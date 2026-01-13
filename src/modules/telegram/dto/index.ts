import { IsString, IsNotEmpty, IsOptional, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TelegramWebAppAuthDto {
  @ApiProperty({ description: 'Telegram Mini App init data string' })
  @IsString()
  @IsNotEmpty()
  initData: string;
}

export class SendTelegramMessageDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  chatId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  text: string;

  @ApiPropertyOptional({ description: 'Image URL to send with message' })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({ description: 'Video URL to send with message' })
  @IsOptional()
  @IsString()
  videoUrl?: string;

  @ApiPropertyOptional({ enum: ['HTML', 'Markdown', 'MarkdownV2'] })
  @IsOptional()
  @IsString()
  parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
}

export class SetWebhookDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  webhookUrl: string;
}

export class SavePhoneDto {
  @ApiProperty({ description: 'Phone number from Telegram contact' })
  @IsString()
  @IsNotEmpty()
  phone: string;
}

export class CompleteRegistrationDto {
  @ApiProperty({ description: 'Username for the account' })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  username: string;

  @ApiProperty({ description: 'Password for the account' })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;

  @ApiProperty({ description: 'Phone number' })
  @IsString()
  @IsNotEmpty()
  phone: string;
}
