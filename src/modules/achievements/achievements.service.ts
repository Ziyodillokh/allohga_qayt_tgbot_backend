import { Injectable, Inject, forwardRef } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, Not, IsNull, MoreThan } from "typeorm";
import { NotificationsService } from "../notifications/notifications.service";
import { Achievement, UserAchievement } from "./entities";
import { User } from "../users/entities";
import { TestAttempt } from "../tests/entities";
import { AIChat } from "../ai/entities";
import { NotificationType } from "../notifications/entities/notification.entity";

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
    @InjectRepository(Achievement)
    private achievementRepository: Repository<Achievement>,
    @InjectRepository(UserAchievement)
    private userAchievementRepository: Repository<UserAchievement>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(TestAttempt)
    private testAttemptRepository: Repository<TestAttempt>,
    @InjectRepository(AIChat)
    private aiChatRepository: Repository<AIChat>,
    @Inject(forwardRef(() => NotificationsService))
    private notificationsService: NotificationsService,
  ) {}

  async getUserAchievements(userId: string) {
    const userAchievements = await this.userAchievementRepository.find({
      where: { userId },
      relations: ["achievement"],
      order: {
        unlockedAt: { direction: "DESC", nulls: "LAST" },
        progress: "DESC",
      },
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
    const achievements = await this.achievementRepository.find({
      where: { isActive: true },
    });

    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) return [];

    // Get counts
    const testAttemptsCount = await this.testAttemptRepository.count({
      where: { userId, completedAt: Not(IsNull()) },
    });

    const aiChatsCount = await this.aiChatRepository.count({
      where: { userId },
    });

    // Get additional stats
    const perfectTests = await this.testAttemptRepository.count({
      where: { userId, score: 100 },
    });

    const newlyUnlocked: any[] = [];

    for (const achievement of achievements) {
      const condition = achievement.condition as any as AchievementCondition;

      // Check if already unlocked
      const existing = await this.userAchievementRepository.findOne({
        where: { userId, achievementId: achievement.id },
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
          progress = testAttemptsCount;
          completed = testAttemptsCount >= condition.value;
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
          progress = aiChatsCount;
          completed = aiChatsCount >= condition.value;
          break;

        case "ranking":
        case "rank":
          // Get user's current rank
          const usersAbove = await this.userRepository.count({
            where: { totalXP: MoreThan(user.totalXP) },
          });
          const currentRank = usersAbove + 1;
          progress = currentRank;
          completed = currentRank <= condition.value;
          break;

        case "category_tests":
        case "category":
          if (condition.categoryId) {
            const categoryTests = await this.testAttemptRepository.count({
              where: {
                userId,
                categoryId: condition.categoryId,
                completedAt: Not(IsNull()),
              },
            });
            progress = categoryTests;
            completed = categoryTests >= condition.value;
          } else {
            // Any category with enough tests - use raw query for groupBy
            const categoryGroups = await this.testAttemptRepository
              .createQueryBuilder("ta")
              .select("ta.categoryId", "categoryId")
              .addSelect("COUNT(*)", "count")
              .where("ta.userId = :userId", { userId })
              .andWhere("ta.completedAt IS NOT NULL")
              .groupBy("ta.categoryId")
              .getRawMany();
            const maxCategoryTests = Math.max(
              ...categoryGroups.map((g) => parseInt(g.count)),
              0,
            );
            progress = maxCategoryTests;
            completed = maxCategoryTests >= condition.value;
          }
          break;

        case "categories":
          // Count unique categories where user has completed tests
          const uniqueCategories = await this.testAttemptRepository
            .createQueryBuilder("ta")
            .select("ta.categoryId", "categoryId")
            .where("ta.userId = :userId", { userId })
            .andWhere("ta.completedAt IS NOT NULL")
            .groupBy("ta.categoryId")
            .getRawMany();
          progress = uniqueCategories.length;
          completed = uniqueCategories.length >= condition.value;
          break;
      }

      // Update or create user achievement
      if (existing) {
        await this.userAchievementRepository.update(
          { id: existing.id },
          {
            progress,
            unlockedAt: completed ? new Date() : null,
          },
        );
      } else {
        const newUserAchievement = this.userAchievementRepository.create({
          userId,
          achievementId: achievement.id,
          progress,
          unlockedAt: completed ? new Date() : null,
        });
        await this.userAchievementRepository.save(newUserAchievement);
      }

      // If newly completed, add XP and notify
      if (completed && !existing?.unlockedAt) {
        // Add achievement XP
        if (achievement.xpReward > 0) {
          await this.userRepository.increment(
            { id: userId },
            "totalXP",
            achievement.xpReward,
          );
        }

        // Send notification
        await this.notificationsService.createNotification(userId, {
          title: "Yangi yutuq! 🏆",
          message: `Siz "${achievement.name}" yutuqiga erishdingiz! +${achievement.xpReward} XP`,
          type: NotificationType.ACHIEVEMENT,
          data: { achievementId: achievement.id },
        });

        newlyUnlocked.push(achievement);
      }
    }

    return newlyUnlocked;
  }
}
