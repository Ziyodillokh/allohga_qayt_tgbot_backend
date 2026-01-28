import { IsString, IsOptional } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class TelegramAuthDto {
  @ApiProperty({ example: "123456789" })
  @IsString()
  telegramId: string;

  @ApiPropertyOptional({ example: "johndoe" })
  @IsOptional()
  @IsString()
  username?: string;

  @ApiPropertyOptional({ example: "+998901234567" })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: "John" })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional({ example: "Doe" })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional({ example: "https://t.me/i/userpic/..." })
  @IsOptional()
  @IsString()
  photoUrl?: string;

  @ApiProperty({ description: "Telegram auth hash for verification" })
  @IsString()
  hash: string;
}
