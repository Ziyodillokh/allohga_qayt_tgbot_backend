import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, MoreThanOrEqual, DataSource } from "typeorm";
import { Zikr, ZikrCompletion } from "./entities";
import { User } from "../users/entities";
import { CreateZikrDto, UpdateZikrDto } from "./dto";
import { WebsocketGateway } from "../websocket/websocket.service";
import { AdminGateway } from "../admin/admin.gateway";
import { UsersService } from "../users/users.service";

@Injectable()
export class ZikrService {
  constructor(
    @InjectRepository(Zikr)
    private zikrRepository: Repository<Zikr>,
    @InjectRepository(ZikrCompletion)
    private zikrCompletionRepository: Repository<ZikrCompletion>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private websocketGateway: WebsocketGateway,
    @Inject(forwardRef(() => AdminGateway))
    private adminGateway: AdminGateway,
    private usersService: UsersService,
    private dataSource: DataSource,
  ) {}

  // Bugungi kunning zikrlarini olish
  async getTodayZikrs(isRamadan: boolean = false) {
    // Bugungi hafta kunini olish (0-6)
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = Yakshanba, 1 = Dushanba, ...

    return this.zikrRepository.find({
      where: {
        dayOfWeek,
        isRamadan,
        isActive: true,
      },
      order: { order: "ASC" },
    });
  }

  // Ma'lum kunning zikrlarini olish
  async getZikrsByDay(dayOfWeek: number, isRamadan: boolean = false) {
    return this.zikrRepository.find({
      where: {
        dayOfWeek,
        isRamadan,
        isActive: true,
      },
      order: { order: "ASC" },
    });
  }

  // Haftalik barcha zikrlarni olish
  async getWeeklyZikrs(isRamadan: boolean = false) {
    const zikrs = await this.zikrRepository.find({
      where: {
        isRamadan,
        isActive: true,
      },
      order: { dayOfWeek: "ASC", order: "ASC" },
    });

    // Kunlar bo'yicha guruhlab berish
    const weekDays = [
      "Yakshanba",
      "Dushanba",
      "Seshanba",
      "Chorshanba",
      "Payshanba",
      "Juma",
      "Shanba",
    ];

    const grouped = weekDays.map((name, index) => ({
      day: index,
      dayName: name,
      zikrs: zikrs.filter((z) => z.dayOfWeek === index),
    }));

    return grouped;
  }

  // Barcha zikrlarni olish (Admin uchun)
  async findAll(includeInactive: boolean = false) {
    return this.zikrRepository.find({
      where: includeInactive ? {} : { isActive: true },
      order: { dayOfWeek: "ASC", order: "ASC" },
    });
  }

  // ID bo'yicha zikrni olish
  async findById(id: string) {
    const zikr = await this.zikrRepository.findOne({
      where: { id },
    });

    if (!zikr) {
      throw new NotFoundException("Zikr topilmadi");
    }

    return zikr;
  }

  // Yangi zikr yaratish
  async create(dto: CreateZikrDto) {
    // XP = zikr soni (masalan 33 ta = 33 XP, 100 ta = 100 XP)
    const xpReward = dto.xpReward ?? dto.count;

    const zikr = this.zikrRepository.create({
      titleArabic: dto.titleArabic,
      titleLatin: dto.titleLatin,
      textArabic: dto.textArabic,
      textLatin: dto.textLatin,
      description: dto.description,
      count: dto.count,
      emoji: dto.emoji || "📿",
      dayOfWeek: dto.dayOfWeek,
      isRamadan: dto.isRamadan || false,
      order: dto.order || 0,
      xpReward,
      isActive: dto.isActive ?? true,
    });

    return this.zikrRepository.save(zikr);
  }

  // Zikrni yangilash
  async update(id: string, dto: UpdateZikrDto) {
    await this.findById(id); // Mavjudligini tekshirish

    await this.zikrRepository.update(id, dto);
    return this.findById(id);
  }

  // Zikrni o'chirish
  async delete(id: string) {
    await this.findById(id); // Mavjudligini tekshirish

    await this.zikrRepository.delete(id);
    return { deleted: true };
  }

  // Statistika
  async getStats() {
    const total = await this.zikrRepository.count();
    const active = await this.zikrRepository.count({
      where: { isActive: true },
    });
    const ramadan = await this.zikrRepository.count({
      where: { isRamadan: true },
    });

    // Har bir kun uchun zikrlar soni
    const byDay = await this.zikrRepository
      .createQueryBuilder("zikr")
      .select("zikr.dayOfWeek", "dayOfWeek")
      .addSelect("COUNT(*)", "count")
      .where("zikr.isActive = :isActive", { isActive: true })
      .groupBy("zikr.dayOfWeek")
      .getRawMany();

    const weekDays = [
      "Yakshanba",
      "Dushanba",
      "Seshanba",
      "Chorshanba",
      "Payshanba",
      "Juma",
      "Shanba",
    ];

    const dayStats = weekDays.map((name, index) => ({
      day: index,
      dayName: name,
      count: parseInt(byDay.find((b) => b.dayOfWeek === index)?.count) || 0,
    }));

    // Jami zikr completionlar
    const totalCompletions = await this.zikrCompletionRepository.count();
    const todayCompletions = await this.zikrCompletionRepository.count({
      where: {
        completedAt: MoreThanOrEqual(new Date(new Date().setHours(0, 0, 0, 0))),
      },
    });

    return {
      total,
      active,
      ramadan,
      byDay: dayStats,
      completions: {
        total: totalCompletions,
        today: todayCompletions,
      },
    };
  }

  // Zikr yakunlash va XP berish
  async completeZikr(userId: string, zikrId: string) {
    const zikr = await this.findById(zikrId);

    // Bugun allaqachon tugatilganligini tekshirish (XP farming oldini olish)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existingCompletion = await this.zikrCompletionRepository.findOne({
      where: {
        userId,
        zikrId,
        completedAt: MoreThanOrEqual(today),
      },
    });

    if (existingCompletion) {
      throw new BadRequestException(
        "Bu zikr bugun allaqachon tugatilgan. Ertaga qaytadan urinib ko'ring.",
      );
    }

    // XP = zikr soni (masalan 33 ta = 33 XP, 100 ta = 100 XP)
    const xpEarned = zikr.count;

    // Transaction ishlatish — barcha operatsiyalar birga amalga oshadi yoki bekor bo'ladi
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Zikr completion yaratish
      const completion = this.zikrCompletionRepository.create({
        userId,
        zikrId,
        xpEarned,
      });
      await queryRunner.manager.save(completion);

      // Zikr count va lastActiveAt atomik yangilash
      await queryRunner.manager.increment(
        User,
        { id: userId },
        "zikrCount",
        zikr.count,
      );
      await queryRunner.manager.update(User, userId, {
        lastActiveAt: new Date(),
      });

      await queryRunner.commitTransaction();

      // XP ni addXP() orqali qo'shish — level, weekly/monthly XP to'g'ri hisoblanadi
      const xpResult = await this.usersService.addXP(userId, xpEarned);
      const newLevel = xpResult.newLevel;

      const user = await this.userRepository.findOne({
        where: { id: userId },
      });

      if (!user) {
        throw new NotFoundException("Foydalanuvchi topilmadi");
      }

      // WebSocket notification yuborish
      this.websocketGateway.completedZikrNotification({
        id: zikr.id,
        titleLatin: zikr.titleLatin,
        user: { fullName: user.fullName, username: user.username },
        completions: [completion],
      });

      // Admin panelga notification yuborish
      this.adminGateway.notifyZikrCompleted({
        id: zikr.id,
        title: zikr.titleLatin,
        emoji: zikr.emoji,
        xpEarned,
        user: {
          id: user.id,
          fullName: user.fullName,
          username: user.username,
        },
        completedAt: new Date(),
      });

      return {
        completion,
        xpEarned,
        totalXP: user.totalXP,
        zikrCount: user.zikrCount,
        level: newLevel,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  // User uchun bugungi zikr holatini olish
  async getUserTodayZikrs(userId: string) {
    const today = new Date();
    const dayOfWeek = today.getDay();
    today.setHours(0, 0, 0, 0);

    const zikrs = await this.zikrRepository.find({
      where: {
        dayOfWeek,
        isRamadan: false,
        isActive: true,
      },
      order: { order: "ASC" },
    });

    const completions = await this.zikrCompletionRepository.find({
      where: {
        userId,
        completedAt: MoreThanOrEqual(today),
      },
    });

    const completedZikrIds = completions.map((c) => c.zikrId);

    return zikrs.map((zikr) => ({
      ...zikr,
      isCompleted: completedZikrIds.includes(zikr.id),
    }));
  }

  // User statistikasi
  async getUserZikrStats(userId: string) {
    const totalCompletions = await this.zikrCompletionRepository.count({
      where: { userId },
    });

    // Total XP earned from zikr completions
    const totalXpEarned = await this.zikrCompletionRepository
      .createQueryBuilder("completion")
      .select("COALESCE(SUM(completion.xpEarned), 0)", "sum")
      .where("completion.userId = :userId", { userId })
      .getRawOne();

    // Kunlik streak hisoblash
    const recentCompletions = await this.zikrCompletionRepository
      .createQueryBuilder("completion")
      .select("DATE(completion.completedAt)", "date")
      .where("completion.userId = :userId", { userId })
      .groupBy("DATE(completion.completedAt)")
      .orderBy("date", "DESC")
      .limit(30)
      .getRawMany();

    return {
      totalCompletions,
      totalXpEarned: parseInt(totalXpEarned?.sum) || 0,
      recentDays: recentCompletions.length,
    };
  }
}
