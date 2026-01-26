import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { ThrottlerModule } from "@nestjs/throttler";
import { ServeStaticModule } from "@nestjs/serve-static";
import { TypeOrmModule } from "@nestjs/typeorm";
import { join } from "path";

// Entities from modules
import { User } from "./modules/users/entities";
import { Category, CategoryStat } from "./modules/categories/entities";
import { Question } from "./modules/questions/entities";
import { TestAttempt, TestAnswer } from "./modules/tests/entities";
import { Achievement, UserAchievement } from "./modules/achievements/entities";
import { Notification } from "./modules/notifications/entities";
import { AIChat } from "./modules/ai/entities";
import { AdminMessage, Setting, DesignSetting } from "./modules/admin/entities";
import { WeeklyXP, MonthlyXP } from "./modules/leaderboard/entities";
import { EmailVerification } from "./modules/auth/entities";
import { Zikr, ZikrCompletion } from "./modules/zikr/entities";

// Modules
import { AuthModule } from "./modules/auth/auth.module";
import { UsersModule } from "./modules/users/users.module";
import { CategoriesModule } from "./modules/categories/categories.module";
import { QuestionsModule } from "./modules/questions/questions.module";
import { TestsModule } from "./modules/tests/tests.module";
import { LeaderboardModule } from "./modules/leaderboard/leaderboard.module";
import { AIModule } from "./modules/ai/ai.module";
import { AchievementsModule } from "./modules/achievements/achievements.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { AdminModule } from "./modules/admin/admin.module";
import { UploadModule } from "./modules/upload/upload.module";
import { TelegramModule } from "./modules/telegram/telegram.module";
import { StatsModule } from "./modules/stats/stats.module";
import { ZikrModule } from "./modules/zikr/zikr.module";
import { WebsocketModule } from "./modules/websocket/websocket.module";

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ".env",
    }),

    // Rate Limiting
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),

    // Static files (uploads)
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), "uploads"),
      serveRoot: "/uploads",
    }),

    // Database - TypeORM (asinxron yuklash)
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        // Avval alohida DB_* o'zgaruvchilarini tekshirish
        let host = configService.get<string>("DB_HOST");
        let port = configService.get<number>("DB_PORT");
        let username = configService.get<string>("DB_USERNAME");
        let password = configService.get<string>("DB_PASSWORD");
        let database = configService.get<string>("DB_DATABASE");

        // Agar alohida o'zgaruvchilar yo'q bo'lsa, DATABASE_URL dan olish
        if (!host || !password) {
          const dbUrl = configService.get<string>("DATABASE_URL");
          if (dbUrl) {
            try {
              const regex = /postgres:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/;
              const match = dbUrl.match(regex);
              if (match) {
                username = match[1];
                password = match[2];
                host = match[3];
                port = parseInt(match[4]);
                database = match[5];
              }
            } catch (e) {
              console.error("Error parsing DATABASE_URL:", e);
            }
          }
        }

        // Default qiymatlar
        host = host || "localhost";
        port = port || 5432;
        username = username || "postgres";
        password = password || "";
        database = database || "tavba";

        console.log(`Database connecting to: ${host}:${port}/${database}`);

        return {
          type: "postgres",
          host,
          port,
          username,
          password,
          database,
          entities: [
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
            EmailVerification,
            Zikr,
            ZikrCompletion,
          ],
          synchronize: false, // Production'da o'chirilgan - migration ishlatish kerak
          logging: false, // Disabled to reduce terminal noise
          ssl:
            configService.get("NODE_ENV") === "production"
              ? { rejectUnauthorized: false }
              : false,
        };
      },
    }),

    // Feature Modules
    AuthModule,
    UsersModule,
    CategoriesModule,
    QuestionsModule,
    TestsModule,
    LeaderboardModule,
    AIModule,
    AchievementsModule,
    NotificationsModule,
    AdminModule,
    UploadModule,
    TelegramModule,
    StatsModule,
    ZikrModule,
    WebsocketModule,
  ],
})
export class AppModule {}
