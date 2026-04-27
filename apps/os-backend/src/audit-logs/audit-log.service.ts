import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../database/entities/audit-log.entity';

export interface AuditLogParams {
  actor_id: string;
  action: string;
  entity_type?: string;
  entity_id?: string;
  before?: Record<string, any> | null;
  after?: Record<string, any> | null;
}

@Injectable()
export class AuditLogService {
  constructor(
    @InjectRepository(AuditLog)
    private repo: Repository<AuditLog>,
  ) {}

  async log(params: AuditLogParams): Promise<void> {
    try {
      await this.repo.save(this.repo.create(params));
    } catch {
      // Audit failures must never block business operations
    }
  }

  async query(params: {
    entity_type?: string;
    entity_id?: string;
    limit?: number;
    offset?: number;
  }) {
    const where: Record<string, string> = {};
    if (params.entity_type) where['entity_type'] = params.entity_type;
    if (params.entity_id) where['entity_id'] = params.entity_id;

    const [rows, total] = await this.repo.findAndCount({
      where,
      order: { created_at: 'DESC' },
      take: params.limit ?? 50,
      skip: params.offset ?? 0,
    });

    return { total, rows };
  }
}
