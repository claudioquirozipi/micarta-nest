import {
  CanActivate, ExecutionContext, ForbiddenException, Injectable,
} from '@nestjs/common';

const ADMIN_EMAIL = 'claudioquirozipi@gmail.com';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const email   = request.user?.email;
    if (email !== ADMIN_EMAIL) throw new ForbiddenException('Acceso denegado.');
    return true;
  }
}
