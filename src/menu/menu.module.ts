import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { CategoryController } from './category.controller';
import { CategoryService } from './category.service';
import { DishController } from './dish.controller';
import { DishService } from './dish.service';
import { PublicMenuController } from './public-menu.controller';

@Module({
  imports: [PrismaModule, CloudinaryModule],
  controllers: [CategoryController, DishController, PublicMenuController],
  providers: [CategoryService, DishService],
})
export class MenuModule {}
