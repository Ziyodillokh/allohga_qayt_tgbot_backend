import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, IsNull, Not } from "typeorm";
import { UsersService } from "../users/users.service";
import { QuestionsService } from "../questions/questions.service";
import { AchievementsService } from "../achievements/achievements.service";
import { NotificationsService } from "../notifications/notifications.service";
import { StartTestDto } from "./dto/start-test.dto";
import { SubmitTestDto } from "./dto/submit-test.dto";
import { TestAttempt, TestAnswer } from "./entities";
import { Question } from "../questions/entities";
import { Category, CategoryStat } from "../categories/entities";
import { NotificationType } from "../notifications/entities/notification.entity";

@Injectable()
export class TestsService {
  constructor(
    @InjectRepository(TestAttempt)
    private testAttemptRepository: Repository<TestAttempt>,
    @InjectRepository(TestAnswer)
    private testAnswerRepository: Repository<TestAnswer>,
    @InjectRepository(Question)
    private questionRepository: Repository<Question>,
    @InjectRepository(CategoryStat)
    private categoryStatRepository: Repository<CategoryStat>,
    @InjectRepository(Category)
    private categoryRepository: Repository<Category>,
    private usersService: UsersService,
    private questionsService: QuestionsService,
    private achievementsService: AchievementsService,
    private notificationsService: NotificationsService,
  ) {}

  async saveTestResult(
    userId: string | null,
    dto: {
      categorySlug: string;
      score: number;
      totalQuestions: number;
      totalXP: number;
      answers: { questionId: string; answer: number; isCorrect: boolean }[];
    },
  ) {
    // Find category by slug (aralash/mixed = barcha kategoriyalar)
    const isMixed =
      dto.categorySlug === "aralash" || dto.categorySlug === "mixed";
    let category = null;

    if (!isMixed) {
      category = await this.categoryRepository.findOne({
        where: { slug: dto.categorySlug },
      });

      if (!category) {
        throw new NotFoundException("Kategoriya topilmadi");
      }
    }

    // Server-side XP hisoblash — client ma'lumotlariga ishonmaymiz
    let serverScore = 0;
    let serverTotalXP = 0;
    const verifiedAnswers: { questionId: string; selectedAnswer: number; isCorrect: boolean }[] = [];

    for (const answer of dto.answers) {
      const question = await this.questionRepository.findOne({
        where: { id: answer.questionId },
      });

      if (!question) continue;

      const isCorrect = question.correctAnswer === answer.answer;
      if (isCorrect) {
        serverScore++;
        serverTotalXP += question.xpReward;
      }

      verifiedAnswers.push({
        questionId: answer.questionId,
        selectedAnswer: answer.answer,
        isCorrect,
      });
    }

    const totalQuestions = verifiedAnswers.length;

    // Create test attempt record with server-calculated values
    const testAttempt = this.testAttemptRepository.create({
      userId: userId || null,
      categoryId: category?.id || null,
      totalQuestions,
      correctAnswers: serverScore,
      score: totalQuestions > 0 ? Math.round((serverScore / totalQuestions) * 100) : 0,
      xpEarned: serverTotalXP,
      completedAt: new Date(),
    });

    await this.testAttemptRepository.save(testAttempt);

    // Save verified answers
    for (const answer of verifiedAnswers) {
      const testAnswer = this.testAnswerRepository.create({
        testAttemptId: testAttempt.id,
        questionId: answer.questionId,
        selectedAnswer: answer.selectedAnswer,
        isCorrect: answer.isCorrect,
      });
      await this.testAnswerRepository.save(testAnswer);
    }

    // If user is authenticated, update their stats
    if (userId) {
      // Add server-calculated XP
      await this.usersService.addXP(userId, serverTotalXP);
      // 1 ta test yakunlandi (har bir savol emas!)
      await this.usersService.incrementTestsCompleted(userId, 1);

      // Update category stats
      if (category?.id) {
        await this.updateCategoryStats(
          userId,
          category.id,
          serverScore,
          totalQuestions,
          serverTotalXP,
          totalQuestions > 0 ? Math.round((serverScore / totalQuestions) * 100) : 0,
        );
      }

      // Check achievements
      await this.achievementsService.checkAchievements(userId);
    }

    return {
      success: true,
      testAttemptId: testAttempt.id,
      score: serverScore,
      totalQuestions,
      percentage: totalQuestions > 0 ? Math.round((serverScore / totalQuestions) * 100) : 0,
      xpEarned: serverTotalXP,
    };
  }

  async startTest(userId: string | null, dto: StartTestDto) {
    // Get random questions
    const questions = await this.questionsService.getRandomQuestionsSimple(
      dto.categoryId || null,
      dto.questionsCount || 10,
    );

    if (questions.length === 0) {
      throw new BadRequestException(
        "Bu kategoriyada yetarli savol mavjud emas",
      );
    }

    // Get category name
    let categoryName = "Aralash test";
    if (dto.categoryId) {
      const category = await this.categoryRepository.findOne({
        where: { id: dto.categoryId },
      });
      if (category) categoryName = category.name;
    }

    // Create test attempt (userId can be null for unauthenticated users)
    const testAttempt = this.testAttemptRepository.create({
      userId: userId || null,
      categoryId: dto.categoryId || null,
      totalQuestions: questions.length,
      questionIds: questions.map((q: any) => q.id),
    });
    await this.testAttemptRepository.save(testAttempt);

    // Return questions without correct answers
    const questionsForUser = questions.map((q: any) => ({
      id: q.id,
      question: q.question,
      options: q.options,
      difficulty: q.difficulty,
      levelIndex: q.levelIndex,
      xpReward: q.xpReward,
      category: q.category,
    }));

    return {
      testAttemptId: testAttempt.id,
      questions: questionsForUser,
      totalQuestions: questions.length,
      categoryName,
    };
  }

  async getTestAttempt(testAttemptId: string) {
    const testAttempt = await this.testAttemptRepository.findOne({
      where: { id: testAttemptId },
      relations: ["category"],
    });

    if (!testAttempt) {
      throw new NotFoundException("Test topilmadi");
    }

    // Get questions by ids
    const questions = await this.questionRepository.findByIds(
      testAttempt.questionIds,
    );

    // Get category name
    const categoryName = testAttempt.category
      ? testAttempt.category.name
      : "Aralash test";

    // Return questions without correct answers
    const questionsForUser = questions.map((q) => ({
      id: q.id,
      question: q.question,
      options: q.options,
      difficulty: q.difficulty,
      levelIndex: q.levelIndex,
      xpReward: q.xpReward,
    }));

    return {
      testAttemptId: testAttempt.id,
      questions: questionsForUser,
      totalQuestions: testAttempt.totalQuestions,
      categoryName,
    };
  }

  async submitTest(userId: string, testAttemptId: string, dto: SubmitTestDto) {
    // Get test attempt
    const testAttempt = await this.testAttemptRepository.findOne({
      where: { id: testAttemptId, userId: userId || undefined },
    });

    if (!testAttempt) {
      throw new NotFoundException("Test topilmadi");
    }

    if (testAttempt.completedAt) {
      throw new BadRequestException("Bu test allaqachon yakunlangan");
    }

    // Process answers
    let totalXP = 0;
    let correctAnswers = 0;
    const results: any[] = [];

    for (const answer of dto.answers) {
      const question = await this.questionRepository.findOne({
        where: { id: answer.questionId },
      });

      if (!question) continue;

      const isCorrect = question.correctAnswer === answer.selectedAnswer;
      if (isCorrect) {
        correctAnswers++;
        totalXP += question.xpReward;
      }

      // Save answer
      const testAnswer = this.testAnswerRepository.create({
        testAttemptId,
        questionId: answer.questionId,
        selectedAnswer: answer.selectedAnswer,
        isCorrect,
        timeSpent: answer.timeSpent,
      });
      await this.testAnswerRepository.save(testAnswer);

      results.push({
        questionId: answer.questionId,
        question: question.question,
        options: question.options,
        selectedAnswer: answer.selectedAnswer,
        correctAnswer: question.correctAnswer,
        isCorrect,
        explanation: question.explanation,
        xpEarned: isCorrect ? question.xpReward : 0,
      });
    }

    // Calculate score (percentage)
    const score = Math.round(
      (correctAnswers / testAttempt.totalQuestions) * 100,
    );

    // Update test attempt
    await this.testAttemptRepository.update(testAttemptId, {
      score,
      correctAnswers,
      xpEarned: totalXP,
      timeSpent: dto.totalTimeSpent,
      completedAt: new Date(),
    });

    // Add XP to user (only if authenticated)
    let levelUpInfo: { newLevel: number; totalXP: number } | null = null;
    if (userId && testAttempt.userId) {
      const xpResult = await this.usersService.addXP(userId, totalXP);

      // Increment user's testsCompleted count
      await this.usersService.incrementTestsCompleted(userId);

      // Update category stats
      if (testAttempt.categoryId) {
        await this.updateCategoryStats(
          userId,
          testAttempt.categoryId,
          correctAnswers,
          testAttempt.totalQuestions,
          totalXP,
          score,
        );
      }

      // Check achievements
      await this.achievementsService.checkAchievements(userId);

      // Send level up notification
      if (xpResult.leveledUp) {
        await this.notificationsService.createNotification(userId, {
          title: "Yangi daraja! 🎉",
          message: `Tabriklaymiz! Siz ${xpResult.newLevel}-darajaga ko'tarildingiz!`,
          type: NotificationType.LEVEL_UP,
          data: { level: xpResult.newLevel },
        });

        levelUpInfo = {
          newLevel: xpResult.newLevel,
          totalXP: xpResult.newXP,
        };
      }
    }

    return {
      testAttemptId,
      score,
      totalQuestions: testAttempt.totalQuestions,
      correctAnswers,
      xpEarned: totalXP,
      results,
      levelUp: levelUpInfo,
    };
  }

  async getTestResult(userId: string, testAttemptId: string) {
    const testAttempt = await this.testAttemptRepository.findOne({
      where: { id: testAttemptId, userId },
      relations: ["category", "testAnswers", "testAnswers.question"],
    });

    if (!testAttempt) {
      throw new NotFoundException("Test topilmadi");
    }

    return testAttempt;
  }

  async getUserTestHistory(userId: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const [tests, total] = await this.testAttemptRepository.findAndCount({
      where: { userId, completedAt: Not(IsNull()) },
      relations: ["category"],
      order: { completedAt: "DESC" },
      skip,
      take: limit,
    });

    return {
      tests,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  private async updateCategoryStats(
    userId: string,
    categoryId: string,
    correctAnswers: number,
    totalQuestions: number,
    xpEarned: number,
    score: number,
  ) {
    const existing = await this.categoryStatRepository.findOne({
      where: { userId, categoryId },
    });

    if (existing) {
      const newTotalTests = existing.totalTests + 1;
      const newTotalQuestions = existing.totalQuestions + totalQuestions;
      const newCorrectAnswers = existing.correctAnswers + correctAnswers;
      const newTotalXP = existing.totalXP + xpEarned;
      const newAverageScore =
        (existing.averageScore * existing.totalTests + score) / newTotalTests;
      const newBestScore = Math.max(existing.bestScore, score);

      await this.categoryStatRepository.update(existing.id, {
        totalTests: newTotalTests,
        totalQuestions: newTotalQuestions,
        correctAnswers: newCorrectAnswers,
        totalXP: newTotalXP,
        averageScore: newAverageScore,
        bestScore: newBestScore,
      });
    } else {
      const categoryStat = this.categoryStatRepository.create({
        userId,
        categoryId,
        totalTests: 1,
        totalQuestions,
        correctAnswers,
        totalXP: xpEarned,
        averageScore: score,
        bestScore: score,
      });
      await this.categoryStatRepository.save(categoryStat);
    }
  }
}
