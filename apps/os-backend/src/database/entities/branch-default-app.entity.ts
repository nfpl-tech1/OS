import {
  Entity, PrimaryGeneratedColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { Branch } from './branch.entity';
import { Application } from './application.entity';

import { Unique } from 'typeorm';

@Entity('branch_default_apps')
@Unique(['branch', 'application'])
export class BranchDefaultApp {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Branch, (branch) => branch.defaultApps, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'branch_id' })
  branch: Branch;

  @ManyToOne(() => Application, { onDelete: 'CASCADE', eager: true })
  @JoinColumn({ name: 'app_id' })
  application: Application;
}
