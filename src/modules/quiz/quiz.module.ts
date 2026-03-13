import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ConfigModule } from "@nestjs/config";
import { QuizController } from "./quiz.controller";
import { QuizService } from "./quiz.service";
import { QuizQuestion, QuizSession, QuizAnswer, QuizSettings } from "./entities";

@Module({
  imports: [
    TypeOrmModule.forFeature([QuizQuestion, QuizSession, QuizAnswer, QuizSettings]),
    ConfigModule,
  ],
  controllers: [QuizController],
  providers: [QuizService],
  exports: [QuizService],
})
export class QuizModule {}
