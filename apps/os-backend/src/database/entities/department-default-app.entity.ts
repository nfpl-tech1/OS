import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { Department } from './department.entity';
import { Application } from './application.entity';

@Entity('department_default_apps')
@Unique(['department', 'application'])
export class DepartmentDefaultApp {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Department, (d) => d.defaultApps, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'department_id' })
  department: Department;

  @ManyToOne(() => Application, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'app_id' })
  application: Application;
}
