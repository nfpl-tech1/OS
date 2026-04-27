import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { InternalApiGuard } from '../common/guards/internal-api.guard';
import { WebhookService } from '../common/services/webhook.service';
import { AuditLogModule } from '../audit-logs/audit-log.module';

import { User } from '../database/entities/user.entity';
import { UserType } from '../database/entities/user-type.entity';
import { Application } from '../database/entities/application.entity';
import { UserAppAccess } from '../database/entities/user-app-access.entity';
import { ClientOrganization } from '../database/entities/client-organization.entity';
import { Department } from '../database/entities/department.entity';
import { DepartmentDefaultApp } from '../database/entities/department-default-app.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      UserType,
      Application,
      UserAppAccess,
      ClientOrganization,
      Department,
      DepartmentDefaultApp,
    ]),
    AuditLogModule,
  ],
  controllers: [UsersController],
  providers: [UsersService, InternalApiGuard, WebhookService],
  exports: [UsersService],
})
export class UsersModule {}
