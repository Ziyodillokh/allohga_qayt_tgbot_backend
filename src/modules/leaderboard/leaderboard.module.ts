import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { LeaderboardController } from "./leaderboard.controller";
import { LeaderboardService } from "./leaderboard.service";
import { User } from "../users/entities";
import { CategoryStat } from "../categories/entities";
import { WeeklyXP, MonthlyXP } from "./entities";

@Module({
  imports: [
    TypeOrmModule.forFeature([User, CategoryStat, WeeklyXP, MonthlyXP]),
  ],
  controllers: [LeaderboardController],
  providers: [LeaderboardService],
  exports: [LeaderboardService],
})
export class LeaderboardModule {}
