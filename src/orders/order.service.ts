import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MemberRole, OrderStatus, OrderType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SseService } from '../sse/sse.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { QueryOrdersDto } from './dto/query-orders.dto';

const ORDER_ITEM_SELECT = {
  id:        true,
  dishId:    true,
  dishName:  true,
  dishPrice: true,
  quantity:  true,
  subtotal:  true,
  notes:     true,
};

const ORDER_SELECT = {
  id:              true,
  type:            true,
  status:          true,
  isPaid:          true,
  tableNumber:     true,
  tableId:         true,
  customerName:    true,
  customerPhone:   true,
  customerAddress: true,
  notes:           true,
  total:           true,
  createdAt:       true,
  updatedAt:       true,
  createdBy: {
    select: { id: true, name: true, avatarUrl: true },
  },
  table: {
    select: { id: true, name: true, room: { select: { id: true, name: true } } },
  },
  items: { select: ORDER_ITEM_SELECT },
};

// Transiciones válidas por rol
const TRANSITIONS: Record<MemberRole, Partial<Record<OrderStatus, OrderStatus[]>>> = {
  CHEF: {
    PENDING: ['COOKING'],
    COOKING: ['READY'],
  },
  WAITER: {
    PENDING: ['SERVED', 'CANCELLED'],
    READY:   ['SERVED'],
    SERVED:  ['FINISHED'],
  },
  OWNER: {
    PENDING:  ['COOKING', 'SERVED', 'CANCELLED'],
    COOKING:  ['READY', 'CANCELLED'],
    READY:    ['SERVED', 'CANCELLED'],
    SERVED:   ['FINISHED', 'CANCELLED'],
    FINISHED: ['CANCELLED'],
  },
  ADMIN: {
    PENDING:  ['COOKING', 'SERVED', 'CANCELLED'],
    COOKING:  ['READY', 'CANCELLED'],
    READY:    ['SERVED', 'CANCELLED'],
    SERVED:   ['FINISHED', 'CANCELLED'],
    FINISHED: ['CANCELLED'],
  },
};

@Injectable()
export class OrderService {
  constructor(
    private prisma: PrismaService,
    private sse:    SseService,
  ) {}

  // ── Create ────────────────────────────────────────────────

  async create(restaurantId: string, userId: string, dto: CreateOrderDto) {
    const member = await this.assertActiveMember(restaurantId, userId);

    if (member.role === MemberRole.CHEF)
      throw new ForbiddenException('Los cocineros no pueden crear órdenes.');

    // Validar y resolver platos
    const dishIds = dto.items.map(i => i.dishId);
    const dishes  = await this.prisma.dish.findMany({
      where: { id: { in: dishIds }, restaurantId, isAvailable: true },
      select: { id: true, name: true, price: true },
    });

    if (dishes.length !== dishIds.length)
      throw new BadRequestException('Uno o más platos no existen o no están disponibles.');

    const dishMap = new Map(dishes.map(d => [d.id, d]));

    const itemsData = dto.items.map(item => {
      const dish     = dishMap.get(item.dishId)!;
      const subtotal = Math.round(dish.price * item.quantity * 100) / 100;
      return {
        dishId:    dish.id,
        dishName:  dish.name,
        dishPrice: dish.price,
        quantity:  item.quantity,
        subtotal,
        notes:     item.notes,
      };
    });

    // ── Flujo con mesa vinculada ──────────────────────────
    if (dto.tableId) {
      const table = await this.prisma.table.findFirst({
        where:  { id: dto.tableId, restaurantId, isActive: true },
        select: { id: true, name: true },
      });
      if (!table) throw new BadRequestException('Mesa no encontrada o inactiva.');

      const activeOrder = await this.prisma.order.findFirst({
        where: {
          tableId: dto.tableId,
          restaurantId,
          status: { in: [OrderStatus.PENDING, OrderStatus.COOKING, OrderStatus.READY, OrderStatus.SERVED] },
        },
        select: { id: true, status: true, total: true },
      });

      if (activeOrder) {
        return this.addItemsToExistingOrder(restaurantId, activeOrder, itemsData);
      }

      const total         = Math.round(itemsData.reduce((s, i) => s + i.subtotal, 0) * 100) / 100;
      const initialStatus = dto.directDelivery ? OrderStatus.SERVED : OrderStatus.PENDING;

      const order = await this.prisma.order.create({
        data: {
          restaurantId,
          type:        OrderType.TABLE,
          status:      initialStatus,
          tableId:     table.id,
          tableNumber: table.name,
          notes:       dto.notes,
          total,
          createdById: userId,
          items:       { create: itemsData },
        },
        select: ORDER_SELECT,
      });
      this.sse.emit(restaurantId, 'order.created', order);
      return order;
    }

    // ── Flujo sin mesa vinculada (WhatsApp / sin mesa) ────
    const total         = Math.round(itemsData.reduce((s, i) => s + i.subtotal, 0) * 100) / 100;
    const initialStatus = dto.directDelivery ? OrderStatus.SERVED : OrderStatus.PENDING;

    const order = await this.prisma.order.create({
      data: {
        restaurantId,
        type:            dto.type,
        status:          initialStatus,
        tableNumber:     dto.tableNumber,
        customerName:    dto.customerName,
        customerPhone:   dto.customerPhone,
        customerAddress: dto.customerAddress,
        notes:           dto.notes,
        total,
        createdById:     userId,
        items:           { create: itemsData },
      },
      select: ORDER_SELECT,
    });
    this.sse.emit(restaurantId, 'order.created', order);
    return order;
  }

  private async addItemsToExistingOrder(
    restaurantId: string,
    activeOrder: { id: string; status: OrderStatus; total: number },
    itemsData: { dishId: string; dishName: string; dishPrice: number; quantity: number; subtotal: number; notes?: string }[],
  ) {
    const newTotal = Math.round(
      (activeOrder.total + itemsData.reduce((s, i) => s + i.subtotal, 0)) * 100,
    ) / 100;

    const order = await this.prisma.order.update({
      where: { id: activeOrder.id },
      data: {
        total: newTotal,
        ...(activeOrder.status === OrderStatus.SERVED ? { status: OrderStatus.PENDING } : {}),
        items: { create: itemsData },
      },
      select: ORDER_SELECT,
    });
    this.sse.emit(restaurantId, 'order.updated', order);
    return order;
  }

  // ── List ──────────────────────────────────────────────────

  async list(restaurantId: string, userId: string, query: QueryOrdersDto) {
    const member = await this.assertActiveMember(restaurantId, userId);

    // Cocina: solo ve lo que le corresponde cocinar
    let statusFilter: OrderStatus[] | undefined;
    if (member.role === MemberRole.CHEF) {
      statusFilter = [OrderStatus.PENDING, OrderStatus.COOKING];
    }

    const where: Prisma.OrderWhereInput = {
      restaurantId,
      ...(statusFilter ? { status: { in: statusFilter } } : {}),
      ...(query.status  ? { status: query.status }   : {}),
      ...(query.type    ? { type: query.type }        : {}),
      ...(query.isPaid !== undefined ? { isPaid: query.isPaid } : {}),
    };

    return this.prisma.order.findMany({
      where,
      select:  ORDER_SELECT,
      orderBy: { createdAt: 'desc' },
    });
  }

  // ── Find one ──────────────────────────────────────────────

  async findOne(restaurantId: string, orderId: string, userId: string) {
    await this.assertActiveMember(restaurantId, userId);

    const order = await this.prisma.order.findFirst({
      where:  { id: orderId, restaurantId },
      select: ORDER_SELECT,
    });
    if (!order) throw new NotFoundException('Orden no encontrada.');
    return order;
  }

  // ── Update status ─────────────────────────────────────────

  async updateStatus(restaurantId: string, orderId: string, userId: string, newStatus: OrderStatus) {
    const member = await this.assertActiveMember(restaurantId, userId);

    const existing = await this.prisma.order.findFirst({
      where:  { id: orderId, restaurantId },
      select: { status: true },
    });
    if (!existing) throw new NotFoundException('Orden no encontrada.');

    const allowed = TRANSITIONS[member.role]?.[existing.status] ?? [];
    if (!allowed.includes(newStatus))
      throw new BadRequestException(
        `El rol ${member.role} no puede cambiar de ${existing.status} a ${newStatus}.`,
      );

    const order = await this.prisma.order.update({
      where:  { id: orderId },
      data:   { status: newStatus },
      select: ORDER_SELECT,
    });
    this.sse.emit(restaurantId, 'order.updated', order);
    return order;
  }

  // ── Toggle payment ────────────────────────────────────────

  async updatePayment(restaurantId: string, orderId: string, userId: string, isPaid: boolean) {
    const member = await this.assertActiveMember(restaurantId, userId);

    if (member.role === MemberRole.CHEF)
      throw new ForbiddenException('Los cocineros no pueden registrar pagos.');

    const existing = await this.prisma.order.findFirst({
      where: { id: orderId, restaurantId },
    });
    if (!existing) throw new NotFoundException('Orden no encontrada.');

    const order = await this.prisma.order.update({
      where:  { id: orderId },
      data:   { isPaid },
      select: ORDER_SELECT,
    });
    this.sse.emit(restaurantId, 'order.updated', order);
    return order;
  }

  // ── Helpers ───────────────────────────────────────────────

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
