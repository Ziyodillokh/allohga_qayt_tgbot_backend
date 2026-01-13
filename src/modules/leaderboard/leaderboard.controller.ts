import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { LeaderboardService } from './leaderboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('leaderboard')
@Controller('leaderboard')
export class LeaderboardController {
  constructor(private leaderboardService: LeaderboardService) {}

  @Get('global')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Umumiy reyting' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Umumiy reyting' })
  async getGlobalLeaderboard(@Req() req: any, @Query('limit') limit?: number) {
    return this.leaderboardService.getGlobalLeaderboard(limit || 100, req.user.id);
  }

  @Get('category/:categoryId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Kategoriya bo\'yicha reyting' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Kategoriya reytingi' })
  async getCategoryLeaderboard(
    @Req() req: any,
    @Param('categoryId') categoryId: string,
    @Query('limit') limit?: number,
  ) {
    return this.leaderboardService.getCategoryLeaderboard(categoryId, limit || 50, req.user.id);
  }

  @Get('weekly')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Haftalik reyting' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Haftalik reyting' })
  async getWeeklyLeaderboard(@Req() req: any, @Query('limit') limit?: number) {
    return this.leaderboardService.getWeeklyLeaderboard(limit || 100, req.user.id);
  }

  @Get('monthly')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Oylik reyting' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Oylik reyting' })
  async getMonthlyLeaderboard(@Req() req: any, @Query('limit') limit?: number) {
    return this.leaderboardService.getMonthlyLeaderboard(limit || 100, req.user.id);
  }

  @Get('my-rank')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mening reytinglarim' })
  @ApiResponse({ status: 200, description: 'Foydalanuvchi reytinglari' })
  async getMyRanks(@Req() req: any) {
    const [global, weekly, monthly] = await Promise.all([
      this.leaderboardService.getUserGlobalRank(req.user.id),
      this.leaderboardService.getUserWeeklyRank(req.user.id),
      this.leaderboardService.getUserMonthlyRank(req.user.id),
    ]);

    return {
      global,
      weekly,
      monthly,
    };
  }
}
