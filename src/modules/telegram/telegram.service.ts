import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Inject,
  forwardRef,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { JwtService } from "@nestjs/jwt";
import { UploadService } from "../upload/upload.service";
import { User } from "../users/entities";
import * as crypto from "crypto";

interface TelegramInitData {
  query_id?: string;
  user?: {
    id: number;
    first_name: string;
    last_name?: string;
    username?: string;
    language_code?: string;
    is_premium?: boolean;
    photo_url?: string;
  };
  auth_date: number;
  hash: string;
}

interface TelegramWebAppUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  photo_url?: string;
}

@Injectable()
export class TelegramService {
  private botToken: string;

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private jwtService: JwtService,
    private configService: ConfigService,
    @Inject(forwardRef(() => UploadService))
    private uploadService: UploadService,
  ) {
    this.botToken = this.configService.get<string>("TELEGRAM_BOT_TOKEN") || "";
  }

  /**
   * Validate Telegram Mini App init data
   */
  validateInitData(initData: string): TelegramInitData {
    if (!this.botToken) {
      throw new BadRequestException("Telegram bot token not configured");
    }

    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get("hash");

    if (!hash) {
      throw new UnauthorizedException("Invalid init data: missing hash");
    }

    urlParams.delete("hash");

    // Sort params alphabetically
    const params = Array.from(urlParams.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join("\n");

    // Create secret key
    const secretKey = crypto
      .createHmac("sha256", "WebAppData")
      .update(this.botToken)
      .digest();

    // Calculate expected hash
    const expectedHash = crypto
      .createHmac("sha256", secretKey)
      .update(params)
      .digest("hex");

    if (hash !== expectedHash) {
      throw new UnauthorizedException("Invalid init data: hash mismatch");
    }

    // Check auth_date (not older than 1 hour)
    const authDate = parseInt(urlParams.get("auth_date") || "0");
    const now = Math.floor(Date.now() / 1000);
    if (now - authDate > 3600) {
      throw new UnauthorizedException("Init data expired");
    }

    // Parse user data
    const userStr = urlParams.get("user");
    let user: TelegramWebAppUser | undefined;

    if (userStr) {
      try {
        user = JSON.parse(userStr);
      } catch {
        throw new BadRequestException("Invalid user data");
      }
    }

    return {
      query_id: urlParams.get("query_id") || undefined,
      user,
      auth_date: authDate,
      hash,
    };
  }

  /**
   * Authenticate or register user via Telegram Mini App
   */
  async authenticateWebApp(initData: string) {
    const validated = this.validateInitData(initData);

    if (!validated.user) {
      throw new BadRequestException("User data not found in init data");
    }

    const telegramUser = validated.user;

    // Find or create user
    let user = await this.userRepository.findOne({
      where: { telegramId: telegramUser.id.toString() },
    });

    // Try to fetch the latest profile photo via Bot API (best-effort)
    const fetchLatestAvatar = async (): Promise<string | undefined> => {
      if (!this.botToken) return undefined;
      try {
        const photosRes = await fetch(
          `https://api.telegram.org/bot${this.botToken}/getUserProfilePhotos?user_id=${telegramUser.id}&limit=1`,
        );
        const photosJson = await photosRes.json();
        if (
          !photosJson.ok ||
          !photosJson.result ||
          photosJson.result.total_count === 0
        )
          return undefined;
        const photoSizes = photosJson.result.photos[0];
        const fileId = photoSizes[photoSizes.length - 1].file_id;
        const fileRes = await fetch(
          `https://api.telegram.org/bot${this.botToken}/getFile?file_id=${fileId}`,
        );
        const fileJson = await fileRes.json();
        if (!fileJson.ok || !fileJson.result) return undefined;
        const filePath = fileJson.result.file_path;
        return `https://api.telegram.org/file/bot${this.botToken}/${filePath}`;
      } catch (err) {
        return undefined;
      }
    };

    const latestAvatar = await fetchLatestAvatar();

    if (!user) {
      // Generate unique username
      let username = telegramUser.username || `user_${telegramUser.id}`;
      const existingUsername = await this.userRepository.findOne({
        where: { username },
      });

      if (existingUsername) {
        username = `${username}_${Date.now().toString(36)}`;
      }

      const fullName = [telegramUser.first_name, telegramUser.last_name]
        .filter(Boolean)
        .join(" ");

      user = this.userRepository.create({
        telegramId: telegramUser.id.toString(),
        username,
        telegramUsername: telegramUser.username || null,
        fullName: fullName || username,
        avatar: latestAvatar || telegramUser.photo_url || null,
        email: `${telegramUser.id}@telegram.allohgaqayting.uz`,
        password: null,
      });
      user = await this.userRepository.save(user);
    } else {
      const fullName = [telegramUser.first_name, telegramUser.last_name]
        .filter(Boolean)
        .join(" ");

      user.fullName = fullName || user.fullName;
      user.telegramUsername = telegramUser.username || user.telegramUsername;
      user.avatar = latestAvatar || telegramUser.photo_url || user.avatar;
      user = await this.userRepository.save(user);
    }

    // Generate JWT
    const token = this.jwtService.sign({
      sub: user.id,
      username: user.username,
      role: user.role,
      telegramId: user.telegramId,
    });

    const isRegistrationComplete = !!user.password;
    const phoneRequired = !user.telegramPhone && !user.password;

    return {
      user: {
        id: user.id,
        username: user.username,
        telegramUsername: user.telegramUsername,
        telegramPhone: user.telegramPhone,
        email: user.email,
        fullName: user.fullName,
        avatar: user.avatar,
        totalXP: user.totalXP,
        level: user.level,
        role: user.role,
        isRegistrationComplete,
      },
      token,
      phoneRequired,
    };
  }

  /**
   * Save phone number from Telegram contact sharing
   */
  async savePhoneNumber(userId: string, phone: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new BadRequestException("User not found");
    }

    user.telegramPhone = phone;
    const updatedUser = await this.userRepository.save(user);

    return {
      success: true,
      user: {
        id: updatedUser.id,
        username: updatedUser.username,
        fullName: updatedUser.fullName,
        telegramPhone: updatedUser.telegramPhone,
        avatar: updatedUser.avatar,
        totalXP: updatedUser.totalXP,
        level: updatedUser.level,
        role: updatedUser.role,
      },
    };
  }

  /**
   * Complete Telegram user registration with username and password
   */
  async completeRegistration(
    userId: string,
    data: { username: string; password: string; phone: string },
  ) {
    const { username, password, phone } = data;

    console.log(
      `[completeRegistration] userId: ${userId}, username: ${username}`,
    );

    // First check if user exists
    const existingUserById = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!existingUserById) {
      console.log(`[completeRegistration] User not found with id: ${userId}`);
      throw new BadRequestException(
        "Foydalanuvchi topilmadi. Iltimos, qaytadan kiring.",
      );
    }

    // Check if username is available
    const existingUser = await this.userRepository.findOne({
      where: { username },
    });

    if (existingUser && existingUser.id !== userId) {
      throw new BadRequestException("Bu username allaqachon band");
    }

    // Hash password
    const bcrypt = await import("bcrypt");
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update user with new credentials
    existingUserById.username = username;
    existingUserById.password = hashedPassword;
    existingUserById.telegramPhone = phone;
    const user = await this.userRepository.save(existingUserById);

    // Generate new JWT token
    const token = this.jwtService.sign({
      sub: user.id,
      username: user.username,
      role: user.role,
      telegramId: user.telegramId,
    });

    return {
      success: true,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        email: user.email,
        telegramId: user.telegramId,
        telegramUsername: user.telegramUsername,
        telegramPhone: user.telegramPhone,
        avatar: user.avatar,
        totalXP: user.totalXP,
        level: user.level,
        role: user.role,
        isRegistrationComplete: true,
      },
      token,
    };
  }

  /**
   * Get user by Telegram ID
   */
  async getUserByTelegramId(telegramId: string) {
    const user = await this.userRepository.findOne({
      where: { telegramId },
    });

    if (!user) return null;

    return {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      avatar: user.avatar,
      totalXP: user.totalXP,
      level: user.level,
      role: user.role,
      createdAt: user.createdAt,
    };
  }

  /**
   * Send message via Telegram Bot API
   */
  async sendMessage(
    chatId: string | number,
    text: string,
    options?: {
      parse_mode?: "HTML" | "Markdown" | "MarkdownV2";
      reply_markup?: any;
    },
  ) {
    if (!this.botToken) {
      throw new BadRequestException("Telegram bot token not configured");
    }

    const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
    console.log(
      "[SENDMESSAGE] Sending to",
      chatId,
      "token:",
      this.botToken.substring(0, 20) + "...",
    );

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        ...options,
      }),
    });

    const data = await response.json();
    console.log("[SENDMESSAGE] Response:", data);

    if (!data.ok) {
      console.error("[SENDMESSAGE] ERROR:", data.description);
      throw new BadRequestException(`Telegram API error: ${data.description}`);
    }

    return data.result;
  }

  /**
   * Send photo via Telegram Bot API
   */
  async sendPhoto(
    chatId: string | number,
    photoUrl: string,
    caption?: string,
    options?: {
      parse_mode?: "HTML" | "Markdown" | "MarkdownV2";
      reply_markup?: any;
    },
  ) {
    if (!this.botToken) {
      throw new BadRequestException("Telegram bot token not configured");
    }

    const url = `https://api.telegram.org/bot${this.botToken}/sendPhoto`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        photo: photoUrl,
        caption,
        ...options,
      }),
    });

    const data = await response.json();

    if (!data.ok) {
      console.error("Telegram sendPhoto error:", data);
      throw new BadRequestException(`Telegram API error: ${data.description}`);
    }

    return data.result;
  }

  /**
   * Send video via Telegram Bot API
   */
  async sendVideo(
    chatId: string | number,
    videoUrl: string,
    caption?: string,
    options?: {
      parse_mode?: "HTML" | "Markdown" | "MarkdownV2";
      reply_markup?: any;
    },
  ) {
    if (!this.botToken) {
      throw new BadRequestException("Telegram bot token not configured");
    }

    const url = `https://api.telegram.org/bot${this.botToken}/sendVideo`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        video: videoUrl,
        caption,
        ...options,
      }),
    });

    const data = await response.json();

    if (!data.ok) {
      console.error("Telegram sendVideo error:", data);
      throw new BadRequestException(`Telegram API error: ${data.description}`);
    }

    return data.result;
  }

  /**
   * Send message with optional media (photo or video)
   */
  async sendMediaMessage(
    chatId: string | number,
    text: string,
    options?: {
      imageUrl?: string;
      videoUrl?: string;
      parse_mode?: "HTML" | "Markdown" | "MarkdownV2";
      reply_markup?: any;
    },
  ) {
    const { imageUrl, videoUrl, ...restOptions } = options || {};

    if (videoUrl) {
      return this.sendVideo(chatId, videoUrl, text, restOptions);
    }

    if (imageUrl) {
      return this.sendPhoto(chatId, imageUrl, text, restOptions);
    }

    return this.sendMessage(chatId, text, restOptions);
  }

  /**
   * Set webhook for Telegram Bot
   */
  async setWebhook(webhookUrl: string) {
    if (!this.botToken) {
      throw new BadRequestException("Telegram bot token not configured");
    }

    const url = `https://api.telegram.org/bot${this.botToken}/setWebhook`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: webhookUrl,
        allowed_updates: ["message", "callback_query"],
      }),
    });

    const data = await response.json();

    if (!data.ok) {
      throw new BadRequestException(`Telegram API error: ${data.description}`);
    }

    return data.result;
  }

  /**
   * Handle incoming webhook update from Telegram
   */
  async handleWebhookUpdate(update: any) {
    try {
      process.stderr.write(
        `[WEBHOOK] Received update: ${JSON.stringify(update)}\n`,
      );

      // Handle /start command - show only platform button (registration optional)
      if (update.message?.text?.startsWith("/start")) {
        const chatId = update.message.chat.id;
        const from = update.message.from;
        const firstName = from.first_name;

        console.log("[TELEGRAM] /start command detected!");
        console.log("[TELEGRAM] ChatID:", chatId);
        console.log("[TELEGRAM] User:", firstName);

        // Save/update user info from message
        await this.saveUserFromMessage(from);

        console.log("[TELEGRAM] User saved, sending message...");

        // For localhost, send without web app button (Telegram doesn't allow http://localhost)
        // TODO: Add web app button when deployed to HTTPS domain
        const messageText =
          `Assalomu alaykum, ${firstName}! 👋\n\n` +
          `<b>Allohga Qayting</b> - Islomiy platformaga xush kelibsiz! 🕌\n\n` +
          `✨ Bu yerda siz:\n` +
          `📖 Islomiy fanlardan testlar topshirishingiz\n` +
          `💡 Bilimingizni sinashingiz\n` +
          `🏆 Reyting jadvalida o'z o'rningizni ko'rishingiz mumkin!\n\n` +
          `🚀 <b>Platform:</b> http://localhost:3000`;

        const webappUrl = this.configService.get("WEBAPP_URL");

        // Only send web app button if URL starts with https:// (production)
        if (webappUrl && webappUrl.startsWith("https://")) {
          await this.sendMessage(chatId, messageText, {
            parse_mode: "HTML",
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: "🕌 Platformani ochish",
                    web_app: {
                      url: webappUrl,
                    },
                  },
                ],
              ],
            },
          });
        } else {
          // For localhost/development - send without button
          await this.sendMessage(chatId, messageText, {
            parse_mode: "HTML",
          });
        }

        console.log("[TELEGRAM] Message sent successfully!");
      }

      // Handle contact shared (phone number)
      if (update.message?.contact) {
        const contact = update.message.contact;
        const from = update.message.from;

        console.log(
          `[Webhook] Contact received from user ${from.id}, phone: ${contact.phone_number}`,
        );

        // Save phone number to user (without sending message - Mini App handles UI)
        if (contact.user_id === from.id) {
          const result = await this.userRepository.update(
            { telegramId: from.id.toString() },
            { telegramPhone: contact.phone_number },
          );
          console.log(
            `[Webhook] Phone saved result: ${JSON.stringify(result)}, telegramId: ${from.id}`,
          );

          if (result.affected === 0) {
            const existingUser = await this.userRepository.findOne({
              where: { telegramId: from.id.toString() },
            });
            console.log(
              `[Webhook] Existing user: ${JSON.stringify(existingUser)}`,
            );
          }
        }
      }

      // Handle callback queries (inline button presses)
      if (update.callback_query) {
        const callbackQueryId = update.callback_query.id;
        const chatId = update.callback_query.message.chat.id;
        const data = update.callback_query.data;

        // Answer callback to remove loading state
        await fetch(
          `https://api.telegram.org/bot${this.botToken}/answerCallbackQuery`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ callback_query_id: callbackQueryId }),
          },
        );

        // Handle share phone request - open Mini App registration page
        if (data === "share_phone") {
          const webappUrl =
            this.configService.get("WEBAPP_URL") || "http://localhost:3000";
          await this.sendMessage(
            chatId,
            `Ro'yxatdan o'tish uchun quyidagi tugmani bosing:`,
            {
              parse_mode: "HTML",
              reply_markup: {
                inline_keyboard: [
                  [
                    {
                      text: "Ro'yxatdan o'tish",
                      web_app: {
                        url: `${webappUrl}/auth/telegram-register`,
                      },
                    },
                  ],
                ],
              },
            },
          );
        }
      }
    } catch (error) {
      console.error("Webhook update error:", error);
    }

    return { ok: true };
  }

  /**
   * Save or update user from Telegram message
   */
  private async saveUserFromMessage(from: any) {
    const telegramId = from.id.toString();

    // Try to fetch the latest profile photo
    let latestAvatar: string | undefined;
    try {
      const photosRes = await fetch(
        `https://api.telegram.org/bot${this.botToken}/getUserProfilePhotos?user_id=${from.id}&limit=1`,
      );
      const photosJson = await photosRes.json();
      if (
        photosJson.ok &&
        photosJson.result &&
        photosJson.result.total_count > 0
      ) {
        const photoSizes = photosJson.result.photos[0];
        const fileId = photoSizes[photoSizes.length - 1].file_id;
        const fileRes = await fetch(
          `https://api.telegram.org/bot${this.botToken}/getFile?file_id=${fileId}`,
        );
        const fileJson = await fileRes.json();
        if (fileJson.ok && fileJson.result) {
          latestAvatar = `https://api.telegram.org/file/bot${this.botToken}/${fileJson.result.file_path}`;
        }
      }
    } catch (err) {
      // ignore errors
    }

    const fullName = [from.first_name, from.last_name]
      .filter(Boolean)
      .join(" ");

    // Check if user exists
    const existingUser = await this.userRepository.findOne({
      where: { telegramId },
    });

    if (existingUser) {
      // Update existing user
      existingUser.telegramUsername =
        from.username || existingUser.telegramUsername;
      existingUser.fullName = fullName || existingUser.fullName;
      existingUser.avatar = latestAvatar || existingUser.avatar;
      await this.userRepository.save(existingUser);
    } else {
      // Create new user
      let username = from.username || `user_${from.id}`;
      const existingUsername = await this.userRepository.findOne({
        where: { username },
      });

      if (existingUsername) {
        username = `${username}_${Date.now().toString(36)}`;
      }

      const newUser = this.userRepository.create({
        telegramId,
        username,
        telegramUsername: from.username || null,
        fullName: fullName || username,
        avatar: latestAvatar || null,
        email: `${from.id}@telegram.allohgaqayting.uz`,
        password: null,
      });
      await this.userRepository.save(newUser);
    }
  }

  /**
   * Generate Mini App link with start parameter
   */
  generateMiniAppLink(startParam?: string) {
    const botUsername =
      this.configService.get("TELEGRAM_BOT_USERNAME") || "Bilimdon_aibot";

    let link = `https://t.me/${botUsername}/app`;

    if (startParam) {
      link += `?startapp=${startParam}`;
    }

    return link;
  }
}
