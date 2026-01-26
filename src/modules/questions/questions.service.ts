import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, ILike } from "typeorm";
import { Question, Difficulty } from "./entities";
import { Category } from "../categories/entities";
import { CreateQuestionDto } from "./dto/create-question.dto";
import { UpdateQuestionDto } from "./dto/update-question.dto";

@Injectable()
export class QuestionsService {
  constructor(
    @InjectRepository(Question)
    private questionRepository: Repository<Question>,
    @InjectRepository(Category)
    private categoryRepository: Repository<Category>,
  ) {}

  async findAll(params: {
    categoryId?: string;
    difficulty?: Difficulty;
    search?: string;
    page?: number;
    limit?: number;
    activeOnly?: boolean;
  }) {
    const {
      categoryId,
      difficulty,
      search,
      page = 1,
      limit = 20,
      activeOnly = true,
    } = params;
    const skip = (page - 1) * limit;

    const queryBuilder = this.questionRepository
      .createQueryBuilder("question")
      .leftJoinAndSelect("question.category", "category")
      .orderBy("question.createdAt", "DESC")
      .skip(skip)
      .take(limit);

    if (categoryId)
      queryBuilder.andWhere("question.categoryId = :categoryId", {
        categoryId,
      });
    if (difficulty)
      queryBuilder.andWhere("question.difficulty = :difficulty", {
        difficulty,
      });
    if (activeOnly)
      queryBuilder.andWhere("question.isActive = :isActive", {
        isActive: true,
      });
    if (search) {
      queryBuilder.andWhere(
        "(LOWER(question.question) LIKE :search OR question.tags LIKE :searchTag)",
        {
          search: `%${search.toLowerCase()}%`,
          searchTag: `%${search.toLowerCase()}%`,
        },
      );
    }

    const [questions, total] = await queryBuilder.getManyAndCount();

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
    const question = await this.questionRepository.findOne({
      where: { id },
      relations: ["category"],
    });

    if (!question) {
      throw new NotFoundException("Savol topilmadi");
    }

    return question;
  }

  async getRandomQuestionsBySlug(categorySlug: string, count: number = 10) {
    // Find category by slug
    const category = await this.categoryRepository.findOne({
      where: { slug: categorySlug },
    });

    if (!category) {
      throw new NotFoundException("Kategoriya topilmadi");
    }

    // Get random questions using RANDOM()
    const questions = await this.questionRepository
      .createQueryBuilder("question")
      .leftJoinAndSelect("question.category", "category")
      .where("question.categoryId = :categoryId", { categoryId: category.id })
      .andWhere("question.isActive = :isActive", { isActive: true })
      .orderBy("RANDOM()")
      .limit(count)
      .getMany();

    if (questions.length === 0) {
      throw new BadRequestException("Bu kategoriyada savollar mavjud emas");
    }

    // Format questions for frontend
    return questions.map((q, index) => ({
      id: q.id,
      number: index + 1,
      question: q.question,
      options: q.options.map((opt, i) => ({
        key: String.fromCharCode(65 + i), // A, B, C, D
        text: opt,
      })),
      correctAnswer: String.fromCharCode(65 + q.correctAnswer), // 0 -> A, 1 -> B, etc.
      category: category.name,
      xpReward: q.xpReward,
    }));
  }

  async getRandomQuestions(categoryId: string | null, count: number = 10) {
    const queryBuilder = this.questionRepository
      .createQueryBuilder("question")
      .leftJoinAndSelect("question.category", "category")
      .where("question.isActive = :isActive", { isActive: true })
      .orderBy("RANDOM()")
      .limit(count);

    if (categoryId) {
      queryBuilder.andWhere("question.categoryId = :categoryId", {
        categoryId,
      });
    }

    const questions = await queryBuilder.getMany();
    return questions;
  }

  async getRandomQuestionsSimple(
    categoryId: string | null,
    count: number = 10,
  ) {
    const where: any = { isActive: true };
    if (categoryId) where.categoryId = categoryId;

    // Get total count
    const totalCount = await this.questionRepository.count({ where });

    if (totalCount === 0) {
      throw new BadRequestException("Bu kategoriyada savollar mavjud emas");
    }

    if (totalCount < count) {
      count = totalCount;
    }

    // Generate random skip values
    const skipValues = new Set<number>();
    while (skipValues.size < count) {
      skipValues.add(Math.floor(Math.random() * totalCount));
    }

    // Fetch questions one by one using query builder for skip
    const questions = await Promise.all(
      Array.from(skipValues).map((skipValue) =>
        this.questionRepository
          .createQueryBuilder("question")
          .leftJoinAndSelect("question.category", "category")
          .where(where)
          .skip(skipValue)
          .take(1)
          .getOne(),
      ),
    );

    return questions.filter(Boolean);
  }

  async create(dto: CreateQuestionDto) {
    // Validate options length
    if (dto.options.length !== 4) {
      throw new BadRequestException(
        "Savol uchun aniq 4 ta variant bo'lishi kerak",
      );
    }

    // Validate correctAnswer
    if (dto.correctAnswer < 0 || dto.correctAnswer > 3) {
      throw new BadRequestException(
        "To'g'ri javob indeksi 0-3 oralig'ida bo'lishi kerak",
      );
    }

    // Calculate XP reward based on difficulty
    const xpRewards = {
      [Difficulty.EASY]: 5,
      [Difficulty.MEDIUM]: 10,
      [Difficulty.HARD]: 15,
    };

    const question = this.questionRepository.create({
      ...dto,
      xpReward: dto.xpReward || xpRewards[dto.difficulty || Difficulty.MEDIUM],
      tags: dto.tags || [],
    });

    const savedQuestion = await this.questionRepository.save(question);
    return this.findById(savedQuestion.id);
  }

  async createMany(questions: CreateQuestionDto[]) {
    const results = await Promise.all(
      questions.map((dto) =>
        this.create(dto).catch((err) => ({
          error: err.message,
          question: dto.question,
        })),
      ),
    );

    const successful = results.filter((r) => !("error" in r));
    const failed = results.filter((r) => "error" in r);

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
      throw new BadRequestException(
        "Savol uchun aniq 4 ta variant bo'lishi kerak",
      );
    }

    if (
      dto.correctAnswer !== undefined &&
      (dto.correctAnswer < 0 || dto.correctAnswer > 3)
    ) {
      throw new BadRequestException(
        "To'g'ri javob indeksi 0-3 oralig'ida bo'lishi kerak",
      );
    }

    await this.questionRepository.update(id, dto);
    return this.findById(id);
  }

  async delete(id: string) {
    await this.findById(id);

    await this.questionRepository.delete(id);

    return { message: "Savol o'chirildi" };
  }

  async toggleActive(id: string) {
    const question = await this.findById(id);

    await this.questionRepository.update(id, { isActive: !question.isActive });
    return this.findById(id);
  }
}
