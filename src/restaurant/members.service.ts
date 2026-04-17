import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InviteMemberDto } from './dto/invite-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { MemberRole, InvitationStatus } from '@prisma/client';

const USER_SELECT = {
  id:        true,
  name:      true,
  email:     true,
  avatarUrl: true,
};

@Injectable()
export class MembersService {
  constructor(private prisma: PrismaService) {}

  // ── Listar ────────────────────────────────────────────────────────────────

  async list(restaurantId: string, requesterId: string) {
    await this.assertMemberAccess(restaurantId, requesterId);

    const [members, invitations] = await Promise.all([
      this.prisma.restaurantMember.findMany({
        where: { restaurantId },
        select: {
          id:       true,
          role:     true,
          isActive: true,
          createdAt: true,
          user: { select: USER_SELECT },
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.restaurantInvitation.findMany({
        where: { restaurantId, status: InvitationStatus.PENDING },
        select: {
          id:        true,
          email:     true,
          role:      true,
          createdAt: true,
          invitedBy: { select: USER_SELECT },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return { members, invitations };
  }

  // ── Invitar ───────────────────────────────────────────────────────────────

  async invite(restaurantId: string, inviterId: string, dto: InviteMemberDto) {
    await this.assertOwnerOrAdmin(restaurantId, inviterId);

    // No se puede invitar al owner a cambiar su propio rol
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { ownerId: true, owner: { select: { email: true } } },
    });
    if (!restaurant) throw new NotFoundException('Restaurante no encontrado.');
    if (restaurant.owner.email === dto.email)
      throw new BadRequestException('No puedes invitar al dueño del restaurante.');

    // ¿Ya es miembro activo?
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existingUser) {
      const isMember = await this.prisma.restaurantMember.findUnique({
        where: { userId_restaurantId: { userId: existingUser.id, restaurantId } },
      });
      if (isMember) throw new ConflictException('Este usuario ya es miembro del restaurante.');

      // Usuario existe → crear miembro directamente y registrar invitación aceptada
      return this.prisma.$transaction(async (tx) => {
        const member = await tx.restaurantMember.create({
          data: { userId: existingUser.id, restaurantId, role: dto.role },
          select: {
            id: true, role: true, isActive: true,
            user: { select: USER_SELECT },
          },
        });
        await tx.restaurantInvitation.upsert({
          where:  { restaurantId_email: { restaurantId, email: dto.email } },
          create: {
            email: dto.email, role: dto.role, restaurantId,
            invitedById: inviterId,
            status:      InvitationStatus.ACCEPTED,
            acceptedAt:  new Date(),
          },
          update: {
            role: dto.role, status: InvitationStatus.ACCEPTED,
            acceptedAt: new Date(), invitedById: inviterId,
          },
        });
        return { type: 'member', data: member };
      });
    }

    // Usuario no existe → crear/actualizar invitación pendiente
    const invitation = await this.prisma.restaurantInvitation.upsert({
      where:  { restaurantId_email: { restaurantId, email: dto.email } },
      create: { email: dto.email, role: dto.role, restaurantId, invitedById: inviterId },
      update: { role: dto.role, invitedById: inviterId, status: InvitationStatus.PENDING, acceptedAt: null },
      select: { id: true, email: true, role: true, createdAt: true },
    });

    return { type: 'invitation', data: invitation };
  }

  // ── Actualizar miembro ────────────────────────────────────────────────────

  async updateMember(restaurantId: string, memberId: string, requesterId: string, dto: UpdateMemberDto) {
    await this.assertOwnerOrAdmin(restaurantId, requesterId);

    const member = await this.prisma.restaurantMember.findFirst({
      where: { id: memberId, restaurantId },
      select: { userId: true, role: true },
    });
    if (!member) throw new NotFoundException('Miembro no encontrado.');

    // No se puede modificar al OWNER
    if (member.role === MemberRole.OWNER)
      throw new ForbiddenException('No se puede modificar al dueño del restaurante.');

    // No se puede auto-modificar (salvo desactivarse uno mismo, que no tiene sentido)
    if (member.userId === requesterId && dto.role)
      throw new ForbiddenException('No puedes cambiar tu propio rol.');

    return this.prisma.restaurantMember.update({
      where: { id: memberId },
      data:  dto,
      select: {
        id: true, role: true, isActive: true,
        user: { select: USER_SELECT },
      },
    });
  }

  // ── Eliminar miembro / cancelar invitación ────────────────────────────────

  async removeMember(restaurantId: string, memberId: string, requesterId: string) {
    await this.assertOwnerOrAdmin(restaurantId, requesterId);

    const member = await this.prisma.restaurantMember.findFirst({
      where: { id: memberId, restaurantId },
      select: { role: true },
    });
    if (!member) throw new NotFoundException('Miembro no encontrado.');
    if (member.role === MemberRole.OWNER)
      throw new ForbiddenException('No se puede eliminar al dueño del restaurante.');

    await this.prisma.restaurantMember.delete({ where: { id: memberId } });
    return { success: true };
  }

  async cancelInvitation(restaurantId: string, invitationId: string, requesterId: string) {
    await this.assertOwnerOrAdmin(restaurantId, requesterId);

    const inv = await this.prisma.restaurantInvitation.findFirst({
      where: { id: invitationId, restaurantId, status: InvitationStatus.PENDING },
    });
    if (!inv) throw new NotFoundException('Invitación no encontrada.');

    await this.prisma.restaurantInvitation.delete({ where: { id: invitationId } });
    return { success: true };
  }

  // ── Guards ────────────────────────────────────────────────────────────────

  private async assertMemberAccess(restaurantId: string, userId: string) {
    const member = await this.prisma.restaurantMember.findUnique({
      where: { userId_restaurantId: { userId, restaurantId } },
    });
    if (!member) throw new ForbiddenException('No tienes acceso a este restaurante.');
  }

  private async assertOwnerOrAdmin(restaurantId: string, userId: string) {
    const member = await this.prisma.restaurantMember.findUnique({
      where: { userId_restaurantId: { userId, restaurantId } },
      select: { role: true },
    });
    if (!member || !['OWNER', 'ADMIN'].includes(member.role))
      throw new ForbiddenException('Solo el dueño o un administrador pueden gestionar miembros.');
  }
}
