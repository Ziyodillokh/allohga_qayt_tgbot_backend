import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsString,
  IsInt,
  IsBoolean,
  IsOptional,
  Min,
  Max,
} from "class-validator";

export class CreateZikrDto {
  @ApiProperty({
    description: "Zikr sarlavhasi (Arab tilida)",
    example: "أَسْتَغْفِرُ اللهَ",
  })
  @IsString()
  titleArabic: string;

  @ApiProperty({
    description: "Zikr sarlavhasi (Lotin harflarida)",
    example: "Astaghfirulloh",
  })
  @IsString()
  titleLatin: string;

  @ApiProperty({
    description: "Zikr matni (Arabcha)",
    example: "أَسْتَغْفِرُ اللهَ وَأَتُوبُ إِلَيْهِ",
  })
  @IsString()
  textArabic: string;

  @ApiProperty({
    description: "Zikr matni (Lotin harflarida)",
    example: "Astaghfirulloha wa atubu ilayh",
  })
  @IsString()
  textLatin: string;

  @ApiPropertyOptional({
    description: "Zikrning foydasi va ma'nosi",
    example:
      "Kim istig'forni ko'paytirsa, Alloh unga har bir g'amdan chiqish yo'li beradi.",
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: "Necha marta o'qilishi kerak",
    example: 100,
    default: 33,
  })
  @IsInt()
  @Min(1)
  count: number;

  @ApiPropertyOptional({
    description: "Emoji belgisi",
    example: "🤲",
    default: "📿",
  })
  @IsString()
  @IsOptional()
  emoji?: string;

  @ApiProperty({
    description:
      "Hafta kuni (0=Yakshanba, 1=Dushanba, 2=Seshanba, 3=Chorshanba, 4=Payshanba, 5=Juma, 6=Shanba)",
    example: 1,
    minimum: 0,
    maximum: 6,
  })
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek: number;

  @ApiPropertyOptional({
    description: "Ramazon oyi uchun maxsus zikrmi?",
    example: false,
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  isRamadan?: boolean;

  @ApiPropertyOptional({
    description: "Tartib raqami",
    example: 1,
    default: 0,
  })
  @IsInt()
  @IsOptional()
  order?: number;

  @ApiPropertyOptional({
    description: "XP mukofoti (1=kichik zikr, 2=katta zikr)",
    example: 1,
    default: 1,
  })
  @IsInt()
  @Min(1)
  @Max(10)
  @IsOptional()
  xpReward?: number;

  @ApiPropertyOptional({
    description: "Faolmi?",
    example: true,
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
