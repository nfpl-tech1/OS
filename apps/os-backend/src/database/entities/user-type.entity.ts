import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
} from 'typeorm';
import { User } from './user.entity';

@Entity('user_types')
export class UserType {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // 'employee' or 'client' — keep this a small fixed set
  @Column({ unique: true })
  slug: string;

  @Column()
  label: string;

  @OneToMany(() => User, (user) => user.userType)
  users: User[];
}
