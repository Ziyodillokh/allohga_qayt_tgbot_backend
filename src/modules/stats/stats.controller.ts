import { Controller, Get } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { StatsService } from "./stats.service";

@ApiTags("stats")
@Controller("stats")
export class StatsController {
  constructor(private statsService: StatsService) {}

  @Get("public")
  @ApiOperation({
    summary:
      "Public statistika - foydalanuvchilar, savollar, kategoriyalar, testlar",
  })
  @ApiResponse({ status: 200, description: "Umumiy statistika" })
  async getPublicStats() {
    return this.statsService.getPublicStats();
  }

  @Get("design")
  @ApiOperation({ summary: "Public dizayn sozlamalari - video background" })
  @ApiResponse({ status: 200, description: "Dizayn sozlamalari" })
  async getDesignSettings() {
    return this.statsService.getDesignSettings();
  }
}
