import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('sso_tokens')
export class SsoToken {
  // token_id is the UUID embedded in the JWT — used as PK directly
  @PrimaryColumn('uuid')
  token_id: string;

  @Index()
  @Column()
  user_id: string;

  @Column()
  app_slug: string;

  @Column({ default: false })
  used: boolean;

  @Index()
  @Column()
  expires_at: Date;

  @CreateDateColumn()
  created_at: Date;
}
