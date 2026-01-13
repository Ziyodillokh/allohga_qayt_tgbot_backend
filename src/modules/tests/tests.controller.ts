import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from "@nestjs/swagger";
import { TestsService } from "./tests.service";
import { StartTestDto } from "./dto/start-test.dto";
import { SubmitTestDto } from "./dto/submit-test.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";

@ApiTags("tests")
@Controller("tests")
export class TestsController {
  constructor(private testsService: TestsService) {}

  @Post("start")
  @ApiOperation({ summary: "Yangi test boshlash" })
  @ApiResponse({
    status: 201,
    description: "Test boshlandi, savollar qaytarildi",
  })
  async startTest(@Req() req: any, @Body() dto: StartTestDto) {
    return this.testsService.startTest(req.user?.id || null, dto);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post(":testAttemptId/submit")
  @ApiOperation({ summary: "Testni yakunlash" })
  @ApiResponse({
    status: 200,
    description: "Test yakunlandi, natijalar qaytarildi",
  })
  async submitTest(
    @Req() req: any,
    @Param("testAttemptId") testAttemptId: string,
    @Body() dto: SubmitTestDto
  ) {
    return this.testsService.submitTest(req.user.id, testAttemptId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get(":testAttemptId/result")
  @ApiOperation({ summary: "Test natijasini olish" })
  @ApiResponse({ status: 200, description: "Test natijasi" })
  async getTestResult(
    @Req() req: any,
    @Param("testAttemptId") testAttemptId: string
  ) {
    return this.testsService.getTestResult(req.user.id, testAttemptId);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get("history")
  @ApiOperation({ summary: "Test tarixini olish" })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiResponse({ status: 200, description: "Test tarixi" })
  async getTestHistory(
    @Req() req: any,
    @Query("page") page?: number,
    @Query("limit") limit?: number
  ) {
    return this.testsService.getUserTestHistory(req.user.id, page, limit);
  }
}
