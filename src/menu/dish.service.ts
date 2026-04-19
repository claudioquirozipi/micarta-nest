import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { CreateDishDto } from './dto/create-dish.dto';
import { UpdateDishDto } from './dto/update-dish.dto';

@Injectable()
export class DishService {
  constructor(
    private prisma:     PrismaService,
    private cloudinary: CloudinaryService,
  ) {}

  async create(restaurantId: string, ownerId: string, dto: CreateDishDto) {
    await this.assertOwner(restaurantId, ownerId);
    await this.assertCategoryBelongs(dto.categoryId, restaurantId);
    return this.prisma.dish.create({
      data: {
        name:        dto.name,
        description: dto.description,
        price:       dto.price,
        categoryId:  dto.categoryId,
        restaurantId,
        isAvailable: dto.isAvailable ?? true,
      },
    });
  }

  async update(restaurantId: string, id: string, ownerId: string, dto: UpdateDishDto) {
    await this.assertOwner(restaurantId, ownerId);
    await this.assertDishBelongs(id, restaurantId);
    if (dto.categoryId) await this.assertCategoryBelongs(dto.categoryId, restaurantId);
    return this.prisma.dish.update({ where: { id }, data: dto });
  }

  async updateAvailability(restaurantId: string, id: string, userId: string, isAvailable: boolean) {
    await this.assertActiveMember(restaurantId, userId);
    await this.assertDishBelongs(id, restaurantId);
    return this.prisma.dish.update({ where: { id }, data: { isAvailable } });
  }

  async updateImage(restaurantId: string, id: string, ownerId: string, imageUrl: string) {
    await this.assertOwner(restaurantId, ownerId);
    await this.assertDishBelongs(id, restaurantId);
    return this.prisma.dish.update({
      where: { id },
      data: { imageUrl },
      select: { id: true, imageUrl: true },
    });
  }

  async remove(restaurantId: string, id: string, ownerId: string) {
    await this.assertOwner(restaurantId, ownerId);
    await this.assertDishBelongs(id, restaurantId);
    await this.prisma.dish.delete({ where: { id } });
  }

  async signImageUpload(restaurantId: string, dishId: string, ownerId: string) {
    await this.assertOwner(restaurantId, ownerId);
    await this.assertDishBelongs(dishId, restaurantId);
    const publicId = `micarta/restaurants/${restaurantId}/menu/${dishId}`;
    return this.cloudinary.signUpload(publicId);
  }

  private async assertActiveMember(restaurantId: string, userId: string) {
    const member = await this.prisma.restaurantMember.findUnique({
      where:  { userId_restaurantId: { userId, restaurantId } },
      select: { isActive: true },
    });
    if (!member?.isActive) throw new ForbiddenException('No tienes acceso a este restaurante.');
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

  private async assertDishBelongs(dishId: string, restaurantId: string) {
    const dish = await this.prisma.dish.findUnique({
      where: { id: dishId },
      select: { restaurantId: true },
    });
    if (!dish || dish.restaurantId !== restaurantId)
      throw new NotFoundException('Plato no encontrado.');
  }
}
