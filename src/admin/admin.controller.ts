import {
  Body, Controller, Get, HttpCode, HttpStatus,
  Param, Post, UseGuards,
} from '@nestjs/common';
import { IsDateString } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from './admin.guard';
import { AdminService } from './admin.service';

class ActivateDto {
  @IsDateString()
  periodEnd: string;
}

@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(private readonly svc: AdminService) {}

  @Get('subscriptions')
  listSubscriptions() {
    return this.svc.listSubscriptions();
  }

  @Post('subscriptions/:restaurantId/activate')
  @HttpCode(HttpStatus.OK)
  activateSubscription(
    @Param('restaurantId') restaurantId: string,
    @Body() dto: ActivateDto,
  ) {
    return this.svc.activateSubscription(restaurantId, new Date(dto.periodEnd));
  }
}
