import { IsEmail, IsString, MinLength, MaxLength, Matches, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail({}, { message: 'Noto\'g\'ri email formati' })
  email: string;

  @ApiProperty({ example: 'username123' })
  @IsString()
  @MinLength(3, { message: 'Username kamida 3 ta belgidan iborat bo\'lishi kerak' })
  @MaxLength(20, { message: 'Username 20 ta belgidan oshmasligi kerak' })
  @Matches(/^[a-zA-Z0-9_]+$/, { message: 'Username faqat harf, raqam va _ dan iborat bo\'lishi kerak' })
  username: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @MinLength(6, { message: 'Parol kamida 6 ta belgidan iborat bo\'lishi kerak' })
  password: string;

  @ApiProperty({ example: 'John Doe' })
  @IsString()
  @MinLength(2, { message: 'Ism kamida 2 ta belgidan iborat bo\'lishi kerak' })
  @MaxLength(100, { message: 'Ism 100 ta belgidan oshmasligi kerak' })
  fullName: string;

  @ApiPropertyOptional({ example: '+998901234567' })
  @IsOptional()
  @IsString()
  telegramPhone?: string;
}
