import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
  Param,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { TelegramService } from "./telegram.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/guards/roles.decorator";
import {
  TelegramWebAppAuthDto,
  SendTelegramMessageDto,
  SetWebhookDto,
  SavePhoneDto,
  CompleteRegistrationDto,
} from "./dto";

@ApiTags("Telegram")
@Controller("telegram")
export class TelegramController {
  constructor(private readonly telegramService: TelegramService) {}

  @Post("webapp/auth")
  @ApiOperation({ summary: "Authenticate via Telegram Mini App" })
  authenticateWebApp(@Body() dto: TelegramWebAppAuthDto) {
    return this.telegramService.authenticateWebApp(dto.initData);
  }

  @Post("webapp/save-phone")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Save phone number from Telegram contact sharing" })
  savePhone(@Request() req, @Body() dto: SavePhoneDto) {
    return this.telegramService.savePhoneNumber(req.user.id, dto.phone);
  }

  @Post("webapp/complete-registration")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: "Complete Telegram user registration with username and password",
  })
  completeRegistration(@Request() req, @Body() dto: CompleteRegistrationDto) {
    return this.telegramService.completeRegistration(req.user.id, dto);
  }

  @Get("user/:telegramId")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Get user by Telegram ID" })
  getUserByTelegramId(@Param("telegramId") telegramId: string) {
    return this.telegramService.getUserByTelegramId(telegramId);
  }

  @Post("webhook")
  @ApiOperation({ summary: "Telegram webhook endpoint" })
  async handleWebhook(@Body() update: any) {
    // Immediately return OK to avoid timeout
    process.stderr.write(
      `[WEBHOOK_CONTROLLER] Received update: ${update?.message?.text}\n`
    );
    try {
      // Process update in background, don't wait
      this.telegramService.handleWebhookUpdate(update).catch((err) => {
        process.stderr.write(
          `[WEBHOOK] Error handling update: ${err.message}\n`
        );
      });
    } catch (err) {
      process.stderr.write(`[WEBHOOK] Sync error: ${err.message}\n`);
    }
    // Always return 200 OK immediately
    return { ok: true };
  }

  @Post("admin/set-webhook")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: "Set Telegram webhook URL (Admin only)" })
  setWebhook(@Body() dto: SetWebhookDto) {
    return this.telegramService.setWebhook(dto.webhookUrl);
  }

  // @Post("admin/send-message")
  // @ApiBearerAuth()
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles(Role.ADMIN, Role.MODERATOR)
  // @ApiOperation({
  //   summary: "Send message via Telegram Bot (with optional photo/video)",
  // })
  // sendMessage(@Body() dto: SendTelegramMessageDto) {
  //   return this.telegramService.sendMediaMessage(dto.chatId, dto.text, {
  //     imageUrl: dto.imageUrl,
  //     videoUrl: dto.videoUrl,
  //     parse_mode: dto.parseMode,
  //   });
  // }

  @Get("miniapp-link")
  @ApiOperation({ summary: "Get Mini App link" })
  getMiniAppLink() {
    return { link: this.telegramService.generateMiniAppLink() };
  }

  @Get("miniapp-link/:startParam")
  @ApiOperation({ summary: "Get Mini App link with start parameter" })
  getMiniAppLinkWithParam(@Param("startParam") startParam: string) {
    return { link: this.telegramService.generateMiniAppLink(startParam) };
  }

  @Post("update-descriptions")
  @ApiOperation({ summary: "Update bot description and short description" })
  async updateBotDescriptions() {
    await this.telegramService.setBotDescriptions();
    return { success: true, message: "Bot descriptions updated" };
  }
}
