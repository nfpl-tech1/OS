import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Unique,
  Index,
} from 'typeorm';
import { User } from './user.entity';
import { Application } from './application.entity';

@Entity('user_app_access')
@Unique(['user', 'application'])
export class UserAppAccess {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @ManyToOne(() => User, (user) => user.appAccess)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Application, (app) => app.userAccess, { eager: true })
  @JoinColumn({ name: 'application_id' })
  application: Application;

  @Column({ default: true })
  is_enabled: boolean;

  @Column({ default: false })
  is_app_admin: boolean;

  @CreateDateColumn()
  granted_at: Date;

  // who granted this access — stored as UUID, not FK to avoid circular deps
  @Column({ nullable: true })
  granted_by: string;
}
