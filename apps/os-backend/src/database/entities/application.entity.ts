import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
} from 'typeorm';
import { UserAppAccess } from './user-app-access.entity';

@Entity('applications')
export class Application {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // e.g. 'superfreight', 'tez', 'trainings', 'shakti'
  @Column({ unique: true })
  slug: string;

  @Column()
  name: string;

  @Column()
  url: string;

  @Column({ type: 'varchar', nullable: true })
  icon_url: string | null;

  @Column({ type: 'varchar', nullable: true })
  webhook_url: string | null;

  @Column({ default: true })
  is_active: boolean;

  @OneToMany(() => UserAppAccess, (access) => access.application)
  userAccess: UserAppAccess[];
}
