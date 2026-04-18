import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IsBoolean } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { OrderService } from './order.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { QueryOrdersDto } from './dto/query-orders.dto';

class UpdatePaymentDto {
  @IsBoolean()
  isPaid: boolean;
}

@Controller('restaurants/:restaurantId/orders')
@UseGuards(JwtAuthGuard)
export class OrderController {
  constructor(private readonly svc: OrderService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Param('restaurantId') restaurantId: string,
    @CurrentUser() userId: string,
    @Body() dto: CreateOrderDto,
  ) {
    return this.svc.create(restaurantId, userId, dto);
  }

  @Get()
  list(
    @Param('restaurantId') restaurantId: string,
    @CurrentUser() userId: string,
    @Query() query: QueryOrdersDto,
  ) {
    return this.svc.list(restaurantId, userId, query);
  }

  @Get(':id')
  findOne(
    @Param('restaurantId') restaurantId: string,
    @Param('id') id: string,
    @CurrentUser() userId: string,
  ) {
    return this.svc.findOne(restaurantId, id, userId);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('restaurantId') restaurantId: string,
    @Param('id') id: string,
    @CurrentUser() userId: string,
    @Body() dto: UpdateStatusDto,
  ) {
    return this.svc.updateStatus(restaurantId, id, userId, dto.status);
  }

  @Patch(':id/payment')
  updatePayment(
    @Param('restaurantId') restaurantId: string,
    @Param('id') id: string,
    @CurrentUser() userId: string,
    @Body() dto: UpdatePaymentDto,
  ) {
    return this.svc.updatePayment(restaurantId, id, userId, dto.isPaid);
  }
}
