import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SsoTokenService } from './sso-token.service';
import { JwtStrategy } from './jwt.strategy';
import { InternalApiGuard } from '../common/guards/internal-api.guard';
import { UsersModule } from '../users/users.module';

import { User } from '../database/entities/user.entity';
import { UserAppAccess } from '../database/entities/user-app-access.entity';
import { SsoToken } from '../database/entities/sso-token.entity';
import { Application } from '../database/entities/application.entity';

@Module({
  imports: [
    ConfigModule,
    PassportModule,
    JwtModule.register({}), // options passed per-call in AuthService
    TypeOrmModule.forFeature([User, UserAppAccess, SsoToken, Application]),
    UsersModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, SsoTokenService, JwtStrategy, InternalApiGuard],
  exports: [AuthService, SsoTokenService],
})
export class AuthModule {}
