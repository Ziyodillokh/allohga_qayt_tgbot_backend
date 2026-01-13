import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { UpdateUserDto } from "./dto/update-user.dto";

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  // XP va level tizimi
  private readonly LEVEL_THRESHOLDS = [
    0, // Level 1: 0-99
    100, // Level 2: 100-249
    250, // Level 3: 250-499
    500, // Level 4: 500-999
    1000, // Level 5: 1000-1999
    2000, // Level 6: 2000-3499
    3500, // Level 7: 3500-5499
    5500, // Level 8: 5500-8499
    8500, // Level 9: 8500-12999
    13000, // Level 10: 13000-19999
    20000, // Level 11+
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
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        username: true,
        fullName: true,
        avatar: true,
        bio: true,
        totalXP: true,
        level: true,
        role: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException("Foydalanuvchi topilmadi");
    }

    return user;
  }

  async findByUsername(username: string) {
    const user = await this.prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        username: true,
        fullName: true,
        avatar: true,
        bio: true,
        totalXP: true,
        level: true,
        createdAt: true,
        _count: {
          select: {
            testAttempts: true,
            userAchievements: { where: { unlockedAt: { not: null } } },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException("Foydalanuvchi topilmadi");
    }

    return user;
  }

  async getFullProfile(userId: string) {
    console.log("[UsersService] getFullProfile called for userId:", userId);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        categoryStats: {
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
          orderBy: { totalXP: "desc" },
        },
        userAchievements: {
          where: { unlockedAt: { not: null } },
          include: {
            achievement: true,
          },
          orderBy: { unlockedAt: "desc" },
          take: 10,
        },
        testAttempts: {
          orderBy: { createdAt: "desc" },
          take: 10,
          include: {
            category: {
              select: { id: true, name: true, slug: true, icon: true },
            },
          },
        },
        _count: {
          select: {
            testAttempts: true,
            userAchievements: { where: { unlockedAt: { not: null } } },
            aiChats: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException("Foydalanuvchi topilmadi");
    }

    console.log("[UsersService] User avatar from DB:", user.avatar);

    // Calculate additional stats
    const xpForCurrentLevel = this.LEVEL_THRESHOLDS[user.level - 1] || 0;
    const xpForNextLevel = this.getXPForNextLevel(user.level);
    const xpProgress = user.totalXP - xpForCurrentLevel;
    const xpNeeded = xpForNextLevel - xpForCurrentLevel;

    const { password, ...userWithoutPassword } = user;

    return {
      ...userWithoutPassword,
      xpProgress,
      xpNeeded,
      progressPercent: Math.round((xpProgress / xpNeeded) * 100),
    };
  }

  async updateProfile(userId: string, dto: UpdateUserDto) {
    // Check if username is already taken
    if (dto.username) {
      const existingUser = await this.prisma.user.findFirst({
        where: {
          username: dto.username,
          NOT: { id: userId },
        },
      });

      if (existingUser) {
        throw new BadRequestException("Bu username allaqachon band");
      }
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: dto,
      select: {
        id: true,
        email: true,
        username: true,
        fullName: true,
        avatar: true,
        bio: true,
        totalXP: true,
        level: true,
        updatedAt: true,
      },
    });

    return user;
  }

  async addXP(
    userId: string,
    xpAmount: number
  ): Promise<{ newXP: number; newLevel: number; leveledUp: boolean }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException("Foydalanuvchi topilmadi");
    }

    const newTotalXP = user.totalXP + xpAmount;
    const newLevel = this.calculateLevel(newTotalXP);
    const leveledUp = newLevel > user.level;

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        totalXP: newTotalXP,
        level: newLevel,
      },
    });

    // Update weekly and monthly XP
    const now = new Date();
    const weekStart = this.getWeekStart(now);
    const monthStart = this.getMonthStart(now);

    // Update weekly XP
    await this.prisma.weeklyXP.upsert({
      where: {
        userId_weekStart: { userId, weekStart },
      },
      update: {
        xp: { increment: xpAmount },
      },
      create: {
        userId,
        weekStart,
        xp: xpAmount,
      },
    });

    // Update monthly XP
    await this.prisma.monthlyXP.upsert({
      where: {
        userId_monthStart: { userId, monthStart },
      },
      update: {
        xp: { increment: xpAmount },
      },
      create: {
        userId,
        monthStart,
        xp: xpAmount,
      },
    });

    return {
      newXP: newTotalXP,
      newLevel,
      leveledUp,
    };
  }

  async getStatsByCategory(userId: string) {
    return this.prisma.categoryStat.findMany({
      where: { userId },
      include: {
        category: {
          select: { id: true, name: true, slug: true, icon: true, color: true },
        },
      },
      orderBy: { totalXP: "desc" },
    });
  }

  async getTestHistory(userId: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const [tests, total] = await Promise.all([
      this.prisma.testAttempt.findMany({
        where: {
          userId,
          completedAt: { not: null }, // Faqat tugallangan testlar
        },
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
        orderBy: { completedAt: "desc" }, // Tugallangan sanasi bo'yicha
        skip,
        take: limit,
      }),
      this.prisma.testAttempt.count({
        where: {
          userId,
          completedAt: { not: null },
        },
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
