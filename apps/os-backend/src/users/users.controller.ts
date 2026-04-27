import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CreateUserDto } from './dto/create-user.dto';
import { BulkCreateUserDto } from './dto/bulk-create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AssignAppAccessDto } from './dto/assign-app-access.dto';
import { CreateFromAppDto } from './dto/create-from-app.dto';
import { InternalApiGuard } from '../common/guards/internal-api.guard';
import { Public } from '../common/decorators/public.decorator';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  // GET /users/me — any authenticated user
  @Get('me')
  me(@Request() req) {
    return this.usersService.getMe(req.user.id);
  }

  // GET /users/departments — any authenticated user
  @Get('departments')
  getDepartments() {
    return this.usersService.getDepartments();
  }

  // GET /users/internal/departments — internal API only
  @Get('internal/departments')
  @Public()
  @UseGuards(InternalApiGuard)
  getInternalDepartments() {
    return this.usersService.getDepartments();
  }

  // POST /users/departments — admin only
  @Post('departments')
  @UseGuards(RolesGuard)
  @Roles('admin')
  createDepartment(@Body() body: { name: string }, @Request() req) {
    return this.usersService.createDepartment(body.name, req.user.id);
  }

  // PATCH /users/departments/:id — admin only
  @Patch('departments/:id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  updateDepartment(@Param('id') id: string, @Body() body: { name: string }, @Request() req) {
    return this.usersService.updateDepartment(id, body.name, req.user.id);
  }

  // DELETE /users/departments/:id — admin only
  @Delete('departments/:id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  deleteDepartment(@Param('id') id: string, @Request() req) {
    return this.usersService.deleteDepartment(id, req.user.id);
  }

  // GET /users/departments/:id/default-apps — admin only
  @Get('departments/:id/default-apps')
  @UseGuards(RolesGuard)
  @Roles('admin')
  getDepartmentDefaultApps(@Param('id') id: string) {
    return this.usersService.getDepartmentDefaultApps(id);
  }

  // POST /users/departments/:id/default-apps — admin only
  @Post('departments/:id/default-apps')
  @UseGuards(RolesGuard)
  @Roles('admin')
  addDepartmentDefaultApp(
    @Param('id') departmentId: string,
    @Body() body: { app_id: string },
    @Request() req,
  ) {
    return this.usersService.addDepartmentDefaultApp(departmentId, body.app_id, req.user.id);
  }

  // DELETE /users/departments/:id/default-apps/:appId — admin only
  @Delete('departments/:id/default-apps/:appId')
  @UseGuards(RolesGuard)
  @Roles('admin')
  removeDepartmentDefaultApp(
    @Param('id') departmentId: string,
    @Param('appId') appId: string,
    @Request() req,
  ) {
    return this.usersService.removeDepartmentDefaultApp(departmentId, appId, req.user.id);
  }

  // GET /users/applications — any authenticated user
  @Get('applications')
  getApplications() {
    return this.usersService.getApplications();
  }

  // POST /users/me/change-password — any authenticated user
  @Post('me/change-password')
  changePassword(
    @Request() req,
    @Body() body: { current_password: string; new_password: string },
  ) {
    return this.usersService.changePassword(
      req.user.id,
      body.current_password,
      body.new_password,
    );
  }

  // GET /users — admin only
  @Get()
  @UseGuards(RolesGuard)
  @Roles('admin')
  findAll() {
    return this.usersService.findAll();
  }

  // GET /users/:id — admin only
  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  // GET /users/:id/profile — internal API only
  @Get(':id/profile')
  @Public()
  @UseGuards(InternalApiGuard)
  getProfile(@Param('id') id: string) {
    return this.usersService.getProfile(id);
  }

  // POST /users — admin only
  @Post()
  @UseGuards(RolesGuard)
  @Roles('admin')
  create(@Body() dto: CreateUserDto, @Request() req) {
    return this.usersService.create(dto, req.user.id);
  }

  // POST /users/bulk — admin only
  @Post('bulk')
  @UseGuards(RolesGuard)
  @Roles('admin')
  createBulk(@Body() dto: BulkCreateUserDto, @Request() req) {
    return this.usersService.createBulk(dto, req.user.id);
  }

  // PATCH /users/:id — admin only
  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  update(@Param('id') id: string, @Body() dto: UpdateUserDto, @Request() req) {
    return this.usersService.update(id, dto, req.user.id);
  }

  // DELETE /users/:id — admin only
  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  delete(@Param('id') id: string, @Request() req) {
    return this.usersService.delete(id, req.user.id);
  }

  // POST /users/:id/app-access — admin only
  @Post(':id/app-access')
  @UseGuards(RolesGuard)
  @Roles('admin')
  assignAppAccess(
    @Param('id') userId: string,
    @Body() dto: AssignAppAccessDto,
    @Request() req,
  ) {
    return this.usersService.assignAppAccess(userId, dto, req.user.id);
  }

  // GET /users/:id/app-access — admin only
  @Get(':id/app-access')
  @UseGuards(RolesGuard)
  @Roles('admin')
  getAppAccess(@Param('id') userId: string) {
    return this.usersService.getAppAccess(userId);
  }

  // POST /users/from-app — internal API only
  @Post('from-app')
  @Public()
  @UseGuards(InternalApiGuard)
  createFromApp(@Body() dto: CreateFromAppDto) {
    return this.usersService.createFromApp(dto);
  }

  // POST /users/sync-all — admin only
  @Post('sync-all')
  @UseGuards(RolesGuard)
  @Roles('admin')
  syncAll(@Request() req) {
    return this.usersService.syncAll(req.user.id);
  }
}

