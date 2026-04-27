import {
  Entity, PrimaryGeneratedColumn, Column, OneToMany,
} from 'typeorm';
import { User } from './user.entity';
import { DepartmentDefaultApp } from './department-default-app.entity';

export type DepartmentStatus = 'active' | 'deleted';

@Entity('departments')
export class Department {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  slug: string; // e.g. 'operations', 'sales', 'finance', 'hr'

  @Column()
  name: string; // e.g. 'Operations'

  @Column({ default: true })
  is_active: boolean;

  @Column({ default: 'active' })
  status: DepartmentStatus;

  @OneToMany(() => User, (user) => user.department)
  users: User[];

  @OneToMany(() => DepartmentDefaultApp, (d) => d.department)
  defaultApps: DepartmentDefaultApp[];
}
