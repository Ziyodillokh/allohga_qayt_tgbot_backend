import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { User } from "./entities";
import { CategoryStat } from "../categories/entities";
import { TestAttempt } from "../tests/entities";
import { WeeklyXP, MonthlyXP } from "../leaderboard/entities";
import { UpdateUserDto } from "./dto/update-user.dto";

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(CategoryStat)
    private categoryStatRepository: Repository<CategoryStat>,
    @InjectRepository(TestAttempt)
    private testAttemptRepository: Repository<TestAttempt>,
    @InjectRepository(WeeklyXP)
    private weeklyXPRepository: Repository<WeeklyXP>,
    @InjectRepository(MonthlyXP)
    private monthlyXPRepository: Repository<MonthlyXP>,
  ) {}

  private readonly LEVEL_THRESHOLDS = [
    0, 100, 250, 500, 1000, 2000, 3500, 5500, 8500, 13000, 20000,
  ];

  calculateLevel(totalXP: number): number {
    for (let i = this.LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
      if (totalXP >= this.LEVEL_THRESHOLDS[i]) {
        return i + 1;
      }
    }
    return 1;
  }

  getXPForNextLevel(level: number): number {
    if (level >= this.LEVEL_THRESHOLDS.length) {
      return (
        this.LEVEL_THRESHOLDS[this.LEVEL_THRESHOLDS.length - 1] +
        (level - this.LEVEL_THRESHOLDS.length + 1) * 10000
      );
    }
    return this.LEVEL_THRESHOLDS[level];
  }

  async findById(id: string) {
    const user = await this.userRepository.findOne({
      where: { id },
      select: [
        "id",
        "email",
        "username",
        "fullName",
        "avatar",
        "bio",
        "totalXP",
        "level",
        "role",
        "createdAt",
      ],
    });

    if (!user) {
      throw new NotFoundException("Foydalanuvchi topilmadi");
    }

    return user;
  }

  async findByUsername(username: string) {
    const user = await this.userRepository.findOne({
      where: { username },
      relations: ["testAttempts", "userAchievements"],
    });

    if (!user) {
      throw new NotFoundException("Foydalanuvchi topilmadi");
    }

    const testAttemptsCount = user.testAttempts?.length || 0;
    const unlockedAchievements =
      user.userAchievements?.filter((ua) => ua.unlockedAt).length || 0;

    const { password, testAttempts, userAchievements, ...rest } = user;

    return {
      ...rest,
      _count: {
        testAttempts: testAttemptsCount,
        userAchievements: unlockedAchievements,
      },
    };
  }

  async getFullProfile(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: [
        "categoryStats",
        "categoryStats.category",
        "userAchievements",
        "userAchievements.achievement",
        "testAttempts",
        "testAttempts.category",
        "aiChats",
      ],
    });

    if (!user) {
      throw new NotFoundException("Foydalanuvchi topilmadi");
    }

    const xpForCurrentLevel = this.LEVEL_THRESHOLDS[user.level - 1] || 0;
    const xpForNextLevel = this.getXPForNextLevel(user.level);
    const xpProgress = user.totalXP - xpForCurrentLevel;
    const xpNeeded = xpForNextLevel - xpForCurrentLevel;

    const testAttemptsCount = user.testAttempts?.length || 0;
    const unlockedAchievements =
      user.userAchievements?.filter((ua) => ua.unlockedAt).length || 0;
    const aiChatsCount = user.aiChats?.length || 0;

    const { password, ...userWithoutPassword } = user;

    return {
      ...userWithoutPassword,
      xpProgress,
      xpNeeded,
      progressPercent: Math.round((xpProgress / xpNeeded) * 100),
      _count: {
        testAttempts: testAttemptsCount,
        userAchievements: unlockedAchievements,
        aiChats: aiChatsCount,
      },
    };
  }

  async updateProfile(userId: string, dto: UpdateUserDto) {
    if (dto.username) {
      const existingUser = await this.userRepository.findOne({
        where: { username: dto.username },
      });

      if (existingUser && existingUser.id !== userId) {
        throw new BadRequestException("Bu username allaqachon band");
      }
    }

    await this.userRepository.update(userId, dto);

    return this.userRepository.findOne({
      where: { id: userId },
      select: [
        "id",
        "email",
        "username",
        "fullName",
        "avatar",
        "bio",
        "totalXP",
        "level",
        "updatedAt",
      ],
    });
  }

  async addXP(
    userId: string,
    xpAmount: number,
  ): Promise<{ newXP: number; newLevel: number; leveledUp: boolean }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException("Foydalanuvchi topilmadi");
    }

    const newTotalXP = user.totalXP + xpAmount;
    const newLevel = this.calculateLevel(newTotalXP);
    const leveledUp = newLevel > user.level;

    await this.userRepository.update(userId, {
      totalXP: newTotalXP,
      level: newLevel,
    });

    // Update weekly and monthly XP
    const now = new Date();
    const weekStart = this.getWeekStart(now);
    const monthStart = this.getMonthStart(now);

    // Update weekly XP
    let weeklyXP = await this.weeklyXPRepository.findOne({
      where: { userId, weekStart },
    });

    if (weeklyXP) {
      weeklyXP.xp += xpAmount;
    } else {
      weeklyXP = this.weeklyXPRepository.create({
        userId,
        weekStart,
        xp: xpAmount,
      });
    }
    await this.weeklyXPRepository.save(weeklyXP);

    // Update monthly XP
    let monthlyXP = await this.monthlyXPRepository.findOne({
      where: { userId, monthStart },
    });

    if (monthlyXP) {
      monthlyXP.xp += xpAmount;
    } else {
      monthlyXP = this.monthlyXPRepository.create({
        userId,
        monthStart,
        xp: xpAmount,
      });
    }
    await this.monthlyXPRepository.save(monthlyXP);

    return { newXP: newTotalXP, newLevel, leveledUp };
  }

  async incrementTestsCompleted(
    userId: string,
    count: number = 1,
  ): Promise<void> {
    await this.userRepository.increment(
      { id: userId },
      "testsCompleted",
      count,
    );
  }

  async incrementZikrCount(userId: string, count: number = 1): Promise<void> {
    await this.userRepository.increment({ id: userId }, "zikrCount", count);
  }

  async getStatsByCategory(userId: string) {
    return this.categoryStatRepository.find({
      where: { userId },
      relations: ["category"],
      order: { totalXP: "DESC" },
    });
  }

  async getTestHistory(userId: string, page = 1, limit = 10) {
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

  private getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private getMonthStart(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
  }
}

// TypeORM operators
import { Not, IsNull } from "typeorm";
