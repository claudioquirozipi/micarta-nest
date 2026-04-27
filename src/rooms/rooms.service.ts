import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { CreateTableDto } from './dto/create-table.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { UpdateTableDto } from './dto/update-table.dto';

@Injectable()
export class RoomsService {
  constructor(private prisma: PrismaService) {}

  async listRooms(restaurantId: string, userId: string) {
    await this.assertActiveMember(restaurantId, userId);

    const rooms = await this.prisma.room.findMany({
      where: { restaurantId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        tables: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            name: true,
            isActive: true,
            orders: {
              where: {
                restaurantId,
                status: {
                  in: [
                    OrderStatus.PENDING,
                    OrderStatus.COOKING,
                    OrderStatus.READY,
                    OrderStatus.SERVED,
                  ],
                },
              },
              select: { id: true, status: true, total: true, isPaid: true },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
      },
    });

    return rooms.map(room => ({
      id:   room.id,
      name: room.name,
      tables: room.tables.map(table => ({
        id:          table.id,
        name:        table.name,
        isActive:    table.isActive,
        activeOrder: table.orders[0] ?? null,
      })),
    }));
  }

  async createRoom(restaurantId: string, userId: string, dto: CreateRoomDto) {
    await this.assertAdminOrOwner(restaurantId, userId);
    return this.prisma.room.create({
      data: { name: dto.name, restaurantId },
      select: { id: true, name: true },
    });
  }

  async updateRoom(restaurantId: string, roomId: string, userId: string, dto: UpdateRoomDto) {
    await this.assertAdminOrOwner(restaurantId, userId);
    await this.assertRoomBelongs(roomId, restaurantId);
    return this.prisma.room.update({
      where:  { id: roomId },
      data:   dto,
      select: { id: true, name: true },
    });
  }

  async deleteRoom(restaurantId: string, roomId: string, userId: string) {
    await this.assertAdminOrOwner(restaurantId, userId);
    await this.assertRoomBelongs(roomId, restaurantId);
    return this.prisma.room.delete({ where: { id: roomId } });
  }

  async createTable(restaurantId: string, roomId: string, userId: string, dto: CreateTableDto) {
    await this.assertAdminOrOwner(restaurantId, userId);
    await this.assertRoomBelongs(roomId, restaurantId);
    return this.prisma.table.create({
      data:   { name: dto.name, roomId, restaurantId },
      select: { id: true, name: true, isActive: true },
    });
  }

  async updateTable(
    restaurantId: string,
    roomId: string,
    tableId: string,
    userId: string,
    dto: UpdateTableDto,
  ) {
    await this.assertAdminOrOwner(restaurantId, userId);
    await this.assertTableBelongs(tableId, roomId, restaurantId);
    return this.prisma.table.update({
      where:  { id: tableId },
      data:   dto,
      select: { id: true, name: true, isActive: true },
    });
  }

  async deleteTable(restaurantId: string, roomId: string, tableId: string, userId: string) {
    await this.assertAdminOrOwner(restaurantId, userId);
    await this.assertTableBelongs(tableId, roomId, restaurantId);
    return this.prisma.table.delete({ where: { id: tableId } });
  }

  private async assertActiveMember(restaurantId: string, userId: string) {
    const member = await this.prisma.restaurantMember.findUnique({
      where:  { userId_restaurantId: { userId, restaurantId } },
      select: { isActive: true },
    });
    if (!member?.isActive) throw new ForbiddenException('No tienes acceso a este restaurante.');
  }

  private async assertAdminOrOwner(restaurantId: string, userId: string) {
    const member = await this.prisma.restaurantMember.findUnique({
      where:  { userId_restaurantId: { userId, restaurantId } },
      select: { isActive: true, role: true },
    });
    if (!member?.isActive) throw new ForbiddenException('No tienes acceso a este restaurante.');
    if (member.role !== 'OWNER' && member.role !== 'ADMIN')
      throw new ForbiddenException('Solo el dueño o administrador puede gestionar salones y mesas.');
  }

  private async assertRoomBelongs(roomId: string, restaurantId: string) {
    const room = await this.prisma.room.findUnique({
      where:  { id: roomId },
      select: { restaurantId: true },
    });
    if (!room || room.restaurantId !== restaurantId)
      throw new NotFoundException('Salón no encontrado.');
  }

  private async assertTableBelongs(tableId: string, roomId: string, restaurantId: string) {
    const table = await this.prisma.table.findUnique({
      where:  { id: tableId },
      select: { roomId: true, restaurantId: true },
    });
    if (!table || table.roomId !== roomId || table.restaurantId !== restaurantId)
      throw new NotFoundException('Mesa no encontrada.');
  }
}
