import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import * as bcrypt from "bcryptjs";
import { User } from "../users/entities";
import { EmailVerification } from "./entities";
import { MailService } from "../mail/mail.service";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { TelegramAuthDto } from "./dto/telegram-auth.dto";

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(EmailVerification)
    private emailVerificationRepository: Repository<EmailVerification>,
    private jwtService: JwtService,
    private mailService: MailService,
  ) {}

  async checkUsername(username: string) {
    const existingUser = await this.userRepository.findOne({
      where: { username },
    });

    if (existingUser) {
      return { available: false, message: "Bu username allaqachon band" };
    }

    return { available: true, message: "Username mavjud" };
  }

  async checkEmail(email: string) {
    const existingUser = await this.userRepository.findOne({
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
    const existingByEmail = await this.userRepository.findOne({
      where: { email: dto.email },
    });
    const existingByUsername = await this.userRepository.findOne({
      where: { username: dto.username },
    });

    if (existingByEmail) {
      throw new ConflictException("Bu email allaqachon ro'yxatdan o'tgan");
    }
    if (existingByUsername) {
      throw new ConflictException("Bu username allaqachon band");
    }

    const hashedPassword = await bcrypt.hash(dto.password, 12);

    const user = this.userRepository.create({
      email: dto.email,
      username: dto.username,
      password: hashedPassword,
      fullName: dto.fullName,
      telegramPhone: dto.telegramPhone || null,
    });

    const savedUser = await this.userRepository.save(user);
    const token = this.generateToken(savedUser.id, savedUser.role);
    const { password, ...userWithoutPassword } = savedUser;

    return { user: userWithoutPassword, token };
  }

  async login(dto: LoginDto) {
    const user = await this.userRepository
      .createQueryBuilder("user")
      .where("user.email = :login OR user.username = :login", {
        login: dto.emailOrUsername,
      })
      .getOne();

    if (!user) {
      throw new UnauthorizedException("Noto'g'ri email/username yoki parol");
    }

    if (!user.isActive) {
      throw new UnauthorizedException("Hisobingiz bloklangan");
    }

    if (!user.password) {
      throw new UnauthorizedException(
        "Telegram orqali ro'yxatdan o'tgan foydalanuvchi. Telegram orqali kiring",
      );
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException("Noto'g'ri email/username yoki parol");
    }

    await this.userRepository.update(user.id, { lastActiveAt: new Date() });

    const token = this.generateToken(user.id, user.role);
    const { password, ...userWithoutPassword } = user;

    return { user: userWithoutPassword, token };
  }

  async telegramAuth(dto: TelegramAuthDto) {
    let user = await this.userRepository.findOne({
      where: { telegramId: dto.telegramId },
    });

    if (!user) {
      const username = dto.username || `tg_${dto.telegramId}`;
      const uniqueUsername = await this.generateUniqueUsername(username);

      user = this.userRepository.create({
        telegramId: dto.telegramId,
        username: uniqueUsername,
        email: `${dto.telegramId}@telegram.bilimdon.uz`,
        password: await bcrypt.hash(Math.random().toString(36), 12),
        fullName:
          `${dto.firstName || ""} ${dto.lastName || ""}`.trim() ||
          "Telegram User",
        avatar: dto.photoUrl || null,
        telegramUsername: dto.username || null,
      });

      user = await this.userRepository.save(user);
    } else {
      await this.userRepository.update(user.id, { lastActiveAt: new Date() });
    }

    if (!user.isActive) {
      throw new UnauthorizedException("Hisobingiz bloklangan");
    }

    const token = this.generateToken(user.id, user.role);
    const { password, ...userWithoutPassword } = user;

    return { user: userWithoutPassword, token };
  }

  async getProfile(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ["testAttempts", "userAchievements"],
    });

    if (!user) {
      throw new UnauthorizedException("Foydalanuvchi topilmadi");
    }

    const testAttemptsCount = user.testAttempts?.length || 0;
    const unlockedAchievements =
      user.userAchievements?.filter((ua) => ua.unlockedAt).length || 0;

    const { password, testAttempts, userAchievements, ...userWithoutPassword } =
      user;

    return {
      ...userWithoutPassword,
      _count: {
        testAttempts: testAttemptsCount,
        userAchievements: unlockedAchievements,
      },
    };
  }

  async changePassword(
    userId: string,
    oldPassword: string,
    newPassword: string,
  ) {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new UnauthorizedException("Foydalanuvchi topilmadi");
    }

    if (!user.password) {
      throw new BadRequestException(
        "Telegram orqali ro'yxatdan o'tgan foydalanuvchi uchun parol o'zgartirish mumkin emas",
      );
    }

    const isPasswordValid = await bcrypt.compare(oldPassword, user.password);
    if (!isPasswordValid) {
      throw new BadRequestException("Joriy parol noto'g'ri");
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await this.userRepository.update(userId, { password: hashedPassword });

    return { message: "Parol muvaffaqiyatli o'zgartirildi" };
  }

  private generateToken(userId: string, role: string) {
    return this.jwtService.sign({ sub: userId, role });
  }

  private async generateUniqueUsername(baseUsername: string): Promise<string> {
    let username = baseUsername.toLowerCase().replace(/[^a-z0-9_]/g, "");
    let counter = 0;

    while (true) {
      const checkUsername = counter === 0 ? username : `${username}${counter}`;
      const existingUser = await this.userRepository.findOne({
        where: { username: checkUsername },
      });

      if (!existingUser) {
        return checkUsername;
      }
      counter++;
    }
  }

  async sendVerificationCode(email: string) {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    let verification = await this.emailVerificationRepository.findOne({
      where: { email },
    });

    if (verification) {
      verification.code = code;
      verification.expiresAt = expiresAt;
      verification.verified = false;
    } else {
      verification = this.emailVerificationRepository.create({
        email,
        code,
        expiresAt,
        verified: false,
      });
    }

    await this.emailVerificationRepository.save(verification);

    try {
      await this.mailService.sendVerificationCode(email, code);
    } catch (error: any) {
      console.error("Email yuborishda xatolik:", error?.message || error);
    }

    return {
      message: "Tasdiqlash kodi emailingizga yuborildi",
      code: process.env.NODE_ENV === "development" ? code : undefined,
    };
  }

  async verifyEmail(email: string, code: string) {
    const verification = await this.emailVerificationRepository.findOne({
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

    await this.emailVerificationRepository.update(verification.id, {
      verified: true,
    });

    return { message: "Email muvaffaqiyatli tasdiqlandi" };
  }

  async sendPhoneToTelegram(phone: string, email: string) {
    if (!email) {
      return { message: "Email kerak" };
    }

    try {
      const user = await this.userRepository.findOne({ where: { email } });
      if (user) {
        await this.userRepository.update(user.id, { telegramPhone: phone });
      }
    } catch (err) {
      console.error("Error saving telegram phone:", err);
    }

    return { message: "Telefon raqam saqlandi" };
  }

  async forgotPassword(email: string) {
    const user = await this.userRepository.findOne({ where: { email } });

    if (!user) {
      try {
        await this.mailService.sendInviteEmail(email);
      } catch (error) {
        console.error("Invite email yuborishda xatolik:", error);
      }
      return {
        message: "Taklif havolasi yuborildi",
        type: "invite",
        registered: false,
      };
    }

    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    let verification = await this.emailVerificationRepository.findOne({
      where: { email },
    });

    if (verification) {
      verification.code = resetCode;
      verification.expiresAt = expiresAt;
      verification.verified = false;
    } else {
      verification = this.emailVerificationRepository.create({
        email,
        code: resetCode,
        expiresAt,
      });
    }

    await this.emailVerificationRepository.save(verification);

    try {
      await this.mailService.sendPasswordResetEmail(
        email,
        resetCode,
        user.fullName,
      );
    } catch (error) {
      console.error("Email yuborishda xatolik:", error);
    }

    return {
      message: "Parolni tiklash kodi emailga yuborildi",
      type: "reset",
      registered: true,
    };
  }

  async resetPassword(email: string, code: string, newPassword: string) {
    const verification = await this.emailVerificationRepository.findOne({
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
        "Kod muddati tugagan. Qayta urinib ko'ring",
      );
    }

    const user = await this.userRepository.findOne({ where: { email } });

    if (!user) {
      throw new BadRequestException("Foydalanuvchi topilmadi");
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await this.userRepository.update(user.id, { password: hashedPassword });
    await this.emailVerificationRepository.delete(verification.id);

    return { message: "Parol muvaffaqiyatli yangilandi" };
  }
}
