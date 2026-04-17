import { IsEnum, IsBoolean, IsOptional } from 'class-validator';
import { MemberRole } from '@prisma/client';

export class UpdateMemberDto {
  @IsOptional()
  @IsEnum(MemberRole)
  role?: MemberRole;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
