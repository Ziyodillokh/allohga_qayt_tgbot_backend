import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class LeaderboardService {
  constructor(private prisma: PrismaService) {}

  async getGlobalLeaderboard(limit = 100, userId?: string) {
    const users = await this.prisma.user.findMany({
      where: { isActive: true },
      select: {
        id: true,
        username: true,
        fullName: true,
        avatar: true,
        totalXP: true,
        level: true,
        _count: {
          select: { testAttempts: { where: { completedAt: { not: null } } } },
        },
      },
      orderBy: { totalXP: 'desc' },
      take: limit,
    });

    const leaderboard = users.map((user, index) => ({
      rank: index + 1,
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      avatar: user.avatar,
      totalXP: user.totalXP,
      level: user.level,
      testsCount: user._count.testAttempts,
    }));

    // Get current user's rank if provided
    let userRank: number | null = null;
    if (userId) {
      userRank = await this.getUserGlobalRank(userId);
    }

    return {
      leaderboard,
      userRank,
    };
  }

  async getCategoryLeaderboard(categoryId: string, limit = 50, userId?: string) {
    const stats = await this.prisma.categoryStat.findMany({
      where: { categoryId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            fullName: true,
            avatar: true,
            level: true,
          },
        },
      },
      orderBy: { totalXP: 'desc' },
      take: limit,
    });

    const leaderboard = stats.map((stat, index) => ({
      rank: index + 1,
      id: stat.user.id,
      username: stat.user.username,
      fullName: stat.user.fullName,
      avatar: stat.user.avatar,
      level: stat.user.level,
      totalXP: stat.totalXP,
      testsCount: stat.totalTests,
      averageScore: stat.averageScore,
      bestScore: stat.bestScore,
    }));

    // Get current user's rank if provided
    let userRank: number | null = null;
    if (userId) {
      userRank = await this.getUserCategoryRank(userId, categoryId);
    }

    return {
      leaderboard,
      userRank,
    };
  }

  async getWeeklyLeaderboard(limit = 100, userId?: string) {
    const weekStart = this.getWeekStart(new Date());

    const weeklyStats = await this.prisma.weeklyXP.findMany({
      where: { weekStart },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            fullName: true,
            avatar: true,
            level: true,
          },
        },
      },
      orderBy: { xp: 'desc' },
      take: limit,
    });

    const leaderboard = weeklyStats.map((stat, index) => ({
      rank: index + 1,
      id: stat.user.id,
      username: stat.user.username,
      fullName: stat.user.fullName,
      avatar: stat.user.avatar,
      level: stat.user.level,
      weeklyXP: stat.xp,
    }));

    // Get current user's rank if provided
    let userRank: number | null = null;
    if (userId) {
      userRank = await this.getUserWeeklyRank(userId);
    }

    return {
      leaderboard,
      weekStart,
      userRank,
    };
  }

  async getMonthlyLeaderboard(limit = 100, userId?: string) {
    const monthStart = this.getMonthStart(new Date());

    const monthlyStats = await this.prisma.monthlyXP.findMany({
      where: { monthStart },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            fullName: true,
            avatar: true,
            level: true,
          },
        },
      },
      orderBy: { xp: 'desc' },
      take: limit,
    });

    const leaderboard = monthlyStats.map((stat, index) => ({
      rank: index + 1,
      id: stat.user.id,
      username: stat.user.username,
      fullName: stat.user.fullName,
      avatar: stat.user.avatar,
      level: stat.user.level,
      monthlyXP: stat.xp,
    }));

    // Get current user's rank if provided
    let userRank: number | null = null;
    if (userId) {
      userRank = await this.getUserMonthlyRank(userId);
    }

    return {
      leaderboard,
      monthStart,
      userRank,
    };
  }

  async getUserGlobalRank(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { totalXP: true },
    });

    if (!user) return null;

    const rank = await this.prisma.user.count({
      where: {
        isActive: true,
        totalXP: { gt: user.totalXP },
      },
    });

    return rank + 1;
  }

  async getUserCategoryRank(userId: string, categoryId: string) {
    const stat = await this.prisma.categoryStat.findUnique({
      where: { userId_categoryId: { userId, categoryId } },
    });

    if (!stat) return null;

    const rank = await this.prisma.categoryStat.count({
      where: {
        categoryId,
        totalXP: { gt: stat.totalXP },
      },
    });

    return rank + 1;
  }

  async getUserWeeklyRank(userId: string) {
    const weekStart = this.getWeekStart(new Date());

    const stat = await this.prisma.weeklyXP.findUnique({
      where: { userId_weekStart: { userId, weekStart } },
    });

    if (!stat) return null;

    const rank = await this.prisma.weeklyXP.count({
      where: {
        weekStart,
        xp: { gt: stat.xp },
      },
    });

    return rank + 1;
  }

  async getUserMonthlyRank(userId: string) {
    const monthStart = this.getMonthStart(new Date());

    const stat = await this.prisma.monthlyXP.findUnique({
      where: { userId_monthStart: { userId, monthStart } },
    });

    if (!stat) return null;

    const rank = await this.prisma.monthlyXP.count({
      where: {
        monthStart,
        xp: { gt: stat.xp },
      },
    });

    return rank + 1;
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
