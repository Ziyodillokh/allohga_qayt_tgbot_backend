import { Injectable, Inject, forwardRef } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";

interface AchievementCondition {
  type:
    | "xp"
    | "tests"
    | "perfect_tests"
    | "perfect"
    | "level"
    | "category_tests"
    | "category"
    | "categories"
    | "ai_chats"
    | "ai"
    | "ranking"
    | "rank";
  value: number;
  categoryId?: string;
}

@Injectable()
export class AchievementsService {
  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => NotificationsService))
    private notificationsService: NotificationsService
  ) {}

  // async getAllAchievements(userId?: string) {
  //   const achievements = await this.prisma.achievement.findMany({
  //     where: { isActive: true },
  //     orderBy: { order: "asc" },
  //   });

  //   if (!userId) {
  //     return achievements;
  //   }

  //   // Get user's achievement progress
  //   const userAchievements = await this.prisma.userAchievement.findMany({
  //     where: { userId },
  //   });

  //   const achievementMap = new Map(
  //     userAchievements.map((ua) => [ua.achievementId, ua])
  //   );

  //   return achievements.map((achievement) => {
  //     const userAchievement = achievementMap.get(achievement.id);
  //     return {
  //       ...achievement,
  //       progress: userAchievement?.progress || 0,
  //       unlocked: !!userAchievement?.unlockedAt,
  //       unlockedAt: userAchievement?.unlockedAt,
  //     };
  //   });
  // }

  async getUserAchievements(userId: string) {
    const userAchievements = await this.prisma.userAchievement.findMany({
      where: { userId },
      include: { achievement: true },
      orderBy: [
        { unlockedAt: { sort: "desc", nulls: "last" } },
        { progress: "desc" },
      ],
    });

    const unlocked = userAchievements.filter((ua) => ua.unlockedAt);
    const inProgress = userAchievements.filter((ua) => !ua.unlockedAt);

    return {
      unlocked,
      inProgress,
      totalUnlocked: unlocked.length,
    };
  }

  async checkAchievements(userId: string) {
    const achievements = await this.prisma.achievement.findMany({
      where: { isActive: true },
    });

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        _count: {
          select: {
            testAttempts: { where: { completedAt: { not: null } } },
            aiChats: true,
          },
        },
      },
    });

    if (!user) return [];

    // Get additional stats
    const perfectTests = await this.prisma.testAttempt.count({
      where: { userId, score: 100 },
    });

    const newlyUnlocked: any[] = [];

    for (const achievement of achievements) {
      const condition = achievement.condition as any as AchievementCondition;

      // Check if already unlocked
      const existing = await this.prisma.userAchievement.findUnique({
        where: {
          userId_achievementId: { userId, achievementId: achievement.id },
        },
      });

      if (existing?.unlockedAt) continue;

      // Calculate progress
      let progress = 0;
      let completed = false;

      switch (condition.type) {
        case "xp":
          progress = user.totalXP;
          completed = user.totalXP >= condition.value;
          break;

        case "tests":
          progress = user._count.testAttempts;
          completed = user._count.testAttempts >= condition.value;
          break;

        case "perfect_tests":
        case "perfect":
          progress = perfectTests;
          completed = perfectTests >= condition.value;
          break;

        case "level":
          progress = user.level;
          completed = user.level >= condition.value;
          break;

        case "ai_chats":
        case "ai":
          progress = user._count.aiChats;
          completed = user._count.aiChats >= condition.value;
          break;

        case "ranking":
        case "rank":
          // Get user's current rank
          const usersAbove = await this.prisma.user.count({
            where: { totalXP: { gt: user.totalXP } },
          });
          const currentRank = usersAbove + 1;
          progress = currentRank;
          completed = currentRank <= condition.value;
          break;

        case "category_tests":
        case "category":
          if (condition.categoryId) {
            const categoryTests = await this.prisma.testAttempt.count({
              where: {
                userId,
                categoryId: condition.categoryId,
                completedAt: { not: null },
              },
            });
            progress = categoryTests;
            completed = categoryTests >= condition.value;
          } else {
            // Any category with enough tests
            const categoryGroups = await this.prisma.testAttempt.groupBy({
              by: ["categoryId"],
              where: { userId, completedAt: { not: null } },
              _count: true,
            });
            const maxCategoryTests = Math.max(
              ...categoryGroups.map((g) => g._count),
              0
            );
            progress = maxCategoryTests;
            completed = maxCategoryTests >= condition.value;
          }
          break;

        case "categories":
          // Count unique categories where user has completed tests
          const uniqueCategories = await this.prisma.testAttempt.groupBy({
            by: ["categoryId"],
            where: { userId, completedAt: { not: null } },
          });
          progress = uniqueCategories.length;
          completed = uniqueCategories.length >= condition.value;
          break;
      }

      // Update or create user achievement
      if (existing) {
        await this.prisma.userAchievement.update({
          where: { id: existing.id },
          data: {
            progress,
            unlockedAt: completed ? new Date() : null,
          },
        });
      } else {
        await this.prisma.userAchievement.create({
          data: {
            userId,
            achievementId: achievement.id,
            progress,
            unlockedAt: completed ? new Date() : null,
          },
        });
      }

      // If newly completed, add XP and notify
      if (completed && !existing?.unlockedAt) {
        // Add achievement XP
        if (achievement.xpReward > 0) {
          await this.prisma.user.update({
            where: { id: userId },
            data: { totalXP: { increment: achievement.xpReward } },
          });
        }

        // Send notification
        await this.notificationsService.createNotification(userId, {
          title: "Yangi yutuq! 🏆",
          message: `Siz "${achievement.name}" yutuqiga erishdingiz! +${achievement.xpReward} XP`,
          type: "ACHIEVEMENT",
          data: { achievementId: achievement.id },
        });

        newlyUnlocked.push(achievement);
      }
    }

    return newlyUnlocked;
  }
}
