import {
  Injectable, CanActivate, ExecutionContext, HttpException, HttpStatus,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SubscriptionService } from '../subscription.service';

@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(
    private prisma:          PrismaService,
    private subscriptionSvc: SubscriptionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req          = context.switchToHttp().getRequest();
    const restaurantId = req.params?.restaurantId;
    if (!restaurantId) return true;

    const sub = await this.prisma.subscription.findUnique({
      where:  { restaurantId },
      select: { currentPeriodEnd: true },
    });

    if (!this.subscriptionSvc.hasAccess(sub?.currentPeriodEnd ?? null)) {
      throw new HttpException(
        { message: 'Suscripción requerida.', code: 'SUBSCRIPTION_REQUIRED' },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    return true;
  }
}
