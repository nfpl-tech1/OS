import {
  Controller,
  Get,
  Query,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AuditLogService } from './audit-log.service';

@Controller('audit-logs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AuditLogsController {
  constructor(private auditLogService: AuditLogService) {}

  // GET /audit-logs?entity_type=user&entity_id=uuid&limit=50&offset=0
  @Get()
  query(
    @Query('entity_type') entity_type?: string,
    @Query('entity_id') entity_id?: string,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit?: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset?: number,
  ) {
    return this.auditLogService.query({ entity_type, entity_id, limit, offset });
  }
}
