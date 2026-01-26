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
  ParseIntPipe,
  Request,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
} from "@nestjs/swagger";
import { ZikrService } from "./zikr.service";
import { CreateZikrDto, UpdateZikrDto } from "./dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard, Roles } from "../auth/guards/roles.guard";
import { Role } from "../users/entities/user.entity";

@ApiTags("zikr")
@Controller("zikr")
export class ZikrController {
  constructor(private zikrService: ZikrService) {}

  @Get("today")
  @ApiOperation({ summary: "Bugungi kunning zikrlarini olish" })
  @ApiQuery({
    name: "ramadan",
    required: false,
    type: Boolean,
    description: "Ramazon oyi zikrlarini olish",
  })
  @ApiResponse({ status: 200, description: "Bugungi zikrlar ro'yxati" })
  async getTodayZikrs(@Query("ramadan") ramadan?: string) {
    const isRamadan = ramadan === "true";
    return this.zikrService.getTodayZikrs(isRamadan);
  }

  @Get("day/:dayOfWeek")
  @ApiOperation({ summary: "Ma'lum kunning zikrlarini olish" })
  @ApiParam({
    name: "dayOfWeek",
    description: "Hafta kuni (0=Yakshanba, 1=Dushanba, ..., 6=Shanba)",
    type: Number,
  })
  @ApiQuery({
    name: "ramadan",
    required: false,
    type: Boolean,
    description: "Ramazon oyi zikrlarini olish",
  })
  @ApiResponse({ status: 200, description: "Belgilangan kun zikrlari" })
  async getZikrsByDay(
    @Param("dayOfWeek", ParseIntPipe) dayOfWeek: number,
    @Query("ramadan") ramadan?: string,
  ) {
    const isRamadan = ramadan === "true";
    return this.zikrService.getZikrsByDay(dayOfWeek, isRamadan);
  }

  @Get("weekly")
  @ApiOperation({
    summary: "Haftalik barcha zikrlarni olish (kunlar bo'yicha guruhlab)",
  })
  @ApiQuery({
    name: "ramadan",
    required: false,
    type: Boolean,
    description: "Ramazon oyi zikrlarini olish",
  })
  @ApiResponse({ status: 200, description: "Haftalik zikrlar ro'yxati" })
  async getWeeklyZikrs(@Query("ramadan") ramadan?: string) {
    const isRamadan = ramadan === "true";
    return this.zikrService.getWeeklyZikrs(isRamadan);
  }

  @Get("stats")
  @ApiOperation({ summary: "Zikrlar statistikasi" })
  @ApiResponse({ status: 200, description: "Statistika" })
  async getStats() {
    return this.zikrService.getStats();
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Barcha zikrlarni olish (Admin)" })
  @ApiQuery({
    name: "all",
    required: false,
    type: Boolean,
    description: "Faol bo'lmaganlarni ham ko'rsatish",
  })
  @ApiResponse({ status: 200, description: "Barcha zikrlar ro'yxati" })
  async findAll(@Query("all") all?: string) {
    const includeInactive = all === "true";
    return this.zikrService.findAll(includeInactive);
  }

  @Get(":id")
  @ApiOperation({ summary: "Zikrni ID bo'yicha olish" })
  @ApiResponse({ status: 200, description: "Zikr ma'lumotlari" })
  @ApiResponse({ status: 404, description: "Zikr topilmadi" })
  async findById(@Param("id") id: string) {
    return this.zikrService.findById(id);
  }

  @Post()
  //   @UseGuards(JwtAuthGuard, RolesGuard)
  //   @Roles("ADMIN")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Yangi zikr yaratish (Admin)" })
  @ApiResponse({ status: 201, description: "Zikr yaratildi" })
  async create(@Body() dto: CreateZikrDto) {
    return this.zikrService.create(dto);
  }

  @Patch(":id")
  //   @UseGuards(JwtAuthGuard, RolesGuard)
  //   @Roles("ADMIN")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Zikrni tahrirlash (Admin)" })
  @ApiResponse({ status: 200, description: "Zikr yangilandi" })
  @ApiResponse({ status: 404, description: "Zikr topilmadi" })
  async update(@Param("id") id: string, @Body() dto: UpdateZikrDto) {
    return this.zikrService.update(id, dto);
  }

  @Delete(":id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Zikrni o'chirish (Admin)" })
  @ApiResponse({ status: 200, description: "Zikr o'chirildi" })
  @ApiResponse({ status: 404, description: "Zikr topilmadi" })
  async delete(@Param("id") id: string) {
    return this.zikrService.delete(id);
  }

  // ============ USER ZIKR COMPLETION ============

  @Post(":id/complete")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Zikrni tugatish va XP olish" })
  @ApiResponse({ status: 200, description: "Zikr tugatildi va XP berildi" })
  @ApiResponse({
    status: 400,
    description: "Bu zikr bugun allaqachon tugatilgan",
  })
  @ApiResponse({ status: 404, description: "Zikr topilmadi" })
  async completeZikr(@Request() req, @Param("id") id: string) {
    return this.zikrService.completeZikr(req.user.id, id);
  }

  @Get("user/today")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Foydalanuvchi uchun bugungi zikrlar (tugatilganligini ko'rsatib)",
  })
  @ApiResponse({ status: 200, description: "Bugungi zikrlar holati" })
  async getUserTodayZikrs(@Request() req) {
    return this.zikrService.getUserTodayZikrs(req.user.id);
  }

  @Get("user/stats")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Foydalanuvchi zikr statistikasi" })
  @ApiResponse({ status: 200, description: "Zikr statistikasi" })
  async getUserZikrStats(@Request() req) {
    return this.zikrService.getUserZikrStats(req.user.id);
  }
}
