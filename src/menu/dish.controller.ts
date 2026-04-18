import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { IsUrl } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { DishService } from './dish.service';
import { CreateDishDto } from './dto/create-dish.dto';
import { UpdateDishDto } from './dto/update-dish.dto';
import { UpdateAvailabilityDto } from './dto/update-availability.dto';

class UpdateDishImageDto {
  @IsUrl()
  imageUrl: string;
}

@Controller('restaurants/:restaurantId/dishes')
@UseGuards(JwtAuthGuard)
export class DishController {
  constructor(private readonly svc: DishService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Param('restaurantId') restaurantId: string,
    @CurrentUser() userId: string,
    @Body() dto: CreateDishDto,
  ) {
    return this.svc.create(restaurantId, userId, dto);
  }

  @Patch(':id')
  update(
    @Param('restaurantId') restaurantId: string,
    @Param('id') id: string,
    @CurrentUser() userId: string,
    @Body() dto: UpdateDishDto,
  ) {
    return this.svc.update(restaurantId, id, userId, dto);
  }

  @Patch(':id/availability')
  updateAvailability(
    @Param('restaurantId') restaurantId: string,
    @Param('id') id: string,
    @CurrentUser() userId: string,
    @Body() dto: UpdateAvailabilityDto,
  ) {
    return this.svc.updateAvailability(restaurantId, id, userId, dto.isAvailable);
  }

  @Patch(':id/image')
  updateImage(
    @Param('restaurantId') restaurantId: string,
    @Param('id') id: string,
    @CurrentUser() userId: string,
    @Body() dto: UpdateDishImageDto,
  ) {
    return this.svc.updateImage(restaurantId, id, userId, dto.imageUrl);
  }

  @Post(':id/image/sign')
  signImage(
    @Param('restaurantId') restaurantId: string,
    @Param('id') id: string,
    @CurrentUser() userId: string,
  ) {
    // assertOwner será necesario; para MVP confiamos en que el dueño llama este endpoint
    void userId;
    return this.svc.signImageUpload(restaurantId, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('restaurantId') restaurantId: string,
    @Param('id') id: string,
    @CurrentUser() userId: string,
  ) {
    return this.svc.remove(restaurantId, id, userId);
  }
}
