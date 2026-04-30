import {
  Injectable,
  ConflictException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { CreateRestaurantDto } from './dto/create-restaurant.dto';
import { UpdateRestaurantDto } from './dto/update-restaurant.dto';
import { MemberRole } from '@prisma/client';

const RESTAURANT_SELECT = {
  id: true,
  name: true,
  slug: true,
  description: true,
  logoUrl: true,
  address: true,
  phone: true,
  whatsapp: true,
  schedule: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  ownerId: true,
  owner: { select: { id: true, name: true, email: true } },
  socialLinks: { select: { platform: true, handle: true } },
  members: {
    select: {
      role: true,
      user: { select: { id: true, name: true, email: true } },
    },
  },
};

@Injectable()
export class RestaurantService {
  constructor(
    private prisma:      PrismaService,
    private cloudinary:  CloudinaryService,
  ) {}

  async create(ownerId: string, dto: CreateRestaurantDto) {
    const slugTaken = await this.prisma.restaurant.findUnique({
      where: { slug: dto.slug },
    });
    if (slugTaken) throw new ConflictException('El slug ya está en uso.');

    const { socialLinks, ...rest } = dto;

    const restaurant = await this.prisma.restaurant.create({
      data: {
        ...rest,
        ownerId,
        // El creador entra automáticamente como miembro OWNER
        members: {
          create: { userId: ownerId, role: MemberRole.OWNER },
        },
        socialLinks: socialLinks?.length
          ? { createMany: { data: socialLinks } }
          : undefined,
      },
      select: RESTAURANT_SELECT,
    });
    return { ...restaurant, hasMenu: false };
  }

  async findMine(userId: string) {
    const restaurant = await this.prisma.restaurant.findFirst({
      where:  { members: { some: { userId, isActive: true } } },
      select: { ...RESTAURANT_SELECT, _count: { select: { dishes: true } } },
    });
    if (!restaurant) return null;
    const { _count, ...rest } = restaurant;
    const member = await this.prisma.restaurantMember.findFirst({
      where:  { restaurantId: restaurant.id, userId },
      select: { role: true },
    });
    return { ...rest, hasMenu: _count.dishes > 0, myRole: member?.role ?? null };
  }

  async getMemberAccess(slug: string, userId: string) {
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { slug },
      select: { id: true, name: true, slug: true, whatsapp: true },
    });
    if (!restaurant) throw new NotFoundException('Restaurante no encontrado.');

    const member = await this.prisma.restaurantMember.findUnique({
      where:  { userId_restaurantId: { userId, restaurantId: restaurant.id } },
      select: { role: true, isActive: true },
    });
    if (!member || !member.isActive)
      throw new ForbiddenException('No tienes acceso a este restaurante.');

    return { ...restaurant, role: member.role };
  }

  async findBySlug(slug: string) {
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { slug },
      select: RESTAURANT_SELECT,
    });
    if (!restaurant) throw new NotFoundException('Restaurante no encontrado.');
    return restaurant;
  }

  async update(id: string, userId: string, dto: UpdateRestaurantDto) {
    await this.assertOwner(id, userId);

    const { socialLinks, ...rest } = dto;

    // Si se cambia el slug, verificar que no esté tomado
    if (rest.slug) {
      const conflict = await this.prisma.restaurant.findFirst({
        where: { slug: rest.slug, NOT: { id } },
      });
      if (conflict) throw new ConflictException('El slug ya está en uso.');
    }

    return this.prisma.$transaction(async (tx) => {
      // Reemplazar redes sociales si vienen en el payload
      if (socialLinks !== undefined) {
        await tx.restaurantSocialLink.deleteMany({ where: { restaurantId: id } });
        if (socialLinks.length) {
          await tx.restaurantSocialLink.createMany({
            data: socialLinks.map((s) => ({ ...s, restaurantId: id })),
          });
        }
      }

      return tx.restaurant.update({
        where: { id },
        data: rest,
        select: RESTAURANT_SELECT,
      });
    });
  }

  async updateLogo(id: string, userId: string, logoUrl: string) {
    await this.assertOwner(id, userId);
    return this.prisma.restaurant.update({
      where: { id },
      data: { logoUrl },
      select: { id: true, logoUrl: true },
    });
  }

  async signLogoUpload(restaurantId: string, userId: string) {
    await this.assertOwner(restaurantId, userId);
    const publicId = `micarta/restaurants/${restaurantId}/logo`;
    return this.cloudinary.signUpload(publicId);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private async assertOwner(restaurantId: string, userId: string) {
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { ownerId: true },
    });
    if (!restaurant) throw new NotFoundException('Restaurante no encontrado.');
    if (restaurant.ownerId !== userId)
      throw new ForbiddenException('Solo el dueño puede realizar esta acción.');
  }
}
