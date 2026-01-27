import { IsString, IsOptional, MaxLength } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class ChatDto {
  @ApiProperty({ example: "JavaScript-da closure nima?" })
  @IsString()
  @MaxLength(10000)
  message: string;

  @ApiPropertyOptional({
    example: "javascript",
    description: "Kategoriya slug (kontekst uchun)",
  })
  @IsOptional()
  @IsString()
  categorySlug?: string;

  @ApiPropertyOptional({
    description: "Audio xabar base64 formatda (ovozli xabar uchun)",
  })
  @IsOptional()
  @IsString()
  @MaxLength(10000000) // 10MB gacha audio
  audioBase64?: string;
}
