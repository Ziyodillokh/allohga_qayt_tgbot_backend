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
import { CategoriesService } from "./categories.service";
import { CreateCategoryDto } from "./dto/create-category.dto";
import { UpdateCategoryDto } from "./dto/update-category.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard, Roles } from "../auth/guards/roles.guard";

@ApiTags("categories")
@Controller("categories")
export class CategoriesController {
  constructor(private categoriesService: CategoriesService) {}

  @Get()
  @ApiOperation({ summary: "Barcha kategoriyalarni olish" })
  @ApiQuery({ name: "all", required: false, type: Boolean })
  @ApiResponse({ status: 200, description: "Kategoriyalar ro'yxati" })
  async findAll(@Query("all") all?: boolean) {
    return this.categoriesService.findAll(!all);
  }

  @Get(":slug")
  @ApiOperation({ summary: "Kategoriyani slug bo'yicha olish" })
  @ApiResponse({ status: 200, description: "Kategoriya ma'lumotlari" })
  @ApiResponse({ status: 404, description: "Kategoriya topilmadi" })
  async findBySlug(@Param("slug") slug: string) {
    return this.categoriesService.findBySlug(slug);
  }

  @Get(":id/stats")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Kategoriya statistikasi (Admin)" })
  @ApiResponse({ status: 200, description: "Statistika" })
  async getStats(@Param("id") id: string) {
    return this.categoriesService.getStats(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Yangi kategoriya yaratish (Admin)" })
  @ApiResponse({ status: 201, description: "Kategoriya yaratildi" })
  async create(@Body() dto: CreateCategoryDto) {
    return this.categoriesService.create(dto);
  }

  @Patch(":id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Kategoriyani tahrirlash (Admin)" })
  @ApiResponse({ status: 200, description: "Kategoriya yangilandi" })
  async update(@Param("id") id: string, @Body() dto: UpdateCategoryDto) {
    return this.categoriesService.update(id, dto);
  }

  @Delete(":id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Kategoriyani o'chirish (Admin)" })
  @ApiResponse({ status: 200, description: "Kategoriya o'chirildi" })
  async delete(@Param("id") id: string) {
    return this.categoriesService.delete(id);
  }
}
