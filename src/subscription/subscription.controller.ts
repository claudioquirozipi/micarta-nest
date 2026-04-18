import {
  Body, Controller, Get, Param, Post, Req,
  UseGuards, HttpCode, HttpStatus, UnauthorizedException,
  Headers,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionService } from './subscription.service';
import { IsInt, IsString, Min, Max } from 'class-validator';

class RequestYapeDto {
  @IsInt() @Min(1) @Max(12)
  months: number;
}

class SubscribeCardDto {
  @IsString()
  culqiToken: string;
}

@Controller('subscription')
@UseGuards(JwtAuthGuard)
export class SubscriptionController {
  constructor(
    private readonly svc:    SubscriptionService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private async getRestaurantId(userId: string): Promise<string> {
    const r = await this.prisma.restaurant.findFirst({
      where:  { ownerId: userId },
      select: { id: true },
    });
    if (!r) throw new UnauthorizedException('No tienes un restaurante.');
    return r.id;
  }

  @Get('status')
  async status(@CurrentUser() userId: string) {
    const restaurantId = await this.getRestaurantId(userId);
    return this.svc.getStatus(restaurantId);
  }

  @Post('yape')
  @HttpCode(HttpStatus.CREATED)
  async requestYape(
    @CurrentUser() userId: string,
    @Body() dto: RequestYapeDto,
  ) {
    const restaurantId = await this.getRestaurantId(userId);
    return this.svc.requestYapePayment(restaurantId, dto.months);
  }

  @Post('card')
  @HttpCode(HttpStatus.CREATED)
  async subscribeCard(
    @CurrentUser() userId: string,
    @Body() dto: SubscribeCardDto,
  ) {
    const restaurantId = await this.getRestaurantId(userId);
    return this.svc.subscribeWithCard(restaurantId, dto.culqiToken);
  }

  @Post('cancel')
  @HttpCode(HttpStatus.OK)
  async cancel(@CurrentUser() userId: string) {
    const restaurantId = await this.getRestaurantId(userId);
    return this.svc.cancel(restaurantId);
  }

  // ── Webhook Culqi (sin autenticación JWT) ─────────────────

  @Post('webhook/culqi')
  @HttpCode(HttpStatus.OK)
  async culqiWebhook(
    @Req() req: Request,
    @Headers('x-culqi-signature') signature: string,
    @Body() payload: any,
  ) {
    const rawBody = JSON.stringify(payload);
    return this.svc.handleCulqiWebhook(rawBody, signature ?? '', payload);
  }

  // ── Admin endpoints ───────────────────────────────────────

  @Post('admin/payments/:id/confirm')
  @HttpCode(HttpStatus.OK)
  async confirmPayment(
    @Param('id') id: string,
    @Headers('x-admin-secret') secret: string,
  ) {
    const expected = this.config.get<string>('ADMIN_SECRET', '');
    if (!expected || secret !== expected)
      throw new UnauthorizedException('Acceso denegado.');
    return this.svc.confirmPayment(id);
  }

  @Post('admin/payments/:id/reject')
  @HttpCode(HttpStatus.OK)
  async rejectPayment(
    @Param('id') id: string,
    @Headers('x-admin-secret') secret: string,
  ) {
    const expected = this.config.get<string>('ADMIN_SECRET', '');
    if (!expected || secret !== expected)
      throw new UnauthorizedException('Acceso denegado.');
    return this.svc.rejectPayment(id);
  }
}
