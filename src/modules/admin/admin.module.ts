import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { JwtModule } from "@nestjs/jwt";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { AdminController } from "./admin.controller";
import { AdminService } from "./admin.service";
import { AdminGateway } from "./admin.gateway";
import { NotificationsModule } from "../notifications/notifications.module";
import { MailModule } from "../mail/mail.module";
import { TelegramModule } from "../telegram/telegram.module";
import { User } from "../users/entities";
import { Category, CategoryStat } from "../categories/entities";
import { Question } from "../questions/entities";
import { TestAttempt, TestAnswer } from "../tests/entities";
import { AIChat } from "../ai/entities";
import { Achievement, UserAchievement } from "../achievements/entities";
import { Notification } from "../notifications/entities";
import { AdminMessage, Setting, DesignSetting } from "./entities";
import { WeeklyXP, MonthlyXP } from "../leaderboard/entities";
import { Zikr, ZikrCompletion } from "../zikr/entities";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Category,
      Question,
      TestAttempt,
      TestAnswer,
      CategoryStat,
      AIChat,
      Achievement,
      UserAchievement,
      Notification,
      AdminMessage,
      WeeklyXP,
      MonthlyXP,
      Setting,
      DesignSetting,
      Zikr,
      ZikrCompletion,
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get("JWT_SECRET"),
      }),
      inject: [ConfigService],
    }),
    NotificationsModule,
    MailModule,
    TelegramModule,
  ],
  controllers: [AdminController],
  providers: [AdminService, AdminGateway],
  exports: [AdminService, AdminGateway],
})
export class AdminModule {}
