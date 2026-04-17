import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../user/user.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const user = await this.userService.create({
      email: dto.email,
      name: dto.name,
      password: dto.password,
    });

    return { accessToken: this.signToken(user.id, user.email), user };
  }

  async login(dto: LoginDto) {
    const user = await this.userService.findByEmail(dto.email);

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Credenciales inválidas');

    const { passwordHash, ...safeUser } = user;
    return { accessToken: this.signToken(user.id, user.email), user: safeUser };
  }

  async validateGoogleUser(data: {
    googleId:  string;
    email:     string;
    name:      string;
    avatarUrl: string;
  }) {
    let user = await this.userService.findByGoogleId(data.googleId);

    if (!user) {
      user = await this.userService.findByEmail(data.email);

      if (user) {
        // email ya existe → vincular Google y guardar avatar si no tenía
        user = await this.userService.linkGoogle(user.id, data.googleId, data.avatarUrl);
      } else {
        // usuario nuevo
        const created = await this.userService.create({
          email:     data.email,
          name:      data.name,
          avatarUrl: data.avatarUrl,
          googleId:  data.googleId,
        });
        return { accessToken: this.signToken(created.id, created.email), user: created };
      }
    }

    const { passwordHash, ...safeUser } = user as any;
    return { accessToken: this.signToken(user.id, user.email), user: safeUser };
  }

  private signToken(sub: string, email: string) {
    return this.jwtService.sign({ sub, email });
  }
}
