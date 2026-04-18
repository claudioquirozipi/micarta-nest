import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RestaurantService } from './restaurant.service';
import { CreateRestaurantDto } from './dto/create-restaurant.dto';
import { UpdateRestaurantDto } from './dto/update-restaurant.dto';
import { UpdateLogoDto } from './dto/update-logo.dto';

@Controller('restaurants')
@UseGuards(JwtAuthGuard)
export class RestaurantController {
  constructor(private readonly restaurantService: RestaurantService) {}

  /** Crear restaurante — el usuario autenticado queda como owner */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@CurrentUser() userId: string, @Body() dto: CreateRestaurantDto) {
    return this.restaurantService.create(userId, dto);
  }

  /** Obtener el restaurante del usuario autenticado */
  @Get('mine')
  findMine(@CurrentUser() userId: string) {
    return this.restaurantService.findMine(userId);
  }

  /** Acceso de staff: devuelve restaurant + rol del usuario autenticado */
  @Get('member-access/:slug')
  getMemberAccess(@Param('slug') slug: string, @CurrentUser() userId: string) {
    return this.restaurantService.getMemberAccess(slug, userId);
  }

  /** Obtener restaurante por slug (público, pero protegido por JWT por ahora) */
  @Get('slug/:slug')
  findBySlug(@Param('slug') slug: string) {
    return this.restaurantService.findBySlug(slug);
  }

  /** Actualizar restaurante — solo el owner puede hacerlo */
  @Patch(':id')
  update(
    @Param('id') id: string,
    @CurrentUser() userId: string,
    @Body() dto: UpdateRestaurantDto,
  ) {
    return this.restaurantService.update(id, userId, dto);
  }

  /** Genera firma para subir el logo directamente a Cloudinary desde el front */
  @Post(':id/logo/sign')
  signLogoUpload(@Param('id') id: string, @CurrentUser() userId: string) {
    return this.restaurantService.signLogoUpload(id, userId);
  }

  /** Guarda la URL del logo tras la subida exitosa a Cloudinary */
  @Patch(':id/logo')
  updateLogo(
    @Param('id') id: string,
    @CurrentUser() userId: string,
    @Body() dto: UpdateLogoDto,
  ) {
    return this.restaurantService.updateLogo(id, userId, dto.logoUrl);
  }
}
