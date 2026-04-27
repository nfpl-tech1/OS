import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../database/entities/user.entity';
import { UserAppAccess } from '../database/entities/user-app-access.entity';
import { Application } from '../database/entities/application.entity';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { SsoTokenService } from './sso-token.service';
import { AppAccess } from './dto/auth-response.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private usersRepo: Repository<User>,
    @InjectRepository(UserAppAccess)
    private accessRepo: Repository<UserAppAccess>,
    @InjectRepository(Application)
    private appRepo: Repository<Application>,
    private jwtService: JwtService,
    private config: ConfigService,
    private ssoTokenService: SsoTokenService,
  ) { }

  async login(dto: LoginDto): Promise<{ token: string; body: AuthResponseDto }> {
    // 1. Find user by email
    const user = await this.usersRepo.findOne({
      where: { email: dto.email, status: 'active' },
      relations: ['userType', 'organization'],
    });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    // 2. Verify password
    const valid = await bcrypt.compare(dto.password, user.password_hash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    // 3. Load allowed apps for this user
    const access = await this.accessRepo.find({
      where: { user: { id: user.id }, is_enabled: true },
      relations: ['application'],
    });

    const allowed_apps: AppAccess[] = access
      .filter((a) => a.application.is_active)
      .map((a) => ({
        slug: a.application.slug as any,
        name: a.application.name,
        url: a.application.url,
        icon_url: a.application.icon_url,
      }));

    // 4. Sign session JWT (long-lived, HS256, stored in httpOnly cookie)
    const token = this.jwtService.sign(
      { sub: user.id, email: user.email },
      {
        secret: this.config.get<string>('OS_SESSION_SECRET'),
        expiresIn: this.config.get('OS_SESSION_EXPIRES_IN') as any,
      },
    );

    const org_id = user.organization?.id ?? null;

    const body: AuthResponseDto = {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        user_type: user.userType.slug,
        org_id,
      },
      allowed_apps,
    };

    return { token, body };
  }

  async getSsoToken(user: User, appSlug: string): Promise<string> {
    // Verify user actually has access to this app
    let access = await this.accessRepo.findOne({
      where: {
        user: { id: user.id },
        application: { slug: appSlug },
        is_enabled: true,
      },
      relations: ['application'],
    });

    // Admin users get implicit access to all apps (same as getMe() behaviour)
    if (!access && user.userType?.slug === 'admin') {
      // Find the access record even if disabled, or create a synthetic one
      const anyAccess = await this.accessRepo.findOne({
        where: {
          user: { id: user.id },
          application: { slug: appSlug },
        },
        relations: ['application'],
      });

      if (anyAccess) {
        // Use it but treat as admin
        access = { ...anyAccess, is_enabled: true, is_app_admin: true };
      } else {
        // No record at all — create a synthetic access object for token generation
        const app = await this.appRepo.findOne({ where: { slug: appSlug, is_active: true } });
        if (!app) throw new UnauthorizedException('Application not found');

        access = {
          id: 'synthetic',
          user,
          application: app,
          is_enabled: true,
          is_app_admin: true,
          granted_at: new Date(),
          granted_by: user.id,
        } as any;
      }
    }

    if (!access) {
      throw new UnauthorizedException('Access to this application not granted');
    }

    // Reload user with all relations needed for the SSO payload
    const fullUser = await this.usersRepo.findOne({
      where: { id: user.id },
      relations: ['userType', 'department', 'organization'],
    });

    return this.ssoTokenService.generate(fullUser!, appSlug, access);
  }

  getPublicKey(): string {
    return this.config
      .get<string>('OS_JWT_PUBLIC_KEY')!
      .replace(/\\n/g, '\n');
  }

  async verifyPassword(email: string, password: string, appSlug: string) {
    const user = await this.usersRepo.findOne({
      where: { email, status: 'active' },
      relations: ['userType', 'department', 'organization'],
    });

    if (!user) {
      return { valid: false };
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return { valid: false };
    }

    // Load app access for this user + app
    let access = await this.accessRepo.findOne({
      where: {
        user: { id: user.id },
        application: { slug: appSlug },
        is_enabled: true,
      },
      relations: ['application'],
    });

    // Admin users get implicit access to all apps
    if (!access && user.userType?.slug === 'admin') {
      access = {
        is_app_admin: true,
      } as any;
    }

    if (!access) {
      return { valid: false, reason: 'no_app_access' };
    }

    const org_id = user.organization?.id ?? null;
    const org_name = user.organization?.name ?? null;

    return {
      valid: true,
      user: {
        os_user_id: user.id,
        email: user.email,
        company_email: user.company_email ?? null,
        name: user.name,
        user_type: user.userType.slug,
        department_slug: user.department?.slug ?? null,
        department_name: user.department?.name ?? null,
        is_app_admin: access.is_app_admin,
        is_team_lead: user.is_team_lead ?? false,
        org_id,
        org_name,
      },
    };
  }
}
