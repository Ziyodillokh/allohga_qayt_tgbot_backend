import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, MoreThan } from "typeorm";
import { User } from "../users/entities";
import { CategoryStat } from "../categories/entities";
import { WeeklyXP, MonthlyXP } from "./entities";

@Injectable()
export class LeaderboardService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(CategoryStat)
    private categoryStatRepository: Repository<CategoryStat>,
    @InjectRepository(WeeklyXP)
    private weeklyXPRepository: Repository<WeeklyXP>,
    @InjectRepository(MonthlyXP)
    private monthlyXPRepository: Repository<MonthlyXP>,
  ) {}

  async getGlobalLeaderboard(limit = 100, userId?: string) {
    const users = await this.userRepository
      .createQueryBuilder("user")
      .leftJoin(
        "user.testAttempts",
        "testAttempt",
        "testAttempt.completedAt IS NOT NULL",
      )
      .select([
        "user.id",
        "user.username",
        "user.fullName",
        "user.avatar",
        "user.totalXP",
        "user.level",
      ])
      .addSelect("COUNT(testAttempt.id)", "testsCount")
      .where("user.isActive = :isActive", { isActive: true })
      .groupBy("user.id")
      .orderBy("user.totalXP", "DESC")
      .limit(limit)
      .getRawAndEntities();

    const leaderboard = users.entities.map((user, index) => ({
      rank: index + 1,
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      avatar: user.avatar,
      totalXP: user.totalXP,
      level: user.level,
      testsCount: parseInt(users.raw[index]?.testsCount || "0", 10),
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

  async getCategoryLeaderboard(
    categoryId: string,
    limit = 50,
    userId?: string,
  ) {
    const stats = await this.categoryStatRepository.find({
      where: { categoryId },
      relations: ["user"],
      order: { totalXP: "DESC" },
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

    const weeklyStats = await this.weeklyXPRepository.find({
      where: { weekStart },
      relations: ["user"],
      order: { xp: "DESC" },
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

    const monthlyStats = await this.monthlyXPRepository.find({
      where: { monthStart },
      relations: ["user"],
      order: { xp: "DESC" },
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
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ["totalXP"],
    });

    if (!user) return null;

    const rank = await this.userRepository.count({
      where: {
        isActive: true,
        totalXP: MoreThan(user.totalXP),
      },
    });

    return rank + 1;
  }

  async getUserCategoryRank(userId: string, categoryId: string) {
    const stat = await this.categoryStatRepository.findOne({
      where: { userId, categoryId },
    });

    if (!stat) return null;

    const rank = await this.categoryStatRepository.count({
      where: {
        categoryId,
        totalXP: MoreThan(stat.totalXP),
      },
    });

    return rank + 1;
  }

  async getUserWeeklyRank(userId: string) {
    const weekStart = this.getWeekStart(new Date());

    const stat = await this.weeklyXPRepository.findOne({
      where: { userId, weekStart },
    });

    if (!stat) return null;

    const rank = await this.weeklyXPRepository.count({
      where: {
        weekStart,
        xp: MoreThan(stat.xp),
      },
    });

    return rank + 1;
  }

  async getUserMonthlyRank(userId: string) {
    const monthStart = this.getMonthStart(new Date());

    const stat = await this.monthlyXPRepository.findOne({
      where: { userId, monthStart },
    });

    if (!stat) return null;

    const rank = await this.monthlyXPRepository.count({
      where: {
        monthStart,
        xp: MoreThan(stat.xp),
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
