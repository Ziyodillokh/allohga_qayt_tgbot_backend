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
import { LoginDto } from "./dto/login.dto";
import { TelegramAuthDto } from "./dto/telegram-auth.dto";

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private jwtService: JwtService,
  ) {}

  async loginForAdmin(dto: LoginDto) {
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
        password: await bcrypt.hash(Math.random().toString(36), 12),
        fullName:
          `${dto.firstName || ""} ${dto.lastName || ""}`.trim() ||
          "Telegram User",
        avatar: dto.photoUrl || null,
        telegramUsername: dto.username || null,
        telegramPhone: dto.phone || null,
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
}
