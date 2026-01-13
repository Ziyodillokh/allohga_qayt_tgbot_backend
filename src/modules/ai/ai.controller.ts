import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Query,
  UseGuards,
  Req,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from "@nestjs/swagger";
import { AIService } from "./ai.service";
import { ChatDto } from "./dto/chat.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";

@ApiTags("ai")
@Controller("ai")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AIController {
  constructor(private aiService: AIService) {}

  @Post("chat")
  @ApiOperation({ summary: "AI yordamchisi bilan suhbatlashish" })
  @ApiResponse({ status: 200, description: "AI javobi" })
  async chat(@Req() req: any, @Body() dto: ChatDto) {
    return this.aiService.chat(req.user.id, dto);
  }

  @Get("history")
  @ApiOperation({ summary: "Chat tarixini olish" })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiResponse({ status: 200, description: "Chat tarixi" })
  async getChatHistory(
    @Req() req: any,
    @Query("page") page?: number,
    @Query("limit") limit?: number
  ) {
    return this.aiService.getChatHistory(req.user.id, page, limit);
  }

  @Delete("history")
  @ApiOperation({ summary: "Chat tarixini tozalash" })
  @ApiResponse({ status: 200, description: "Tarix tozalandi" })
  async clearChatHistory(@Req() req: any) {
    return this.aiService.clearChatHistory(req.user.id);
  }

  @Get("usage")
  @ApiOperation({ summary: "Kunlik foydalanish statistikasi" })
  @ApiResponse({ status: 200, description: "Foydalanish ma'lumotlari" })
  async getDailyUsage(@Req() req: any) {
    return this.aiService.getDailyUsage(req.user.id);
  }
}
