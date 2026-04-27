import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class InternalApiGuard implements CanActivate {
  constructor(private config: ConfigService) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    const key = req.headers['x-internal-key'];
    if (!key || key !== this.config.get('INTERNAL_API_KEY')) {
      throw new UnauthorizedException('Invalid internal API key');
    }
    return true;
  }
}
