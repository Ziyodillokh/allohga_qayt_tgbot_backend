import { IsString, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ChatDto {
  @ApiProperty({ example: 'JavaScript-da closure nima?' })
  @IsString()
  @MaxLength(5000)
  message: string;

  @ApiPropertyOptional({ example: 'javascript', description: 'Kategoriya slug (kontekst uchun)' })
  @IsOptional()
  @IsString()
  categorySlug?: string;
}
