import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { BranchesService } from './branches.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('users/branches')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @Get()
  async getBranches() {
    return this.branchesService.getBranches();
  }

  @Post()
  @Roles('admin')
  async createBranch(@Body('name') name: string) {
    return this.branchesService.createBranch(name);
  }

  @Put(':id')
  @Roles('admin')
  async updateBranch(@Param('id') id: string, @Body('name') name: string) {
    return this.branchesService.updateBranch(id, name);
  }

  @Delete(':id')
  @Roles('admin')
  async deleteBranch(@Param('id') id: string) {
    return this.branchesService.deleteBranch(id);
  }

  @Get(':id/default-apps')
  async getBranchDefaultApps(@Param('id') id: string) {
    return this.branchesService.getBranchDefaultApps(id);
  }

  @Post(':id/default-apps')
  @Roles('admin')
  async addDefaultApp(@Param('id') id: string, @Body('app_id') appId: string) {
    return this.branchesService.addDefaultApp(id, appId);
  }

  @Delete(':id/default-apps/:appId')
  @Roles('admin')
  async removeDefaultApp(@Param('id') id: string, @Param('appId') appId: string) {
    return this.branchesService.removeDefaultApp(id, appId);
  }
}
