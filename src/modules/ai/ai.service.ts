import { Injectable, BadRequestException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, MoreThanOrEqual } from "typeorm";
import { AIChat } from "./entities";
import { User } from "../users/entities";
import { Category } from "../categories/entities";
import { ChatDto } from "./dto/chat.dto";
import { GoogleGenAI } from "@google/genai";

@Injectable()
export class AIService {
  private geminiApiKey: string;
  private ai: GoogleGenAI | null = null;

  constructor(
    private configService: ConfigService,
    @InjectRepository(AIChat)
    private aiChatRepository: Repository<AIChat>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Category)
    private categoryRepository: Repository<Category>,
  ) {
    // Gemini API key
    this.geminiApiKey =
      process.env.GEMINI_API_KEY ||
      this.configService.get<string>("GEMINI_API_KEY") ||
      "";
    console.log("GEMINI_API_KEY configured:", this.geminiApiKey ? "YES" : "NO");

    if (this.geminiApiKey) {
      this.ai = new GoogleGenAI({ apiKey: this.geminiApiKey });
    }
  }

  async chat(userId: string, dto: ChatDto) {
    if (!this.geminiApiKey) {
      throw new BadRequestException("Gemini API kaliti sozlanmagan");
    }

    // Check daily limit (100 requests per user per day)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayCount = await this.aiChatRepository.count({
      where: {
        userId,
        createdAt: MoreThanOrEqual(today),
      },
    });

    if (todayCount >= 100) {
      throw new BadRequestException(
        "Kunlik so'rovlar limiti tugadi (100 ta). Ertaga qaytadan urinib ko'ring.",
      );
    }

    // Get chat history for context
    const chatHistory = await this.aiChatRepository.find({
      where: { userId },
      order: { createdAt: "DESC" },
      take: 10,
      select: { message: true, response: true },
    });

    // Build system prompt
    const systemPrompt = `Sen "Tavba" islomiy ta'lim platformasining AI yordamchisisan.

MUHIM QOIDALAR:
1. FAQAT O'ZBEK TILIDA javob ber
2. Har safar o'zingni tanishtirma - to'g'ridan-to'g'ri savolga javob ber
3. Aniq, qisqa va foydali ma'lumot ber
4. Islomiy mavzularda Qur'on va hadis asosida javob ber
5. Agar bilmasang "Bu haqida aniq ma'lumotim yo'q" de
6. Hurmatli va muloyim tonda muloqot qil

MAVZULAR: Qur'on, Hadis, Fiqh, Aqida, Zikr, Duo, Namoz, Ro'za, Haj, Zakot, Islom tarixi.`;

    // Build conversation for Gemini
    const contents: Array<{ role: string; parts: Array<{ text: string }> }> =
      [];

    // Add chat history in chronological order
    const reversedChats = [...chatHistory].reverse();
    for (const chat of reversedChats) {
      contents.push({ role: "user", parts: [{ text: chat.message }] });
      contents.push({ role: "model", parts: [{ text: chat.response }] });
    }

    // Add current message with system context for first message
    const userMessage =
      reversedChats.length === 0
        ? `${systemPrompt}\n\nFoydalanuvchi savoli: ${dto.message}`
        : dto.message;
    contents.push({ role: "user", parts: [{ text: userMessage }] });

    try {
      console.log(
        "Calling Gemini AI with message:",
        dto.message.substring(0, 50),
      );

      let aiResponse = await this.callGemini(contents);

      if (!aiResponse) {
        throw new Error("Gemini AI javob bermadi");
      }

      console.log("AI response received successfully");

      // Clean response
      aiResponse = aiResponse
        .replace(/<s>/g, "")
        .replace(/<\/s>/g, "")
        .replace(/^\s+/, "")
        .trim();

      // Get category ID if slug provided
      let categoryId: string | null = null;
      if (dto.categorySlug) {
        const category = await this.categoryRepository.findOne({
          where: { slug: dto.categorySlug },
        });
        categoryId = category?.id || null;
      }

      // Save to database
      const newChat = this.aiChatRepository.create({
        userId,
        categoryId,
        message: dto.message,
        response: aiResponse,
      });
      const savedChat = await this.aiChatRepository.save(newChat);

      // Load category relation
      const aiChat = await this.aiChatRepository.findOne({
        where: { id: savedChat.id },
        relations: ["category"],
      });

      return {
        id: savedChat.id,
        message: dto.message,
        response: aiResponse,
        category: aiChat?.category || null,
        createdAt: savedChat.createdAt,
        remainingQueries: 100 - todayCount - 1,
      };
    } catch (error) {
      console.error("AI Error:", error);
      throw new BadRequestException(
        "AI javob berishda xatolik yuz berdi. Qaytadan urinib ko'ring.",
      );
    }
  }

  async getChatHistory(userId: string, page = 1, limit = 50) {
    const skip = (page - 1) * limit;

    const [chats, total] = await this.aiChatRepository.findAndCount({
      where: { userId },
      relations: ["category"],
      order: { createdAt: "DESC" },
      skip,
      take: limit,
    });

    return {
      chats,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async clearChatHistory(userId: string) {
    await this.aiChatRepository.delete({ userId });

    return { message: "Chat tarixi tozalandi" };
  }

  async getDailyUsage(userId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const count = await this.aiChatRepository.count({
      where: {
        userId,
        createdAt: MoreThanOrEqual(today),
      },
    });

    return {
      used: count,
      limit: 100,
      remaining: Math.max(0, 100 - count),
    };
  }

  // Gemini API - @google/genai SDK orqali (2026 yangi API)
  private async callGemini(
    contents: Array<{ role: string; parts: Array<{ text: string }> }>,
  ): Promise<string | null> {
    if (!this.ai) {
      console.error("Gemini API not initialized");
      return null;
    }

    // Gemini modellar - 2026 dokumentatsiya asosida (eng yangidan eskiga)
    const models = [
      "gemini-3-flash-preview", // Eng yangi preview (bepul)
      "gemini-2.5-flash", // Barqaror va tez
      "gemini-2.0-flash", // Eski barqaror
    ];

    for (const modelName of models) {
      try {
        console.log("Trying Gemini model:", modelName);

        // Yangi @google/genai SDK formatida
        // Contentlarni to'g'ri formatga o'tkazish
        const formattedContents = contents.map((c) => ({
          role: c.role === "model" ? "model" : "user",
          parts: c.parts.map((p) => ({ text: p.text })),
        }));

        const response = await this.ai.models.generateContent({
          model: modelName,
          contents: formattedContents as any,
          config: {
            temperature: 0.7,
            maxOutputTokens: 2048,
          },
        });

        const text = response.text;

        if (text) {
          console.log("Success with Gemini model:", modelName);
          return text;
        }
      } catch (error: any) {
        console.error("Error with Gemini model", modelName, ":", error.message);
        // Rate limit xatosi bo'lsa, keyingi modelga o'tish
        if (
          error.message?.includes("429") ||
          error.message?.includes("quota") ||
          error.message?.includes("RESOURCE_EXHAUSTED")
        ) {
          console.log("Rate limit hit, trying next model...");
          continue;
        }
        // 404 xatosi - model topilmadi
        if (
          error.message?.includes("404") ||
          error.message?.includes("NOT_FOUND")
        ) {
          console.log("Model not found, trying next...");
          continue;
        }
        // Boshqa xato bo'lsa ham keyingi modelni sinash
        continue;
      }
    }

    return null;
  }
}
