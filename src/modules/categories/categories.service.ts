import {
  Injectable,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateCategoryDto } from "./dto/create-category.dto";
import { UpdateCategoryDto } from "./dto/update-category.dto";

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  async findAll(activeOnly = true) {
    const where = activeOnly ? { isActive: true } : {};

    const categories = await this.prisma.category.findMany({
      where,
      orderBy: { order: "asc" },
      include: {
        _count: {
          select: {
            questions: { where: { isActive: true } },
          },
        },
      },
    });

    return categories.map((cat) => ({
      ...cat,
      questionsCount: cat._count.questions,
    }));
  }

  async findBySlug(slug: string) {
    const category = await this.prisma.category.findUnique({
      where: { slug },
      include: {
        _count: {
          select: {
            questions: { where: { isActive: true } },
            testAttempts: true,
          },
        },
      },
    });

    if (!category) {
      throw new NotFoundException("Kategoriya topilmadi");
    }

    return {
      ...category,
      questionsCount: category._count.questions,
      testsCount: category._count.testAttempts,
    };
  }

  async findById(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
    });

    if (!category) {
      throw new NotFoundException("Kategoriya topilmadi");
    }

    return category;
  }

  async create(dto: CreateCategoryDto) {
    // Check if slug already exists
    const existing = await this.prisma.category.findUnique({
      where: { slug: dto.slug },
    });

    if (existing) {
      throw new ConflictException("Bu slug allaqachon mavjud");
    }

    return this.prisma.category.create({
      data: dto,
    });
  }

  async update(id: string, dto: UpdateCategoryDto) {
    await this.findById(id);

    // Check if new slug conflicts
    if (dto.slug) {
      const existing = await this.prisma.category.findFirst({
        where: {
          slug: dto.slug,
          NOT: { id },
        },
      });

      if (existing) {
        throw new ConflictException("Bu slug allaqachon mavjud");
      }
    }

    return this.prisma.category.update({
      where: { id },
      data: dto,
    });
  }

  async delete(id: string) {
    const category = await this.findById(id);

    // Check if category has questions
    const questionsCount = await this.prisma.question.count({
      where: { categoryId: id },
    });

    if (questionsCount > 0) {
      throw new ConflictException(
        `Bu kategoriyada ${questionsCount} ta savol mavjud. Avval savollarni o'chiring yoki boshqa kategoriyaga ko'chiring.`
      );
    }

    await this.prisma.category.delete({
      where: { id },
    });

    return { message: "Kategoriya o'chirildi" };
  }

  async getStats(id: string) {
    const category = await this.findById(id);

    const [questionsCount, testsCount, avgScore] = await Promise.all([
      this.prisma.question.count({
        where: { categoryId: id, isActive: true },
      }),
      this.prisma.testAttempt.count({
        where: { categoryId: id },
      }),
      this.prisma.testAttempt.aggregate({
        where: { categoryId: id },
        _avg: { score: true },
      }),
    ]);

    // Questions by difficulty
    const questionsByDifficulty = await this.prisma.question.groupBy({
      by: ["difficulty"],
      where: { categoryId: id, isActive: true },
      _count: true,
    });

    return {
      category,
      stats: {
        questionsCount,
        testsCount,
        averageScore: avgScore._avg.score || 0,
        questionsByDifficulty,
      },
    };
  }
}
