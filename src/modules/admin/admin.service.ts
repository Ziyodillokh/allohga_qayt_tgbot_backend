import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import {
  Repository,
  MoreThanOrEqual,
  LessThan,
  In,
  ILike,
  Not,
  IsNull,
  DataSource,
} from "typeorm";
import { User } from "../users/entities";
import { Category, CategoryStat } from "../categories/entities";
import { Question, Difficulty } from "../questions/entities";
import { TestAttempt, TestAnswer } from "../tests/entities";
import { AIChat } from "../ai/entities";
import { UserAchievement } from "../achievements/entities";
import { Notification } from "../notifications/entities";
import { AdminMessage, Setting, DesignSetting } from "./entities";
import { WeeklyXP, MonthlyXP } from "../leaderboard/entities";
import { Zikr, ZikrCompletion } from "../zikr/entities";
import { NotificationsService } from "../notifications/notifications.service";
import { TelegramService } from "../telegram/telegram.service";

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Category)
    private categoryRepository: Repository<Category>,
    @InjectRepository(Question)
    private questionRepository: Repository<Question>,
    @InjectRepository(TestAttempt)
    private testAttemptRepository: Repository<TestAttempt>,
    @InjectRepository(TestAnswer)
    private testAnswerRepository: Repository<TestAnswer>,
    @InjectRepository(CategoryStat)
    private categoryStatRepository: Repository<CategoryStat>,
    @InjectRepository(AIChat)
    private aiChatRepository: Repository<AIChat>,
    @InjectRepository(UserAchievement)
    private userAchievementRepository: Repository<UserAchievement>,
    @InjectRepository(Notification)
    private notificationRepository: Repository<Notification>,
    @InjectRepository(AdminMessage)
    private adminMessageRepository: Repository<AdminMessage>,
    @InjectRepository(WeeklyXP)
    private weeklyXPRepository: Repository<WeeklyXP>,
    @InjectRepository(MonthlyXP)
    private monthlyXPRepository: Repository<MonthlyXP>,
    @InjectRepository(Setting)
    private settingRepository: Repository<Setting>,
    @InjectRepository(DesignSetting)
    private designSettingRepository: Repository<DesignSetting>,
    @InjectRepository(Zikr)
    private zikrRepository: Repository<Zikr>,
    @InjectRepository(ZikrCompletion)
    private zikrCompletionRepository: Repository<ZikrCompletion>,
    private dataSource: DataSource,
    private notificationsService: NotificationsService,
    private telegramService: TelegramService,
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
      totalTestsResult,
      todayTestsResult,
      totalQuestions,
      totalCategories,
      totalAIChats,
      todayAIChats,
      avgTestScoreResult,
      topCategories,
      totalXPResult,
      totalZikrResult,
    ] = await Promise.all([
      this.userRepository.count(),
      this.userRepository.count({
        where: { createdAt: MoreThanOrEqual(today) },
      }),
      this.userRepository.count({
        where: { createdAt: MoreThanOrEqual(weekAgo) },
      }),
      // Jami yechilgan savollar soni (1 savol = 1 test)
      this.testAnswerRepository.count(),
      // Bugun yechilgan savollar soni
      this.testAnswerRepository.count({
        where: { createdAt: MoreThanOrEqual(today) },
      }),
      this.questionRepository.count(),
      this.categoryRepository.count({ where: { isActive: true } }),
      this.aiChatRepository.count(),
      this.aiChatRepository.count({
        where: { createdAt: MoreThanOrEqual(today) },
      }),
      this.testAttemptRepository
        .createQueryBuilder("t")
        .select("AVG(t.score)", "avg")
        .where("t.completedAt IS NOT NULL")
        .getRawOne(),
      // Top kategoriyalar - yechilgan savollar soni bo'yicha (1 savol = 1 test)
      this.dataSource.query(`
        SELECT c.id, c.name, COUNT(ta.id)::int as "testsCount"
        FROM "categories" c
        LEFT JOIN "test_attempts" t ON t."categoryId" = c.id AND t."completedAt" IS NOT NULL
        LEFT JOIN "test_answers" ta ON ta."testAttemptId" = t.id
        WHERE c."isActive" = true
        GROUP BY c.id, c.name
        ORDER BY "testsCount" DESC
        LIMIT 5
      `) as Promise<Array<{ id: string; name: string; testsCount: number }>>,
      // Total XP earned
      this.testAttemptRepository
        .createQueryBuilder("t")
        .select("COALESCE(SUM(t.xpEarned), 0)", "total")
        .where("t.completedAt IS NOT NULL")
        .getRawOne(),
      // Total zikr count (sum of zikr.count for each completion, not just completion count)
      this.dataSource.query(`
        SELECT COALESCE(SUM(z.count), 0)::int as total
        FROM "zikr_completions" zc
        INNER JOIN "zikrs" z ON z.id = zc."zikrId"
      `),
    ]);

    return {
      users: {
        total: totalUsers,
        today: todayUsers,
        thisWeek: weekUsers,
      },
      tests: {
        total: totalTestsResult,
        today: todayTestsResult,
        averageScore: avgTestScoreResult?.avg || 0,
      },
      questions: totalQuestions,
      categories: totalCategories,
      aiChats: {
        total: totalAIChats,
        today: todayAIChats,
      },
      totalXP: parseInt(totalXPResult?.total) || 0,
      totalZikr: totalZikrResult?.[0]?.total || 0,
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

    const users = await this.userRepository
      .createQueryBuilder("u")
      .select("DATE(u.createdAt)", "date")
      .addSelect("COUNT(*)", "count")
      .where("u.createdAt >= :startDate", { startDate })
      .groupBy("DATE(u.createdAt)")
      .getRawMany();

    const tests = await this.testAttemptRepository
      .createQueryBuilder("t")
      .select("DATE(t.completedAt)", "date")
      .addSelect("COUNT(*)", "count")
      .where("t.completedAt >= :startDate", { startDate })
      .groupBy("DATE(t.completedAt)")
      .getRawMany();

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
      const key =
        u.date instanceof Date ? u.date.toISOString().split("T")[0] : u.date;
      usersByDate.set(key, parseInt(u.count) || 0);
    });

    tests.forEach((t) => {
      if (t.date) {
        const key =
          t.date instanceof Date ? t.date.toISOString().split("T")[0] : t.date;
        testsByDate.set(key, parseInt(t.count) || 0);
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

    const queryBuilder = this.userRepository.createQueryBuilder("user");

    if (search) {
      queryBuilder.where(
        "(user.username ILIKE :search OR user.email ILIKE :search OR user.fullName ILIKE :search)",
        { search: `%${search}%` },
      );
    }

    // if (role) queryBuilder.andWhere("user.role = :role", { role });
    if (minLevel)
      queryBuilder.andWhere("user.level >= :minLevel", { minLevel });
    if (maxLevel)
      queryBuilder.andWhere("user.level <= :maxLevel", { maxLevel });

    queryBuilder
      .select([
        "user.id",
        "user.email",
        "user.username",
        "user.fullName",
        "user.avatar",
        "user.totalXP",
        "user.level",
        "user.testsCompleted",
        "user.zikrCount",
        "user.role",
        "user.isActive",
        "user.phone",
        "user.telegramId",
        "user.telegramUsername",
        "user.telegramPhone",
        "user.createdAt",
      ])
      .orderBy(`user.${sortBy}`, sortOrder.toUpperCase() as "ASC" | "DESC")
      .skip(skip)
      .take(limit);

    const [users, total] = await queryBuilder.getManyAndCount();

    // Har bir user uchun yechilgan savollar va zikrlar sonini hisoblash
    const usersWithCounts = await Promise.all(
      users.map(async (user) => {
        // test_answers jadvalidan user yechgan savollar sonini olish (1 savol = 1 test)
        const completedTests = await this.testAnswerRepository
          .createQueryBuilder("ta")
          .innerJoin("ta.testAttempt", "t")
          .where("t.userId = :userId", { userId: user.id })
          .getCount();

        // zikr_completions jadvalidan user zikr sonini olish (zikr.count bo'yicha)
        const zikrCountResult = await this.dataSource.query(
          `
          SELECT COALESCE(SUM(z.count), 0)::int as total
          FROM "zikr_completions" zc
          INNER JOIN "zikrs" z ON z.id = zc."zikrId"
          WHERE zc."userId" = $1
        `,
          [user.id],
        );

        return {
          ...user,
          completedTests: completedTests || user.testsCompleted || 0,
          zikrCount: zikrCountResult?.[0]?.total || user.zikrCount || 0,
        };
      }),
    );

    return {
      users: usersWithCounts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getUserDetails(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: [
        "categoryStats",
        "categoryStats.category",
        "userAchievements",
        "userAchievements.achievement",
      ],
    });

    if (!user) throw new NotFoundException("Foydalanuvchi topilmadi");

    // Get test attempts separately with limit
    const testAttempts = await this.testAttemptRepository.find({
      where: { userId },
      order: { completedAt: "DESC" },
      take: 10,
      relations: ["category"],
    });

    // Get AI chats separately with limit
    const aiChats = await this.aiChatRepository.find({
      where: { userId },
      order: { createdAt: "DESC" },
      take: 20,
    });

    // Get counts
    const [testAttemptsCount, aiChatsCount, userAchievementsCount] =
      await Promise.all([
        this.testAttemptRepository.count({ where: { userId } }),
        this.aiChatRepository.count({ where: { userId } }),
        this.userAchievementRepository.count({ where: { userId } }),
      ]);

    // Get ranking
    const rank = await this.userRepository.count({
      where: { totalXP: MoreThanOrEqual(user.totalXP + 1) },
    });

    return {
      ...user,
      testAttempts,
      aiChats,
      _count: {
        testAttempts: testAttemptsCount,
        aiChats: aiChatsCount,
        userAchievements: userAchievementsCount,
      },
      rank: rank + 1,
    };
  }

  async updateUserRole(userId: string, role: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException("Foydalanuvchi topilmadi");

    // Validate role
    const validRoles = ["USER", "MODERATOR", "ADMIN"];
    if (!validRoles.includes(role)) {
      throw new BadRequestException("Noto'g'ri rol");
    }

    user.role = role as any;
    return this.userRepository.save(user);
  }

  async blockUser(userId: string, blocked: boolean) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException("Foydalanuvchi topilmadi");

    user.isActive = !blocked;
    return this.userRepository.save(user);
  }

  async adjustUserXP(userId: string, amount: number, reason: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException("Foydalanuvchi topilmadi");

    const newXP = Math.max(0, user.totalXP + amount);
    const newLevel = this.calculateLevel(newXP);

    user.totalXP = newXP;
    user.level = newLevel;
    const updated = await this.userRepository.save(user);

    await this.notificationsService.createNotification(userId, {
      title: amount > 0 ? "XP qo'shildi" : "XP ayirildi",
      message: `${Math.abs(amount)} XP ${amount > 0 ? "qo'shildi" : "ayirildi"}. Sabab: ${reason}`,
      // type: NotificationType.SYSTEM,
    });

    return updated;
  }

  async deleteUser(userId: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException("Foydalanuvchi topilmadi");

    // Delete related data using queryRunner for transaction
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Delete test answers for user's test attempts
      await queryRunner.manager
        .createQueryBuilder()
        .delete()
        .from(TestAnswer)
        .where(
          'testAttemptId IN (SELECT id FROM test_attempts WHERE "userId" = :userId)',
          { userId },
        )
        .execute();

      await queryRunner.manager.delete(TestAttempt, { userId });
      await queryRunner.manager.delete(CategoryStat, { userId });
      await queryRunner.manager.delete(AIChat, { userId });
      await queryRunner.manager.delete(UserAchievement, { userId });
      await queryRunner.manager.delete(Notification, { userId });
      await queryRunner.manager.delete(WeeklyXP, { userId });
      await queryRunner.manager.delete(MonthlyXP, { userId });
      await queryRunner.manager.delete(User, { id: userId });

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }

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
      const users = await this.userRepository.find({
        where: { isActive: true },
        select: ["id"],
      });
      userIds = users.map((u) => u.id);
    } else if (targetType === "selected" && targetIds) {
      userIds = targetIds;
    } else if (targetType === "filter" && filter) {
      const queryBuilder = this.userRepository
        .createQueryBuilder("user")
        .select("user.id")
        .where("user.isActive = :isActive", { isActive: true });

      if (filter.minLevel) {
        queryBuilder.andWhere("user.level >= :minLevel", {
          minLevel: filter.minLevel,
        });
      }
      if (filter.maxLevel) {
        queryBuilder.andWhere("user.level <= :maxLevel", {
          maxLevel: filter.maxLevel,
        });
      }
      if (filter.minXP) {
        queryBuilder.andWhere("user.totalXP >= :minXP", {
          minXP: filter.minXP,
        });
      }

      if (filter.inactiveDays) {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - filter.inactiveDays);
        queryBuilder.andWhere("user.lastActiveAt < :cutoff", { cutoff });
      }

      if (filter.categoryId) {
        const categoryUsers = await this.testAttemptRepository.find({
          where: { categoryId: filter.categoryId },
          select: ["userId"],
        });
        const uniqueUserIds = [
          ...new Set(categoryUsers.map((u) => u.userId).filter(Boolean)),
        ];
        userIds = uniqueUserIds as string[];
      } else {
        const users = await queryBuilder.getMany();
        userIds = users.map((u) => u.id);
      }
    }

    if (userIds.length === 0) {
      throw new BadRequestException("Hech qanday foydalanuvchi topilmadi");
    }

    // Create admin message record
    const adminMessage = this.adminMessageRepository.create({
      adminId,
      targetType,
      targetIds: userIds,
      title,
      message,
      sentAt: new Date(),
    });
    await this.adminMessageRepository.save(adminMessage);

    // Send notifications
    await Promise.all(
      userIds.map((userId) =>
        this.notificationsService.createNotification(userId, {
          title,
          message,
          // type: NotificationType.MESSAGE,
        }),
      ),
    );

    return {
      messageId: adminMessage.id,
      recipientsCount: userIds.length,
    };
  }

  async getMessageHistory(
    adminId: string,
    page: number = 1,
    limit: number = 20,
  ) {
    const skip = (page - 1) * limit;

    const [messages, total] = await this.adminMessageRepository.findAndCount({
      where: { adminId },
      skip,
      take: limit,
      order: { sentAt: "DESC" },
      relations: ["admin"],
    });

    // Format messages to include only needed admin fields
    const formattedMessages = messages.map((m) => ({
      ...m,
      admin: m.admin
        ? { username: m.admin.username, fullName: m.admin.fullName }
        : null,
    }));

    return {
      messages: formattedMessages,
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
      difficulty: Difficulty;
      levelIndex?: number;
      tags?: string[];
    }>;
  }) {
    const { categoryId, questions } = data;

    const category = await this.categoryRepository.findOne({
      where: { id: categoryId },
    });
    if (!category) throw new NotFoundException("Kategoriya topilmadi");

    const xpMap = {
      [Difficulty.EASY]: 5,
      [Difficulty.MEDIUM]: 10,
      [Difficulty.HARD]: 15,
    };

    const questionsToCreate = questions.map((q) =>
      this.questionRepository.create({
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
      }),
    );

    const result = await this.questionRepository.save(questionsToCreate);

    return { imported: result.length };
  }

  async exportQuestions(categoryId?: string) {
    const where = categoryId ? { categoryId } : {};

    const questions = await this.questionRepository.find({
      where,
      relations: ["category"],
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
    const settings = await this.settingRepository.find();
    const result: Record<string, any> = {};
    settings.forEach((s) => {
      result[s.key] = s.value;
    });
    return result;
  }

  async updateSettings(settings: Record<string, any>) {
    const updates = Object.entries(settings).map(async ([key, value]) => {
      const existing = await this.settingRepository.findOne({ where: { key } });
      if (existing) {
        existing.value = JSON.stringify(value);
        return this.settingRepository.save(existing);
      } else {
        const newSetting = this.settingRepository.create({
          key,
          value: JSON.stringify(value),
        });
        return this.settingRepository.save(newSetting);
      }
    });

    await Promise.all(updates);
    return this.getSettings();
  }

  // ==================== DESIGN SETTINGS ====================
  async getDesignSettings() {
    let settings = await this.designSettingRepository.findOne({
      where: { isActive: true },
    });

    // Default yaratish agar yo'q bo'lsa
    if (!settings) {
      settings = this.designSettingRepository.create({
        isActive: true,
        videoLoop: true,
        videoMuted: true,
      });
      await this.designSettingRepository.save(settings);
    }

    return settings;
  }

  async updateDesignSettings(dto: {
    lightVideoUrl?: string;
    darkVideoUrl?: string;
    lightImageUrl?: string;
    darkImageUrl?: string;
    videoLoop?: boolean;
    videoMuted?: boolean;
    theme?: string;
    isActive?: boolean;
  }) {
    let settings = await this.designSettingRepository.findOne({
      where: { isActive: true },
    });

    if (!settings) {
      settings = this.designSettingRepository.create({
        isActive: true,
        videoLoop: true,
        videoMuted: true,
      });
    }

    if (dto.lightVideoUrl !== undefined)
      settings.lightVideoUrl = dto.lightVideoUrl;
    if (dto.darkVideoUrl !== undefined)
      settings.darkVideoUrl = dto.darkVideoUrl;
    if (dto.lightImageUrl !== undefined)
      settings.lightImageUrl = dto.lightImageUrl;
    if (dto.darkImageUrl !== undefined)
      settings.darkImageUrl = dto.darkImageUrl;
    if (dto.videoLoop !== undefined) settings.videoLoop = dto.videoLoop;
    if (dto.videoMuted !== undefined) settings.videoMuted = dto.videoMuted;
    if (dto.theme !== undefined) settings.theme = dto.theme;
    if (dto.isActive !== undefined) settings.isActive = dto.isActive;

    await this.designSettingRepository.save(settings);
    return settings;
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

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Active users (last 7 days)
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const activeUsers = await this.userRepository.find({
      where: { lastActiveAt: MoreThanOrEqual(weekAgo) },
      order: { lastActiveAt: "DESC" },
      take: 10,
      select: [
        "id",
        "username",
        "fullName",
        "avatar",
        "totalXP",
        "level",
        "lastActiveAt",
      ],
    });

    // ============ ZIKR STATISTICS ============
    const [
      totalZikrs,
      activeZikrs,
      totalZikrCompletionsResult,
      todayZikrCompletionsResult,
      weekZikrCompletionsResult,
      totalZikrXpEarnedResult,
    ] = await Promise.all([
      this.zikrRepository.count(),
      this.zikrRepository.count({ where: { isActive: true } }),
      // Jami zikr soni (zikr.count bo'yicha)
      this.dataSource.query(`
        SELECT COALESCE(SUM(z.count), 0)::int as total
        FROM "zikr_completions" zc
        INNER JOIN "zikrs" z ON z.id = zc."zikrId"
      `),
      // Bugungi zikr soni
      this.dataSource.query(
        `
        SELECT COALESCE(SUM(z.count), 0)::int as total
        FROM "zikr_completions" zc
        INNER JOIN "zikrs" z ON z.id = zc."zikrId"
        WHERE zc."completedAt" >= $1
      `,
        [today],
      ),
      // Haftalik zikr soni
      this.dataSource.query(
        `
        SELECT COALESCE(SUM(z.count), 0)::int as total
        FROM "zikr_completions" zc
        INNER JOIN "zikrs" z ON z.id = zc."zikrId"
        WHERE zc."completedAt" >= $1
      `,
        [weekAgo],
      ),
      // Total XP earned from zikr (calculated from zikr.xpReward * completions count)
      this.dataSource.query(`
        SELECT COALESCE(SUM(z."xpReward"), 0)::int as sum
        FROM "zikr_completions" zc
        INNER JOIN "zikrs" z ON z.id = zc."zikrId"
      `),
    ]);

    // Top zikrs by completions
    const topZikrs = await this.zikrRepository
      .createQueryBuilder("z")
      .leftJoin("z.completions", "c")
      .where("z.isActive = :isActive", { isActive: true })
      .select(["z.id", "z.titleLatin", "z.emoji", "z.count", "z.xpReward"])
      .addSelect("COUNT(c.id)", "completions_count")
      .groupBy("z.id")
      .orderBy('"completions_count"', "DESC")
      .take(5)
      .getRawMany();

    // Zikr completions by day of week
    const zikrsByDay = await this.zikrRepository
      .createQueryBuilder("z")
      .where("z.isActive = :isActive", { isActive: true })
      .select("z.dayOfWeek", "dayOfWeek")
      .addSelect("COUNT(*)", "count")
      .groupBy("z.dayOfWeek")
      .getRawMany();

    // Categories with unused questions (questions not yet answered by any user)
    const categoriesWithQuestions = await this.categoryRepository.find({
      where: { isActive: true },
      relations: ["questions"],
    });

    // Get all used question IDs (questions that appear in TestAnswer)
    const usedQuestionIds = await this.testAnswerRepository
      .createQueryBuilder("ta")
      .select("DISTINCT ta.questionId", "questionId")
      .getRawMany();
    const usedSet = new Set(usedQuestionIds.map((q) => q.questionId));

    const lowQuestionCategories = await Promise.all(
      categoriesWithQuestions.map(async (c) => {
        // Count unused questions for this category
        const unusedCount = c.questions.filter(
          (q) => !usedSet.has(q.id),
        ).length;
        const totalCount = c.questions.length;
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
      }),
    );

    // Sort by unused questions (ascending - lowest unused first)
    lowQuestionCategories.sort((a, b) => a.unusedQuestions - b.unusedQuestions);

    // Question distribution by difficulty
    const questionsByDifficulty = await this.questionRepository
      .createQueryBuilder("q")
      .select("q.difficulty", "difficulty")
      .addSelect("COUNT(*)", "count")
      .groupBy("q.difficulty")
      .getRawMany();

    // Most active categories today
    const todayForActivity = new Date();
    todayForActivity.setHours(0, 0, 0, 0);

    const categoryActivity = await this.testAttemptRepository
      .createQueryBuilder("t")
      .where("t.completedAt >= :today", { today: todayForActivity })
      .andWhere("t.categoryId IS NOT NULL")
      .select("t.categoryId", "categoryId")
      .addSelect("COUNT(*)", "count")
      .groupBy("t.categoryId")
      .orderBy("count", "DESC")
      .take(5)
      .getRawMany();

    const categoryActivityWithNames = await Promise.all(
      categoryActivity.map(async (c) => {
        const cat = await this.categoryRepository.findOne({
          where: { id: c.categoryId },
          select: ["name", "slug"],
        });
        return {
          ...c,
          _count: parseInt(c.count),
          name: cat?.name,
          slug: cat?.slug,
        };
      }),
    );

    // ============ TOTAL XP EARNED ============
    const totalXPEarnedResult = await this.userRepository
      .createQueryBuilder("u")
      .select("SUM(u.totalXP)", "sum")
      .getRawOne();

    // ============ CORRECT ANSWERS COUNT ============
    const correctAnswers = await this.testAnswerRepository.count({
      where: { isCorrect: true },
    });
    const todayCorrectAnswers = await this.testAnswerRepository.count({
      where: { isCorrect: true, createdAt: MoreThanOrEqual(today) },
    });

    return {
      ...basicStats,
      activeUsers,
      lowQuestionCategories,
      questionsByDifficulty: questionsByDifficulty.map((q) => ({
        difficulty: q.difficulty,
        count: parseInt(q.count),
      })),
      categoryActivityToday: categoryActivityWithNames,
      // Zikr stats
      zikr: {
        total: totalZikrs,
        active: activeZikrs,
        completions: {
          total: totalZikrCompletionsResult?.[0]?.total || 0,
          today: todayZikrCompletionsResult?.[0]?.total || 0,
          thisWeek: weekZikrCompletionsResult?.[0]?.total || 0,
        },
        totalXpEarned: parseInt(totalZikrXpEarnedResult?.[0]?.sum) || 0,
        topZikrs: topZikrs.map((z) => ({
          id: z.z_id,
          title: z.z_titleLatin,
          emoji: z.z_emoji,
          count: z.z_count,
          xpReward: z.z_xpReward,
          completions: parseInt(z.completionsCount) || 0,
        })),
        byDayOfWeek: zikrsByDay.map((d) => ({
          dayOfWeek: d.dayOfWeek,
          count: parseInt(d.count),
        })),
      },
      // XP stats
      xp: {
        totalEarned: parseInt(totalXPEarnedResult?.sum) || 0,
        fromZikrs: parseInt(totalZikrXpEarnedResult?.sum) || 0,
      },
      // Correct answers
      correctAnswers: {
        total: correctAnswers,
        today: todayCorrectAnswers,
      },
    };
  }

  // ==================== CATEGORY MANAGEMENT ====================
  async getAllCategoriesAdmin() {
    const categories = await this.categoryRepository.find({
      order: { order: "ASC" },
    });

    // Get counts for each category
    const categoriesWithCounts = await Promise.all(
      categories.map(async (c) => {
        const [questionsCount, testAttemptsCount] = await Promise.all([
          this.questionRepository.count({ where: { categoryId: c.id } }),
          this.testAttemptRepository.count({ where: { categoryId: c.id } }),
        ]);
        return {
          ...c,
          _count: {
            questions: questionsCount,
            testAttempts: testAttemptsCount,
          },
        };
      }),
    );

    return categoriesWithCounts;
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
    const existing = await this.categoryRepository.findOne({
      where: { slug: data.slug },
    });
    if (existing) {
      throw new BadRequestException("Bu slug allaqachon mavjud");
    }

    const category = this.categoryRepository.create(data);
    const savedCategory = await this.categoryRepository.save(category);

    // Notify all users about the new category (async, don't wait)
    this.notificationsService
      .notifyNewCategory({
        id: savedCategory.id,
        name: savedCategory.name,
        slug: savedCategory.slug,
        icon: savedCategory.icon,
      })
      .catch((err) => {
        console.error("Failed to send new category notifications:", err);
      });

    return savedCategory;
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
    },
  ) {
    const category = await this.categoryRepository.findOne({ where: { id } });
    if (!category) {
      throw new NotFoundException("Kategoriya topilmadi");
    }

    Object.assign(category, data);
    return this.categoryRepository.save(category);
  }

  async deleteCategory(id: string) {
    const category = await this.categoryRepository.findOne({ where: { id } });
    if (!category) {
      throw new NotFoundException("Kategoriya topilmadi");
    }

    // Delete all questions first
    await this.questionRepository.delete({ categoryId: id });

    return this.categoryRepository.remove(category);
  }

  // Parse namuna.txt format and import questions
  async importQuestionsFromText(categoryId: string, text: string) {
    const category = await this.categoryRepository.findOne({
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
    const existingQuestions = await this.questionRepository.find({
      where: { categoryId },
      select: ["question"],
    });
    const existingSet = new Set(
      existingQuestions.map((q) => q.question.toLowerCase().trim()),
    );

    const newQuestions = questions.filter(
      (q) => !existingSet.has(q.question.toLowerCase().trim()),
    );

    if (newQuestions.length === 0) {
      return {
        imported: 0,
        skipped: questions.length,
        message: "Barcha savollar allaqachon mavjud",
      };
    }

    const xpMap = { EASY: 5, MEDIUM: 10, HARD: 15 };

    const questionsToCreate = newQuestions.map((q) =>
      this.questionRepository.create({
        categoryId,
        question: q.question,
        options: q.options,
        correctAnswer: q.correctAnswer,
        // difficulty: q.difficulty as Difficulty,
        xpReward: xpMap[q.difficulty],
        isActive: true,
      }),
    );

    const created = await this.questionRepository.save(questionsToCreate);

    return {
      imported: created.length,
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
        `Kamida 300 ta savol kerak. Hozir: ${questions.length} ta`,
      );
    }

    // Check difficulty distribution (need all 3 levels)
    const difficulties = new Set(questions.map((q) => q.difficulty));
    if (difficulties.size < 3) {
      throw new BadRequestException(
        "Savollar 3 ta darajada (EASY, MEDIUM, HARD) bo'lishi kerak",
      );
    }

    // Check for duplicates within the questions
    const questionTexts = questions.map((q) => q.question.toLowerCase().trim());
    const uniqueQuestions = new Set(questionTexts);
    if (uniqueQuestions.size < questions.length) {
      throw new BadRequestException("Savollar orasida dublikatlar bor");
    }

    // Check if slug exists
    const existing = await this.categoryRepository.findOne({
      where: { slug: data.slug },
    });
    if (existing) {
      throw new BadRequestException("Bu slug allaqachon mavjud");
    }

    // Create category and questions in transaction
    const xpMap = { EASY: 5, MEDIUM: 10, HARD: 15 };

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const category = queryRunner.manager.create(Category, {
        name: data.name,
        slug: data.slug,
        description: data.description,
        icon: data.icon,
        color: data.color,
      });
      const savedCategory = await queryRunner.manager.save(category);

      const questionsToCreate = questions.map((q) =>
        queryRunner.manager.create(Question, {
          categoryId: savedCategory.id,
          question: q.question,
          options: q.options,
          correctAnswer: q.correctAnswer,
          // difficulty: q.difficulty as Difficulty,
          xpReward: xpMap[q.difficulty],
          isActive: true,
        }),
      );

      await queryRunner.manager.save(questionsToCreate);

      await queryRunner.commitTransaction();

      return {
        category: savedCategory,
        questionsImported: questions.length,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
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
    const admin = await this.userRepository.findOne({
      where: { id: adminId },
      select: ["id", "username", "avatar", "fullName"],
    });

    // Get target users
    let users: Array<{
      id: string;
      email: string | null;
      telegramId: string | null;
      fullName: string;
    }> = [];

    if (targetType === "all") {
      users = await this.userRepository.find({
        where: { isActive: true },
        select: ["id", "email", "telegramId", "fullName"],
      });
    } else if (targetType === "selected" && targetIds) {
      users = await this.userRepository.find({
        where: { id: In(targetIds), isActive: true },
        select: ["id", "email", "telegramId", "fullName"],
      });
    } else if (targetType === "filter" && filter) {
      const queryBuilder = this.userRepository
        .createQueryBuilder("user")
        .select(["user.id", "user.email", "user.telegramId", "user.fullName"])
        .where("user.isActive = :isActive", { isActive: true });

      if (filter.minLevel) {
        queryBuilder.andWhere("user.level >= :minLevel", {
          minLevel: filter.minLevel,
        });
      }
      if (filter.maxLevel) {
        queryBuilder.andWhere("user.level <= :maxLevel", {
          maxLevel: filter.maxLevel,
        });
      }
      if (filter.minXP) {
        queryBuilder.andWhere("user.totalXP >= :minXP", {
          minXP: filter.minXP,
        });
      }

      if (filter.inactiveDays) {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - filter.inactiveDays);
        queryBuilder.andWhere("user.lastActiveAt < :cutoff", { cutoff });
      }

      users = await queryBuilder.getMany();
    }

    if (users.length === 0) {
      throw new BadRequestException("Hech qanday foydalanuvchi topilmadi");
    }

    // Limit to 15 users for selected
    if (targetType === "selected" && users.length > 15) {
      throw new BadRequestException(
        "Bir vaqtda 15 tadan ko'p foydalanuvchiga xabar yuborib bo'lmaydi",
      );
    }

    let emailSent = 0;
    let telegramSent = 0;
    let notifSent = 0;

    // Send via channels
    for (const user of users) {
      // Send telegram
      if (channels.includes("telegram") && user.telegramId) {
        try {
          let telegramMessage = `*${title}*\n\n${message}`;
          await this.telegramService.sendMessage(
            parseInt(user.telegramId),
            telegramMessage,
          );
          telegramSent++;
        } catch (error) {
          console.error("Telegram error:", error);
        }
      }
    }

    // Save message record
    const adminMessage = this.adminMessageRepository.create({
      adminId,
      title,
      message,
      imageUrl,
      videoUrl,
      targetType,
      targetIds: users.map((u) => u.id),
      channels,
      sentAt: new Date(),
      telegramSent,
      notifSent,
    });
    await this.adminMessageRepository.save(adminMessage);

    return {
      messageId: adminMessage.id,
      recipientsCount: users.length,
      emailSent,
      telegramSent,
      notifSent,
    };
  }
}
