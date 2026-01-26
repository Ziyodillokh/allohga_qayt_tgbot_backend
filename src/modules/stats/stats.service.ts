import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, Not, IsNull } from "typeorm";
import { User } from "../users/entities";
import { Question } from "../questions/entities";
import { Category } from "../categories/entities";
import { TestAttempt } from "../tests/entities";
import { DesignSetting } from "../admin/entities";

@Injectable()
export class StatsService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Question)
    private questionRepository: Repository<Question>,
    @InjectRepository(Category)
    private categoryRepository: Repository<Category>,
    @InjectRepository(TestAttempt)
    private testAttemptRepository: Repository<TestAttempt>,
    @InjectRepository(DesignSetting)
    private designSettingRepository: Repository<DesignSetting>,
  ) {}

  async getPublicStats() {
    const [totalUsers, totalQuestions, totalCategories, totalTests] =
      await Promise.all([
        this.userRepository.count(),
        this.questionRepository.count({ where: { isActive: true } }),
        this.categoryRepository.count({ where: { isActive: true } }),
        this.testAttemptRepository.count({
          where: { completedAt: Not(IsNull()) },
        }),
      ]);

    return {
      users: totalUsers,
      questions: totalQuestions,
      categories: totalCategories,
      tests: totalTests,
    };
  }

  async getDesignSettings() {
    let settings = await this.designSettingRepository.findOne({
      where: { isActive: true },
    });

    // Default yaratish agar yo'q bo'lsa
    if (!settings) {
      settings = this.designSettingRepository.create({
        isActive: true,
        videoLoop: true,
        videoMuted: true,
      });
      await this.designSettingRepository.save(settings);
    }

    return settings;
  }
}
