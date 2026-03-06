import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Inject,
  forwardRef,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
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

// Majburiy obuna kanali
const REQUIRED_CHANNEL_ID = -1002578305491; // t.me/AslBaxt_ilm
const REQUIRED_CHANNEL_USERNAME = "@AslBaxt_ilm";
const REQUIRED_CHANNEL_LINK = "https://t.me/AslBaxt_ilm";

@Injectable()
export class TelegramService implements OnModuleInit, OnModuleDestroy {
  private botToken: string;
  private pollingActive = false;
  private pollingOffset = 0;
  private readonly logger = new Logger(TelegramService.name);

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

  async onModuleInit() {
    if (!this.botToken) {
      this.logger.warn("TELEGRAM_BOT_TOKEN not set, skipping bot polling");
      return;
    }
    // Start polling in background (non-blocking)
    this.startPolling().catch((err) =>
      this.logger.error("Polling error:", err.message),
    );
    // Setup Web App menu button and bot info
    this.setupBotWebApp().catch((err) =>
      this.logger.warn("Bot setup warning:", err.message),
    );
  }

  private async setupBotWebApp() {
    const webappUrl = this.configService.get<string>("WEBAPP_URL");
    if (!webappUrl || !webappUrl.startsWith("https://")) {
      this.logger.warn("WEBAPP_URL is not HTTPS, skipping Web App menu setup");
      return;
    }

    try {
      // 1. Menu tugmasini Web App sifatida sozlash
      const menuRes = await fetch(
        `https://api.telegram.org/bot${this.botToken}/setChatMenuButton`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            menu_button: {
              type: "web_app",
              text: "🕌 Platformani ochish",
              web_app: { url: webappUrl },
            },
          }),
        },
      );
      const menuData = await menuRes.json();
      if (menuData.ok) {
        this.logger.log(`✅ Web App menu button set: ${webappUrl}`);
      }

      // 2. Bot descriptsiyasini yangilash
      await this.setBotDescriptions();
      this.logger.log("✅ Bot descriptions updated");
    } catch (e) {
      this.logger.warn("Web App setup error:", e.message);
    }
  }

  onModuleDestroy() {
    this.pollingActive = false;
  }

  private async startPolling() {
    this.pollingActive = true;
    this.logger.log("🤖 Telegram bot polling started...");

    // Delete webhook first
    try {
      await fetch(
        `https://api.telegram.org/bot${this.botToken}/deleteWebhook`,
        {
          method: "POST",
        },
      );
      this.logger.log("✅ Webhook deleted, polling mode active");
    } catch (e) {
      this.logger.warn("Could not delete webhook:", e.message);
    }

    while (this.pollingActive) {
      try {
        const res = await fetch(
          `https://api.telegram.org/bot${this.botToken}/getUpdates?offset=${this.pollingOffset}&timeout=30&allowed_updates=["message","callback_query"]`,
        );
        if (!res.ok) {
          await new Promise((r) => setTimeout(r, 5000));
          continue;
        }
        const data = await res.json();
        if (!data.ok) {
          this.logger.error("Telegram API error:", JSON.stringify(data));
          await new Promise((r) => setTimeout(r, 5000));
          continue;
        }
        for (const update of data.result || []) {
          this.pollingOffset = update.update_id + 1;
          this.handleWebhookUpdate(update).catch((err) =>
            this.logger.error("Update handler error:", err.message),
          );
        }
      } catch (err) {
        if (this.pollingActive) {
          this.logger.error("Polling fetch error:", err.message);
          await new Promise((r) => setTimeout(r, 5000));
        }
      }
    }
    this.logger.log("🛑 Telegram bot polling stopped");
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

    // Bot description va short description'ni ham yangilaymiz
    await this.setBotDescriptions();

    return data.result;
  }

  /**
   * Set bot description and short description
   */
  async setBotDescriptions() {
    if (!this.botToken) return;

    const description =
      "📖 TAVBA - Islomiy bilim platformasi\n\n" +
      "✅ Qur'on, Hadis, Fiqh, Aqida testlari\n" +
      "🤖 AI yordamchi - islomiy savollarga javob\n" +
      "📿 Zikr va duo to'plamlari\n" +
      "🏆 Reyting va yutuqlar tizimi\n\n" +
      "Bilimingizni sinab, savob qozoning!";

    const shortDescription =
      "📖 Islomiy testlar, AI yordamchi, zikrlar va duolar - Tavba platformasi";

    try {
      // Set description (512 character limit)
      await fetch(
        `https://api.telegram.org/bot${this.botToken}/setMyDescription`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ description }),
        },
      );

      // Set short description (120 character limit)
      await fetch(
        `https://api.telegram.org/bot${this.botToken}/setMyShortDescription`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ short_description: shortDescription }),
        },
      );

      console.log("[TELEGRAM] Bot descriptions updated successfully");
    } catch (error) {
      console.error("[TELEGRAM] Failed to update bot descriptions:", error);
    }
  }

  /**
   * Check if user is a member of the required channel
   */
  private async checkChannelMembership(userId: number): Promise<boolean> {
    try {
      // Use channel username (@username) - more reliable than numeric ID
      const res = await fetch(
        `https://api.telegram.org/bot${this.botToken}/getChatMember`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: REQUIRED_CHANNEL_USERNAME,
            user_id: userId,
          }),
        },
      );
      const data = await res.json();
      this.logger.log(`[CHANNEL_CHECK] user=${userId}, response=${JSON.stringify(data)}`);
      if (!data.ok) {
        // Bot kanalda admin emas yoki boshqa xatolik
        this.logger.warn(`[CHANNEL_CHECK] API error for user ${userId}: ${data.description}`);
        // Bot admin bo'lmasa, foydalanuvchini bloklash kerak emas
        if (data.description?.includes('chat not found') || data.description?.includes('bot is not a member')) {
          this.logger.error(`[CHANNEL_CHECK] Bot is NOT admin in ${REQUIRED_CHANNEL_USERNAME}! Add bot as admin.`);
          // Bot admin emas - foydalanuvchini o'tkazib yuboramiz (bloklash emas)
          return true;
        }
        return false;
      }
      const status = data.result?.status;
      this.logger.log(`[CHANNEL_CHECK] user=${userId}, status=${status}`);
      // "left" yoki "kicked" bo'lsa - obuna emas
      return ["member", "administrator", "creator", "restricted"].includes(status);
    } catch (err) {
      this.logger.error(`[CHANNEL_CHECK] Exception: ${err.message}`);
      // Xatolik bo'lsa ham foydalanuvchini bloklash kerak emas
      return true;
    }
  }

  /**
   * Send subscription required message
   */
  private async sendSubscriptionRequired(
    chatId: number | string,
    firstName: string,
  ) {
    const text =
      `⚠️ <b>Xurmatli ${firstName}!</b>\n\n` +
      `TAVBA platformasidan foydalanish uchun avval kanalimizga obuna bo'ling 👇\n\n` +
      `📢 <b>${REQUIRED_CHANNEL_USERNAME}</b> — Asl Baxt, Ilm\n\n` +
      `Obuna bo'lgandan so'ng <b>✅ Obunani tekshirish</b> tugmasini bosing.`;

    await this.sendMessage(chatId, text, {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "📢 Kanalga obuna bo'lish",
              url: REQUIRED_CHANNEL_LINK,
            },
          ],
          [
            {
              text: "✅ Obunani tekshirish",
              callback_data: "check_subscription",
            },
          ],
        ],
      },
    });
  }

  /**
   * Handle incoming webhook update from Telegram
   */
  async handleWebhookUpdate(update: any) {
    try {
      process.stderr.write(
        `[WEBHOOK] Received update: ${JSON.stringify(update)}\n`,
      );

      // Handle /start command
      if (update.message?.text?.startsWith("/start")) {
        const chatId = update.message.chat.id;
        const from = update.message.from;
        const firstName = from.first_name;

        this.logger.log(`[BOT] /start from ${firstName} (${from.id})`);

        // 1. Kanal a'zoligini tekshirish
        const isMember = await this.checkChannelMembership(from.id);
        if (!isMember) {
          await this.sendSubscriptionRequired(chatId, firstName);
          return { ok: true };
        }

        // 2. Foydalanuvchini saqlash
        await this.saveUserFromMessage(from);

        // 3. Xush kelibsiz xabari
        const webappUrl = this.configService.get("WEBAPP_URL");

        const messageText =
          `Assalomu alaykum, <b>${firstName}</b>! 👋\n\n` +
          `🕌 <b>TAVBA</b> — Islomiy bilim platformasiga xush kelibsiz!\n\n` +
          `📚 <b>Platformada neler bor:</b>\n` +
          `• 📖 Qur'on, Hadis, Fiqh, Aqida bo'yicha testlar\n` +
          `• 🤖 AI yordamchi — islomiy savollarga javob\n` +
          `• 📿 Zikr va duo to'plamlari\n` +
          `• 🏆 Reyting va yutuqlar tizimi\n` +
          `• 📊 Shaxsiy statistika va taraqqiyot\n\n` +
          `✨ <i>Bilimingizni sinab, savob qozoning!</i>\n\n` +
          `👇 Platformani ochish uchun tugmani bosing:`;

        if (webappUrl && webappUrl.startsWith("https://")) {
          await this.sendMessage(chatId, messageText, {
            parse_mode: "HTML",
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: "🕌 TAVBA platformasini ochish",
                    web_app: { url: webappUrl },
                  },
                ],
                [
                  {
                    text:
                      "📢 " + REQUIRED_CHANNEL_USERNAME + " kanaliga o'tish",
                    url: REQUIRED_CHANNEL_LINK,
                  },
                ],
              ],
            },
          });
        } else {
          await this.sendMessage(
            chatId,
            messageText.replace(
              "👇 Platformani ochish uchun tugmani bosing:",
              `🔗 Platform: ${webappUrl || "http://localhost:3000"}`,
            ),
            { parse_mode: "HTML" },
          );
        }

        this.logger.log(`[BOT] Welcome message sent to ${firstName}`);
      } else if (update.message && !update.message.text?.startsWith("/")) {
        // Oddiy xabar yuborilganda ham obunani tekshirish
        const chatId = update.message.chat.id;
        const from = update.message.from;
        const isMember = await this.checkChannelMembership(from.id);
        if (!isMember) {
          await this.sendSubscriptionRequired(chatId, from.first_name);
          return { ok: true };
        }
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
        const chatId = update.callback_query.message?.chat?.id;
        const from = update.callback_query.from;
        const data = update.callback_query.data;

        // Answer callback to remove loading state
        const answerCallback = async (text?: string, showAlert = false) => {
          await fetch(
            `https://api.telegram.org/bot${this.botToken}/answerCallbackQuery`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                callback_query_id: callbackQueryId,
                text,
                show_alert: showAlert,
              }),
            },
          );
        };

        // ✅ Obunani tekshirish callback
        if (data === "check_subscription") {
          const isMember = await this.checkChannelMembership(from.id);
          if (isMember) {
            await answerCallback(
              "✅ Rahmat! Endi platformadan foydalanishingiz mumkin.",
              true,
            );
            // Obuna xabarini o'chirish
            try {
              await fetch(
                `https://api.telegram.org/bot${this.botToken}/deleteMessage`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    chat_id: chatId,
                    message_id: update.callback_query.message.message_id,
                  }),
                },
              );
            } catch {}
            // Xush kelibsiz xabari yuborish
            await this.saveUserFromMessage(from);
            const webappUrl = this.configService.get("WEBAPP_URL");
            const firstName = from.first_name;
            const welcomeText =
              `✅ <b>Obuna tasdiqlandi!</b>\n\n` +
              `Assalomu alaykum, <b>${firstName}</b>! 👋\n\n` +
              `🕌 <b>TAVBA</b> platformasiga xush kelibsiz!\n\n` +
              `👇 Platformani ochish uchun tugmani bosing:`;
            if (webappUrl && webappUrl.startsWith("https://")) {
              await this.sendMessage(chatId, welcomeText, {
                parse_mode: "HTML",
                reply_markup: {
                  inline_keyboard: [
                    [
                      {
                        text: "🕌 TAVBA platformasini ochish",
                        web_app: { url: webappUrl },
                      },
                    ],
                  ],
                },
              });
            }
          } else {
            await answerCallback(
              "❌ Siz hali kanalga obuna bo'lmadingiz! Iltimos, avval obuna bo'ling.",
              true,
            );
          }
          return { ok: true };
        }

        await answerCallback();

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
      this.configService.get("TELEGRAM_BOT_USERNAME") || "allohga_qayting_bot";

    let link = `https://t.me/${botUsername}/app`;

    if (startParam) {
      link += `?startapp=${startParam}`;
    }

    return link;
  }
}
