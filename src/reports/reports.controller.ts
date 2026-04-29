import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SubscriptionGuard } from '../subscription/guards/subscription.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ReportsService } from './reports.service';
import { QueryReportDto } from './dto/query-report.dto';

@Controller('restaurants/:restaurantId/reports')
@UseGuards(JwtAuthGuard, SubscriptionGuard)
export class ReportsController {
  constructor(private readonly svc: ReportsService) {}

  @Get('summary')
  summary(
    @Param('restaurantId') restaurantId: string,
    @CurrentUser() userId: string,
    @Query() query: QueryReportDto,
  ) {
    return this.svc.getSummary(
      restaurantId,
      userId,
      new Date(query.from),
      new Date(query.to),
    );
  }
}
