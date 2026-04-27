import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SubscriptionGuard } from '../subscription/guards/subscription.guard';
import { RoomsService } from './rooms.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { CreateTableDto } from './dto/create-table.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { UpdateTableDto } from './dto/update-table.dto';

@Controller('restaurants/:restaurantId/rooms')
@UseGuards(JwtAuthGuard, SubscriptionGuard)
export class RoomsController {
  constructor(private readonly svc: RoomsService) {}

  @Get()
  list(
    @Param('restaurantId') rId: string,
    @CurrentUser() userId: string,
  ) {
    return this.svc.listRooms(rId, userId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  createRoom(
    @Param('restaurantId') rId: string,
    @CurrentUser() userId: string,
    @Body() dto: CreateRoomDto,
  ) {
    return this.svc.createRoom(rId, userId, dto);
  }

  @Patch(':roomId')
  updateRoom(
    @Param('restaurantId') rId: string,
    @Param('roomId') roomId: string,
    @CurrentUser() userId: string,
    @Body() dto: UpdateRoomDto,
  ) {
    return this.svc.updateRoom(rId, roomId, userId, dto);
  }

  @Delete(':roomId')
  deleteRoom(
    @Param('restaurantId') rId: string,
    @Param('roomId') roomId: string,
    @CurrentUser() userId: string,
  ) {
    return this.svc.deleteRoom(rId, roomId, userId);
  }

  @Post(':roomId/tables')
  @HttpCode(HttpStatus.CREATED)
  createTable(
    @Param('restaurantId') rId: string,
    @Param('roomId') roomId: string,
    @CurrentUser() userId: string,
    @Body() dto: CreateTableDto,
  ) {
    return this.svc.createTable(rId, roomId, userId, dto);
  }

  @Patch(':roomId/tables/:tableId')
  updateTable(
    @Param('restaurantId') rId: string,
    @Param('roomId') roomId: string,
    @Param('tableId') tableId: string,
    @CurrentUser() userId: string,
    @Body() dto: UpdateTableDto,
  ) {
    return this.svc.updateTable(rId, roomId, tableId, userId, dto);
  }

  @Delete(':roomId/tables/:tableId')
  deleteTable(
    @Param('restaurantId') rId: string,
    @Param('roomId') roomId: string,
    @Param('tableId') tableId: string,
    @CurrentUser() userId: string,
  ) {
    return this.svc.deleteTable(rId, roomId, tableId, userId);
  }
}
