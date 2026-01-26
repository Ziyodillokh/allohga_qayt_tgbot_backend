import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AIController } from "./ai.controller";
import { AIService } from "./ai.service";
import { AIChat } from "./entities";
import { User } from "../users/entities";
import { Category } from "../categories/entities";

@Module({
  imports: [TypeOrmModule.forFeature([AIChat, User, Category])],
  controllers: [AIController],
  providers: [AIService],
  exports: [AIService],
})
export class AIModule {}
