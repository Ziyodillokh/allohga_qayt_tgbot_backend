import { IsString, IsOptional, IsInt, IsArray, ValidateNested, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class StartTestDto {
  @ApiPropertyOptional({ example: 'uuid-of-category', description: 'Kategoriya ID (bo\'sh qoldirilsa aralash test)' })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({ example: 10, description: 'Savollar soni (default: 10)' })
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(50)
  questionsCount?: number;
}

export class AnswerDto {
  @ApiProperty({ example: 'uuid-of-question' })
  @IsString()
  questionId: string;

  @ApiProperty({ example: 0, description: 'Tanlangan javob indeksi (0-3)' })
  @IsInt()
  @Min(0)
  @Max(3)
  selectedAnswer: number;

  @ApiPropertyOptional({ example: 15, description: 'Savol uchun sarflangan vaqt (sekundlarda)' })
  @IsOptional()
  @IsInt()
  timeSpent?: number;
}

export class SubmitTestDto {
  @ApiProperty({ type: [AnswerDto], description: 'Javoblar ro\'yxati' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AnswerDto)
  answers: AnswerDto[];

  @ApiPropertyOptional({ example: 180, description: 'Jami sarflangan vaqt (sekundlarda)' })
  @IsOptional()
  @IsInt()
  totalTimeSpent?: number;
}
