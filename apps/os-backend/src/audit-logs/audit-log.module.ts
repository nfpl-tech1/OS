import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from '../database/entities/audit-log.entity';
import { AuditLogService } from './audit-log.service';
import { AuditLogsController } from './audit-logs.controller';

@Module({
  imports: [TypeOrmModule.forFeature([AuditLog])],
  providers: [AuditLogService],
  controllers: [AuditLogsController],
  exports: [AuditLogService],
})
export class AuditLogModule {}
