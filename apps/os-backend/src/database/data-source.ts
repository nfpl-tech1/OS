import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

import { UserType } from './entities/user-type.entity';
import { User } from './entities/user.entity';
import { Department } from './entities/department.entity';
import { Application } from './entities/application.entity';
import { UserAppAccess } from './entities/user-app-access.entity';
import { ClientOrganization } from './entities/client-organization.entity';
import { SsoToken } from './entities/sso-token.entity';
import { DepartmentDefaultApp } from './entities/department-default-app.entity';
import { AuditLog } from './entities/audit-log.entity';

dotenv.config();

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  username: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  entities: [
    UserType,
    User,
    Department,
    Application,
    UserAppAccess,
    ClientOrganization,
    SsoToken,
    DepartmentDefaultApp,
    AuditLog,
  ],
  migrations: ['src/database/migrations/*.ts'],
  synchronize: false,
});
