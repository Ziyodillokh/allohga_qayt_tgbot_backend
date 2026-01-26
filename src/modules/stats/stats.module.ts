import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { StatsController } from "./stats.controller";
import { StatsService } from "./stats.service";
import { User } from "../users/entities";
import { Question } from "../questions/entities";
import { Category } from "../categories/entities";
import { TestAttempt } from "../tests/entities";
import { DesignSetting } from "../admin/entities";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Question,
      Category,
      TestAttempt,
      DesignSetting,
    ]),
  ],
  controllers: [StatsController],
  providers: [StatsService],
  exports: [StatsService],
})
export class StatsModule {}
