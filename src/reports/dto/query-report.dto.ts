import { IsDateString } from 'class-validator';

export class QueryReportDto {
  @IsDateString()
  from: string;

  @IsDateString()
  to: string;
}
