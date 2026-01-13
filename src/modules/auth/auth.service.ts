import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../../prisma/prisma.service";
import { MailService } from "../mail/mail.service";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { TelegramAuthDto } from "./dto/telegram-auth.dto";

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private mailService: MailService
  ) {}

  async checkUsername(username: string) {
    const existingUser = await this.prisma.user.findFirst({
      where: { username },
    });

    if (existingUser) {
      return { available: false, message: "Bu username allaqachon band" };
    }

    return { available: true, message: "Username mavjud" };
  }

  async checkEmail(email: string) {
    const existingUser = await this.prisma.user.findFirst({
      where: { email },
    });

    if (existingUser) {
      return {
        available: false,
        message: "Bu email allaqachon ro'yxatdan o'tgan",
      };
    }

    return { available: true, message: "Email mavjud" };
  }

  async register(dto: RegisterDto) {
    // Check if email or username already exists
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: dto.email }, { username: dto.username }],
      },
    });

    if (existingUser) {
      if (existingUser.email === dto.email) {
        throw new ConflictException("Bu email allaqachon ro'yxatdan o'tgan");
      }
      throw new ConflictException("Bu username allaqachon band");
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(dto.password, 12);

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        username: dto.username,
        password: hashedPassword,
        fullName: dto.fullName,
        telegramPhone: dto.telegramPhone || null,
      },
      select: {
        id: true,
        email: true,
        username: true,
        fullName: true,
        avatar: true,
        totalXP: true,
        level: true,
        role: true,
        telegramPhone: true,
        createdAt: true,
      },
    });

    // Generate token
    const token = this.generateToken(user.id, user.role);

    return {
      user,
      token,
    };
  }

  async login(dto: LoginDto) {
    // Find user by email or username
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: dto.emailOrUsername }, { username: dto.emailOrUsername }],
      },
    });

    if (!user) {
      throw new UnauthorizedException("Noto'g'ri email/username yoki parol");
    }

    if (!user.isActive) {
      throw new UnauthorizedException("Hisobingiz bloklangan");
    }

    if (!user.password) {
      throw new UnauthorizedException(
        "Telegram orqali ro'yxatdan o'tgan foydalanuvchi. Telegram orqali kiring"
      );
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException("Noto'g'ri email/username yoki parol");
    }

    // Update last active
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastActiveAt: new Date() },
    });

    // Generate token
    const token = this.generateToken(user.id, user.role);

    // Return user without password
    const { password, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword,
      token,
    };
  }

  async telegramAuth(dto: TelegramAuthDto) {
    // Find or create user by Telegram ID
    let user = await this.prisma.user.findUnique({
      where: { telegramId: dto.telegramId },
    });

    if (!user) {
      // Create new user from Telegram
      const username = dto.username || `tg_${dto.telegramId}`;
      const uniqueUsername = await this.generateUniqueUsername(username);

      user = await this.prisma.user.create({
        data: {
          telegramId: dto.telegramId,
          username: uniqueUsername,
          email: `${dto.telegramId}@telegram.bilimdon.uz`,
          password: await bcrypt.hash(Math.random().toString(36), 12),
          fullName:
            `${dto.firstName || ""} ${dto.lastName || ""}`.trim() ||
            "Telegram User",
          avatar: dto.photoUrl || null,
          telegramUsername: dto.username || null,
        },
      });
    } else {
      // Update last active
      await this.prisma.user.update({
        where: { id: user.id },
        data: { lastActiveAt: new Date() },
      });
    }

    if (!user.isActive) {
      throw new UnauthorizedException("Hisobingiz bloklangan");
    }

    // Generate token
    const token = this.generateToken(user.id, user.role);

    const { password, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword,
      token,
    };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        fullName: true,
        avatar: true,
        bio: true,
        totalXP: true,
        level: true,
        role: true,
        telegramId: true,
        telegramUsername: true,
        telegramPhone: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            testAttempts: true,
            userAchievements: { where: { unlockedAt: { not: null } } },
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException("Foydalanuvchi topilmadi");
    }

    return user;
  }

  async changePassword(
    userId: string,
    oldPassword: string,
    newPassword: string
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException("Foydalanuvchi topilmadi");
    }

    if (!user.password) {
      throw new BadRequestException(
        "Telegram orqali ro'yxatdan o'tgan foydalanuvchi uchun parol o'zgartirish mumkin emas"
      );
    }

    const isPasswordValid = await bcrypt.compare(oldPassword, user.password);
    if (!isPasswordValid) {
      throw new BadRequestException("Joriy parol noto'g'ri");
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    return { message: "Parol muvaffaqiyatli o'zgartirildi" };
  }

  private generateToken(userId: string, role: string) {
    return this.jwtService.sign({
      sub: userId,
      role,
    });
  }

  private async generateUniqueUsername(baseUsername: string): Promise<string> {
    let username = baseUsername.toLowerCase().replace(/[^a-z0-9_]/g, "");
    let counter = 0;

    while (true) {
      const existingUser = await this.prisma.user.findUnique({
        where: { username: counter === 0 ? username : `${username}${counter}` },
      });

      if (!existingUser) {
        return counter === 0 ? username : `${username}${counter}`;
      }

      counter++;
    }
  }

  async sendVerificationCode(email: string) {
    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Save to database
    await this.prisma.emailVerification.upsert({
      where: { email },
      create: {
        email,
        code,
        expiresAt,
        verified: false,
      },
      update: {
        code,
        expiresAt,
        verified: false,
      },
    });

    // Send email - handle errors gracefully
    try {
      await this.mailService.sendVerificationCode(email, code);
    } catch (error: any) {
      console.error("Email yuborishda xatolik:", error?.message || error);
      // Don't throw - just log error and continue
      // Return success anyway since code is saved in database
    }

    return {
      message: "Tasdiqlash kodi emailingizga yuborildi",
      code: process.env.NODE_ENV === "development" ? code : undefined,
    };
  }

  async verifyEmail(email: string, code: string) {
    const verification = await this.prisma.emailVerification.findUnique({
      where: { email },
    });

    if (!verification) {
      throw new BadRequestException("Tasdiqlash kodi topilmadi");
    }

    if (verification.verified) {
      throw new BadRequestException("Email allaqachon tasdiqlangan");
    }

    if (verification.code !== code) {
      throw new BadRequestException("Noto'g'ri tasdiqlash kodi");
    }

    if (verification.expiresAt < new Date()) {
      throw new BadRequestException("Tasdiqlash kodi muddati tugagan");
    }

    // Mark as verified
    await this.prisma.emailVerification.update({
      where: { email },
      data: { verified: true },
    });

    return { message: "Email muvaffaqiyatli tasdiqlandi" };
  }

  async sendPhoneToTelegram(phone: string, email: string) {
    // Here you would integrate with Telegram Bot API
    // For now, just save to database or log
    console.log(`Saving phone ${phone} for email ${email}`);

    if (!email) {
      return { message: "Email kerak" };
    }

    try {
      const user = await this.prisma.user.findUnique({ where: { email } });
      if (user) {
        await this.prisma.user.update({
          where: { id: user.id },
          data: { telegramPhone: phone },
        });
      }
    } catch (err) {
      console.error("Error saving telegram phone:", err);
    }

    // TODO: optionally notify admin via bot about the phone
    return { message: "Telefon raqam saqlandi" };
  }

  async forgotPassword(email: string) {
    console.log("🔍 forgotPassword called with email:", email);

    // Find user by email
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    console.log("👤 User found:", user ? "YES - " + user.email : "NO");

    // 1. Agar user bazada yo'q - taklif havolasi yuborish
    if (!user) {
      console.log("📨 User not found. Sending INVITE email to:", email);
      try {
        await this.mailService.sendInviteEmail(email);
        console.log("✅ Invite email sent successfully");
      } catch (error) {
        console.error("❌ Invite email yuborishda xatolik:", error);
      }
      const response = {
        message: "Taklif havolasi yuborildi",
        type: "invite",
        registered: false,
      };
      console.log("📤 Returning response:", response);
      return response;
    }

    // 2. User bazada bor - parol tiklash kodi yuborish
    // Generate reset token (6 ta raqam)
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 daqiqa

    // Save to EmailVerification table (reusing for reset)
    await this.prisma.emailVerification.upsert({
      where: { email },
      update: {
        code: resetCode,
        expiresAt,
        verified: false,
      },
      create: {
        email,
        code: resetCode,
        expiresAt,
      },
    });

    // Send email with reset code
    console.log("📧 Sending PASSWORD RESET email to:", email);
    try {
      await this.mailService.sendPasswordResetEmail(
        email,
        resetCode,
        user.fullName
      );
      console.log("✅ Password reset email sent successfully");
    } catch (error) {
      console.error("❌ Email yuborishda xatolik:", error);
    }

    const response = {
      message: "Parolni tiklash kodi emailga yuborildi",
      type: "reset",
      registered: true,
    };
    console.log("📤 Returning response:", response);
    return response;
  }

  async resetPassword(email: string, code: string, newPassword: string) {
    // Find verification code
    const verification = await this.prisma.emailVerification.findUnique({
      where: { email },
    });

    if (!verification) {
      throw new BadRequestException("Tiklash kodi topilmadi");
    }

    if (verification.code !== code) {
      throw new BadRequestException("Noto'g'ri kod");
    }

    if (verification.expiresAt < new Date()) {
      throw new BadRequestException(
        "Kod muddati tugagan. Qayta urinib ko'ring"
      );
    }

    // Find user
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new BadRequestException("Foydalanuvchi topilmadi");
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Update password
    await this.prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    // Delete verification code
    await this.prisma.emailVerification.delete({
      where: { email },
    });

    return { message: "Parol muvaffaqiyatli yangilandi" };
  }
}
