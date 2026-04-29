import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { RestaurantModule } from './restaurant/restaurant.module';
import { MenuModule } from './menu/menu.module';
import { OrderModule } from './orders/order.module';
import { RoomsModule } from './rooms/rooms.module';
import { SubscriptionModule } from './subscription/subscription.module';
import { ReportsModule } from './reports/reports.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    UserModule,
    AuthModule,
    RestaurantModule,
    MenuModule,
    OrderModule,
    RoomsModule,
    SubscriptionModule,
    ReportsModule,
  ],
})
export class AppModule {}
