import {
  IsString,
  IsNotEmpty,
  IsOptional,
  Matches,
  MaxLength,
  IsArray,
  ValidateNested,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SocialPlatform } from '@prisma/client';

export class SocialLinkDto {
  @IsEnum(SocialPlatform)
  platform: SocialPlatform;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  handle: string;
}

export class CreateRestaurantDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'El slug solo puede contener letras minúsculas, números y guiones.',
  })
  @MaxLength(80)
  slug: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  whatsapp?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  schedule?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SocialLinkDto)
  socialLinks?: SocialLinkDto[];
}
