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
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { TelegramAuthDto } from "./dto/telegram-auth.dto";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { SendVerificationDto } from "./dto/send-verification.dto";
import { VerifyEmailDto } from "./dto/verify-email.dto";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post("register")
  @ApiOperation({ summary: "Ro'yxatdan o'tish" })
  @ApiResponse({
    status: 201,
    description: "Muvaffaqiyatli ro'yxatdan o'tildi",
  })
  @ApiResponse({ status: 409, description: "Email yoki username band" })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post("login")
  @ApiOperation({ summary: "Tizimga kirish" })
  @ApiResponse({ status: 200, description: "Muvaffaqiyatli kirildi" })
  @ApiResponse({ status: 401, description: "Noto'g'ri ma'lumotlar" })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
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
      dto.newPassword
    );
  }

  @Post("send-verification")
  @ApiOperation({ summary: "Email tasdiqlash kodi yuborish" })
  @ApiResponse({ status: 200, description: "Tasdiqlash kodi yuborildi" })
  async sendVerification(@Body() dto: SendVerificationDto) {
    return this.authService.sendVerificationCode(dto.email);
  }

  @Post("verify-email")
  @ApiOperation({ summary: "Email tasdiqlanish" })
  @ApiResponse({ status: 200, description: "Email tasdiqlandi" })
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto.email, dto.code);
  }

  @Post("send-phone-telegram")
  @ApiOperation({ summary: "Telegram ga telefon raqam yuborish" })
  @ApiResponse({ status: 200, description: "Telefon raqam yuborildi" })
  async sendPhoneToTelegram(@Body() dto: { phone: string; email: string }) {
    return this.authService.sendPhoneToTelegram(dto.phone, dto.email);
  }

  @Post("forgot-password")
  @ApiOperation({ summary: "Parolni tiklash so'rovi" })
  @ApiResponse({ status: 200, description: "Tiklash kodi yuborildi" })
  async forgotPassword(@Body() dto: { email: string }) {
    return this.authService.forgotPassword(dto.email);
  }

  @Post("reset-password")
  @ApiOperation({ summary: "Parolni tiklash" })
  @ApiResponse({ status: 200, description: "Parol yangilandi" })
  async resetPassword(
    @Body() dto: { email: string; code: string; newPassword: string }
  ) {
    return this.authService.resetPassword(dto.email, dto.code, dto.newPassword);
  }

  @Post("check-username")
  @ApiOperation({ summary: "Username mavjudligini tekshirish" })
  @ApiResponse({ status: 200, description: "Username holati" })
  async checkUsername(@Body() dto: { username: string }) {
    return this.authService.checkUsername(dto.username);
  }

  @Post("check-email")
  @ApiOperation({ summary: "Email mavjudligini tekshirish" })
  @ApiResponse({ status: 200, description: "Email holati" })
  async checkEmail(@Body() dto: { email: string }) {
    return this.authService.checkEmail(dto.email);
  }
}
