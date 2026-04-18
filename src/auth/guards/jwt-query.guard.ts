import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtQueryGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private config:     ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const req   = context.switchToHttp().getRequest();
    const token = req.query?.token as string | undefined;
    if (!token) throw new UnauthorizedException('Token requerido.');
    try {
      req.user = this.jwtService.verify(token, {
        secret: this.config.get<string>('JWT_SECRET', 'fallback-secret'),
      });
      return true;
    } catch {
      throw new UnauthorizedException('Token inválido o expirado.');
    }
  }
}
