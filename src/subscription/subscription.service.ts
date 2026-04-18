import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { CulqiService } from './culqi.service';

const GRACE_DAYS = 3;

@Injectable()
export class SubscriptionService {
  private readonly monthlyPrice: number;
  private readonly yapeNumber:   string;

  constructor(
    private prisma:  PrismaService,
    private config:  ConfigService,
    private culqi:   CulqiService,
  ) {
    this.monthlyPrice = this.config.get<number>('MONTHLY_PRICE_SOLES', 29);
    this.yapeNumber   = this.config.get<string>('YAPE_NUMBER', '');
  }

  // ── Helpers ───────────────────────────────────────────────

  hasAccess(currentPeriodEnd: Date | null): boolean {
    if (!currentPeriodEnd) return false;
    const deadline = new Date(currentPeriodEnd);
    deadline.setDate(deadline.getDate() + GRACE_DAYS);
    return new Date() <= deadline;
  }

  private nextPeriodEnd(from: Date, billingDay: number, months: number): Date {
    const d = new Date(from);
    d.setDate(1);
    d.setMonth(d.getMonth() + months);
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(billingDay, lastDay));
    return d;
  }

  // ── Status ────────────────────────────────────────────────

  async getStatus(restaurantId: string) {
    const sub = await this.prisma.subscription.findUnique({
      where:   { restaurantId },
      include: { payments: { orderBy: { createdAt: 'desc' }, take: 5 } },
    });

    const monthlyPrice  = this.monthlyPrice;
    const yapeNumber    = this.yapeNumber;

    if (!sub) return { subscribed: false, isInGrace: false, currentPeriodEnd: null, status: null, billingDay: null, pendingPayment: null, monthlyPrice, yapeNumber };

    const now       = new Date();
    const deadline  = new Date(sub.currentPeriodEnd);
    deadline.setDate(deadline.getDate() + GRACE_DAYS);

    const subscribed    = now <= deadline;
    const isInGrace     = subscribed && now > sub.currentPeriodEnd;
    const pendingPayment = sub.payments.find(p => p.status === 'PENDING') ?? null;

    return {
      subscribed,
      isInGrace,
      currentPeriodEnd: sub.currentPeriodEnd,
      status:           sub.status,
      billingDay:       sub.billingDay,
      pendingPayment,
      monthlyPrice,
      yapeNumber,
    };
  }

  // ── Request Yape payment ──────────────────────────────────

  async requestYapePayment(restaurantId: string, months: number) {
    if (months < 1 || months > 12)
      throw new BadRequestException('Elige entre 1 y 12 meses.');

    const amount = this.monthlyPrice * months;

    let sub = await this.prisma.subscription.findUnique({ where: { restaurantId } });

    // Reject if there's already a pending payment
    if (sub) {
      const pending = await this.prisma.payment.findFirst({
        where: { subscriptionId: sub.id, status: 'PENDING' },
      });
      if (pending)
        throw new BadRequestException('Ya tienes un pago pendiente de confirmación.');
    }

    // Create subscription shell if it doesn't exist yet
    if (!sub) {
      sub = await this.prisma.subscription.create({
        data: {
          restaurantId,
          status:          'EXPIRED',
          currentPeriodEnd: new Date(0),
        },
      });
    }

    const payment = await this.prisma.payment.create({
      data: {
        subscriptionId: sub.id,
        plan:   'YAPE',
        months,
        amount,
        status: 'PENDING',
      },
    });

    return { ...payment, yapeNumber: this.yapeNumber };
  }

  // ── Confirm payment (admin) ───────────────────────────────

  async confirmPayment(paymentId: string) {
    const payment = await this.prisma.payment.findUnique({
      where:   { id: paymentId },
      include: { subscription: true },
    });
    if (!payment) throw new NotFoundException('Pago no encontrado.');
    if (payment.status !== 'PENDING')
      throw new BadRequestException('Este pago ya fue procesado.');

    const sub = payment.subscription;
    const now = new Date();

    const grace = new Date(sub.currentPeriodEnd);
    grace.setDate(grace.getDate() + GRACE_DAYS);
    const isActive = now <= grace;

    const billingDay   = sub.billingDay ?? now.getDate();
    const baseDate     = isActive ? sub.currentPeriodEnd : now;
    const newPeriodEnd = this.nextPeriodEnd(baseDate, billingDay, payment.months);

    await this.prisma.$transaction([
      this.prisma.payment.update({
        where: { id: paymentId },
        data:  { status: 'CONFIRMED', confirmedAt: now },
      }),
      this.prisma.subscription.update({
        where: { id: sub.id },
        data: {
          status:          'ACTIVE',
          billingDay:      sub.billingDay ?? billingDay,
          currentPeriodEnd: newPeriodEnd,
          plan:            'YAPE',
        },
      }),
    ]);

    return { success: true, newPeriodEnd };
  }

  // ── Reject payment (admin) ────────────────────────────────

  async rejectPayment(paymentId: string) {
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new NotFoundException('Pago no encontrado.');
    if (payment.status !== 'PENDING')
      throw new BadRequestException('Este pago ya fue procesado.');

    await this.prisma.payment.update({
      where: { id: paymentId },
      data:  { status: 'REJECTED' },
    });

    return { success: true };
  }

  // ── Subscribe with card (Culqi) ──────────────────────────

  async subscribeWithCard(restaurantId: string, culqiToken: string) {
    // Crea la suscripción recurrente en Culqi
    const culqiSub = await this.culqi.createSubscription(culqiToken);

    const now      = new Date();
    const periodEnd = culqiSub.current_period_end
      ? new Date(culqiSub.current_period_end * 1000)
      : this.nextPeriodEnd(now, now.getDate(), 1);

    const billingDay = periodEnd.getDate();

    await this.prisma.subscription.upsert({
      where:  { restaurantId },
      create: {
        restaurantId,
        status:          'ACTIVE',
        billingDay,
        currentPeriodEnd: periodEnd,
        plan:            'CARD',
        culqiSubId:      culqiSub.id,
      },
      update: {
        status:          'ACTIVE',
        billingDay,
        currentPeriodEnd: periodEnd,
        plan:            'CARD',
        culqiSubId:      culqiSub.id,
      },
    });

    return { success: true, currentPeriodEnd: periodEnd };
  }

  // ── Cancel subscription ───────────────────────────────────

  async cancel(restaurantId: string) {
    const sub = await this.prisma.subscription.findUnique({ where: { restaurantId } });
    if (!sub) throw new NotFoundException('No hay suscripción activa.');

    // Si tiene suscripción de tarjeta activa en Culqi, cancelarla allá también
    if (sub.culqiSubId && sub.plan === 'CARD') {
      await this.culqi.cancelSubscription(sub.culqiSubId).catch(() => {
        // Si Culqi falla no bloqueamos la cancelación local
      });
    }

    await this.prisma.subscription.update({
      where: { restaurantId },
      data:  { status: 'CANCELLED', billingDay: null, culqiSubId: null },
    });

    return { success: true };
  }

  // ── Webhook: Culqi notifica cobro exitoso ─────────────────

  async handleCulqiWebhook(rawBody: string, signature: string, payload: any) {
    if (!this.culqi.verifySignature(rawBody, signature))
      throw new BadRequestException('Firma de webhook inválida.');

    // Culqi envía el tipo de evento en payload.type o payload.event_type
    // Verificar nombre exacto del evento en: https://culqi.com/docs/api/webhooks
    const eventType = payload.type ?? payload.event_type ?? '';

    if (eventType === 'charge.succeeded' || eventType === 'subscription.charge.succeeded') {
      const culqiSubId = payload.data?.object?.subscription_id
                      ?? payload.data?.object?.id;

      if (!culqiSubId) return { received: true };

      const sub = await this.prisma.subscription.findFirst({
        where: { culqiSubId },
      });
      if (!sub) return { received: true };

      // Renovar el período un mes más desde el currentPeriodEnd actual
      const newEnd = this.nextPeriodEnd(
        sub.currentPeriodEnd,
        sub.billingDay ?? new Date().getDate(),
        1,
      );

      await this.prisma.subscription.update({
        where: { id: sub.id },
        data:  { status: 'ACTIVE', currentPeriodEnd: newEnd },
      });
    }

    return { received: true };
  }
}
