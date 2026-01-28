import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  Min,
  Matches,
  IsArray,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreateCategoryDto {
  @ApiProperty({ example: "Qur'on" })
  @IsString()
  name: string;

  @ApiProperty({ example: "Qur'on" })
  @IsString()
  @Matches(/^[a-z0-9-]+$/, {
    message: "Slug faqat kichik harf, raqam va - dan iborat bo'lishi kerak",
  })
  slug: string;

  @ApiPropertyOptional({
    example: "Qur'on bo'yicha testlar",
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: "📖" })
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiPropertyOptional({ example: "#f7df1e" })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateCategoryDto {
  @ApiPropertyOptional({ example: "JavaScript" })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: "javascript" })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9-]+$/, {
    message: "Slug faqat kichik harf, raqam va - dan iborat bo'lishi kerak",
  })
  slug?: string;

  @ApiPropertyOptional({
    example: "JavaScript dasturlash tili bo'yicha testlar",
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: "📖" })
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiPropertyOptional({ example: "#f7df1e" })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
