import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, IsNull } from 'typeorm';
import { createHmac } from 'crypto';
import { UserAppAccess } from '../../database/entities/user-app-access.entity';
import { Application } from '../../database/entities/application.entity';

// ─── Event type union ────────────────────────────────────────────────────────

export type OsWebhookEvent =
  | 'user.created'
  | 'user.updated'
  | 'user.deactivated'
  | 'user.reactivated'
  | 'user.deleted'
  | 'user.app_access_revoked'
  | 'department.created'
  | 'department.updated'
  | 'department.deleted';

// ─── Per-event payload interfaces ───────────────────────────────────────────

export interface UserCreatedPayload {
  event: 'user.created';
  os_user_id: string;
  email: string;
  name: string;
  user_type: string;
  department_slug: string | null;
  org_id: string | null;
  timestamp: string;
}

export interface UserUpdatedPayload {
  event: 'user.updated';
  os_user_id: string;
  email: string;
  name: string;
  user_type: string;
  department_slug: string | null;
  org_id: string | null;
  status: string;
  timestamp: string;
}

export interface UserLifecyclePayload {
  event: 'user.deactivated' | 'user.reactivated' | 'user.deleted';
  os_user_id: string;
  email: string;
  timestamp: string;
}

export interface UserAppAccessRevokedPayload {
  event: 'user.app_access_revoked';
  os_user_id: string;
  email: string;
  app_slug: string;
  timestamp: string;
}

export interface DepartmentCreatedPayload {
  event: 'department.created';
  department_id: string;
  department_slug: string;
  department_name: string;
  timestamp: string;
}

export interface DepartmentUpdatedPayload {
  event: 'department.updated';
  department_id: string;
  department_slug: string;
  department_name: string;
  new_slug: string;
  new_name: string;
  timestamp: string;
}

export interface DepartmentDeletedPayload {
  event: 'department.deleted';
  department_id: string;
  department_slug: string;
  timestamp: string;
}

export type OsWebhookPayload =
  | UserCreatedPayload
  | UserUpdatedPayload
  | UserLifecyclePayload
  | UserAppAccessRevokedPayload
  | DepartmentCreatedPayload
  | DepartmentUpdatedPayload
  | DepartmentDeletedPayload;

// ─── Helpers ─────────────────────────────────────────────────────────────────

const RETRY_COUNT = 3;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  label: string,
): Promise<void> {
  for (let attempt = 0; attempt < RETRY_COUNT; attempt++) {
    try {
      const res = await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        console.log(`[WebhookService] ${label} → 200 OK (attempt ${attempt + 1})`);
        return;
      }
      console.warn(`[WebhookService] ${label} → ${res.status} (attempt ${attempt + 1})`);
    } catch (err) {
      console.warn(`[WebhookService] ${label} → network error (attempt ${attempt + 1}): ${err}`);
    }
    if (attempt < RETRY_COUNT - 1) {
      await sleep(Math.pow(2, attempt) * 500); // 500 ms, 1 s, 2 s
    }
  }
  console.error(`[WebhookService] ${label} — all ${RETRY_COUNT} attempts failed`);
}

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class WebhookService {
  constructor(
    private config: ConfigService,
    @InjectRepository(UserAppAccess)
    private accessRepo: Repository<UserAppAccess>,
    @InjectRepository(Application)
    private appRepo: Repository<Application>,
  ) {}

  private get internalKey(): string {
    return this.config.get<string>('INTERNAL_API_KEY') ?? '';
  }

  private sign(body: string): string {
    const secret = this.config.get<string>('WEBHOOK_SECRET') ?? '';
    return 'sha256=' + createHmac('sha256', secret).update(body).digest('hex');
  }

  private headers(body: string): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'x-internal-key': this.internalKey,
      'x-webhook-signature': this.sign(body),
    };
  }

  private dispatch(url: string, payload: OsWebhookPayload, appSlug: string): void {
    const body = JSON.stringify(payload);
    // Fire and forget from the caller's perspective
    fetchWithRetry(url, { method: 'POST', headers: this.headers(body), body }, `${appSlug} ${payload.event}`)
      .catch(() => {}); // fetchWithRetry already logs; swallow to avoid unhandledRejection
  }

  /**
   * Notify all apps that have an access record for this user.
   * Pass targetAppSlug to restrict delivery to a single app (e.g. app_access_revoked).
   */
  async notifyApps(
    osUserId: string,
    email: string,
    event: OsWebhookEvent,
    extra: Record<string, unknown> = {},
    targetAppSlug?: string,
  ): Promise<void> {
    const records = await this.accessRepo.find({
      where: { user: { id: osUserId } },
      relations: ['application'],
    });

    const targets = records.filter(
      (r) =>
        r.application?.webhook_url &&
        (!targetAppSlug || r.application.slug === targetAppSlug),
    );

    const timestamp = new Date().toISOString();
    const base = { event, os_user_id: osUserId, email, timestamp, ...extra };

    for (const r of targets) {
      this.dispatch(r.application.webhook_url!, base as OsWebhookPayload, r.application.slug);
    }
  }

  /**
   * Broadcast a department event to ALL active apps that have a webhook_url.
   */
  async broadcastDepartment(
    event: 'department.created' | 'department.updated' | 'department.deleted',
    data: Record<string, unknown>,
  ): Promise<void> {
    const apps = await this.appRepo.find({
      where: { is_active: true, webhook_url: Not(IsNull()) },
    });

    const payload = { event, ...data, timestamp: new Date().toISOString() } as OsWebhookPayload;

    for (const app of apps) {
      this.dispatch(app.webhook_url!, payload, app.slug);
    }
  }
}
