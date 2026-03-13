import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ConfigModule } from "@nestjs/config";
import { QuizController } from "./quiz.controller";
import { QuizService } from "./quiz.service";
import { QuizQuestion, QuizSession, QuizAnswer } from "./entities";

@Module({
  imports: [
    TypeOrmModule.forFeature([QuizQuestion, QuizSession, QuizAnswer]),
    ConfigModule,
  ],
  controllers: [QuizController],
  providers: [QuizService],
  exports: [QuizService],
})
export class QuizModule {}
