import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { QuestionsController } from "./questions.controller";
import { QuestionsService } from "./questions.service";
import { Question } from "./entities";
import { Category } from "../categories/entities";

@Module({
  imports: [TypeOrmModule.forFeature([Question, Category])],
  controllers: [QuestionsController],
  providers: [QuestionsService],
  exports: [QuestionsService],
})
export class QuestionsModule {}
