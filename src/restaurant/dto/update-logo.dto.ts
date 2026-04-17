import { IsUrl } from 'class-validator';

export class UpdateLogoDto {
  @IsUrl()
  logoUrl: string;
}
