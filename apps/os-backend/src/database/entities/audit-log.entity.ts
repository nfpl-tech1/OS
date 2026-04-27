import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('audit_logs')
@Index(['entity_type', 'entity_id'])
@Index(['actor_id'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  actor_id: string;

  @Column()
  action: string;

  @Column({ nullable: true })
  entity_type: string;

  @Column({ nullable: true })
  entity_id: string;

  @Column({ type: 'jsonb', nullable: true })
  before: Record<string, any> | null;

  @Column({ type: 'jsonb', nullable: true })
  after: Record<string, any> | null;

  @CreateDateColumn()
  created_at: Date;
}
