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
import { QuizSettings } from "./entities/quiz-settings.entity";

interface ActiveQuizState {
  sessionId: string;
  chatId: string;
  questions: QuizQuestion[];
  currentIndex: number;
  questionSentAt: number;
  answersClosed: boolean;
  timer: ReturnType<typeof setTimeout> | null;
  nextTimer: ReturnType<typeof setTimeout> | null;
  countdownTimers: ReturnType<typeof setTimeout>[];
  currentMessageId: number | null;
  messageIds: number[];
  answerTimeSeconds: number;
  waitTimeSeconds: number;
}

@Injectable()
export class QuizService {
  private readonly logger = new Logger(QuizService.name);
  private activeQuizzes: Map<string, ActiveQuizState> = new Map();
  private botToken: string;
  // Keep messageIds after quiz ends for /clean
  private chatMessageIds: Map<string, number[]> = new Map();

  constructor(
    @InjectRepository(QuizQuestion)
    private quizQuestionRepo: Repository<QuizQuestion>,
    @InjectRepository(QuizSession)
    private quizSessionRepo: Repository<QuizSession>,
    @InjectRepository(QuizAnswer)
    private quizAnswerRepo: Repository<QuizAnswer>,
    @InjectRepository(QuizSettings)
    private quizSettingsRepo: Repository<QuizSettings>,
    private configService: ConfigService,
  ) {
    this.botToken = this.configService.get<string>("TELEGRAM_BOT_TOKEN") || "";
  }

  // ==================== SETTINGS ====================

  async getSettings(): Promise<QuizSettings> {
    let settings = await this.quizSettingsRepo.findOne({ where: { id: 1 } });
    if (!settings) {
      settings = this.quizSettingsRepo.create({
        id: 1,
        answerTimeSeconds: 15,
        waitTimeSeconds: 45,
      });
      settings = await this.quizSettingsRepo.save(settings);
    }
    return settings;
  }

  async updateSettings(data: {
    answerTimeSeconds?: number;
    waitTimeSeconds?: number;
  }): Promise<QuizSettings> {
    let settings = await this.getSettings();
    if (data.answerTimeSeconds !== undefined) {
      settings.answerTimeSeconds = Math.max(5, Math.min(120, data.answerTimeSeconds));
    }
    if (data.waitTimeSeconds !== undefined) {
      settings.waitTimeSeconds = Math.max(5, Math.min(300, data.waitTimeSeconds));
    }
    return this.quizSettingsRepo.save(settings);
  }

  // ==================== ADMIN: QUESTION MANAGEMENT ====================

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

      currentQuestionText = currentQuestionText.replace(/:\s*$/, "").trim();

      if (!options["a"] || !options["b"] || !options["c"] || !options["d"]) {
        errors.push(`Savol #${currentQuestionNum}: 4 ta variant topilmadi`);
        return;
      }
      if (!correctOption) {
        errors.push(`Savol #${currentQuestionNum}: To'g'ri javob belgilanmagan`);
        return;
      }

      const optionValues = [options["a"], options["b"], options["c"], options["d"]];
      const uniqueOptions = new Set(optionValues.map((o) => o.toLowerCase().trim()));
      if (uniqueOptions.size < 4) {
        errors.push(`Savol #${currentQuestionNum}: Takroriy variantlar mavjud`);
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

      const questionMatch = line.match(/^(\d+)\.\s*\{?\s*(.+)$/);
      if (questionMatch) {
        saveCurrentQuestion();
        currentQuestionNum = parseInt(questionMatch[1]);
        currentQuestionText = questionMatch[2].replace(/\}\s*:?\s*$/, "").trim();
        options = {};
        correctOption = "";
        continue;
      }

      const correctOptionMatch = line.match(/^\(([a-dA-D])\)\s*(.+)$/);
      if (correctOptionMatch) {
        const letter = correctOptionMatch[1].toLowerCase();
        const optionText = correctOptionMatch[2].trim();
        options[letter] = optionText;
        correctOption = letter;
        continue;
      }

      const optionMatch = line.match(/^([a-dA-D])\)\s*(.+)$/);
      if (optionMatch) {
        const letter = optionMatch[1].toLowerCase();
        const optionText = optionMatch[2].trim();
        options[letter] = optionText;
        continue;
      }

      if (currentQuestionText && !correctOption && Object.keys(options).length === 0) {
        const cleaned = line.replace(/\}\s*:?\s*$/, "").trim();
        currentQuestionText += " " + cleaned;
      }
    }

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

    return { questions, total, page, totalPages: Math.ceil(total / limit) };
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

  // ==================== LEADERBOARD ====================

  async getLeaderboard(limit = 10): Promise<
    Array<{
      userId: string;
      username: string | null;
      correctCount: number;
      totalAnswers: number;
      accuracy: number;
    }>
  > {
    const results = await this.quizAnswerRepo
      .createQueryBuilder("a")
      .select("a.userId", "userId")
      .addSelect("MAX(a.username)", "username")
      .addSelect("SUM(CASE WHEN a.isCorrect = true THEN 1 ELSE 0 END)", "correctCount")
      .addSelect("COUNT(*)", "totalAnswers")
      .groupBy("a.userId")
      .orderBy('"correctCount"', "DESC")
      .addOrderBy('"totalAnswers"', "DESC")
      .limit(limit)
      .getRawMany();

    return results.map((r) => ({
      userId: r.userId,
      username: r.username,
      correctCount: parseInt(r.correctCount) || 0,
      totalAnswers: parseInt(r.totalAnswers) || 0,
      accuracy:
        parseInt(r.totalAnswers) > 0
          ? Math.round((parseInt(r.correctCount) / parseInt(r.totalAnswers)) * 100)
          : 0,
    }));
  }

  // ==================== QUIZ SESSION LOGIC ====================

  async startQuiz(chatId: string, numQuestions: number): Promise<string> {
    if (this.activeQuizzes.has(chatId)) {
      return "quiz_already_running";
    }

    const totalAvailable = await this.quizQuestionRepo.count();
    if (totalAvailable === 0) {
      return "no_questions";
    }

    if (totalAvailable < numQuestions) {
      numQuestions = totalAvailable;
    }

    const allQuestions = await this.quizQuestionRepo.find();
    const shuffled = this.shuffleArray([...allQuestions]);
    const selected = shuffled.slice(0, numQuestions);

    // Load settings
    const settings = await this.getSettings();

    const session = this.quizSessionRepo.create({
      chatId,
      totalQuestions: selected.length,
    });
    const savedSession = await this.quizSessionRepo.save(session);

    const state: ActiveQuizState = {
      sessionId: savedSession.id,
      chatId,
      questions: selected,
      currentIndex: 0,
      questionSentAt: 0,
      answersClosed: true,
      timer: null,
      nextTimer: null,
      countdownTimers: [],
      currentMessageId: null,
      messageIds: [],
      answerTimeSeconds: settings.answerTimeSeconds,
      waitTimeSeconds: settings.waitTimeSeconds,
    };

    this.activeQuizzes.set(chatId, state);
    this.chatMessageIds.set(chatId, []);

    // Send quiz start announcement
    const startText =
      `🏁 <b>QUIZ BOSHLANDI!</b>\n\n` +
      `📊 Savollar soni: <b>${selected.length}</b>\n` +
      `⏱ Har bir savol: <b>${settings.answerTimeSeconds} sekund</b>\n` +
      `⏳ Savollar oralig'i: <b>${settings.answerTimeSeconds + settings.waitTimeSeconds} sekund</b>\n\n` +
      `🔵 Tayyor bo'ling! Birinchi savol kelmoqda...`;

    const startMsg = await this.sendTelegramMessage(chatId, startText, {
      parse_mode: "HTML",
    });
    if (startMsg) {
      state.messageIds.push(startMsg);
      this.chatMessageIds.get(chatId)?.push(startMsg);
    }

    // Send first question after 3 seconds
    state.nextTimer = setTimeout(() => {
      this.sendQuestion(chatId);
    }, 3000);

    return "started";
  }

  private buildQuestionText(
    question: QuizQuestion,
    questionNum: number,
    total: number,
    remainingSeconds: number,
    answerTimeSeconds: number,
    showAnswer = false,
    stats?: { total: number; correct: number },
  ): string {
    const options = [
      { letter: "A", text: question.optionA, key: "a" },
      { letter: "B", text: question.optionB, key: "b" },
      { letter: "C", text: question.optionC, key: "c" },
      { letter: "D", text: question.optionD, key: "d" },
    ];

    let text = `━━━━━━━━━━━━━━━━━━━━\n`;
    text += `📊 <b>SAVOL ${questionNum}/${total}</b>\n`;
    text += `━━━━━━━━━━━━━━━━━━━━\n\n`;
    text += `❓ <b>${question.questionText}</b>\n\n`;

    for (const opt of options) {
      if (showAnswer && opt.key === question.correctOption) {
        text += `✅ <b>${opt.letter}) ${opt.text}</b>\n`;
      } else if (showAnswer) {
        text += `▫️ ${opt.letter}) ${opt.text}\n`;
      } else {
        text += `🔹 ${opt.letter}) ${opt.text}\n`;
      }
    }

    text += `\n`;

    if (showAnswer) {
      const incorrect = (stats?.total || 0) - (stats?.correct || 0);
      text += `━━━━━━━━━━━━━━━━━━━━\n`;
      text += `📈 Javoblar: ${stats?.total || 0} | ✅ ${stats?.correct || 0} | ❌ ${incorrect}\n`;
      text += `⏰ Vaqt tugadi!`;
    } else {
      const bar = this.getProgressBar(remainingSeconds, answerTimeSeconds);
      const clockEmoji = this.getClockEmoji(remainingSeconds, answerTimeSeconds);
      text += `${clockEmoji} ${bar} <b>${remainingSeconds}s</b>`;
    }

    return text;
  }

  private getProgressBar(remaining: number, total: number): string {
    const totalBlocks = 15;
    const filled = Math.max(0, Math.round((remaining / total) * totalBlocks));
    const empty = totalBlocks - filled;
    return "▓".repeat(filled) + "░".repeat(empty);
  }

  private getClockEmoji(remaining: number, total: number): string {
    const ratio = remaining / total;
    if (ratio > 0.66) return "🟢";
    if (ratio > 0.33) return "🟡";
    return "🔴";
  }

  private async sendQuestion(chatId: string) {
    const state = this.activeQuizzes.get(chatId);
    if (!state) return;

    const question = state.questions[state.currentIndex];
    const questionNum = state.currentIndex + 1;
    const total = state.questions.length;
    const idx = state.currentIndex;

    const text = this.buildQuestionText(
      question,
      questionNum,
      total,
      state.answerTimeSeconds,
      state.answerTimeSeconds,
    );

    const inlineKeyboard = [
      [
        { text: "🔵 A", callback_data: `qa:${idx}:a` },
        { text: "🔵 B", callback_data: `qa:${idx}:b` },
      ],
      [
        { text: "🔵 C", callback_data: `qa:${idx}:c` },
        { text: "🔵 D", callback_data: `qa:${idx}:d` },
      ],
    ];

    const msgId = await this.sendTelegramMessage(chatId, text, {
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: inlineKeyboard },
    });

    state.questionSentAt = Date.now();
    state.answersClosed = false;
    state.currentMessageId = msgId;

    if (msgId) {
      state.messageIds.push(msgId);
      this.chatMessageIds.get(chatId)?.push(msgId);
    }

    // Schedule countdown updates
    this.scheduleCountdown(chatId);
  }

  private scheduleCountdown(chatId: string) {
    const state = this.activeQuizzes.get(chatId);
    if (!state) return;

    // Clear any existing countdown timers
    for (const t of state.countdownTimers) {
      clearTimeout(t);
    }
    state.countdownTimers = [];

    const answerTime = state.answerTimeSeconds;

    // Update at 2/3 and 1/3 remaining, and close at 0
    const updatePoints = [
      Math.round(answerTime * 0.33), // 2/3 elapsed → 1/3 remaining
      Math.round(answerTime * 0.66), // 1/3 elapsed → 2/3 remaining
    ].sort((a, b) => a - b);

    for (const elapsed of updatePoints) {
      if (elapsed > 0 && elapsed < answerTime) {
        const timer = setTimeout(() => {
          this.updateCountdownMessage(chatId);
        }, elapsed * 1000);
        state.countdownTimers.push(timer);
      }
    }

    // Close answers at the end
    state.timer = setTimeout(() => {
      this.closeAnswers(chatId);
    }, answerTime * 1000);
  }

  private async updateCountdownMessage(chatId: string) {
    const state = this.activeQuizzes.get(chatId);
    if (!state || state.answersClosed || !state.currentMessageId) return;

    const elapsed = Math.floor((Date.now() - state.questionSentAt) / 1000);
    const remaining = Math.max(0, state.answerTimeSeconds - elapsed);

    const question = state.questions[state.currentIndex];
    const questionNum = state.currentIndex + 1;
    const total = state.questions.length;

    const text = this.buildQuestionText(
      question,
      questionNum,
      total,
      remaining,
      state.answerTimeSeconds,
    );

    const idx = state.currentIndex;
    const inlineKeyboard = [
      [
        { text: "🔵 A", callback_data: `qa:${idx}:a` },
        { text: "🔵 B", callback_data: `qa:${idx}:b` },
      ],
      [
        { text: "🔵 C", callback_data: `qa:${idx}:c` },
        { text: "🔵 D", callback_data: `qa:${idx}:d` },
      ],
    ];

    await this.editTelegramMessage(chatId, state.currentMessageId, text, {
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: inlineKeyboard },
    });
  }

  private async closeAnswers(chatId: string) {
    const state = this.activeQuizzes.get(chatId);
    if (!state || state.answersClosed) return;

    state.answersClosed = true;

    // Clear countdown timers
    for (const t of state.countdownTimers) {
      clearTimeout(t);
    }
    state.countdownTimers = [];

    const question = state.questions[state.currentIndex];

    // Count answers for this question
    const answers = await this.quizAnswerRepo.find({
      where: {
        quizSessionId: state.sessionId,
        questionId: question.id,
      },
    });

    const correctCount = answers.filter((a) => a.isCorrect).length;
    const totalAnswers = answers.length;
    const questionNum = state.currentIndex + 1;
    const total = state.questions.length;

    // Edit the question message to show the correct answer
    const text = this.buildQuestionText(
      question,
      questionNum,
      total,
      0,
      state.answerTimeSeconds,
      true,
      { total: totalAnswers, correct: correctCount },
    );

    if (state.currentMessageId) {
      // Remove buttons and show answer
      await this.editTelegramMessage(chatId, state.currentMessageId, text, {
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: [] },
      });
    }

    // Save messageIds to DB periodically
    await this.saveMessageIds(state);

    // Check if this was the last question
    if (state.currentIndex >= state.questions.length - 1) {
      state.nextTimer = setTimeout(() => {
        this.finishQuiz(chatId);
      }, 5000);
    } else {
      // Schedule next question
      state.nextTimer = setTimeout(() => {
        state.currentIndex++;
        this.sendQuestion(chatId);
      }, state.waitTimeSeconds * 1000);
    }
  }

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
      await this.answerCallback(callbackQueryId, "⏰ Vaqt tugadi!", true);
      return;
    }

    if (state.currentIndex !== questionIndex) {
      await this.answerCallback(callbackQueryId, "Bu savol endi aktiv emas.", true);
      return;
    }

    const currentQuestion = state.questions[state.currentIndex];

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

    // Don't reveal if correct or not — just confirm received
    await this.answerCallback(callbackQueryId, "✅ Javobingiz qabul qilindi!", false);
  }

  private async finishQuiz(chatId: string) {
    const state = this.activeQuizzes.get(chatId);
    if (!state) return;

    await this.quizSessionRepo.update(state.sessionId, {
      finishedAt: new Date(),
    });

    const answers = await this.quizAnswerRepo.find({
      where: { quizSessionId: state.sessionId },
    });

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

    let resultText = `\n🏆 <b>QUIZ NATIJALARI</b>\n`;
    resultText += `━━━━━━━━━━━━━━━━━━━━\n\n`;
    resultText += `📊 Jami savollar: <b>${state.questions.length}</b>\n`;
    resultText += `👥 Ishtirokchilar: <b>${ranked.length}</b>\n\n`;

    if (ranked.length === 0) {
      resultText += "😔 Hech kim javob bermadi.\n";
    } else {
      const medals = ["🥇", "🥈", "🥉"];

      for (let i = 0; i < Math.min(ranked.length, 20); i++) {
        const r = ranked[i];
        const medal = i < 3 ? medals[i] : `<b>${i + 1}.</b>`;
        const displayName = r.username ? `@${r.username}` : `Foydalanuvchi`;
        const timeStr = (r.totalTime / 1000).toFixed(1);
        resultText += `${medal} ${displayName} — <b>${r.correct}/${state.questions.length}</b> ✅ (${timeStr}s)\n`;
      }
    }

    resultText += `\n━━━━━━━━━━━━━━━━━━━━\n`;
    resultText += `💡 /clean — Quiz xabarlarini tozalash\n`;
    resultText += `💡 /rayting — Umumiy reyting (TOP 10)`;

    const msgId = await this.sendTelegramMessage(chatId, resultText, {
      parse_mode: "HTML",
    });
    if (msgId) {
      state.messageIds.push(msgId);
      this.chatMessageIds.get(chatId)?.push(msgId);
    }

    // Save final messageIds to DB
    await this.saveMessageIds(state);

    // Clean up timers
    if (state.timer) clearTimeout(state.timer);
    if (state.nextTimer) clearTimeout(state.nextTimer);
    for (const t of state.countdownTimers) clearTimeout(t);
    this.activeQuizzes.delete(chatId);
  }

  isQuizActive(chatId: string): boolean {
    return this.activeQuizzes.has(chatId);
  }

  async stopQuiz(chatId: string): Promise<boolean> {
    const state = this.activeQuizzes.get(chatId);
    if (!state) return false;

    if (state.timer) clearTimeout(state.timer);
    if (state.nextTimer) clearTimeout(state.nextTimer);
    for (const t of state.countdownTimers) clearTimeout(t);

    await this.quizSessionRepo.update(state.sessionId, {
      finishedAt: new Date(),
    });

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

      let resultText = `\n🛑 <b>QUIZ TO'XTATILDI</b>\n`;
      resultText += `━━━━━━━━━━━━━━━━━━━━\n\n`;
      resultText += `📊 Javob berilgan savollar: <b>${answeredQuestions}/${state.questions.length}</b>\n`;
      resultText += `👥 Ishtirokchilar: <b>${ranked.length}</b>\n\n`;

      const medals = ["🥇", "🥈", "🥉"];
      for (let i = 0; i < Math.min(ranked.length, 20); i++) {
        const r = ranked[i];
        const medal = i < 3 ? medals[i] : `<b>${i + 1}.</b>`;
        const displayName = r.username ? `@${r.username}` : `Foydalanuvchi`;
        const timeStr = (r.totalTime / 1000).toFixed(1);
        resultText += `${medal} ${displayName} — <b>${r.correct}</b> ✅ (${timeStr}s)\n`;
      }

      resultText += `\n💡 /clean — Quiz xabarlarini tozalash`;

      const msgId = await this.sendTelegramMessage(chatId, resultText, {
        parse_mode: "HTML",
      });
      if (msgId) {
        state.messageIds.push(msgId);
        this.chatMessageIds.get(chatId)?.push(msgId);
      }
    }

    // Save messageIds to DB
    await this.saveMessageIds(state);

    this.activeQuizzes.delete(chatId);
    return true;
  }

  // ==================== /clean — Delete quiz messages ====================

  async cleanQuizMessages(chatId: string): Promise<number> {
    // Get from memory first
    let messageIds = this.chatMessageIds.get(chatId) || [];

    // If not in memory, try to load from the last session
    if (messageIds.length === 0) {
      const lastSession = await this.quizSessionRepo.findOne({
        where: { chatId },
        order: { startedAt: "DESC" },
      });
      if (lastSession && lastSession.messageIds) {
        try {
          messageIds = JSON.parse(lastSession.messageIds);
        } catch {
          messageIds = [];
        }
      }
    }

    let deleted = 0;
    for (const msgId of messageIds) {
      const success = await this.deleteTelegramMessage(chatId, msgId);
      if (success) deleted++;
    }

    // Clear stored IDs
    this.chatMessageIds.delete(chatId);

    return deleted;
  }

  // ==================== /rayting — All-time leaderboard message ====================

  async getLeaderboardText(): Promise<string> {
    const leaders = await this.getLeaderboard(10);

    let text = `🏆 <b>UMUMIY REYTING (TOP 10)</b>\n`;
    text += `━━━━━━━━━━━━━━━━━━━━\n\n`;

    if (leaders.length === 0) {
      text += "Hali hech kim quiz o'ynamagan.\n";
    } else {
      const medals = ["🥇", "🥈", "🥉"];

      for (let i = 0; i < leaders.length; i++) {
        const l = leaders[i];
        const medal = i < 3 ? medals[i] : `<b>${i + 1}.</b>`;
        const displayName = l.username ? `@${l.username}` : `Foydalanuvchi`;
        text += `${medal} ${displayName} — <b>${l.correctCount}</b> ✅ to'g'ri (${l.accuracy}%)\n`;
      }
    }

    text += `\n━━━━━━━━━━━━━━━━━━━━\n`;
    text += `📊 Barcha quiz natijalari asosida`;

    return text;
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

    return { sessions, total, page, totalPages: Math.ceil(total / limit) };
  }

  // ==================== HELPERS ====================

  private async saveMessageIds(state: ActiveQuizState) {
    try {
      await this.quizSessionRepo.update(state.sessionId, {
        messageIds: JSON.stringify(state.messageIds),
      });
    } catch (err) {
      this.logger.error(`Failed to save messageIds: ${err.message}`);
    }
  }

  private async sendTelegramMessage(
    chatId: string,
    text: string,
    options?: {
      parse_mode?: string;
      reply_markup?: any;
    },
  ): Promise<number | null> {
    if (!this.botToken) return null;

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
        return null;
      }
      return data.result?.message_id || null;
    } catch (err) {
      this.logger.error(`Telegram sendMessage exception: ${err.message}`);
      return null;
    }
  }

  private async editTelegramMessage(
    chatId: string,
    messageId: number,
    text: string,
    options?: {
      parse_mode?: string;
      reply_markup?: any;
    },
  ): Promise<boolean> {
    if (!this.botToken) return false;

    try {
      const res = await fetch(
        `https://api.telegram.org/bot${this.botToken}/editMessageText`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            message_id: messageId,
            text,
            ...options,
          }),
        },
      );
      const data = await res.json();
      if (!data.ok) {
        this.logger.warn(`editMessageText error: ${data.description}`);
        return false;
      }
      return true;
    } catch (err) {
      this.logger.error(`editMessageText exception: ${err.message}`);
      return false;
    }
  }

  private async deleteTelegramMessage(
    chatId: string,
    messageId: number,
  ): Promise<boolean> {
    if (!this.botToken) return false;

    try {
      const res = await fetch(
        `https://api.telegram.org/bot${this.botToken}/deleteMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            message_id: messageId,
          }),
        },
      );
      const data = await res.json();
      return data.ok === true;
    } catch {
      return false;
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
