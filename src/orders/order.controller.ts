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
  Req,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { IsBoolean, IsEnum, IsNumber, IsOptional, Min } from 'class-validator';
import { PaymentMethod } from '@prisma/client';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtQueryGuard } from '../auth/guards/jwt-query.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SubscriptionGuard } from '../subscription/guards/subscription.guard';
import { OrderService } from './order.service';
import { SseService, SseEvent } from '../sse/sse.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { AddOrderItemsDto } from './dto/add-order-items.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { QueryOrdersDto } from './dto/query-orders.dto';

class UpdatePaymentDto {
  @IsBoolean()
  isPaid: boolean;

  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @IsOptional()
  @IsNumber()
  @Min(0)
  tip?: number;
}

@Controller('restaurants/:restaurantId/orders')
@UseGuards(JwtAuthGuard, SubscriptionGuard)
export class OrderController {
  constructor(
    private readonly svc: OrderService,
    private readonly sse: SseService,
  ) {}

  @Sse('events')
  @UseGuards(JwtQueryGuard)
  stream(
    @Param('restaurantId') restaurantId: string,
    @Req() req: Request,
  ): Observable<SseEvent> {
    const { stream, cleanup } = this.sse.addConnection(restaurantId);
    req.on('close', cleanup);
    return stream;
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Param('restaurantId') restaurantId: string,
    @CurrentUser() userId: string,
    @Body() dto: CreateOrderDto,
  ) {
    return this.svc.create(restaurantId, userId, dto);
  }

  @Post(':id/items')
  @HttpCode(HttpStatus.OK)
  addItems(
    @Param('restaurantId') restaurantId: string,
    @Param('id') id: string,
    @CurrentUser() userId: string,
    @Body() dto: AddOrderItemsDto,
  ) {
    return this.svc.addItems(restaurantId, id, userId, dto);
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
    return this.svc.updatePayment(restaurantId, id, userId, dto.isPaid, dto.paymentMethod, dto.tip);
  }
}
