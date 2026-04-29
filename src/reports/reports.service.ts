import { ForbiddenException, Injectable } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async getSummary(restaurantId: string, userId: string, from: Date, to: Date) {
    await this.assertActiveMember(restaurantId, userId);

    const dateRange = { gte: from, lte: to };

    // Orden IDs del período (excluye canceladas para métricas de platos)
    const [paidOrders, allOrderIds, cancelledCount] = await Promise.all([
      this.prisma.order.aggregate({
        where:    { restaurantId, createdAt: dateRange, isPaid: true },
        _sum:     { total: true },
        _count:   { id: true },
      }),
      this.prisma.order.findMany({
        where:  { restaurantId, createdAt: dateRange, status: { not: OrderStatus.CANCELLED } },
        select: { id: true },
      }),
      this.prisma.order.count({
        where: { restaurantId, createdAt: dateRange, status: OrderStatus.CANCELLED },
      }),
    ]);

    const orderIds    = allOrderIds.map(o => o.id);
    const totalSales  = paidOrders._sum.total ?? 0;
    const paidCount   = paidOrders._count.id;
    const averageTicket = paidCount > 0 ? Math.round((totalSales / paidCount) * 100) / 100 : 0;

    // Top / bottom 5 platos
    const [topDishes, bottomDishes] = await Promise.all([
      this.prisma.orderItem.groupBy({
        by:      ['dishName'],
        where:   { orderId: { in: orderIds } },
        _sum:    { quantity: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take:    5,
      }),
      this.prisma.orderItem.groupBy({
        by:      ['dishName'],
        where:   { orderId: { in: orderIds } },
        _sum:    { quantity: true },
        orderBy: { _sum: { quantity: 'asc' } },
        take:    5,
      }),
    ]);

    // Ventas por mesero (solo órdenes pagadas)
    const salesGroups = await this.prisma.order.groupBy({
      by:      ['createdById'],
      where:   { restaurantId, createdAt: dateRange, isPaid: true },
      _sum:    { total: true },
      _count:  { id: true },
    });

    const waiterIds = salesGroups
      .map(g => g.createdById)
      .filter((id): id is string => id !== null);

    const users = await this.prisma.user.findMany({
      where:  { id: { in: waiterIds } },
      select: { id: true, name: true },
    });
    const userMap = new Map(users.map(u => [u.id, u.name ?? 'Sin nombre']));

    const salesByWaiter = salesGroups.map(g => ({
      userId:     g.createdById,
      userName:   g.createdById ? (userMap.get(g.createdById) ?? 'Sin nombre') : 'Sistema',
      totalSales: Math.round((g._sum.total ?? 0) * 100) / 100,
      orderCount: g._count.id,
    }));

    return {
      totalSales:     Math.round(totalSales * 100) / 100,
      totalOrders:    allOrderIds.length + cancelledCount,
      averageTicket,
      cancelledOrders: cancelledCount,
      topDishes:    topDishes.map(d => ({ dishName: d.dishName, quantity: d._sum.quantity ?? 0 })),
      bottomDishes: bottomDishes.map(d => ({ dishName: d.dishName, quantity: d._sum.quantity ?? 0 })),
      salesByWaiter,
    };
  }

  private async assertActiveMember(restaurantId: string, userId: string) {
    const member = await this.prisma.restaurantMember.findUnique({
      where:  { userId_restaurantId: { userId, restaurantId } },
      select: { role: true, isActive: true },
    });
    if (!member || !member.isActive)
      throw new ForbiddenException('No tienes acceso a este restaurante.');
    return member;
  }
}
