import { Controller, Get, Post, UseGuards, Req } from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { AchievementsService } from "./achievements.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";

@ApiTags("achievements")
@Controller("achievements")
export class AchievementsController {
  constructor(private achievementsService: AchievementsService) {}

  // @Get()
  // @UseGuards(JwtAuthGuard)
  // @ApiBearerAuth()
  // @ApiOperation({ summary: 'Barcha yutuqlarni ko\'rish (progress bilan)' })
  // @ApiResponse({ status: 200, description: 'Yutuqlar ro\'yxati' })
  // async getAllAchievements(@Req() req: any) {
  //   return this.achievementsService.getAllAchievements(req.user.id);
  // }

  @Get("my")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Mening yutuqlarim" })
  @ApiResponse({ status: 200, description: "Foydalanuvchi yutuqlari" })
  async getMyAchievements(@Req() req: any) {
    return this.achievementsService.getUserAchievements(req.user.id);
  }

  @Post("check")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Yutuqlarni tekshirish va yangilash" })
  @ApiResponse({ status: 200, description: "Yangi olingan yutuqlar" })
  async checkMyAchievements(@Req() req: any) {
    const newAchievements = await this.achievementsService.checkAchievements(
      req.user.id
    );
    return {
      message: "Yutuqlar tekshirildi",
      newAchievements,
      newCount: newAchievements.length,
    };
  }
}
