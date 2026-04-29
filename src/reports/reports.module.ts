import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [
    PrismaModule,
    SubscriptionModule,
    JwtModule.registerAsync({
      inject:     [ConfigService],
      useFactory: (cfg: ConfigService) => ({ secret: cfg.get('JWT_SECRET') }),
    }),
  ],
  controllers: [ReportsController],
  providers:   [ReportsService],
})
export class ReportsModule {}
