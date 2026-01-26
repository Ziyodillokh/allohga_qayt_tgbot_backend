import { Injectable, BadRequestException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, MoreThanOrEqual } from "typeorm";
import { AIChat } from "./entities";
import { User } from "../users/entities";
import { Category } from "../categories/entities";
import { ChatDto } from "./dto/chat.dto";

@Injectable()
export class AIService {
  private geminiApiKey: string;
  private openrouterApiKey: string;

  constructor(
    private configService: ConfigService,
    @InjectRepository(AIChat)
    private aiChatRepository: Repository<AIChat>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Category)
    private categoryRepository: Repository<Category>,
  ) {
    // API keys - process.env dan olish
    this.geminiApiKey =
      process.env.GEMINI_API_KEY ||
      this.configService.get<string>("GEMINI_API_KEY") ||
      "";
    this.openrouterApiKey =
      process.env.OPENROUTER_API_KEY ||
      this.configService.get<string>("OPENROUTER_API_KEY") ||
      "";
    console.log("GEMINI_API_KEY configured:", this.geminiApiKey ? "YES" : "NO");
    console.log(
      "OPENROUTER_API_KEY configured:",
      this.openrouterApiKey ? "YES" : "NO",
    );
  }

  async chat(userId: string, dto: ChatDto) {
    if (!this.geminiApiKey && !this.openrouterApiKey) {
      throw new BadRequestException("AI xizmati sozlanmagan");
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
      console.log("Calling AI API with message:", dto.message.substring(0, 50));

      let aiResponse: string | null = null;

      // OpenRouter API (bepul modellar bilan)
      if (this.openrouterApiKey) {
        aiResponse = await this.callOpenRouter(
          systemPrompt,
          dto.message,
          chatHistory,
        );
      }

      // Gemini API fallback
      if (!aiResponse && this.geminiApiKey) {
        aiResponse = await this.callGemini(contents);
      }

      if (!aiResponse) {
        throw new Error("All AI providers failed");
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

  // OpenRouter API - bepul modellar bilan
  private async callOpenRouter(
    systemPrompt: string,
    message: string,
    chatHistory: any[],
  ): Promise<string | null> {
    const models = [
      "meta-llama/llama-3.3-70b-instruct:free",
      "qwen/qwen-2.5-7b-instruct:free",
      "google/gemma-2-9b-it:free",
      "mistralai/mistral-7b-instruct:free",
    ];

    // Build messages
    const messages = [{ role: "system", content: systemPrompt }];

    // Add chat history
    const reversedChats = [...chatHistory].reverse();
    for (const chat of reversedChats) {
      messages.push({ role: "user", content: chat.message });
      messages.push({ role: "assistant", content: chat.response });
    }
    messages.push({ role: "user", content: message });

    for (const model of models) {
      try {
        console.log("Trying OpenRouter model:", model);

        const response = await fetch(
          "https://openrouter.ai/api/v1/chat/completions",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${this.openrouterApiKey}`,
              "HTTP-Referer": "https://allohgaqayt.uz",
              "X-Title": "Tavba AI",
            },
            body: JSON.stringify({
              model: model,
              messages: messages,
              max_tokens: 2048,
              temperature: 0.7,
            }),
          },
        );

        const responseText = await response.text();
        console.log(
          "OpenRouter Response status for",
          model,
          ":",
          response.status,
        );

        if (!response.ok) {
          console.error("OpenRouter Error for", model, ":", response.status);
          continue;
        }

        const data = JSON.parse(responseText);
        const aiResponse = data.choices?.[0]?.message?.content;

        if (aiResponse) {
          console.log("Success with OpenRouter model:", model);
          return aiResponse;
        }
      } catch (error) {
        console.error("Error with OpenRouter model", model, ":", error);
        continue;
      }
    }

    return null;
  }

  // Gemini API
  private async callGemini(
    contents: Array<{ role: string; parts: Array<{ text: string }> }>,
  ): Promise<string | null> {
    const models = [
      "gemini-2.0-flash-exp",
      "gemini-1.5-flash-8b",
      "gemini-1.0-pro",
    ];

    for (const model of models) {
      try {
        console.log("Trying Gemini model:", model);

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.geminiApiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: contents,
              generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 2048,
              },
            }),
          },
        );

        if (!response.ok) {
          console.error("Gemini Error for", model, ":", response.status);
          continue;
        }

        const data = await response.json();
        const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (aiResponse) {
          console.log("Success with Gemini model:", model);
          return aiResponse;
        }
      } catch (error) {
        console.error("Error with Gemini model", model, ":", error);
        continue;
      }
    }

    return null;
  }
}
