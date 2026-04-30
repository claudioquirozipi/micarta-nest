import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const GRACE_DAYS = 3;
const DUMMY_DATE = new Date('2000-01-01');

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async listSubscriptions() {
    const now = new Date();

    const restaurants = await this.prisma.restaurant.findMany({
      select: {
        id:    true,
        name:  true,
        owner: { select: { email: true, name: true } },
        subscription: {
          select: { status: true, currentPeriodEnd: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return restaurants.map(r => {
      const sub = r.subscription;
      let subscribed = false;
      let isInGrace  = false;

      if (sub && sub.currentPeriodEnd > DUMMY_DATE) {
        const deadline = new Date(sub.currentPeriodEnd);
        deadline.setDate(deadline.getDate() + GRACE_DAYS);
        subscribed = now <= deadline;
        isInGrace  = subscribed && now > sub.currentPeriodEnd;
      }

      const currentPeriodEnd =
        sub && sub.currentPeriodEnd > DUMMY_DATE
          ? sub.currentPeriodEnd.toISOString()
          : null;

      return {
        restaurantId:       r.id,
        restaurantName:     r.name,
        ownerName:          r.owner.name,
        ownerEmail:         r.owner.email,
        subscriptionStatus: sub?.status ?? null,
        currentPeriodEnd,
        subscribed,
        isInGrace,
      };
    });
  }

  async activateSubscription(restaurantId: string, periodEnd: Date) {
    await this.prisma.subscription.upsert({
      where:  { restaurantId },
      create: {
        restaurantId,
        status:           'ACTIVE',
        currentPeriodEnd: periodEnd,
        billingDay:       periodEnd.getDate(),
      },
      update: {
        status:           'ACTIVE',
        currentPeriodEnd: periodEnd,
        billingDay:       periodEnd.getDate(),
      },
    });
    return { success: true };
  }
}
