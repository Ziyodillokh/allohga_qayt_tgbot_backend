import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { QuizService } from "./quiz.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { AdminOnlyGuard } from "../auth/guards/admin-only.guard";
import {
  ImportQuizQuestionsDto,
  GetQuizQuestionsDto,
  GetQuizSessionsDto,
} from "./dto";

@ApiTags("Quiz")
@ApiBearerAuth()
@Controller("quiz")
@UseGuards(JwtAuthGuard, RolesGuard, AdminOnlyGuard)
export class QuizController {
  constructor(private readonly quizService: QuizService) {}

  @Post("questions/import")
  @ApiOperation({ summary: "Import quiz questions from text" })
  importQuestions(@Body() dto: ImportQuizQuestionsDto) {
    return this.quizService.importQuestions(dto.text);
  }

  @Get("questions")
  @ApiOperation({ summary: "Get all quiz questions (paginated)" })
  getQuestions(@Query() dto: GetQuizQuestionsDto) {
    return this.quizService.getAllQuestions(dto.page, dto.limit);
  }

  @Get("questions/count")
  @ApiOperation({ summary: "Get total quiz question count" })
  async getQuestionCount() {
    const count = await this.quizService.getQuestionCount();
    return { count };
  }

  @Delete("questions/:id")
  @ApiOperation({ summary: "Delete a quiz question" })
  async deleteQuestion(@Param("id") id: string) {
    await this.quizService.deleteQuestion(id);
    return { success: true };
  }

  @Delete("questions")
  @ApiOperation({ summary: "Delete all quiz questions" })
  deleteAllQuestions() {
    return this.quizService.deleteAllQuestions();
  }

  @Get("sessions")
  @ApiOperation({ summary: "Get quiz session history" })
  getSessions(@Query() dto: GetQuizSessionsDto) {
    return this.quizService.getSessionHistory(dto.page, dto.limit);
  }

  // ==================== SETTINGS ====================

  @Get("settings")
  @ApiOperation({ summary: "Get quiz settings" })
  getSettings() {
    return this.quizService.getSettings();
  }

  @Put("settings")
  @ApiOperation({ summary: "Update quiz settings" })
  updateSettings(
    @Body() body: { answerTimeSeconds?: number; waitTimeSeconds?: number },
  ) {
    return this.quizService.updateSettings(body);
  }

  // ==================== LEADERBOARD ====================

  @Get("leaderboard")
  @ApiOperation({ summary: "Get all-time leaderboard (top 10)" })
  getLeaderboard() {
    return this.quizService.getLeaderboard(10);
  }
}
