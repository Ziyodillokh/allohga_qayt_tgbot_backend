import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";
import { User } from "./entities";
import { CategoryStat } from "../categories/entities";
import { TestAttempt } from "../tests/entities";
import { WeeklyXP, MonthlyXP } from "../leaderboard/entities";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      CategoryStat,
      TestAttempt,
      WeeklyXP,
      MonthlyXP,
    ]),
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService, TypeOrmModule],
})
export class UsersModule {}
