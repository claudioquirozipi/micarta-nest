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
import { CategoryService } from './category.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Controller('restaurants/:restaurantId/categories')
@UseGuards(JwtAuthGuard)
export class CategoryController {
  constructor(private readonly svc: CategoryService) {}

  @Get()
  findAll(@Param('restaurantId') restaurantId: string, @CurrentUser() userId: string) {
    return this.svc.findAll(restaurantId, userId);
  }

  @Get('staff')
  findAllStaff(@Param('restaurantId') restaurantId: string, @CurrentUser() userId: string) {
    return this.svc.findAllStaff(restaurantId, userId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Param('restaurantId') restaurantId: string,
    @CurrentUser() userId: string,
    @Body() dto: CreateCategoryDto,
  ) {
    return this.svc.create(restaurantId, userId, dto);
  }

  @Patch(':id')
  update(
    @Param('restaurantId') restaurantId: string,
    @Param('id') id: string,
    @CurrentUser() userId: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.svc.update(restaurantId, id, userId, dto);
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
