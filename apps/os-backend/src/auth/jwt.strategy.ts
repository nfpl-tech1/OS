import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../database/entities/user.entity';
import { Request } from 'express';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    @InjectRepository(User)
    private usersRepo: Repository<User>,
  ) {
    super({
      // Extract JWT from httpOnly cookie named 'os_session'
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => req?.cookies?.os_session ?? null,
      ]),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('OS_SESSION_SECRET')!,
    });
  }

  async validate(payload: { sub: string; email: string }) {
    const user = await this.usersRepo.findOne({
      where: { id: payload.sub, status: 'active' },
    });
    if (!user) throw new UnauthorizedException();
    return user;
  }
}
