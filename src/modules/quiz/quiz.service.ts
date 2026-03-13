import {
  Injectable,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ConfigService } from "@nestjs/config";
import { QuizQuestion } from "./entities/quiz-question.entity";
import { QuizSession } from "./entities/quiz-session.entity";
import { QuizAnswer } from "./entities/quiz-answer.entity";

interface ActiveQuizState {
  sessionId: string;
  chatId: string;
  questions: QuizQuestion[];
  currentIndex: number;
  questionSentAt: number; // timestamp ms
  answersClosed: boolean;
  timer: ReturnType<typeof setTimeout> | null;
  nextTimer: ReturnType<typeof setTimeout> | null;
}

@Injectable()
export class QuizService {
  private readonly logger = new Logger(QuizService.name);
  private activeQuizzes: Map<string, ActiveQuizState> = new Map(); // chatId -> state
  private botToken: string;

  constructor(
    @InjectRepository(QuizQuestion)
    private quizQuestionRepo: Repository<QuizQuestion>,
    @InjectRepository(QuizSession)
    private quizSessionRepo: Repository<QuizSession>,
    @InjectRepository(QuizAnswer)
    private quizAnswerRepo: Repository<QuizAnswer>,
    private configService: ConfigService,
  ) {
    this.botToken = this.configService.get<string>("TELEGRAM_BOT_TOKEN") || "";
  }

  // ==================== ADMIN: QUESTION MANAGEMENT ====================

  /**
   * Parse and import quiz questions from text.
   * Format:
   * 1.{Question text}:
   * a) Option A
   * b) Option B
   * (d) Option D    <-- correct answer has parentheses
   * c) Option C
   */
  async importQuestions(text: string): Promise<{
    imported: number;
    skipped: number;
    errors: string[];
  }> {
    const parsed = this.parseQuizText(text);

    if (parsed.questions.length === 0) {
      throw new BadRequestException(
        `Savollar topilmadi. ${parsed.errors.length > 0 ? "Xatolar: " + parsed.errors.join("; ") : ""}`,
      );
    }

    // Check for duplicates in DB
    const existingQuestions = await this.quizQuestionRepo.find({
      select: ["questionText"],
    });
    const existingSet = new Set(
      existingQuestions.map((q) => q.questionText.toLowerCase().trim()),
    );

    const newQuestions = parsed.questions.filter(
      (q) => !existingSet.has(q.questionText.toLowerCase().trim()),
    );

    if (newQuestions.length === 0) {
      return {
        imported: 0,
        skipped: parsed.questions.length,
        errors: parsed.errors,
      };
    }

    const entities = newQuestions.map((q) =>
      this.quizQuestionRepo.create({
        questionText: q.questionText,
        optionA: q.optionA,
        optionB: q.optionB,
        optionC: q.optionC,
        optionD: q.optionD,
        correctOption: q.correctOption,
      }),
    );

    const saved = await this.quizQuestionRepo.save(entities);

    return {
      imported: saved.length,
      skipped: parsed.questions.length - newQuestions.length,
      errors: parsed.errors,
    };
  }

  private parseQuizText(text: string): {
    questions: Array<{
      questionText: string;
      optionA: string;
      optionB: string;
      optionC: string;
      optionD: string;
      correctOption: string;
    }>;
    errors: string[];
  } {
    const questions: Array<{
      questionText: string;
      optionA: string;
      optionB: string;
      optionC: string;
      optionD: string;
      correctOption: string;
    }> = [];
    const errors: string[] = [];

    const lines = text.split("\n");
    let currentQuestionNum = 0;
    let currentQuestionText = "";
    let options: { [key: string]: string } = {};
    let correctOption = "";

    const saveCurrentQuestion = () => {
      if (!currentQuestionText) return;

      // Remove trailing colon from question text
      currentQuestionText = currentQuestionText.replace(/:\s*$/, "").trim();

      if (!options["a"] || !options["b"] || !options["c"] || !options["d"]) {
        errors.push(
          `Savol #${currentQuestionNum}: 4 ta variant topilmadi`,
        );
        return;
      }
      if (!correctOption) {
        errors.push(
          `Savol #${currentQuestionNum}: To'g'ri javob belgilanmagan`,
        );
        return;
      }

      // Check for duplicate options
      const optionValues = [options["a"], options["b"], options["c"], options["d"]];
      const uniqueOptions = new Set(optionValues.map((o) => o.toLowerCase().trim()));
      if (uniqueOptions.size < 4) {
        errors.push(
          `Savol #${currentQuestionNum}: Takroriy variantlar mavjud`,
        );
        return;
      }

      questions.push({
        questionText: currentQuestionText,
        optionA: options["a"],
        optionB: options["b"],
        optionC: options["c"],
        optionD: options["d"],
        correctOption,
      });
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Check if it's a question number (e.g., "1.", "1.Question text", "1.{Question text}:")
      const questionMatch = line.match(/^(\d+)\.\s*\{?\s*(.+)$/);
      if (questionMatch) {
        // Save previous question
        saveCurrentQuestion();

        currentQuestionNum = parseInt(questionMatch[1]);
        currentQuestionText = questionMatch[2].replace(/\}\s*:?\s*$/, "").trim();
        options = {};
        correctOption = "";
        continue;
      }

      // Check for option with parentheses = correct answer: (a) Option text
      const correctOptionMatch = line.match(/^\(([a-dA-D])\)\s*(.+)$/);
      if (correctOptionMatch) {
        const letter = correctOptionMatch[1].toLowerCase();
        const optionText = correctOptionMatch[2].trim();
        options[letter] = optionText;
        correctOption = letter;
        continue;
      }

      // Check for regular option: a) Option text or A) Option text
      const optionMatch = line.match(/^([a-dA-D])\)\s*(.+)$/);
      if (optionMatch) {
        const letter = optionMatch[1].toLowerCase();
        const optionText = optionMatch[2].trim();
        options[letter] = optionText;
        continue;
      }

      // If we're in a question, append to question text (multi-line questions)
      if (currentQuestionText && !correctOption && Object.keys(options).length === 0) {
        const cleaned = line.replace(/\}\s*:?\s*$/, "").trim();
        currentQuestionText += " " + cleaned;
      }
    }

    // Save last question
    saveCurrentQuestion();

    return { questions, errors };
  }

  async getAllQuestions(page = 1, limit = 50): Promise<{
    questions: QuizQuestion[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const [questions, total] = await this.quizQuestionRepo.findAndCount({
      order: { createdAt: "DESC" },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      questions,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async deleteQuestion(id: string): Promise<void> {
    await this.quizQuestionRepo.delete(id);
  }

  async deleteAllQuestions(): Promise<{ deleted: number }> {
    const count = await this.quizQuestionRepo.count();
    await this.quizQuestionRepo.clear();
    return { deleted: count };
  }

  async getQuestionCount(): Promise<number> {
    return this.quizQuestionRepo.count();
  }

  // ==================== QUIZ SESSION LOGIC ====================

  async startQuiz(chatId: string, numQuestions: number): Promise<string> {
    // Check if quiz already running in this chat
    if (this.activeQuizzes.has(chatId)) {
      return "quiz_already_running";
    }

    // Check available questions
    const totalAvailable = await this.quizQuestionRepo.count();
    if (totalAvailable === 0) {
      return "no_questions";
    }

    if (totalAvailable < numQuestions) {
      numQuestions = totalAvailable;
    }

    // Randomly select questions
    const allQuestions = await this.quizQuestionRepo.find();
    const shuffled = this.shuffleArray([...allQuestions]);
    const selected = shuffled.slice(0, numQuestions);

    // Create session in DB
    const session = this.quizSessionRepo.create({
      chatId,
      totalQuestions: selected.length,
    });
    const savedSession = await this.quizSessionRepo.save(session);

    // Set up active state
    const state: ActiveQuizState = {
      sessionId: savedSession.id,
      chatId,
      questions: selected,
      currentIndex: 0,
      questionSentAt: 0,
      answersClosed: true,
      timer: null,
      nextTimer: null,
    };

    this.activeQuizzes.set(chatId, state);

    // Send first question immediately
    this.sendQuestion(chatId);

    return "started";
  }

  /**
   * Callback data format: "qa:{questionIndex}:{option}"
   * Short enough for Telegram's 64-byte limit.
   * We look up the active quiz by chatId (only one quiz per chat).
   */
  private async sendQuestion(chatId: string) {
    const state = this.activeQuizzes.get(chatId);
    if (!state) return;

    const question = state.questions[state.currentIndex];
    const questionNum = state.currentIndex + 1;
    const total = state.questions.length;
    const idx = state.currentIndex;

    const text =
      `📊 <b>QUIZ #${questionNum}/${total}</b>\n\n` +
      `${question.questionText}\n\n` +
      `A) ${question.optionA}\n` +
      `B) ${question.optionB}\n` +
      `C) ${question.optionC}\n` +
      `D) ${question.optionD}`;

    const inlineKeyboard = [
      [
        { text: "A", callback_data: `qa:${idx}:a` },
        { text: "B", callback_data: `qa:${idx}:b` },
        { text: "C", callback_data: `qa:${idx}:c` },
        { text: "D", callback_data: `qa:${idx}:d` },
      ],
    ];

    await this.sendTelegramMessage(chatId, text, {
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: inlineKeyboard },
    });

    state.questionSentAt = Date.now();
    state.answersClosed = false;

    // Close answers after 15 seconds
    state.timer = setTimeout(() => {
      this.closeAnswers(chatId);
    }, 15000);
  }

  private async closeAnswers(chatId: string) {
    const state = this.activeQuizzes.get(chatId);
    if (!state || state.answersClosed) return;

    state.answersClosed = true;

    const question = state.questions[state.currentIndex];
    const correctLetter = question.correctOption.toUpperCase();
    const correctText =
      correctLetter === "A"
        ? question.optionA
        : correctLetter === "B"
          ? question.optionB
          : correctLetter === "C"
            ? question.optionC
            : question.optionD;

    // Count answers for this question
    const answers = await this.quizAnswerRepo.find({
      where: {
        quizSessionId: state.sessionId,
        questionId: question.id,
      },
    });

    const correctCount = answers.filter((a) => a.isCorrect).length;
    const totalAnswers = answers.length;

    const text =
      `✅ <b>To'g'ri javob: ${correctLetter}) ${correctText}</b>\n\n` +
      `📈 Javob berganlar: ${totalAnswers}\n` +
      `✅ To'g'ri: ${correctCount} | ❌ Noto'g'ri: ${totalAnswers - correctCount}`;

    await this.sendTelegramMessage(chatId, text, { parse_mode: "HTML" });

    // Check if this was the last question
    if (state.currentIndex >= state.questions.length - 1) {
      // Quiz finished - show results after a short delay
      state.nextTimer = setTimeout(() => {
        this.finishQuiz(chatId);
      }, 3000);
    } else {
      // Schedule next question: wait until the next minute mark
      // (60 seconds from when question was sent, minus 15 seconds already passed = 45 seconds)
      state.nextTimer = setTimeout(() => {
        state.currentIndex++;
        this.sendQuestion(chatId);
      }, 45000);
    }
  }

  /**
   * Handle quiz answer from callback query.
   * Called from TelegramService when callback_data starts with "qa:".
   * chatId is used to find the active quiz.
   */
  async handleQuizAnswer(
    chatId: string,
    questionIndex: number,
    option: string,
    userId: string,
    username: string | null,
    callbackQueryId: string,
  ): Promise<void> {
    const state = this.activeQuizzes.get(chatId);

    if (!state) {
      await this.answerCallback(callbackQueryId, "Bu quiz tugagan.", true);
      return;
    }

    if (state.answersClosed) {
      await this.answerCallback(callbackQueryId, "Vaqt tugadi! ⏰", true);
      return;
    }

    // Check if current question matches
    if (state.currentIndex !== questionIndex) {
      await this.answerCallback(callbackQueryId, "Bu savol endi aktiv emas.", true);
      return;
    }

    const currentQuestion = state.questions[state.currentIndex];

    // Check if user already answered this question
    const existing = await this.quizAnswerRepo.findOne({
      where: {
        quizSessionId: state.sessionId,
        questionId: currentQuestion.id,
        userId,
      },
    });

    if (existing) {
      await this.answerCallback(callbackQueryId, "Siz allaqachon javob berdingiz! ✋", true);
      return;
    }

    const isCorrect = option === currentQuestion.correctOption;
    const responseTime = Date.now() - state.questionSentAt;

    // Save answer
    const answer = this.quizAnswerRepo.create({
      quizSessionId: state.sessionId,
      questionId: currentQuestion.id,
      userId,
      username,
      selectedOption: option,
      isCorrect,
      responseTime: responseTime.toString(),
    });
    await this.quizAnswerRepo.save(answer);

    const emoji = isCorrect ? "✅" : "❌";
    await this.answerCallback(callbackQueryId, `${emoji} Javobingiz qabul qilindi!`, false);
  }

  private async finishQuiz(chatId: string) {
    const state = this.activeQuizzes.get(chatId);
    if (!state) return;

    // Mark session as finished
    await this.quizSessionRepo.update(state.sessionId, {
      finishedAt: new Date(),
    });

    // Calculate rankings
    const answers = await this.quizAnswerRepo.find({
      where: { quizSessionId: state.sessionId },
    });

    // Group by user
    const userScores: Map<
      string,
      { username: string | null; correct: number; totalTime: number }
    > = new Map();

    for (const answer of answers) {
      const existing = userScores.get(answer.userId) || {
        username: answer.username,
        correct: 0,
        totalTime: 0,
      };
      if (answer.isCorrect) {
        existing.correct++;
      }
      existing.totalTime += parseInt(answer.responseTime) || 0;
      if (answer.username) {
        existing.username = answer.username;
      }
      userScores.set(answer.userId, existing);
    }

    // Sort by correct answers DESC, then by total time ASC
    const ranked = Array.from(userScores.entries())
      .map(([userId, data]) => ({
        userId,
        username: data.username,
        correct: data.correct,
        totalTime: data.totalTime,
      }))
      .sort((a, b) => {
        if (b.correct !== a.correct) return b.correct - a.correct;
        return a.totalTime - b.totalTime;
      });

    // Build results message
    let resultText = `🏆 <b>QUIZ NATIJALARI</b>\n\n`;
    resultText += `📊 Jami savollar: ${state.questions.length}\n`;
    resultText += `👥 Ishtirokchilar: ${ranked.length}\n\n`;

    if (ranked.length === 0) {
      resultText += "Hech kim javob bermadi.";
    } else {
      const medals = ["🥇", "🥈", "🥉"];

      for (let i = 0; i < ranked.length; i++) {
        const r = ranked[i];
        const medal = i < 3 ? medals[i] : `${i + 1}.`;
        const displayName = r.username ? `@${r.username}` : `User ${r.userId}`;
        resultText += `${medal} ${displayName} — ${r.correct}/${state.questions.length} to'g'ri\n`;
      }
    }

    await this.sendTelegramMessage(chatId, resultText, { parse_mode: "HTML" });

    // Clean up
    if (state.timer) clearTimeout(state.timer);
    if (state.nextTimer) clearTimeout(state.nextTimer);
    this.activeQuizzes.delete(chatId);
  }

  isQuizActive(chatId: string): boolean {
    return this.activeQuizzes.has(chatId);
  }

  /**
   * Stop an active quiz. Returns true if a quiz was stopped, false if none was running.
   */
  async stopQuiz(chatId: string): Promise<boolean> {
    const state = this.activeQuizzes.get(chatId);
    if (!state) return false;

    // Clear timers
    if (state.timer) clearTimeout(state.timer);
    if (state.nextTimer) clearTimeout(state.nextTimer);

    // Mark session as finished in DB
    await this.quizSessionRepo.update(state.sessionId, {
      finishedAt: new Date(),
    });

    // Show partial results if any answers exist
    const answers = await this.quizAnswerRepo.find({
      where: { quizSessionId: state.sessionId },
    });

    if (answers.length > 0) {
      const userScores: Map<
        string,
        { username: string | null; correct: number; totalTime: number }
      > = new Map();

      for (const answer of answers) {
        const existing = userScores.get(answer.userId) || {
          username: answer.username,
          correct: 0,
          totalTime: 0,
        };
        if (answer.isCorrect) existing.correct++;
        existing.totalTime += parseInt(answer.responseTime) || 0;
        if (answer.username) existing.username = answer.username;
        userScores.set(answer.userId, existing);
      }

      const ranked = Array.from(userScores.entries())
        .map(([userId, data]) => ({
          userId,
          username: data.username,
          correct: data.correct,
          totalTime: data.totalTime,
        }))
        .sort((a, b) => {
          if (b.correct !== a.correct) return b.correct - a.correct;
          return a.totalTime - b.totalTime;
        });

      const answeredQuestions = state.currentIndex + (state.answersClosed ? 1 : 0);

      let resultText = `🏆 <b>QUIZ NATIJALARI (to'xtatildi)</b>\n\n`;
      resultText += `📊 Javob berilgan savollar: ${answeredQuestions}/${state.questions.length}\n`;
      resultText += `👥 Ishtirokchilar: ${ranked.length}\n\n`;

      const medals = ["🥇", "🥈", "🥉"];
      for (let i = 0; i < ranked.length; i++) {
        const r = ranked[i];
        const medal = i < 3 ? medals[i] : `${i + 1}.`;
        const displayName = r.username ? `@${r.username}` : `User ${r.userId}`;
        resultText += `${medal} ${displayName} — ${r.correct} to'g'ri\n`;
      }

      await this.sendTelegramMessage(chatId, resultText, { parse_mode: "HTML" });
    }

    this.activeQuizzes.delete(chatId);
    return true;
  }

  // ==================== SESSION HISTORY ====================

  async getSessionHistory(page = 1, limit = 20): Promise<{
    sessions: QuizSession[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const [sessions, total] = await this.quizSessionRepo.findAndCount({
      order: { startedAt: "DESC" },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      sessions,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ==================== TELEGRAM HELPERS ====================

  private async sendTelegramMessage(
    chatId: string,
    text: string,
    options?: {
      parse_mode?: string;
      reply_markup?: any;
    },
  ) {
    if (!this.botToken) return;

    try {
      const res = await fetch(
        `https://api.telegram.org/bot${this.botToken}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text,
            ...options,
          }),
        },
      );
      const data = await res.json();
      if (!data.ok) {
        this.logger.error(`Telegram sendMessage error: ${data.description}`);
      }
    } catch (err) {
      this.logger.error(`Telegram sendMessage exception: ${err.message}`);
    }
  }

  private async answerCallback(
    callbackQueryId: string,
    text: string,
    showAlert: boolean,
  ) {
    if (!this.botToken) return;

    try {
      await fetch(
        `https://api.telegram.org/bot${this.botToken}/answerCallbackQuery`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            callback_query_id: callbackQueryId,
            text,
            show_alert: showAlert,
          }),
        },
      );
    } catch (err) {
      this.logger.error(`answerCallbackQuery error: ${err.message}`);
    }
  }

  private shuffleArray<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }
}
