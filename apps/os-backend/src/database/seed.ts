import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';
import * as path from 'path';

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

function envString(name: string, defaultValue: string): string {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value.trim() : defaultValue;
}

const AppDataSource = new DataSource({
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
  // Schema is managed by migrations — seed runs them first before inserting data
  synchronize: false,
  migrations: [path.join(__dirname, 'migrations', '*.ts')],
});

async function seed() {
  await AppDataSource.initialize();
  console.log('✅ Database connected');

  // ─── 1. Run all pending migrations ───────────────────────────────────────
  // This creates all tables on a fresh DB. On subsequent runs it is a no-op
  // (TypeORM tracks which migrations have already run in the "migrations" table).
  const ran = await AppDataSource.runMigrations({ transaction: 'each' });
  if (ran.length > 0) {
    console.log(`✅ Migrations: ran ${ran.length} new migration(s)`);
    ran.forEach((m) => console.log(`   → ${m.name}`));
  } else {
    console.log('✅ Migrations: already up to date');
  }

  // ─── 2. User Types ────────────────────────────────────────────────────────
  // These slugs are hardcoded in application logic (roles.guard.ts, auth.service.ts).
  // They are system constants — not business data — and cannot be created via the UI.
  const userTypeRepo = AppDataSource.getRepository(UserType);

  await userTypeRepo.upsert(
    [
      { slug: 'employee', label: 'Employee' },
      { slug: 'client',   label: 'Client'   },
      { slug: 'admin',    label: 'Admin'    },
    ],
    { conflictPaths: ['slug'], skipUpdateIfNoValuesChanged: true },
  );
  console.log('✅ User types seeded (employee / client / admin)');

  // ─── 3. Bootstrap Admin User ──────────────────────────────────────────────
  // The only way to get a first user into the system. All subsequent users
  // and permissions are managed by this admin through the UI after first login.
  const adminType = await userTypeRepo.findOneOrFail({ where: { slug: 'admin' } });

  const userRepo = AppDataSource.getRepository(User);
  const adminEmail    = envString('SEED_ADMIN_EMAIL',    'admin@nagarkot.com');
  const adminPassword = envString('SEED_ADMIN_PASSWORD', 'Admin@1234');
  const adminName     = envString('SEED_ADMIN_NAME',     'Admin');

  const existingAdmin = await userRepo.findOne({ where: { email: adminEmail } });

  if (!existingAdmin) {
    const password_hash = await bcrypt.hash(adminPassword, 10);
    await userRepo.save(
      userRepo.create({
        email: adminEmail,
        password_hash,
        name: adminName,
        userType: adminType,
        status: 'active',
      }),
    );
    console.log('✅ Admin user created');
    console.log(`   Email:    ${adminEmail}`);
    console.log(`   Password: ${adminPassword}`);
    console.log('   ⚠️  Change this password immediately after first login');
  } else {
    // Ensure the existing account always has admin type — safe to re-run
    existingAdmin.userType = adminType;
    await userRepo.save(existingAdmin);
    console.log(`✅ Admin user already exists (${adminEmail}) — type confirmed`);
  }

  // ─── Done ─────────────────────────────────────────────────────────────────
  // Applications, departments, and app access are NOT seeded here.
  // Log in to the OS dashboard as admin and configure them via the UI.
  await AppDataSource.destroy();
  console.log('🎉 Setup complete — log in and configure apps/departments via the OS dashboard');
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
