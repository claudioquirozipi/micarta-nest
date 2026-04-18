import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { SseModule } from '../sse/sse.module';

@Module({
  imports: [
    SseModule,
    JwtModule.registerAsync({
      imports:    [ConfigModule],
      inject:     [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET', 'fallback-secret'),
      }),
    }),
  ],
  controllers: [OrderController],
  providers:   [OrderService],
})
export class OrderModule {}
