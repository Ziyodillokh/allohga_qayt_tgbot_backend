import { Module, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AchievementsController } from "./achievements.controller";
import { AchievementsService } from "./achievements.service";
import { NotificationsModule } from "../notifications/notifications.module";
import { UsersModule } from "../users/users.module";
import { Achievement, UserAchievement } from "./entities";
import { User } from "../users/entities";
import { TestAttempt } from "../tests/entities";
import { AIChat } from "../ai/entities";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Achievement,
      UserAchievement,
      User,
      TestAttempt,
      AIChat,
    ]),
    forwardRef(() => NotificationsModule),
    UsersModule,
  ],
  controllers: [AchievementsController],
  providers: [AchievementsService],
  exports: [AchievementsService],
})
export class AchievementsModule {}
