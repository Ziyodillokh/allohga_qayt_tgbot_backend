import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  UseInterceptors,
  UploadedFile,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiConsumes,
} from "@nestjs/swagger";
import { AdminService } from "./admin.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { AdminOnlyGuard } from "../auth/guards/admin-only.guard";
import { Roles } from "../auth/guards/roles.decorator";
import {
  GetUsersDto,
  UpdateUserRoleDto,
  BlockUserDto,
  AdjustXPDto,
  SendBulkMessageDto,
  BulkImportQuestionsDto,
  ExportQuestionsDto,
  UpdateSettingsDto,
  GrowthStatsDto,
  UpdateDesignDto,
  CreateCategoryDto,
  UpdateCategoryDto,
  ImportQuestionsTextDto,
  CreateCategoryWithQuestionsDto,
} from "./dto";

@ApiTags("Admin")
@ApiBearerAuth()
@Controller("admin")
@UseGuards(JwtAuthGuard, RolesGuard, AdminOnlyGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // ==================== DASHBOARD ====================
  @Get("dashboard")
  @ApiOperation({ summary: "Get dashboard statistics" })
  getDashboardStats() {
    return this.adminService.getDashboardStats();
  }

  @Get("dashboard/extended")
  @ApiOperation({
    summary:
      "Get extended dashboard with active users and low question categories",
  })
  getExtendedDashboard() {
    return this.adminService.getExtendedDashboard();
  }

  @Get("dashboard/growth")
  @ApiOperation({ summary: "Get growth statistics over time" })
  getGrowthStats(@Query() dto: GrowthStatsDto) {
    return this.adminService.getGrowthStats(dto.days);
  }

  // ==================== USER MANAGEMENT ====================
  @Get("users")
  @ApiOperation({ summary: "Get all users with filters" })
  getUsers(@Query() dto: GetUsersDto) {
    return this.adminService.getUsers(dto);
  }

  @Get("users/:id")
  @ApiOperation({ summary: "Get user details" })
  getUserDetails(@Param("id") id: string) {
    return this.adminService.getUserDetails(id);
  }

  @Patch("users/:id/role")
  @ApiOperation({ summary: "Update user role (Admin only)" })
  updateUserRole(@Param("id") id: string, @Body() dto: UpdateUserRoleDto) {
    return this.adminService.updateUserRole(id, dto.role ?? "USER");
  }

  @Patch("users/:id/block")
  @ApiOperation({ summary: "Block or unblock user" })
  blockUser(@Param("id") id: string, @Body() dto: BlockUserDto) {
    return this.adminService.blockUser(id, dto.blocked ?? false);
  }

  @Patch("users/:id/xp")
  @ApiOperation({ summary: "Adjust user XP (Admin only)" })
  adjustUserXP(@Param("id") id: string, @Body() dto: AdjustXPDto) {
    return this.adminService.adjustUserXP(
      id,
      dto.amount ?? 0,
      dto.reason ?? "",
    );
  }

  @Delete("users/:id")
  @ApiOperation({ summary: "Delete user (Admin only)" })
  deleteUser(@Param("id") id: string) {
    return this.adminService.deleteUser(id);
  }

  // ==================== MESSAGING ====================
  @Post("messages/bulk")
  @ApiOperation({ summary: "Send bulk message to users" })
  sendBulkMessage(@Body() dto: SendBulkMessageDto, @Request() req: any) {
    return this.adminService.sendMultiChannelMessage({
      adminId: req.user.id,
      title: dto.title ?? "",
      message: dto.message ?? "",
      imageUrl: dto.imageUrl,
      videoUrl: dto.videoUrl,
      targetType: dto.targetType ?? "all",
      targetIds: dto.targetIds,
      channels: dto.channels ?? [],
      filter: dto.filter,
    });
  }

  @Get("messages/history")
  @ApiOperation({ summary: "Get sent messages history" })
  getMessageHistory(
    @Request() req: any,
    @Query("page") page?: number,
    @Query("limit") limit?: number,
  ) {
    return this.adminService.getMessageHistory(req.user.id, page, limit);
  }

  // ==================== CATEGORIES ====================
  @Get("categories")
  @ApiOperation({ summary: "Get all categories with stats" })
  getAllCategories() {
    return this.adminService.getAllCategoriesAdmin();
  }

  @Post("categories")
  @ApiOperation({ summary: "Create new category" })
  createCategory(@Body() dto: CreateCategoryDto) {
    if (!dto.name || !dto.slug) {
      throw new Error("Name and slug are required");
    }
    return this.adminService.createCategory(dto as any);
  }

  @Post("categories/with-questions")
  @ApiOperation({ summary: "Create category with 300+ questions" })
  createCategoryWithQuestions(@Body() dto: CreateCategoryWithQuestionsDto) {
    if (!dto.name || !dto.slug || !dto.questionsText) {
      throw new Error("Name, slug and questionsText are required");
    }
    return this.adminService.createCategoryWithQuestions(dto as any);
  }

  @Patch("categories/:id")
  @ApiOperation({ summary: "Update category" })
  updateCategory(@Param("id") id: string, @Body() dto: UpdateCategoryDto) {
    return this.adminService.updateCategory(id, dto);
  }

  @Delete("categories/:id")
  @ApiOperation({ summary: "Delete category" })
  deleteCategory(@Param("id") id: string) {
    return this.adminService.deleteCategory(id);
  }

  @Post("categories/:id/import-questions")
  @ApiOperation({ summary: "Import questions from text (namuna.txt format)" })
  importQuestionsFromText(
    @Param("id") categoryId: string,
    @Body() dto: ImportQuestionsTextDto,
  ) {
    if (!dto.text) {
      throw new Error("Text is required");
    }
    return this.adminService.importQuestionsFromText(categoryId, dto.text);
  }

  // ==================== QUESTIONS ====================
  @Post("questions/import")
  @ApiOperation({ summary: "Bulk import questions" })
  bulkImportQuestions(@Body() dto: BulkImportQuestionsDto) {
    if (!dto.categoryId || !dto.questions) {
      throw new Error("CategoryId and questions are required");
    }
    return this.adminService.bulkImportQuestions(dto as any);
  }

  @Get("questions/export")
  @ApiOperation({ summary: "Export questions to CSV format" })
  exportQuestions(@Query() dto: ExportQuestionsDto) {
    return this.adminService.exportQuestions(dto.categoryId);
  }

  // ==================== SETTINGS ====================
  @Get("settings")
  @ApiOperation({ summary: "Get platform settings" })
  getSettings() {
    return this.adminService.getSettings();
  }

  @Patch("settings")
  @ApiOperation({ summary: "Update platform settings" })
  updateSettings(@Body() dto: UpdateSettingsDto) {
    return this.adminService.updateSettings(dto);
  }

  // ==================== DESIGN SETTINGS ====================
  @Get("design")
  @ApiOperation({ summary: "Get design settings" })
  getDesignSettings() {
    return this.adminService.getDesignSettings();
  }

  @Patch("design")
  @ApiOperation({ summary: "Update design settings" })
  updateDesignSettings(@Body() dto: UpdateDesignDto) {
    return this.adminService.updateDesignSettings(dto);
  }
}
