import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SsoToken } from '../database/entities/sso-token.entity';
import { User } from '../database/entities/user.entity';
import { UserAppAccess } from '../database/entities/user-app-access.entity';

@Injectable()
export class SsoTokenService {
  private readonly logger = new Logger(SsoTokenService.name);

  constructor(
    private jwtService: JwtService,
    private config: ConfigService,
    @InjectRepository(SsoToken)
    private ssoTokenRepo: Repository<SsoToken>,
  ) { }

  async generate(user: User, appSlug: string, appAccess: UserAppAccess): Promise<string> {
    const token_id = uuidv4();

    // Store token_id so we can mark it used after consumption
    await this.ssoTokenRepo.save({
      token_id,
      user_id: user.id,
      app_slug: appSlug,
      used: false,
      expires_at: new Date(Date.now() + 60_000), // 60 seconds
    });

    const org_id = user.organization?.id ?? null;
    const org_name = user.organization?.name ?? null;

    const payload = {
      token_id,
      user_id: user.id,
      email: user.email,
      company_email: user.company_email ?? null,
      name: user.name,
      // 'admin' is an OS-internal concept — receiving apps only understand 'employee' | 'client'.
      // Admin users are always treated as employees in app context; is_app_admin carries the privilege.
      user_type: (user.userType.slug === 'admin' ? 'employee' : user.userType.slug) as 'employee' | 'client',
      department_slug: user.department?.slug ?? null,
      department_name: user.department?.name ?? null,
      branch_slug: user.branch?.slug ?? null,
      branch_name: user.branch?.name ?? null,
      is_app_admin: appAccess.is_app_admin,
      is_team_lead: user.is_team_lead ?? false,
      org_id,
      org_name,
    } as any;

    return this.jwtService.sign(payload, {
      algorithm: 'RS256',
      expiresIn: '60s',
      privateKey: this.config
        .get<string>('OS_JWT_PRIVATE_KEY')!
        .replace(/\\n/g, '\n'),
    });
  }

  async markUsed(token_id: string): Promise<void> {
    const record = await this.ssoTokenRepo.findOne({ where: { token_id } });
    if (!record) throw new UnauthorizedException('SSO token not found');
    if (record.used) throw new UnauthorizedException('SSO token already used');
    if (record.expires_at < new Date())
      throw new UnauthorizedException('SSO token expired');
    await this.ssoTokenRepo.update({ token_id }, { used: true });
  }

  // ─── Hourly cleanup of tokens older than 24 hours ─────────────────
  @Cron(CronExpression.EVERY_HOUR)
  async cleanupExpiredTokens(): Promise<void> {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const result = await this.ssoTokenRepo.delete({ expires_at: LessThan(cutoff) });
    if ((result.affected ?? 0) > 0) {
      this.logger.log(`Cleaned up ${result.affected} expired SSO token(s)`);
    }
  }
}
