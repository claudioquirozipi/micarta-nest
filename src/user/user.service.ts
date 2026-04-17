import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { MemberRole, InvitationStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateUserDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('El correo ya está registrado');

    const passwordHash = dto.password ? await bcrypt.hash(dto.password, 10) : null;

    const user = await this.prisma.user.create({
      data: {
        email:     dto.email,
        name:      dto.name      ?? null,
        avatarUrl: dto.avatarUrl ?? null,
        passwordHash,
        googleId:  dto.googleId  ?? null,
      },
    });

    // Aceptar invitaciones pendientes para este email
    await this.acceptPendingInvitations(user.id, user.email);

    return this.sanitize(user);
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return this.sanitize(user);
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findByGoogleId(googleId: string) {
    return this.prisma.user.findUnique({ where: { googleId } });
  }

  async linkGoogle(id: string, googleId: string, avatarUrl?: string) {
    return this.prisma.user.update({
      where: { id },
      data: {
        googleId,
        // Solo actualizar avatar si no tenía uno
        ...(avatarUrl ? { avatarUrl } : {}),
      },
    });
  }

  // ── Invitaciones pendientes ────────────────────────────────────────────────

  /**
   * Cuando un usuario crea su cuenta, busca invitaciones pendientes para su
   * email y las convierte en membresías reales.
   */
  private async acceptPendingInvitations(userId: string, email: string) {
    const pending = await this.prisma.restaurantInvitation.findMany({
      where: { email, status: InvitationStatus.PENDING },
    });

    if (!pending.length) return;

    await this.prisma.$transaction(
      pending.map((inv) =>
        this.prisma.restaurantInvitation.update({
          where: { id: inv.id },
          data: {
            status:     InvitationStatus.ACCEPTED,
            acceptedAt: new Date(),
            restaurant: {
              update: {
                members: {
                  create: { userId, role: inv.role as MemberRole },
                },
              },
            },
          },
        }),
      ),
    );
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private sanitize(user: any) {
    const { passwordHash, ...rest } = user;
    return rest;
  }
}
