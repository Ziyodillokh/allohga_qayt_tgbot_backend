import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Notification, NotificationType } from "./entities";
import { User } from "../users/entities";
import { NotificationsGateway } from "./notifications.gateway";
import { ConfigService } from "@nestjs/config";

interface CreateNotificationDto {
  title: string;
  message: string;
  type?: NotificationType;
  data?: any;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private botToken: string;

  constructor(
    @InjectRepository(Notification)
    private notificationRepository: Repository<Notification>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private notificationsGateway: NotificationsGateway,
    private configService: ConfigService,
  ) {
    this.botToken = this.configService.get<string>("TELEGRAM_BOT_TOKEN") || "";
  }

  async createNotification(userId: string, dto: CreateNotificationDto) {
    const notification = this.notificationRepository.create({
      userId,
      title: dto.title,
      message: dto.message,
      type: dto.type || NotificationType.SYSTEM,
      data: dto.data,
    });
    await this.notificationRepository.save(notification);

    // Send real-time notification via WebSocket
    this.notificationsGateway.sendToUser(userId, notification);

    return notification;
  }

  async createBulkNotifications(userIds: string[], dto: CreateNotificationDto) {
    const notificationsToCreate = userIds.map((userId) =>
      this.notificationRepository.create({
        userId,
        title: dto.title,
        message: dto.message,
        type: dto.type || NotificationType.SYSTEM,
        data: dto.data,
      }),
    );
    const notifications = await this.notificationRepository.save(
      notificationsToCreate,
    );

    // Send real-time notifications
    userIds.forEach((userId) => {
      this.notificationsGateway.sendToUser(userId, {
        title: dto.title,
        message: dto.message,
        type: dto.type || NotificationType.SYSTEM,
        data: dto.data,
      });
    });

    return notifications;
  }

  async getUserNotifications(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [notifications, total, unreadCount] = await Promise.all([
      this.notificationRepository.find({
        where: { userId },
        order: { createdAt: "DESC" },
        skip,
        take: limit,
      }),
      this.notificationRepository.count({ where: { userId } }),
      this.notificationRepository.count({ where: { userId, isRead: false } }),
    ]);

    return {
      notifications,
      unreadCount,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async markAsRead(userId: string, notificationId: string) {
    return this.notificationRepository.update(
      { id: notificationId, userId },
      { isRead: true },
    );
  }

  async markAllAsRead(userId: string) {
    return this.notificationRepository.update(
      { userId, isRead: false },
      { isRead: true },
    );
  }

  async deleteNotification(userId: string, notificationId: string) {
    return this.notificationRepository.delete({ id: notificationId, userId });
  }

  async getUnreadCount(userId: string) {
    return this.notificationRepository.count({
      where: { userId, isRead: false },
    });
  }

  /**
   * Notify all users about a new category via Telegram, Email, and WebSocket
   */
  async notifyNewCategory(category: {
    id: string;
    name: string;
    slug: string;
    icon?: string | null;
    group?: string | null;
  }) {
    this.logger.log(`Notifying users about new category: ${category.name}`);

    // Get all users
    const users = await this.userRepository.find({
      select: {
        id: true,
        telegramId: true,
        email: true,
        fullName: true,
        username: true,
      },
    });

    const webappUrl =
      this.configService.get<string>("WEBAPP_URL") || "http://localhost:3000";
    const categoryUrl = `${webappUrl}/test/${category.slug}`;

    // Check if icon is a file path or emoji
    const isIconFile = category.icon && category.icon.startsWith("/uploads/");
    const iconEmoji = isIconFile ? "📚" : category.icon || "📚";

    // For emails, use absolute URL (base64 doesn't work reliably in email clients)
    const apiUrl =
      this.configService.get<string>("API_URL") || "http://localhost:3001";
    const iconAbsoluteUrl =
      isIconFile && category.icon ? `${apiUrl}${category.icon}` : null;

    // Read icon file for Telegram (buffer for photo upload)
    let iconBuffer: Buffer | null = null;
    if (isIconFile && category.icon) {
      try {
        const fs = await import("fs");
        const path = await import("path");
        // Try multiple possible paths
        const possiblePaths = [
          path.join(process.cwd(), category.icon),
          path.join(process.cwd(), "backend", category.icon),
          path.join(__dirname, "..", "..", "..", "..", category.icon),
        ];

        let iconPath: string | null = null;
        for (const p of possiblePaths) {
          this.logger.log(`Checking path: ${p}`);
          if (fs.existsSync(p)) {
            iconPath = p;
            break;
          }
        }

        if (iconPath) {
          iconBuffer = fs.readFileSync(iconPath);
          this.logger.log(
            `Icon loaded successfully: ${iconPath}, size: ${iconBuffer.length} bytes`,
          );
        } else {
          this.logger.warn(
            `Icon file not found in any path for: ${category.icon}`,
          );
        }
      } catch (error: any) {
        this.logger.warn(
          `Failed to read icon file: ${error?.message || error}`,
        );
      }
    }

    // For in-app notifications, store relative path (frontend will add base URL)
    const iconUrlForInApp = isIconFile ? category.icon : null;

    let telegramSent = 0;
    let websocketSent = 0;
    let errors = 0;

    // Create in-app notifications for all users
    const notificationData = {
      title: `🎉 Yangi kategoriya: ${category.name}`,
      message: `${category.name} kategoriyasi qo'shildi. Yangi testlarni sinab ko'ring!`,
      type: NotificationType.SYSTEM,
      data: {
        categoryId: category.id,
        categorySlug: category.slug,
        iconUrl: iconUrlForInApp,
      },
    };

    // Create bulk in-app notifications
    await this.createBulkNotifications(
      users.map((u) => u.id),
      notificationData,
    );
    websocketSent = users.length;

    // Send Telegram and Email notifications in parallel batches
    const batchSize = 10;
    for (let i = 0; i < users.length; i += batchSize) {
      const batch = users.slice(i, i + batchSize);

      await Promise.allSettled(
        batch.map(async (user) => {
          // Send Telegram notification with photo if available
          if (user.telegramId) {
            try {
              if (iconBuffer) {
                // Send photo with caption using buffer
                await this.sendTelegramPhotoBuffer(
                  user.telegramId,
                  iconBuffer,
                  `${category.name}.png`,
                  `🎉 <b>Yangi kategoriya qo'shildi!</b>\n\n` +
                    `📚 <b>${category.name}</b>\n` +
                    (category.slug ? `📁 ${category.slug}\n\n` : "\n") +
                    `Yangi testlarni sinab ko'ring va bilimingizni oshiring! 🚀`,
                  {
                    parse_mode: "HTML",
                    reply_markup: {
                      inline_keyboard: [
                        [
                          {
                            text: "📝 Testni boshlash",
                            web_app: { url: categoryUrl },
                          },
                        ],
                      ],
                    },
                  },
                );
              } else {
                // Send text message only
                await this.sendTelegramMessage(
                  user.telegramId,
                  `🎉 <b>Yangi kategoriya qo'shildi!</b>\n\n` +
                    `${iconEmoji} <b>${category.name}</b>\n` +
                    (category.slug ? `📁 ${category.slug}\n\n` : "\n") +
                    `Yangi testlarni sinab ko'ring va bilimingizni oshiring! 🚀`,
                  {
                    parse_mode: "HTML",
                    reply_markup: {
                      inline_keyboard: [
                        [
                          {
                            text: "📝 Testni boshlash",
                            web_app: { url: categoryUrl },
                          },
                        ],
                      ],
                    },
                  },
                );
              }
              telegramSent++;
            } catch (error: any) {
              this.logger.warn(
                `Failed to send Telegram to ${user.telegramId}: ${error?.message || error}`,
              );
              errors++;
            }
          }
        }),
      );

      // Small delay between batches to avoid rate limits
      if (i + batchSize < users.length) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    return {
      totalUsers: users.length,
      telegramSent,
      websocketSent,
      errors,
    };
  }

  /**
   * Send message via Telegram Bot API
   */
  private async sendTelegramMessage(
    chatId: string | number,
    text: string,
    options?: {
      parse_mode?: "HTML" | "Markdown" | "MarkdownV2";
      reply_markup?: any;
    },
  ) {
    if (!this.botToken) {
      throw new Error("Telegram bot token not configured");
    }

    const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;

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

    if (!data.ok) {
      throw new Error(`Telegram API error: ${data.description}`);
    }

    return data.result;
  }

  /**
   * Send photo via Telegram Bot API
   */
  private async sendTelegramPhoto(
    chatId: string | number,
    photoUrl: string,
    caption: string,
    options?: {
      parse_mode?: "HTML" | "Markdown" | "MarkdownV2";
      reply_markup?: any;
    },
  ) {
    if (!this.botToken) {
      throw new Error("Telegram bot token not configured");
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
      throw new Error(`Telegram API error: ${data.description}`);
    }

    return data.result;
  }

  /**
   * Send photo via Telegram Bot API using file buffer (multipart/form-data)
   */
  private async sendTelegramPhotoBuffer(
    chatId: string | number,
    photoBuffer: Buffer,
    filename: string,
    caption: string,
    options?: {
      parse_mode?: "HTML" | "Markdown" | "MarkdownV2";
      reply_markup?: any;
    },
  ) {
    if (!this.botToken) {
      throw new Error("Telegram bot token not configured");
    }

    const FormData = (await import("form-data")).default;
    const formData = new FormData();

    formData.append("chat_id", chatId.toString());
    formData.append("photo", photoBuffer, {
      filename,
      contentType: "image/png",
    });
    formData.append("caption", caption);

    if (options?.parse_mode) {
      formData.append("parse_mode", options.parse_mode);
    }
    if (options?.reply_markup) {
      formData.append("reply_markup", JSON.stringify(options.reply_markup));
    }

    const url = `https://api.telegram.org/bot${this.botToken}/sendPhoto`;

    const response = await fetch(url, {
      method: "POST",
      body: formData as any,
      headers: formData.getHeaders(),
    });

    const data = await response.json();

    if (!data.ok) {
      throw new Error(`Telegram API error: ${data.description}`);
    }

    return data.result;
  }
}
