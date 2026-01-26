import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CategoriesController } from "./categories.controller";
import { CategoriesService } from "./categories.service";
import { Category } from "./entities";
import { Question } from "../questions/entities";
import { TestAttempt } from "../tests/entities";

@Module({
  imports: [TypeOrmModule.forFeature([Category, Question, TestAttempt])],
  controllers: [CategoriesController],
  providers: [CategoriesService],
  exports: [CategoriesService],
})
export class CategoriesModule {}
