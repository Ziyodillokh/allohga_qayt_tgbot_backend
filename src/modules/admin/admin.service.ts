import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import {} from "@prisma/client";
import { NotificationsService } from "../notifications/notifications.service";
import { MailService } from "../mail/mail.service";
import { TelegramService } from "../telegram/telegram.service";

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
    private mailService: MailService,
    private telegramService: TelegramService
  ) {}

  // ==================== DASHBOARD ====================
  async getDashboardStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const monthAgo = new Date();
    monthAgo.setMonth(monthAgo.getMonth() - 1);

    const [
      totalUsers,
      todayUsers,
      weekUsers,
      totalTests,
      todayTests,
      totalQuestions,
      totalCategories,
      totalAIChats,
      todayAIChats,
      avgTestScore,
      topCategories,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { createdAt: { gte: today } } }),
      this.prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
      this.prisma.testAttempt.count(),
      this.prisma.testAttempt.count({ where: { completedAt: { gte: today } } }),
      this.prisma.question.count(),
      this.prisma.category.count({ where: { isActive: true } }),
      this.prisma.aIChat.count(),
      this.prisma.aIChat.count({ where: { createdAt: { gte: today } } }),
      this.prisma.testAttempt.aggregate({
        _avg: { score: true },
        where: { completedAt: { not: null } },
      }),
      // Top kategoriyalar - faqat yakunlangan testlar soni bo'yicha
      this.prisma.$queryRaw`
        SELECT c.id, c.name, COUNT(t.id)::int as "testsCount"
        FROM "Category" c
        LEFT JOIN "TestAttempt" t ON t."categoryId" = c.id AND t."completedAt" IS NOT NULL
        WHERE c."isActive" = true
        GROUP BY c.id, c.name
        ORDER BY "testsCount" DESC
        LIMIT 5
      ` as Promise<Array<{ id: string; name: string; testsCount: number }>>,
    ]);

    return {
      users: {
        total: totalUsers,
        today: todayUsers,
        thisWeek: weekUsers,
      },
      tests: {
        total: totalTests,
        today: todayTests,
        averageScore: avgTestScore._avg.score || 0,
      },
      questions: totalQuestions,
      categories: totalCategories,
      aiChats: {
        total: totalAIChats,
        today: todayAIChats,
      },
      topCategories: topCategories.map((c) => ({
        id: c.id,
        name: c.name,
        testsCount: c.testsCount || 0,
      })),
    };
  }

  async getGrowthStats(days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const users = await this.prisma.user.groupBy({
      by: ["createdAt"],
      where: { createdAt: { gte: startDate } },
      _count: true,
    });

    const tests = await this.prisma.testAttempt.groupBy({
      by: ["completedAt"],
      where: { completedAt: { gte: startDate } },
      _count: true,
    });

    // Group by date
    const usersByDate = new Map<string, number>();
    const testsByDate = new Map<string, number>();

    for (let i = 0; i <= days; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const key = date.toISOString().split("T")[0];
      usersByDate.set(key, 0);
      testsByDate.set(key, 0);
    }

    users.forEach((u) => {
      const key = u.createdAt.toISOString().split("T")[0];
      usersByDate.set(key, (usersByDate.get(key) || 0) + u._count);
    });

    tests.forEach((t) => {
      if (t.completedAt) {
        const key = t.completedAt.toISOString().split("T")[0];
        testsByDate.set(key, (testsByDate.get(key) || 0) + t._count);
      }
    });

    return {
      users: Array.from(usersByDate.entries()).map(([date, count]) => ({
        date,
        count,
      })),
      tests: Array.from(testsByDate.entries()).map(([date, count]) => ({
        date,
        count,
      })),
    };
  }

  // ==================== USER MANAGEMENT ====================
  async getUsers(params: {
    page?: number;
    limit?: number;
    search?: string;
    // role?: Role;
    minLevel?: number;
    maxLevel?: number;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
  }) {
    const {
      page = 1,
      limit = 20,
      search,
      // role,
      minLevel,
      maxLevel,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = params;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (search) {
      where.OR = [
        { username: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { fullName: { contains: search, mode: "insensitive" } },
      ];
    }

    // if (role) where.role = role;
    if (minLevel) where.level = { gte: minLevel };
    if (maxLevel) where.level = { ...where.level, lte: maxLevel };

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        select: {
          id: true,
          email: true,
          username: true,
          fullName: true,
          avatar: true,
          totalXP: true,
          level: true,
          role: true,
          isActive: true,
          phone: true,
          telegramId: true,
          telegramUsername: true,
          telegramPhone: true,

          createdAt: true,
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    // Get completed tests count for each user
    const usersWithTestCount = await Promise.all(
      users.map(async (user) => {
        const completedTests = await this.prisma.testAttempt.count({
          where: {
            userId: user.id,
            completedAt: { not: null },
          },
        });
        return {
          ...user,
          completedTests,
        };
      })
    );

    return {
      users: usersWithTestCount,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getUserDetails(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        categoryStats: {
          include: { category: true },
        },
        userAchievements: {
          include: { achievement: true },
        },
        testAttempts: {
          take: 10,
          orderBy: { completedAt: "desc" },
          include: { category: true },
        },
        aiChats: {
          take: 20,
          orderBy: { createdAt: "desc" },
        },
        _count: {
          select: {
            testAttempts: true,
            aiChats: true,
            userAchievements: true,
          },
        },
      },
    });

    if (!user) throw new NotFoundException("Foydalanuvchi topilmadi");

    // Get ranking
    const rank = await this.prisma.user.count({
      where: { totalXP: { gt: user.totalXP } },
    });

    return { ...user, rank: rank + 1 };
  }

  async blockUser(userId: string, blocked: boolean) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException("Foydalanuvchi topilmadi");

    return this.prisma.user.update({
      where: { id: userId },
      data: { isActive: !blocked },
    });
  }

  async adjustUserXP(userId: string, amount: number, reason: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException("Foydalanuvchi topilmadi");

    const newXP = Math.max(0, user.totalXP + amount);
    const newLevel = this.calculateLevel(newXP);

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { totalXP: newXP, level: newLevel },
    });

    await this.notificationsService.createNotification(userId, {
      title: amount > 0 ? "XP qo'shildi" : "XP ayirildi",
      message: `${Math.abs(amount)} XP ${amount > 0 ? "qo'shildi" : "ayirildi"}. Sabab: ${reason}`,
      // type: NotificationType.SYSTEM,
    });

    return updated;
  }

  async deleteUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException("Foydalanuvchi topilmadi");

    // Delete related data first
    await this.prisma.$transaction([
      this.prisma.testAnswer.deleteMany({ where: { testAttempt: { userId } } }),
      this.prisma.testAttempt.deleteMany({ where: { userId } }),
      this.prisma.categoryStat.deleteMany({ where: { userId } }),
      this.prisma.aIChat.deleteMany({ where: { userId } }),
      this.prisma.userAchievement.deleteMany({ where: { userId } }),
      this.prisma.notification.deleteMany({ where: { userId } }),
      this.prisma.weeklyXP.deleteMany({ where: { userId } }),
      this.prisma.monthlyXP.deleteMany({ where: { userId } }),
      this.prisma.user.delete({ where: { id: userId } }),
    ]);

    return { message: "Foydalanuvchi o'chirildi" };
  }

  // ==================== BULK MESSAGING ====================
  async sendBulkMessage(params: {
    adminId: string;
    title: string;
    message: string;
    targetType: "all" | "selected" | "filter";
    targetIds?: string[];
    filter?: {
      minLevel?: number;
      maxLevel?: number;
      minXP?: number;
      categoryId?: string;
      inactiveDays?: number;
    };
  }) {
    const { adminId, title, message, targetType, targetIds, filter } = params;

    let userIds: string[] = [];

    if (targetType === "all") {
      const users = await this.prisma.user.findMany({
        where: { isActive: true },
        select: { id: true },
      });
      userIds = users.map((u) => u.id);
    } else if (targetType === "selected" && targetIds) {
      userIds = targetIds;
    } else if (targetType === "filter" && filter) {
      const where: any = { isActive: true };

      if (filter.minLevel) where.level = { gte: filter.minLevel };
      if (filter.maxLevel)
        where.level = { ...where.level, lte: filter.maxLevel };
      if (filter.minXP) where.totalXP = { gte: filter.minXP };

      if (filter.inactiveDays) {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - filter.inactiveDays);
        where.lastActiveAt = { lt: cutoff };
      }

      if (filter.categoryId) {
        const categoryUsers = await this.prisma.testAttempt.findMany({
          where: { categoryId: filter.categoryId },
          select: { userId: true },
          distinct: ["userId"],
        });
        userIds = categoryUsers.map((u) => u.userId || "");
      } else {
        const users = await this.prisma.user.findMany({
          where,
          select: { id: true },
        });
        userIds = users.map((u) => u.id);
      }
    }

    if (userIds.length === 0) {
      throw new BadRequestException("Hech qanday foydalanuvchi topilmadi");
    }

    // Create admin message record
    const adminMessage = await this.prisma.adminMessage.create({
      data: {
        adminId,
        targetType,
        targetIds: userIds,
        title,
        message,
        sentAt: new Date(),
      },
    });

    // Send notifications
    await Promise.all(
      userIds.map((userId) =>
        this.notificationsService.createNotification(userId, {
          title,
          message,
          // type: NotificationType.MESSAGE,
        })
      )
    );

    return {
      messageId: adminMessage.id,
      recipientsCount: userIds.length,
    };
  }

  async getMessageHistory(
    adminId: string,
    page: number = 1,
    limit: number = 20
  ) {
    const skip = (page - 1) * limit;

    const [messages, total] = await Promise.all([
      this.prisma.adminMessage.findMany({
        where: { adminId },
        skip,
        take: limit,
        orderBy: { sentAt: "desc" },
        include: {
          admin: {
            select: { username: true, fullName: true },
          },
        },
      }),
      this.prisma.adminMessage.count({ where: { adminId } }),
    ]);

    return {
      messages,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ==================== QUESTIONS BULK OPERATIONS ====================
  async bulkImportQuestions(data: {
    categoryId: string;
    questions: Array<{
      question: string;
      options: string[];
      correctAnswer: number;
      explanation?: string;
      difficulty: "EASY" | "MEDIUM" | "HARD";
      levelIndex?: number;
      tags?: string[];
    }>;
  }) {
    const { categoryId, questions } = data;

    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
    });
    if (!category) throw new NotFoundException("Kategoriya topilmadi");

    const xpMap = { EASY: 5, MEDIUM: 10, HARD: 15 };

    const created = await this.prisma.question.createMany({
      data: questions.map((q) => ({
        categoryId,
        question: q.question,
        options: q.options,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
        difficulty: q.difficulty,
        levelIndex: q.levelIndex ?? 0,
        xpReward: xpMap[q.difficulty],
        tags: q.tags || [],
        isActive: true,
      })),
    });

    return { imported: created.count };
  }

  async exportQuestions(categoryId?: string) {
    const where = categoryId ? { categoryId } : {};

    const questions = await this.prisma.question.findMany({
      where,
      include: { category: { select: { name: true, slug: true } } },
    });

    return questions.map((q) => ({
      category: q.category.name,
      categorySlug: q.category.slug,
      question: q.question,
      optionA: q.options[0],
      optionB: q.options[1],
      optionC: q.options[2],
      optionD: q.options[3],
      correctAnswer: ["A", "B", "C", "D"][q.correctAnswer],
      explanation: q.explanation || "",
      difficulty: q.difficulty,
      tags: q.tags.join(", "),
    }));
  }

  // ==================== SETTINGS ====================
  async getSettings() {
    const settings = await this.prisma.setting.findMany();
    const result: Record<string, any> = {};
    settings.forEach((s) => {
      result[s.key] = s.value;
    });
    return result;
  }

  async updateSettings(settings: Record<string, any>) {
    const updates = Object.entries(settings).map(([key, value]) =>
      this.prisma.setting.upsert({
        where: { key },
        update: { value: JSON.stringify(value) },
        create: { key, value: JSON.stringify(value) },
      })
    );

    await Promise.all(updates);
    return this.getSettings();
  }

  // ==================== HELPERS ====================
  private calculateLevel(xp: number): number {
    const thresholds = [
      0, 100, 250, 500, 1000, 2000, 3500, 5500, 8500, 13000, 20000,
    ];
    for (let i = thresholds.length - 1; i >= 0; i--) {
      if (xp >= thresholds[i]) return i + 1;
    }
    return 1;
  }

  // ==================== EXTENDED DASHBOARD ====================
  async getExtendedDashboard() {
    const basicStats = await this.getDashboardStats();

    // Active users (last 7 days)
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const activeUsers = await this.prisma.user.findMany({
      where: { lastActiveAt: { gte: weekAgo } },
      orderBy: { lastActiveAt: "desc" },
      take: 10,
      select: {
        id: true,
        username: true,
        fullName: true,
        avatar: true,
        totalXP: true,
        level: true,
        lastActiveAt: true,
      },
    });

    // Categories with unused questions (questions not yet answered by any user)
    const categoriesWithQuestions = await this.prisma.category.findMany({
      where: { isActive: true },
      include: {
        _count: { select: { questions: true } },
        questions: {
          select: { id: true },
        },
      },
    });

    // Get all used question IDs (questions that appear in TestAnswer)
    const usedQuestionIds = await this.prisma.testAnswer.findMany({
      select: { questionId: true },
      distinct: ["questionId"],
    });
    const usedSet = new Set(usedQuestionIds.map((q) => q.questionId));

    const lowQuestionCategories = await Promise.all(
      categoriesWithQuestions.map(async (c) => {
        // Count unused questions for this category
        const unusedCount = c.questions.filter(
          (q) => !usedSet.has(q.id)
        ).length;
        const totalCount = c._count.questions;
        const usedCount = totalCount - unusedCount;

        return {
          id: c.id,
          name: c.name,
          slug: c.slug,
          totalQuestions: totalCount,
          usedQuestions: usedCount,
          unusedQuestions: unusedCount,
          questionsCount: unusedCount, // For backward compatibility
          needed: 300 - unusedCount,
        };
      })
    );

    // Sort by unused questions (ascending - lowest unused first)
    lowQuestionCategories.sort((a, b) => a.unusedQuestions - b.unusedQuestions);

    // Question distribution by difficulty
    const questionsByDifficulty = await this.prisma.question.groupBy({
      by: ["difficulty"],
      _count: true,
    });

    // Most active categories today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const categoryActivity = await this.prisma.testAttempt.groupBy({
      by: ["categoryId"],
      where: { completedAt: { gte: today }, categoryId: { not: null } },
      _count: true,
      orderBy: { _count: { categoryId: "desc" } },
      take: 5,
    });

    const categoryActivityWithNames = await Promise.all(
      categoryActivity.map(async (c) => {
        const cat = await this.prisma.category.findUnique({
          where: { id: c.categoryId! },
          select: { name: true, slug: true },
        });
        return { ...c, name: cat?.name, slug: cat?.slug };
      })
    );

    return {
      ...basicStats,
      activeUsers,
      lowQuestionCategories,
      questionsByDifficulty: questionsByDifficulty.map((q) => ({
        difficulty: q.difficulty,
        count: q._count,
      })),
      categoryActivityToday: categoryActivityWithNames,
    };
  }

  // ==================== CATEGORY MANAGEMENT ====================
  async getAllCategoriesAdmin() {
    return this.prisma.category.findMany({
      orderBy: { order: "asc" },
      include: {
        _count: {
          select: {
            questions: true,
            testAttempts: true,
          },
        },
      },
    });
  }

  async createCategory(data: {
    name: string;
    slug: string;
    nameEn?: string;
    nameRu?: string;
    description?: string;
    icon?: string;
    color?: string;
    group?: string;
    order?: number;
    difficultyLevels?: string[];
  }) {
    // Check if slug exists
    const existing = await this.prisma.category.findUnique({
      where: { slug: data.slug },
    });
    if (existing) {
      throw new BadRequestException("Bu slug allaqachon mavjud");
    }

    const category = await this.prisma.category.create({ data });

    // Notify all users about the new category (async, don't wait)
    this.notificationsService
      .notifyNewCategory({
        id: category.id,
        name: category.name,
        slug: category.slug,
        icon: category.icon,
        group: category.group,
      })
      .catch((err) => {
        console.error("Failed to send new category notifications:", err);
      });

    return category;
  }

  async updateCategory(
    id: string,
    data: {
      name?: string;
      nameEn?: string;
      nameRu?: string;
      description?: string;
      icon?: string;
      color?: string;
      group?: string;
      order?: number;
      isActive?: boolean;
      difficultyLevels?: string[];
    }
  ) {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) {
      throw new NotFoundException("Kategoriya topilmadi");
    }

    return this.prisma.category.update({ where: { id }, data });
  }

  async deleteCategory(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: { _count: { select: { questions: true } } },
    });
    if (!category) {
      throw new NotFoundException("Kategoriya topilmadi");
    }

    // Delete all questions first
    await this.prisma.question.deleteMany({ where: { categoryId: id } });

    return this.prisma.category.delete({ where: { id } });
  }

  // Parse namuna.txt format and import questions
  async importQuestionsFromText(categoryId: string, text: string) {
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
    });
    if (!category) {
      throw new NotFoundException("Kategoriya topilmadi");
    }

    const questions = this.parseQuestionsText(text);

    if (questions.length === 0) {
      throw new BadRequestException("Savollar topilmadi");
    }

    // Check for duplicates
    const existingQuestions = await this.prisma.question.findMany({
      where: { categoryId },
      select: { question: true },
    });
    const existingSet = new Set(
      existingQuestions.map((q) => q.question.toLowerCase().trim())
    );

    const newQuestions = questions.filter(
      (q) => !existingSet.has(q.question.toLowerCase().trim())
    );

    if (newQuestions.length === 0) {
      return {
        imported: 0,
        skipped: questions.length,
        message: "Barcha savollar allaqachon mavjud",
      };
    }

    const xpMap = { EASY: 5, MEDIUM: 10, HARD: 15 };

    const created = await this.prisma.question.createMany({
      data: newQuestions.map((q) => ({
        categoryId,
        question: q.question,
        options: q.options,
        correctAnswer: q.correctAnswer,
        // difficulty: q.difficulty as Difficulty,
        xpReward: xpMap[q.difficulty],
        isActive: true,
      })),
    });

    return {
      imported: created.count,
      skipped: questions.length - newQuestions.length,
      total: questions.length,
    };
  }

  // Create category with 300+ questions
  async createCategoryWithQuestions(data: {
    name: string;
    slug: string;
    description?: string;
    icon?: string;
    color?: string;
    questionsText: string;
  }) {
    // Parse questions first to validate
    const questions = this.parseQuestionsText(data.questionsText);

    if (questions.length < 300) {
      throw new BadRequestException(
        `Kamida 300 ta savol kerak. Hozir: ${questions.length} ta`
      );
    }

    // Check difficulty distribution (need all 3 levels)
    const difficulties = new Set(questions.map((q) => q.difficulty));
    if (difficulties.size < 3) {
      throw new BadRequestException(
        "Savollar 3 ta darajada (EASY, MEDIUM, HARD) bo'lishi kerak"
      );
    }

    // Check for duplicates within the questions
    const questionTexts = questions.map((q) => q.question.toLowerCase().trim());
    const uniqueQuestions = new Set(questionTexts);
    if (uniqueQuestions.size < questions.length) {
      throw new BadRequestException("Savollar orasida dublikatlar bor");
    }

    // Check if slug exists
    const existing = await this.prisma.category.findUnique({
      where: { slug: data.slug },
    });
    if (existing) {
      throw new BadRequestException("Bu slug allaqachon mavjud");
    }

    // Create category and questions in transaction
    const xpMap = { EASY: 5, MEDIUM: 10, HARD: 15 };

    const result = await this.prisma.$transaction(async (tx) => {
      const category = await tx.category.create({
        data: {
          name: data.name,
          slug: data.slug,
          description: data.description,
          icon: data.icon,
          color: data.color,
        },
      });

      await tx.question.createMany({
        data: questions.map((q) => ({
          categoryId: category.id,
          question: q.question,
          options: q.options,
          correctAnswer: q.correctAnswer,
          // difficulty: q.difficulty as Difficulty,
          xpReward: xpMap[q.difficulty],
          isActive: true,
        })),
      });

      return category;
    });

    return {
      category: result,
      questionsImported: questions.length,
    };
  }

  // Parse questions from namuna.txt format
  private parseQuestionsText(text: string): Array<{
    question: string;
    options: string[];
    correctAnswer: number;
    difficulty: "EASY" | "MEDIUM" | "HARD";
  }> {
    const questions: Array<{
      question: string;
      options: string[];
      correctAnswer: number;
      difficulty: "EASY" | "MEDIUM" | "HARD";
    }> = [];

    // Detect difficulty from title
    let currentDifficulty: "EASY" | "MEDIUM" | "HARD" = "MEDIUM";
    const titleLower = text.toLowerCase();
    if (titleLower.includes("oson") || titleLower.includes("easy")) {
      currentDifficulty = "EASY";
    } else if (
      titleLower.includes("o'rta") ||
      titleLower.includes("orta") ||
      titleLower.includes("medium")
    ) {
      currentDifficulty = "MEDIUM";
    } else if (titleLower.includes("qiyin") || titleLower.includes("hard")) {
      currentDifficulty = "HARD";
    }

    // Split by question numbers (1., 2., etc.)
    const lines = text.split("\n");
    let currentQuestion = "";
    let currentOptions: string[] = [];
    let currentAnswer = -1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Skip empty lines and titles
      if (!line || line.startsWith("=") || line.includes("TEST SAVOLLARI")) {
        continue;
      }

      // Check if it's a question number (e.g., "1.", "2.", "100.")
      const questionMatch = line.match(/^(\d+)\.\s*(.+)$/);
      if (questionMatch) {
        // Save previous question if exists
        if (
          currentQuestion &&
          currentOptions.length === 4 &&
          currentAnswer >= 0
        ) {
          questions.push({
            question: currentQuestion,
            options: currentOptions,
            correctAnswer: currentAnswer,
            difficulty: currentDifficulty,
          });
        }

        currentQuestion = questionMatch[2];
        currentOptions = [];
        currentAnswer = -1;
        continue;
      }

      // Check if it's an option (A), B), C), D))
      const optionMatch = line.match(/^([A-D])\)\s*(.+)$/);
      if (optionMatch) {
        const optionLetter = optionMatch[1];
        const optionText = optionMatch[2];
        const index = optionLetter.charCodeAt(0) - 65; // A=0, B=1, C=2, D=3
        currentOptions[index] = optionText;
        continue;
      }

      // Check if it's answer line (Javob: B)
      const answerMatch = line.match(/^Javob:\s*([A-D])$/i);
      if (answerMatch) {
        currentAnswer = answerMatch[1].toUpperCase().charCodeAt(0) - 65;
        continue;
      }

      // If question continues on next line
      if (
        currentQuestion &&
        !line.startsWith("A)") &&
        !line.startsWith("B)") &&
        !line.startsWith("C)") &&
        !line.startsWith("D)") &&
        !line.toLowerCase().startsWith("javob")
      ) {
        currentQuestion += " " + line;
      }
    }

    // Don't forget last question
    if (currentQuestion && currentOptions.length === 4 && currentAnswer >= 0) {
      questions.push({
        question: currentQuestion,
        options: currentOptions,
        correctAnswer: currentAnswer,
        difficulty: currentDifficulty,
      });
    }

    return questions;
  }

  // ==================== DESIGN SETTINGS ====================
  async getDesignSettings() {
    let settings = await this.prisma.designSetting.findFirst({
      where: { isActive: true },
    });

    if (!settings) {
      // Create default settings
      settings = await this.prisma.designSetting.create({
        data: {
          theme: "default",
          videoLoop: true,
          videoMuted: true,
          isActive: true,
        },
      });
    }

    return settings;
  }

  async updateDesignSettings(data: {
    theme?: string;
    lightVideoUrl?: string;
    darkVideoUrl?: string;
    lightImageUrl?: string;
    darkImageUrl?: string;
    videoLoop?: boolean;
    videoMuted?: boolean;
  }) {
    let settings = await this.prisma.designSetting.findFirst({
      where: { isActive: true },
    });

    if (!settings) {
      return this.prisma.designSetting.create({
        data: {
          ...data,
          isActive: true,
        },
      });
    }

    return this.prisma.designSetting.update({
      where: { id: settings.id },
      data,
    });
  }

  async resetDesignToDefault() {
    const settings = await this.prisma.designSetting.findFirst({
      where: { isActive: true },
    });

    if (settings) {
      return this.prisma.designSetting.update({
        where: { id: settings.id },
        data: {
          theme: "default",
          lightVideoUrl: null,
          darkVideoUrl: null,
          lightImageUrl: null,
          darkImageUrl: null,
          videoLoop: true,
          videoMuted: true,
        },
      });
    }

    return this.getDesignSettings();
  }

  // ==================== EXTENDED MESSAGING ====================
  async sendMultiChannelMessage(params: {
    adminId: string;
    title: string;
    message: string;
    imageUrl?: string;
    videoUrl?: string;
    targetType: "all" | "selected" | "filter";
    targetIds?: string[];
    channels: string[]; // ['email', 'telegram', 'notification']
    filter?: {
      minLevel?: number;
      maxLevel?: number;
      minXP?: number;
      categoryId?: string;
      inactiveDays?: number;
    };
  }) {
    const {
      adminId,
      title,
      message,
      imageUrl,
      videoUrl,
      targetType,
      targetIds,
      channels,
      filter,
    } = params;

    // Log incoming params
    console.log("[sendMultiChannelMessage] Params:", {
      title,
      imageUrl,
      videoUrl,
      targetType,
      channels,
    });

    // Get admin info for notification
    const admin = await this.prisma.user.findUnique({
      where: { id: adminId },
      select: { id: true, username: true, avatar: true, fullName: true },
    });

    // Get target users
    let users: Array<{
      id: string;
      email: string | null;
      telegramId: string | null;
      fullName: string;
    }> = [];

    if (targetType === "all") {
      users = await this.prisma.user.findMany({
        where: { isActive: true },
        select: { id: true, email: true, telegramId: true, fullName: true },
      });
    } else if (targetType === "selected" && targetIds) {
      users = await this.prisma.user.findMany({
        where: { id: { in: targetIds }, isActive: true },
        select: { id: true, email: true, telegramId: true, fullName: true },
      });
    } else if (targetType === "filter" && filter) {
      const where: any = { isActive: true };

      if (filter.minLevel) where.level = { gte: filter.minLevel };
      if (filter.maxLevel)
        where.level = { ...where.level, lte: filter.maxLevel };
      if (filter.minXP) where.totalXP = { gte: filter.minXP };

      if (filter.inactiveDays) {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - filter.inactiveDays);
        where.lastActiveAt = { lt: cutoff };
      }

      users = await this.prisma.user.findMany({
        where,
        select: { id: true, email: true, telegramId: true, fullName: true },
      });
    }

    if (users.length === 0) {
      throw new BadRequestException("Hech qanday foydalanuvchi topilmadi");
    }

    // Limit to 15 users for selected
    if (targetType === "selected" && users.length > 15) {
      throw new BadRequestException(
        "Bir vaqtda 15 tadan ko'p foydalanuvchiga xabar yuborib bo'lmaydi"
      );
    }

    let emailSent = 0;
    let telegramSent = 0;
    let notifSent = 0;

    // Send via channels
    for (const user of users) {
      // Send notification
      if (channels.includes("notification")) {
        try {
          const notificationData: any = {
            adminId: admin?.id,
            adminUsername: admin?.username,
            adminAvatar: admin?.avatar,
            adminFullName: admin?.fullName,
          };

          // Only add media URLs if they exist
          if (imageUrl) notificationData.imageUrl = imageUrl;
          if (videoUrl) notificationData.videoUrl = videoUrl;

          console.log(
            "[sendMultiChannelMessage] Creating notification with data:",
            notificationData
          );

          await this.notificationsService.createNotification(user.id, {
            title,
            message,
            // type: NotificationType.MESSAGE,
            data: notificationData,
          });
          notifSent++;
        } catch (error) {
          console.error("Notification error:", error);
        }
      }

      // Send email
      if (channels.includes("email") && user.email) {
        try {
          console.log(
            "[Admin] Sending email with imageUrl:",
            imageUrl,
            "videoUrl:",
            videoUrl
          );
          await this.mailService.sendAdminMessage(
            user.email,
            title,
            message,
            admin?.fullName || admin?.username,
            imageUrl,
            videoUrl
          );
          emailSent++;
        } catch (error) {
          console.error("Email error:", error);
        }
      }

      // Send telegram
      if (channels.includes("telegram") && user.telegramId) {
        try {
          let telegramMessage = `*${title}*\n\n${message}`;
          await this.telegramService.sendMessage(
            parseInt(user.telegramId),
            telegramMessage
          );
          telegramSent++;
        } catch (error) {
          console.error("Telegram error:", error);
        }
      }
    }

    // Save message record
    const adminMessage = await this.prisma.adminMessage.create({
      data: {
        adminId,
        title,
        message,
        imageUrl,
        videoUrl,
        targetType,
        targetIds: users.map((u) => u.id),
        channels,
        sentAt: new Date(),
        emailSent,
        telegramSent,
        notifSent,
      },
    });

    return {
      messageId: adminMessage.id,
      recipientsCount: users.length,
      emailSent,
      telegramSent,
      notifSent,
    };
  }
}
