import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Difficulty } from '@prisma/client';
import { CreateQuestionDto } from './dto/create-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';

@Injectable()
export class QuestionsService {
  constructor(private prisma: PrismaService) {}

  async findAll(params: {
    categoryId?: string;
    difficulty?: Difficulty;
    search?: string;
    page?: number;
    limit?: number;
    activeOnly?: boolean;
  }) {
    const { categoryId, difficulty, search, page = 1, limit = 20, activeOnly = true } = params;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (categoryId) where.categoryId = categoryId;
    if (difficulty) where.difficulty = difficulty;
    if (activeOnly) where.isActive = true;
    if (search) {
      where.OR = [
        { question: { contains: search, mode: 'insensitive' } },
        { tags: { has: search.toLowerCase() } },
      ];
    }

    const [questions, total] = await Promise.all([
      this.prisma.question.findMany({
        where,
        include: {
          category: {
            select: { id: true, name: true, slug: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.question.count({ where }),
    ]);

    return {
      questions,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: string) {
    const question = await this.prisma.question.findUnique({
      where: { id },
      include: {
        category: {
          select: { id: true, name: true, slug: true },
        },
      },
    });

    if (!question) {
      throw new NotFoundException('Savol topilmadi');
    }

    return question;
  }

  async getRandomQuestions(categoryId: string | null, count: number = 10) {
    const where: any = { isActive: true };
    if (categoryId) where.categoryId = categoryId;

    // Get random questions using raw SQL for better performance
    const questions = await this.prisma.$queryRaw`
      SELECT q.*, c.name as category_name, c.slug as category_slug
      FROM "Question" q
      LEFT JOIN "Category" c ON q."categoryId" = c.id
      WHERE q."isActive" = true
      ${categoryId ? this.prisma.$queryRaw`AND q."categoryId" = ${categoryId}` : this.prisma.$queryRaw``}
      ORDER BY RANDOM()
      LIMIT ${count}
    `;

    return questions;
  }

  async getRandomQuestionsSimple(categoryId: string | null, count: number = 10) {
    const where: any = { isActive: true };
    if (categoryId) where.categoryId = categoryId;

    // Get total count
    const totalCount = await this.prisma.question.count({ where });

    if (totalCount === 0) {
      throw new BadRequestException('Bu kategoriyada savollar mavjud emas');
    }

    if (totalCount < count) {
      count = totalCount;
    }

    // Generate random skip values
    const skipValues = new Set<number>();
    while (skipValues.size < count) {
      skipValues.add(Math.floor(Math.random() * totalCount));
    }

    // Fetch questions one by one (less efficient but works with Prisma)
    const questions = await Promise.all(
      Array.from(skipValues).map((skip) =>
        this.prisma.question.findFirst({
          where,
          skip,
          include: {
            category: {
              select: { id: true, name: true, slug: true, icon: true },
            },
          },
        }),
      ),
    );

    return questions.filter(Boolean);
  }

  async create(dto: CreateQuestionDto) {
    // Validate options length
    if (dto.options.length !== 4) {
      throw new BadRequestException('Savol uchun aniq 4 ta variant bo\'lishi kerak');
    }

    // Validate correctAnswer
    if (dto.correctAnswer < 0 || dto.correctAnswer > 3) {
      throw new BadRequestException('To\'g\'ri javob indeksi 0-3 oralig\'ida bo\'lishi kerak');
    }

    // Calculate XP reward based on difficulty
    const xpRewards = {
      [Difficulty.EASY]: 5,
      [Difficulty.MEDIUM]: 10,
      [Difficulty.HARD]: 15,
    };

    return this.prisma.question.create({
      data: {
        ...dto,
        xpReward: dto.xpReward || xpRewards[dto.difficulty || Difficulty.MEDIUM],
        tags: dto.tags || [],
      },
      include: {
        category: {
          select: { id: true, name: true, slug: true },
        },
      },
    });
  }

  async createMany(questions: CreateQuestionDto[]) {
    const results = await Promise.all(
      questions.map((dto) => this.create(dto).catch((err) => ({ error: err.message, question: dto.question }))),
    );

    const successful = results.filter((r) => !('error' in r));
    const failed = results.filter((r) => 'error' in r);

    return {
      totalProcessed: questions.length,
      successful: successful.length,
      failed: failed.length,
      errors: failed,
    };
  }

  async update(id: string, dto: UpdateQuestionDto) {
    await this.findById(id);

    if (dto.options && dto.options.length !== 4) {
      throw new BadRequestException('Savol uchun aniq 4 ta variant bo\'lishi kerak');
    }

    if (dto.correctAnswer !== undefined && (dto.correctAnswer < 0 || dto.correctAnswer > 3)) {
      throw new BadRequestException('To\'g\'ri javob indeksi 0-3 oralig\'ida bo\'lishi kerak');
    }

    return this.prisma.question.update({
      where: { id },
      data: dto,
      include: {
        category: {
          select: { id: true, name: true, slug: true },
        },
      },
    });
  }

  async delete(id: string) {
    await this.findById(id);

    await this.prisma.question.delete({
      where: { id },
    });

    return { message: 'Savol o\'chirildi' };
  }

  async toggleActive(id: string) {
    const question = await this.findById(id);

    return this.prisma.question.update({
      where: { id },
      data: { isActive: !question.isActive },
    });
  }
}
