import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SubscriptionService } from './subscription.service';
import { SubscriptionController } from './subscription.controller';
import { SubscriptionGuard } from './guards/subscription.guard';
import { CulqiService } from './culqi.service';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports:    [ConfigModule],
      inject:     [ConfigService],
      useFactory: (c: ConfigService) => ({
        secret: c.get<string>('JWT_SECRET', 'fallback-secret'),
      }),
    }),
  ],
  providers:   [SubscriptionService, SubscriptionGuard, CulqiService],
  controllers: [SubscriptionController],
  exports:     [SubscriptionService, SubscriptionGuard],
})
export class SubscriptionModule {}
