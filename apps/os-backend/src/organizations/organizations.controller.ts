import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, UseGuards, Request,
} from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { InternalApiGuard } from '../common/guards/internal-api.guard';
import { Public } from '../common/decorators/public.decorator';

@Controller('organizations')
@UseGuards(JwtAuthGuard)
export class OrganizationsController {
  constructor(private readonly orgsService: OrganizationsService) {}

  // GET /organizations — any authenticated user
  @Get()
  findAll() {
    return this.orgsService.findAll();
  }

  // GET /organizations/internal — internal API key (Training module / proxied requests)
  @Get('internal')
  @Public()
  @UseGuards(InternalApiGuard)
  findAllInternal() {
    return this.orgsService.findAll();
  }

  // GET /organizations/:id — admin only
  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  findOne(@Param('id') id: string) {
    return this.orgsService.findOne(id);
  }

  // POST /organizations — admin only
  @Post()
  @UseGuards(RolesGuard)
  @Roles('admin')
  create(@Body() body: { name: string; country?: string }) {
    return this.orgsService.create(body);
  }

  // PATCH /organizations/:id — admin only
  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  update(@Param('id') id: string, @Body() body: { name?: string; country?: string }) {
    return this.orgsService.update(id, body);
  }

  // DELETE /organizations/:id — admin only (soft-disable)
  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  disable(@Param('id') id: string) {
    return this.orgsService.disable(id);
  }
}
