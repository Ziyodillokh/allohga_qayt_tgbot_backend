import {
  Injectable,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, Not } from "typeorm";
import { Category } from "./entities";
import { Question } from "../questions/entities";
import { TestAttempt } from "../tests/entities";
import { CreateCategoryDto } from "./dto/create-category.dto";
import { UpdateCategoryDto } from "./dto/update-category.dto";

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private categoryRepository: Repository<Category>,
    @InjectRepository(Question)
    private questionRepository: Repository<Question>,
    @InjectRepository(TestAttempt)
    private testAttemptRepository: Repository<TestAttempt>,
  ) {}

  async findAll(activeOnly = true) {
    const where = activeOnly ? { isActive: true } : {};

    const categories = await this.categoryRepository.find({
      where,
      order: { order: "ASC" },
    });

    // Get question counts for each category
    const categoriesWithCounts = await Promise.all(
      categories.map(async (cat) => {
        const questionsCount = await this.questionRepository.count({
          where: { categoryId: cat.id, isActive: true },
        });
        return {
          ...cat,
          questionsCount,
        };
      }),
    );

    return categoriesWithCounts;
  }

  async findBySlug(slug: string) {
    const category = await this.categoryRepository.findOne({
      where: { slug },
    });

    if (!category) {
      throw new NotFoundException("Kategoriya topilmadi");
    }

    const [questionsCount, testsCount] = await Promise.all([
      this.questionRepository.count({
        where: { categoryId: category.id, isActive: true },
      }),
      this.testAttemptRepository.count({
        where: { categoryId: category.id },
      }),
    ]);

    return {
      ...category,
      questionsCount,
      testsCount,
    };
  }

  async findById(id: string) {
    const category = await this.categoryRepository.findOne({
      where: { id },
    });

    if (!category) {
      throw new NotFoundException("Kategoriya topilmadi");
    }

    return category;
  }

  async create(dto: CreateCategoryDto) {
    // Check if slug already exists
    const existing = await this.categoryRepository.findOne({
      where: { slug: dto.slug },
    });

    if (existing) {
      throw new ConflictException("Bu slug allaqachon mavjud");
    }

    const category = this.categoryRepository.create(dto);
    return this.categoryRepository.save(category);
  }

  async update(id: string, dto: UpdateCategoryDto) {
    await this.findById(id);

    // Check if new slug conflicts
    if (dto.slug) {
      const existing = await this.categoryRepository.findOne({
        where: {
          slug: dto.slug,
          id: Not(id),
        },
      });

      if (existing) {
        throw new ConflictException("Bu slug allaqachon mavjud");
      }
    }

    await this.categoryRepository.update(id, dto);
    return this.findById(id);
  }

  async delete(id: string) {
    const category = await this.findById(id);

    // Check if category has questions
    const questionsCount = await this.questionRepository.count({
      where: { categoryId: id },
    });

    if (questionsCount > 0) {
      throw new ConflictException(
        `Bu kategoriyada ${questionsCount} ta savol mavjud. Avval savollarni o'chiring yoki boshqa kategoriyaga ko'chiring.`,
      );
    }

    await this.categoryRepository.delete(id);

    return { message: "Kategoriya o'chirildi" };
  }

  async getStats(id: string) {
    const category = await this.findById(id);

    const [questionsCount, testsCount, avgScoreResult] = await Promise.all([
      this.questionRepository.count({
        where: { categoryId: id, isActive: true },
      }),
      this.testAttemptRepository.count({
        where: { categoryId: id },
      }),
      this.testAttemptRepository
        .createQueryBuilder("testAttempt")
        .where("testAttempt.categoryId = :id", { id })
        .select("AVG(testAttempt.score)", "avgScore")
        .getRawOne(),
    ]);

    // Questions by difficulty
    const questionsByDifficulty = await this.questionRepository
      .createQueryBuilder("question")
      .where("question.categoryId = :id", { id })
      .andWhere("question.isActive = :isActive", { isActive: true })
      .select("question.difficulty", "difficulty")
      .addSelect("COUNT(*)", "_count")
      .groupBy("question.difficulty")
      .getRawMany();

    return {
      category,
      stats: {
        questionsCount,
        testsCount,
        averageScore: avgScoreResult?.avgScore || 0,
        questionsByDifficulty,
      },
    };
  }
}
