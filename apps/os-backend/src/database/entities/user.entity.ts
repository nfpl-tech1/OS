import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { UserType } from './user-type.entity';
import { UserAppAccess } from './user-app-access.entity';
import { ClientOrganization } from './client-organization.entity';
import { Department } from './department.entity';

export type UserStatus = 'active' | 'disabled' | 'deleted';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // email unique constraint already creates an index — explicit @Index for clarity
  @Index()
  @Column({ unique: true })
  email: string;

  @Column({ type: 'varchar', nullable: true })
  company_email: string | null;

  @Column()
  password_hash: string;

  @Column()
  name: string;

  @ManyToOne(() => UserType, (ut) => ut.users, { eager: true })
  @JoinColumn({ name: 'user_type_id' })
  userType: UserType;

  @ManyToOne(() => Department, (dept) => dept.users, { nullable: true, eager: true })
  @JoinColumn({ name: 'department_id' })
  department: Department | null;

  @Index()
  @Column({ type: 'enum', enum: ['active', 'disabled', 'deleted'], default: 'active' })
  status: UserStatus;

  @Column({ default: false })
  is_team_lead: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToMany(() => UserAppAccess, (access) => access.user)
  appAccess: UserAppAccess[];

  @ManyToOne(() => ClientOrganization, { nullable: true, eager: true })
  @JoinColumn({ name: 'organization_id' })
  organization: ClientOrganization | null;
}
