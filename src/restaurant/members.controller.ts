import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { MembersService } from './members.service';
import { InviteMemberDto } from './dto/invite-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';

@Controller('restaurants/:restaurantId/members')
@UseGuards(JwtAuthGuard)
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  /** Listar miembros activos + invitaciones pendientes */
  @Get()
  list(
    @Param('restaurantId') restaurantId: string,
    @CurrentUser() userId: string,
  ) {
    return this.membersService.list(restaurantId, userId);
  }

  /** Invitar por email */
  @Post('invite')
  @HttpCode(HttpStatus.CREATED)
  invite(
    @Param('restaurantId') restaurantId: string,
    @CurrentUser() userId: string,
    @Body() dto: InviteMemberDto,
  ) {
    return this.membersService.invite(restaurantId, userId, dto);
  }

  /** Actualizar rol o isActive de un miembro */
  @Patch(':memberId')
  updateMember(
    @Param('restaurantId') restaurantId: string,
    @Param('memberId') memberId: string,
    @CurrentUser() userId: string,
    @Body() dto: UpdateMemberDto,
  ) {
    return this.membersService.updateMember(restaurantId, memberId, userId, dto);
  }

  /** Eliminar miembro */
  @Delete(':memberId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeMember(
    @Param('restaurantId') restaurantId: string,
    @Param('memberId') memberId: string,
    @CurrentUser() userId: string,
  ) {
    return this.membersService.removeMember(restaurantId, memberId, userId);
  }

  /** Cancelar invitación pendiente */
  @Delete('invitations/:invitationId')
  @HttpCode(HttpStatus.NO_CONTENT)
  cancelInvitation(
    @Param('restaurantId') restaurantId: string,
    @Param('invitationId') invitationId: string,
    @CurrentUser() userId: string,
  ) {
    return this.membersService.cancelInvitation(restaurantId, invitationId, userId);
  }
}
