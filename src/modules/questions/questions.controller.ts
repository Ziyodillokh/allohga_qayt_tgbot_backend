import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from "@nestjs/swagger";
import { QuestionsService } from "./questions.service";
import { CreateQuestionDto } from "./dto/create-question.dto";
import { UpdateQuestionDto } from "./dto/update-question.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard, Roles } from "../auth/guards/roles.guard";
import { Role } from "../users/entities/user.entity";
import { Difficulty } from "./entities/question.entity";

@ApiTags("questions")
@Controller("questions")
export class QuestionsController {
  constructor(private questionsService: QuestionsService) {}

  @Get("random/:categorySlug")
  @ApiOperation({
    summary: "Kategoriya bo'yicha random savollar olish (Public)",
  })
  @ApiQuery({
    name: "count",
    required: false,
    description: "Savollar soni (default: 10)",
  })
  @ApiResponse({ status: 200, description: "Random savollar ro'yxati" })
  async getRandomQuestions(
    @Param("categorySlug") categorySlug: string,
    @Query("count") count?: number,
  ) {
    return this.questionsService.getRandomQuestionsBySlug(
      categorySlug,
      count || 10,
    );
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.MODERATOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Barcha savollarni olish (Admin)" })
  @ApiQuery({ name: "categoryId", required: false })
  @ApiQuery({ name: "difficulty", required: false, enum: Difficulty })
  @ApiQuery({ name: "search", required: false })
  @ApiQuery({ name: "page", required: false })
  @ApiQuery({ name: "limit", required: false })
  @ApiResponse({ status: 200, description: "Savollar ro'yxati" })
  async findAll(
    @Query("categoryId") categoryId?: string,
    @Query("difficulty") difficulty?: Difficulty,
    @Query("search") search?: string,
    @Query("page") page?: number,
    @Query("limit") limit?: number,
  ) {
    return this.questionsService.findAll({
      categoryId,
      difficulty,
      search,
      page,
      limit,
      activeOnly: false,
    });
  }

  @Get(":id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.MODERATOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Savolni ID bo'yicha olish (Admin)" })
  @ApiResponse({ status: 200, description: "Savol ma'lumotlari" })
  async findById(@Param("id") id: string) {
    return this.questionsService.findById(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.MODERATOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Yangi savol qo'shish (Admin)" })
  @ApiResponse({ status: 201, description: "Savol qo'shildi" })
  async create(@Body() dto: CreateQuestionDto) {
    return this.questionsService.create(dto);
  }

  @Post("bulk")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Ko'p savollarni qo'shish (Admin)" })
  @ApiResponse({ status: 201, description: "Savollar qo'shildi" })
  async createMany(@Body() questions: CreateQuestionDto[]) {
    return this.questionsService.createMany(questions);
  }

  @Patch(":id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.MODERATOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Savolni tahrirlash (Admin)" })
  @ApiResponse({ status: 200, description: "Savol yangilandi" })
  async update(@Param("id") id: string, @Body() dto: UpdateQuestionDto) {
    return this.questionsService.update(id, dto);
  }

  @Patch(":id/toggle")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.MODERATOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Savolni faollashtirish/nofaollashtirish (Admin)" })
  @ApiResponse({ status: 200, description: "Savol holati o'zgartirildi" })
  async toggleActive(@Param("id") id: string) {
    return this.questionsService.toggleActive(id);
  }

  @Delete(":id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Savolni o'chirish (Admin)" })
  @ApiResponse({ status: 200, description: "Savol o'chirildi" })
  async delete(@Param("id") id: string) {
    return this.questionsService.delete(id);
  }
}
