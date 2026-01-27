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

    // Agar audio bo'lsa, uni transcribe qilish
    let messageText = dto.message;
    let isAudioMessage = false;
    
    if (dto.audioBase64 && dto.audioBase64.length > 100) {
      isAudioMessage = true;
      try {
        console.log("Audio received, length:", dto.audioBase64.length);
        const transcribedText = await this.transcribeAudio(dto.audioBase64);
        if (transcribedText && transcribedText !== "Ovozli xabar tushunarsiz") {
          messageText = transcribedText;
          console.log("Audio transcribed:", transcribedText.substring(0, 100));
        } else {
          // Agar transcribe bo'lmasa, umumiy savol qilamiz
          messageText = "Assalomu alaykum, menga islomiy mavzuda yordam bering";
          console.log("Audio transcription failed, using default message");
        }
      } catch (error: any) {
        console.error("Audio transcription error:", error.message);
        // Xatolik bo'lsa, umumiy savol qilamiz
        messageText = "Assalomu alaykum, menga islomiy mavzuda yordam bering";
      }
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
7. HECH QACHON "men ovozli xabarlarni tushunmayman" yoki "men matn asosidagi sun'iy intellektman" dema - foydalanuvchi savolini oddiy savol sifatida qabul qil va javob ber
8. HECH QACHON "men rasm yarata olmayman" dema - agar foydalanuvchi rasm so'rasa, uning tasviri haqida batafsil yoz yoki internet URL berishga harakat qil
9. Foydalanuvchi ovozli xabar yuborsa, u avtomatik matnga aylantirilgan - shuning uchun oddiy savol sifatida javob ber
10. Bahona qilma, doim yordam berishga harakat qil

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
        ? `${systemPrompt}\n\nFoydalanuvchi savoli: ${messageText}`
        : messageText;
    contents.push({ role: "user", parts: [{ text: userMessage }] });

    try {
      console.log(
        "Calling Gemini AI with message:",
        messageText.substring(0, 50),
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
        message: messageText,
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
        message: messageText,
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

  // Audio transcription - Gemini orqali
  private async transcribeAudio(audioBase64: string): Promise<string | null> {
    if (!this.ai) {
      console.error("Gemini API not initialized for audio transcription");
      return null;
    }

    try {
      console.log("Transcribing audio with Gemini, data length:", audioBase64.length);

      // Gemini 1.5 Flash audio transcription uchun yaxshiroq
      const mimeTypes = ["audio/webm", "audio/webm;codecs=opus", "audio/mp4", "audio/mpeg", "audio/wav", "audio/ogg"];
      
      for (const mimeType of mimeTypes) {
        try {
          const response = await this.ai.models.generateContent({
            model: "gemini-1.5-flash",
            contents: [
              {
                role: "user",
                parts: [
                  {
                    inlineData: {
                      mimeType: mimeType,
                      data: audioBase64,
                    },
                  },
                  {
                    text: "Bu audio yozuvni diqqat bilan tingla va aytilgan so'zlarni aniq transkripsiya qil. FAQAT aytilgan so'zlarni yoz, hech qanday izoh yoki tushuntirish qo'shma. Agar o'zbek tilida gapirilsa, o'zbek tilida yoz. Agar boshqa tilda gapirilsa, o'sha tilda yoz.",
                  },
                ],
              },
            ],
            config: {
              temperature: 0,
              maxOutputTokens: 2048,
            },
          });

          const transcribedText = response.text;
          if (transcribedText && transcribedText.trim().length > 0) {
            console.log("Audio transcribed successfully with", mimeType, ":", transcribedText.substring(0, 100));
            return transcribedText.trim();
          }
        } catch (err: any) {
          console.log("Failed with mimeType", mimeType, ":", err.message?.substring(0, 100));
          continue;
        }
      }

      return null;
    } catch (error: any) {
      console.error("Audio transcription error:", error.message);
      return null;
    }
  }
}
