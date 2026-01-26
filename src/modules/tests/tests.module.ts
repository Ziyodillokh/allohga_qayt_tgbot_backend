import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { TestsController } from "./tests.controller";
import { TestsService } from "./tests.service";
import { UsersModule } from "../users/users.module";
import { QuestionsModule } from "../questions/questions.module";
import { AchievementsModule } from "../achievements/achievements.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { TestAttempt, TestAnswer } from "./entities";
import { Question } from "../questions/entities";
import { Category, CategoryStat } from "../categories/entities";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TestAttempt,
      TestAnswer,
      Question,
      Category,
      CategoryStat,
    ]),
    UsersModule,
    QuestionsModule,
    AchievementsModule,
    NotificationsModule,
  ],
  controllers: [TestsController],
  providers: [TestsService],
  exports: [TestsService],
})
export class TestsModule {}
