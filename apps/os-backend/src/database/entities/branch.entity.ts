import {
  Entity, PrimaryGeneratedColumn, Column, OneToMany,
} from 'typeorm';
import { User } from './user.entity';
import { BranchDefaultApp } from './branch-default-app.entity';

export type BranchStatus = 'active' | 'deleted';

@Entity('branches')
export class Branch {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  slug: string; // e.g. 'ho-chembur', 'air-cargo'

  @Column()
  name: string; // e.g. 'HO (Chembur)'

  @Column({ default: true })
  is_active: boolean;

  @Column({ default: 'active' })
  status: BranchStatus;

  @OneToMany(() => User, (user) => user.branch)
  users: User[];

  @OneToMany(() => BranchDefaultApp, (b) => b.branch)
  defaultApps: BranchDefaultApp[];
}
