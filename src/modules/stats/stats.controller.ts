import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PrismaService } from '../../prisma/prisma.service';

@ApiTags('stats')
@Controller('stats')
export class StatsController {
  constructor(private prisma: PrismaService) {}

  @Get('public')
  @ApiOperation({ summary: 'Public statistika - foydalanuvchilar, savollar, kategoriyalar, testlar' })
  @ApiResponse({ status: 200, description: 'Umumiy statistika' })
  async getPublicStats() {
    const [
      totalUsers,
      totalQuestions,
      totalCategories,
      totalTests,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.question.count({ where: { isActive: true } }),
      this.prisma.category.count({ where: { isActive: true } }),
      this.prisma.testAttempt.count({ where: { completedAt: { not: null } } }),
    ]);

    return {
      users: totalUsers,
      questions: totalQuestions,
      categories: totalCategories,
      tests: totalTests,
    };
  }

  @Get('design')
  @ApiOperation({ summary: 'Public dizayn sozlamalari - video background' })
  @ApiResponse({ status: 200, description: 'Dizayn sozlamalari' })
  async getDesignSettings() {
    let settings = await this.prisma.designSetting.findFirst({
      where: { isActive: true },
    });

    // Default yaratish agar yo'q bo'lsa
    if (!settings) {
      settings = await this.prisma.designSetting.create({
        data: {
          isActive: true,
          videoLoop: true,
          videoMuted: true,
        },
      });
    }

    return settings;
  }
}
