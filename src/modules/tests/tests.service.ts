import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { UsersService } from "../users/users.service";
import { QuestionsService } from "../questions/questions.service";
import { AchievementsService } from "../achievements/achievements.service";
import { NotificationsService } from "../notifications/notifications.service";
import { StartTestDto } from "./dto/start-test.dto";
import { SubmitTestDto } from "./dto/submit-test.dto";

@Injectable()
export class TestsService {
  constructor(
    private prisma: PrismaService,
    private usersService: UsersService,
    private questionsService: QuestionsService,
    private achievementsService: AchievementsService,
    private notificationsService: NotificationsService
  ) {}

  async startTest(userId: string | null, dto: StartTestDto) {
    // Get random questions
    const questions = await this.questionsService.getRandomQuestionsSimple(
      dto.categoryId || null,
      dto.questionsCount || 10
    );

    if (questions.length === 0) {
      throw new BadRequestException(
        "Bu kategoriyada yetarli savol mavjud emas"
      );
    }

    // Create test attempt (userId can be null for unauthenticated users)
    const testAttempt = await this.prisma.testAttempt.create({
      data: {
        userId: userId || "",
        categoryId: dto.categoryId || null,
        totalQuestions: questions.length,
      },
    });

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
    };
  }

  async submitTest(userId: string, testAttemptId: string, dto: SubmitTestDto) {
    // Get test attempt
    const testAttempt = await this.prisma.testAttempt.findFirst({
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
      const question = await this.prisma.question.findUnique({
        where: { id: answer.questionId },
      });

      if (!question) continue;

      const isCorrect = question.correctAnswer === answer.selectedAnswer;
      if (isCorrect) {
        correctAnswers++;
        totalXP += question.xpReward;
      }

      // Save answer
      await this.prisma.testAnswer.create({
        data: {
          testAttemptId,
          questionId: answer.questionId,
          selectedAnswer: answer.selectedAnswer,
          isCorrect,
          timeSpent: answer.timeSpent,
        },
      });

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
      (correctAnswers / testAttempt.totalQuestions) * 100
    );

    // Update test attempt
    await this.prisma.testAttempt.update({
      where: { id: testAttemptId },
      data: {
        score,
        correctAnswers,
        xpEarned: totalXP,
        timeSpent: dto.totalTimeSpent,
        completedAt: new Date(),
      },
    });

    // Add XP to user (only if authenticated)
    let levelUpInfo: { newLevel: number; totalXP: number } | null = null;
    if (userId && testAttempt.userId) {
      const xpResult = await this.usersService.addXP(userId, totalXP);

      // Update category stats
      if (testAttempt.categoryId) {
        await this.updateCategoryStats(
          userId,
          testAttempt.categoryId,
          correctAnswers,
          testAttempt.totalQuestions,
          totalXP,
          score
        );
      }

      // Check achievements
      await this.achievementsService.checkAchievements(userId);

      // Send level up notification
      if (xpResult.leveledUp) {
        await this.notificationsService.createNotification(userId, {
          title: "Yangi daraja! 🎉",
          message: `Tabriklaymiz! Siz ${xpResult.newLevel}-darajaga ko'tarildingiz!`,
          type: "LEVEL_UP",
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
    const testAttempt = await this.prisma.testAttempt.findFirst({
      where: { id: testAttemptId, userId },
      include: {
        category: {
          select: { id: true, name: true, slug: true, icon: true },
        },
        testAnswers: {
          include: {
            question: {
              select: {
                id: true,
                question: true,
                options: true,
                correctAnswer: true,
                explanation: true,
                difficulty: true,
              },
            },
          },
        },
      },
    });

    if (!testAttempt) {
      throw new NotFoundException("Test topilmadi");
    }

    return testAttempt;
  }

  async getUserTestHistory(userId: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const [tests, total] = await Promise.all([
      this.prisma.testAttempt.findMany({
        where: { userId, completedAt: { not: null } },
        include: {
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
              icon: true,
              color: true,
            },
          },
        },
        orderBy: { completedAt: "desc" },
        skip,
        take: limit,
      }),
      this.prisma.testAttempt.count({
        where: { userId, completedAt: { not: null } },
      }),
    ]);

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
    score: number
  ) {
    const existing = await this.prisma.categoryStat.findUnique({
      where: {
        userId_categoryId: { userId, categoryId },
      },
    });

    if (existing) {
      const newTotalTests = existing.totalTests + 1;
      const newTotalQuestions = existing.totalQuestions + totalQuestions;
      const newCorrectAnswers = existing.correctAnswers + correctAnswers;
      const newTotalXP = existing.totalXP + xpEarned;
      const newAverageScore =
        (existing.averageScore * existing.totalTests + score) / newTotalTests;
      const newBestScore = Math.max(existing.bestScore, score);

      await this.prisma.categoryStat.update({
        where: { id: existing.id },
        data: {
          totalTests: newTotalTests,
          totalQuestions: newTotalQuestions,
          correctAnswers: newCorrectAnswers,
          totalXP: newTotalXP,
          averageScore: newAverageScore,
          bestScore: newBestScore,
        },
      });
    } else {
      await this.prisma.categoryStat.create({
        data: {
          userId,
          categoryId,
          totalTests: 1,
          totalQuestions,
          correctAnswers,
          totalXP: xpEarned,
          averageScore: score,
          bestScore: score,
        },
      });
    }
  }
}
