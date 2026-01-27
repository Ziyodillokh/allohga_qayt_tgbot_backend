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
  // Multiple API keys for rotation
  private apiKeys: string[] = [];
  private currentKeyIndex: number = 1; // Key #1 limiti tugadi, #2 dan boshlaymiz
  private aiInstances: Map<number, GoogleGenAI> = new Map();

  constructor(
    private configService: ConfigService,
    @InjectRepository(AIChat)
    private aiChatRepository: Repository<AIChat>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Category)
    private categoryRepository: Repository<Category>,
  ) {
    // Load all Gemini API keys (GEMINI_API_KEY, GEMINI_API_KEY1, GEMINI_API_KEY2, etc.)
    this.loadApiKeys();
  }

  private loadApiKeys() {
    const keys: string[] = [];

    // Main key
    const mainKey =
      process.env.GEMINI_API_KEY ||
      this.configService.get<string>("GEMINI_API_KEY");
    if (mainKey) keys.push(mainKey);

    // Numbered keys (1-10)
    for (let i = 1; i <= 10; i++) {
      const key =
        process.env[`GEMINI_API_KEY${i}`] ||
        this.configService.get<string>(`GEMINI_API_KEY${i}`);
      if (key) keys.push(key);
    }

    this.apiKeys = keys;
    console.log(`[GEMINI] Loaded ${this.apiKeys.length} API keys for rotation`);

    // Create AI instances for each key
    this.apiKeys.forEach((key, index) => {
      this.aiInstances.set(index, new GoogleGenAI({ apiKey: key }));
    });
  }

  private getCurrentAI(): GoogleGenAI | null {
    return this.aiInstances.get(this.currentKeyIndex) || null;
  }

  private rotateToNextKey(): boolean {
    const nextIndex = this.currentKeyIndex + 1;
    if (nextIndex < this.apiKeys.length) {
      this.currentKeyIndex = nextIndex;
      console.log(
        `[GEMINI] Rotated to API key #${nextIndex + 1} of ${this.apiKeys.length}`,
      );
      return true;
    }
    // Reset to first key for next time
    this.currentKeyIndex = 0;
    console.log(`[GEMINI] All API keys exhausted, reset to key #1`);
    return false;
  }

  async chat(userId: string, dto: ChatDto) {
    if (this.apiKeys.length === 0) {
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
    let originalTranscript = "";
    let audioData: { mimeType: string; data: string } | null = null;

    if (dto.audioBase64 && dto.audioBase64.length > 100) {
      isAudioMessage = true;
      audioData = {
        mimeType: "audio/webm",
        data: dto.audioBase64,
      };
      console.log(
        "Audio received for direct processing, length:",
        dto.audioBase64.length,
      );
      // Audio bilan birga savolni yuboramiz - Gemini o'zi tushunadi
      messageText =
        "Bu ovozli xabarni tinglang va savol/so'rovga javob bering. Agar aniq tushunmasangiz, eng yaqin ma'noni toping va javob bering.";
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
        audioData ? "(with audio)" : "(text only)",
      );

      let aiResponse = await this.callGemini(contents, audioData);

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

  // Gemini API - @google/genai SDK orqali (API Key Rotation bilan)
  private async callGemini(
    contents: Array<{ role: string; parts: Array<{ text: string }> }>,
    audioData?: { mimeType: string; data: string } | null,
  ): Promise<string | null> {
    // 2026 yangi Gemini modellar
    const models = [
      "gemini-3-flash-preview",
      "gemini-2.5-flash-preview-05-20", // Eng yangi 2.5 flash
      "gemini-2.0-flash", // Barqaror flash
      "gemini-2.5-pro-preview-05-06", // Pro preview
    ];

    // Barcha API keylarni sinash
    const startKeyIndex = this.currentKeyIndex;
    let triedAllKeys = false;

    while (!triedAllKeys) {
      const ai = this.getCurrentAI();
      if (!ai) {
        console.error("[GEMINI] No AI instance available");
        return null;
      }

      const keyNum = this.currentKeyIndex + 1;
      console.log(
        `[GEMINI] Using API key #${keyNum} of ${this.apiKeys.length}`,
      );

      // Har bir model bilan sinash
      for (const modelName of models) {
        try {
          console.log(
            `[GEMINI] Trying model: ${modelName}`,
            audioData ? "(with audio)" : "(text only)",
          );

          // Contentlarni tayyorlash
          let formattedContents: any[];

          if (audioData) {
            // Audio bor - multimodal so'rov
            const previousMessages = contents.slice(0, -1).map((c) => ({
              role: c.role === "model" ? "model" : "user",
              parts: c.parts.map((p) => ({ text: p.text })),
            }));

            const lastMessage = contents[contents.length - 1];
            const audioMessage = {
              role: "user",
              parts: [
                {
                  inlineData: {
                    mimeType: audioData.mimeType,
                    data: audioData.data,
                  },
                },
                {
                  text: `${lastMessage.parts[0].text}

MUHIM: Bu ovozli xabar O'ZBEK TILIDA. Ovozni diqqat bilan tingla, nima deyilganini tushun va to'g'ridan-to'g'ri javob ber. Sheva va lahjalar ham bo'lishi mumkin.`,
                },
              ],
            };

            formattedContents = [...previousMessages, audioMessage];
          } else {
            formattedContents = contents.map((c) => ({
              role: c.role === "model" ? "model" : "user",
              parts: c.parts.map((p) => ({ text: p.text })),
            }));
          }

          const response = await ai.models.generateContent({
            model: modelName,
            contents: formattedContents as any,
            config: {
              temperature: 0.7,
              maxOutputTokens: 2048,
            },
          });

          const text = response.text;

          if (text) {
            console.log(
              `[GEMINI] ✅ Success with model: ${modelName}, API key #${keyNum}`,
            );
            return text;
          }
        } catch (error: any) {
          const errorMsg =
            typeof error.message === "string"
              ? error.message
              : JSON.stringify(error);
          console.error(
            `[GEMINI] Error with ${modelName}:`,
            errorMsg.substring(0, 150),
          );

          // Rate limit yoki quota xatosi - keyingi API key'ga o'tish
          if (
            errorMsg.includes("429") ||
            errorMsg.includes("quota") ||
            errorMsg.includes("RESOURCE_EXHAUSTED")
          ) {
            console.log(
              `[GEMINI] ⚠️ Rate limit on API key #${keyNum}, rotating...`,
            );
            break; // Bu API key uchun boshqa model sinashni to'xtatish
          }

          // 404 xatosi - keyingi model
          if (errorMsg.includes("404") || errorMsg.includes("NOT_FOUND")) {
            console.log(
              `[GEMINI] Model ${modelName} not found, trying next...`,
            );
            continue;
          }

          // Boshqa xatolik - keyingi model
          continue;
        }
      }

      // Keyingi API key'ga o'tish
      const rotated = this.rotateToNextKey();

      // Agar boshidan boshlab kelgan bo'lsak, to'xtatish
      if (this.currentKeyIndex === startKeyIndex || !rotated) {
        triedAllKeys = true;
      }
    }

    console.error("[GEMINI] ❌ All API keys and models exhausted");
    return null;
  }
}
