import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('public/menu')
export class PublicMenuController {
  constructor(private prisma: PrismaService) {}

  @Get(':slug')
  async getMenu(@Param('slug') slug: string) {
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { slug },
      select: {
        id:          true,
        name:        true,
        slug:        true,
        description: true,
        logoUrl:     true,
        whatsapp:    true,
        address:     true,
        phone:       true,
        schedule:    true,
        isActive:    true,
      },
    });

    if (!restaurant || !restaurant.isActive)
      throw new NotFoundException('Restaurante no encontrado.');

    const categories = await this.prisma.category.findMany({
      where: { restaurantId: restaurant.id },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      select: {
        id:   true,
        name: true,
        dishes: {
          where:   { isAvailable: true },
          orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
          select: {
            id:          true,
            name:        true,
            description: true,
            price:       true,
            imageUrl:    true,
          },
        },
      },
    });

    return { restaurant, categories };
  }
}
