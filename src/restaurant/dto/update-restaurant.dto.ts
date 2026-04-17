import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateRestaurantDto } from './create-restaurant.dto';

// ownerId nunca se puede cambiar desde el DTO; slug se puede editar
export class UpdateRestaurantDto extends PartialType(CreateRestaurantDto) {}
