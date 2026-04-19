import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoryService {
  constructor(private prisma: PrismaService) {}

  async findAll(restaurantId: string, ownerId: string) {
    await this.assertOwner(restaurantId, ownerId);
    return this.prisma.category.findMany({
      where: { restaurantId },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      include: {
        dishes: {
          orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
        },
      },
    });
  }

  // Accesible a cualquier miembro activo — devuelve TODOS los platos (incl. no disponibles)
  async findAllStaff(restaurantId: string, userId: string) {
    const member = await this.prisma.restaurantMember.findUnique({
      where:  { userId_restaurantId: { userId, restaurantId } },
      select: { isActive: true },
    });
    if (!member?.isActive) throw new ForbiddenException('No tienes acceso a este restaurante.');

    return this.prisma.category.findMany({
      where:   { restaurantId },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      select: {
        id:   true,
        name: true,
        dishes: {
          orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
          select: {
            id:          true,
            name:        true,
            price:       true,
            isAvailable: true,
          },
        },
      },
    });
  }

  async create(restaurantId: string, ownerId: string, dto: CreateCategoryDto) {
    await this.assertOwner(restaurantId, ownerId);
    return this.prisma.category.create({
      data: { name: dto.name, restaurantId },
      include: { dishes: true },
    });
  }

  async update(restaurantId: string, id: string, ownerId: string, dto: UpdateCategoryDto) {
    await this.assertOwner(restaurantId, ownerId);
    await this.assertCategoryBelongs(id, restaurantId);
    return this.prisma.category.update({
      where: { id },
      data: dto,
      include: { dishes: true },
    });
  }

  async remove(restaurantId: string, id: string, ownerId: string) {
    await this.assertOwner(restaurantId, ownerId);
    await this.assertCategoryBelongs(id, restaurantId);
    await this.prisma.category.delete({ where: { id } });
  }

  private async assertOwner(restaurantId: string, ownerId: string) {
    const r = await this.prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { ownerId: true },
    });
    if (!r) throw new NotFoundException('Restaurante no encontrado.');
    if (r.ownerId !== ownerId) throw new ForbiddenException('Acceso denegado.');
  }

  private async assertCategoryBelongs(categoryId: string, restaurantId: string) {
    const cat = await this.prisma.category.findUnique({
      where: { id: categoryId },
      select: { restaurantId: true },
    });
    if (!cat || cat.restaurantId !== restaurantId)
      throw new NotFoundException('Categoría no encontrada.');
  }
}
