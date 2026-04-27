import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Res,
  UseGuards,
  Request,
  HttpCode,
} from '@nestjs/common';
import type { Response } from 'express';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { SsoTokenService } from './sso-token.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { InternalApiGuard } from '../common/guards/internal-api.guard';
import { Public } from '../common/decorators/public.decorator';
import { VerifyPasswordDto } from './dto/verify-password.dto';
import { ConsumeSsoTokenDto } from './dto/consume-sso-token.dto';
import { UsersService } from '../users/users.service';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private ssoTokenService: SsoTokenService,
    private usersService: UsersService,
  ) {}

  // POST /auth/login
  @Post('login')
  @HttpCode(200)
  @Throttle({ short: { limit: 5, ttl: 60000 } })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const { token, body } = await this.authService.login(dto);

    // Set session token as httpOnly cookie
    res.cookie('os_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 8 * 60 * 60 * 1000, // 8 hours in ms
    });

    return body;
  }

  // POST /auth/logout
  @Post('logout')
  @SkipThrottle()
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('os_session');
    return { message: 'Logged out' };
  }

  // GET /auth/sso-token?app=superfreight
  @Get('sso-token')
  @SkipThrottle()
  @UseGuards(JwtAuthGuard)
  async getSsoToken(@Request() req, @Query('app') appSlug: string) {
    const token = await this.authService.getSsoToken(req.user, appSlug);
    return { sso_token: token };
  }

  // GET /auth/public-key — used by apps to verify SSO tokens
  @Get('public-key')
  @SkipThrottle()
  getPublicKey() {
    return { public_key: this.authService.getPublicKey() };
  }

  // POST /auth/verify-session — internal API only
  @Post('verify-session')
  @HttpCode(200)
  @Public()
  @SkipThrottle()
  @UseGuards(InternalApiGuard)
  async verifySession(@Body() body: { os_user_id: string }) {
    const user = await this.usersService.findRaw(body.os_user_id);
    return { is_active: user != null && user.status === 'active' };
  }

  // POST /auth/verify-password — internal API only
  @Post('verify-password')
  @Public()
  @SkipThrottle()
  @UseGuards(InternalApiGuard)
  @HttpCode(200)
  verifyPassword(@Body() dto: VerifyPasswordDto) {
    return this.authService.verifyPassword(dto.email, dto.password, dto.app_slug);
  }

  // POST /auth/sso-token/consume — internal API only
  // Called by satellite apps after verifying the RS256 signature to mark the token used.
  @Post('sso-token/consume')
  @Public()
  @UseGuards(InternalApiGuard)
  @HttpCode(200)
  async consumeSsoToken(@Body() dto: ConsumeSsoTokenDto) {
    await this.ssoTokenService.markUsed(dto.token_id);
    return { consumed: true };
  }
}
