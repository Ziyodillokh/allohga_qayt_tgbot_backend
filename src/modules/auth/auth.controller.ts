import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Req,
  Patch,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { TelegramAuthDto } from "./dto/telegram-auth.dto";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post("login")
  @ApiOperation({ summary: "Tizimga kirish" })
  @ApiResponse({ status: 200, description: "Muvaffaqiyatli kirildi" })
  @ApiResponse({ status: 401, description: "Noto'g'ri ma'lumotlar" })
  async login(@Body() dto: LoginDto) {
    return this.authService.loginForAdmin(dto);
  }

  @Post("telegram")
  @ApiOperation({ summary: "Telegram orqali kirish" })
  @ApiResponse({ status: 200, description: "Muvaffaqiyatli kirildi" })
  async telegramAuth(@Body() dto: TelegramAuthDto) {
    return this.authService.telegramAuth(dto);
  }

  @Get("profile")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Profil ma'lumotlarini olish" })
  @ApiResponse({ status: 200, description: "Profil ma'lumotlari" })
  async getProfile(@Req() req: any) {
    return this.authService.getProfile(req.user.id);
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Joriy foydalanuvchi ma'lumotlari" })
  @ApiResponse({ status: 200, description: "Foydalanuvchi ma'lumotlari" })
  async getMe(@Req() req: any) {
    return this.authService.getProfile(req.user.id);
  }

  @Patch("change-password")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Parolni o'zgartirish" })
  @ApiResponse({ status: 200, description: "Parol o'zgartirildi" })
  async changePassword(@Req() req: any, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(
      req.user.id,
      dto.oldPassword,
      dto.newPassword,
    );
  }
}
