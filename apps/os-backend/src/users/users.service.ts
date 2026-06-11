import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';

import { User } from '../database/entities/user.entity';
import { UserType } from '../database/entities/user-type.entity';
import { Application } from '../database/entities/application.entity';
import { UserAppAccess } from '../database/entities/user-app-access.entity';
import { ClientOrganization } from '../database/entities/client-organization.entity';
import { Department } from '../database/entities/department.entity';
import { DepartmentDefaultApp } from '../database/entities/department-default-app.entity';
import { Branch } from '../database/entities/branch.entity';
import { BranchDefaultApp } from '../database/entities/branch-default-app.entity';

import { CreateUserDto } from './dto/create-user.dto';
import { BulkCreateUserDto } from './dto/bulk-create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AssignAppAccessDto } from './dto/assign-app-access.dto';
import { CreateFromAppDto } from './dto/create-from-app.dto';
import { AppAccess } from '../auth/dto/auth-response.dto';
import { WebhookService } from '../common/services/webhook.service';
import { AuditLogService } from '../audit-logs/audit-log.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepo: Repository<User>,
    @InjectRepository(UserType)
    private userTypeRepo: Repository<UserType>,
    @InjectRepository(Application)
    private appRepo: Repository<Application>,
    @InjectRepository(UserAppAccess)
    private accessRepo: Repository<UserAppAccess>,
    @InjectRepository(ClientOrganization)
    private clientOrgRepo: Repository<ClientOrganization>,
    @InjectRepository(Department)
    private deptRepo: Repository<Department>,
    @InjectRepository(DepartmentDefaultApp)
    private deptDefaultAppRepo: Repository<DepartmentDefaultApp>,
    @InjectRepository(Branch)
    private branchRepo: Repository<Branch>,
    @InjectRepository(BranchDefaultApp)
    private branchDefaultAppRepo: Repository<BranchDefaultApp>,
    private webhookService: WebhookService,
    private auditLog: AuditLogService,
  ) {}

  // ─── Get current user + allowed apps ─────────────────────────────
  async getMe(userId: string) {
    const user = await this.usersRepo.findOne({
      where: { id: userId, status: 'active' },
      relations: ['userType', 'department', 'organization', 'branch'],
    });
    if (!user) throw new NotFoundException('User not found');

    // Admins have unrestricted access to all active apps
    if (user.userType.slug === 'admin') {
      const allApps = await this.appRepo.find({ where: { is_active: true }, order: { name: 'ASC' } });
      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          user_type: user.userType.slug,
          org_id: null,
          department_id: user.department?.id ?? null,
          department_slug: user.department?.slug ?? null,
          department_name: user.department?.name ?? null,
          branch_id: user.branch?.id ?? null,
          branch_slug: user.branch?.slug ?? null,
          branch_name: user.branch?.name ?? null,
        },
        allowed_apps: allApps.map((a) => ({
          slug: a.slug,
          name: a.name,
          url: a.url,
          icon_url: a.icon_url,
        })) as AppAccess[],
      };
    }

    const access = await this.accessRepo.find({
      where: { user: { id: userId }, is_enabled: true },
      relations: ['application'],
    });

    const allowed_apps: AppAccess[] = access
      .filter((a) => a.application.is_active)
      .map((a) => ({
        slug: a.application.slug as any,
        name: a.application.name,
        url: a.application.url,
        icon_url: a.application.icon_url,
      }));

    const org_id = user.organization?.id ?? null;

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        user_type: user.userType.slug,
        org_id,
        department_id: user.department?.id ?? null,
        department_slug: user.department?.slug ?? null,
        department_name: user.department?.name ?? null,
        branch_id: user.branch?.id ?? null,
        branch_slug: user.branch?.slug ?? null,
        branch_name: user.branch?.name ?? null,
      },
      allowed_apps,
    };
  }

  // ─── List all users ───────────────────────────────────────────────
  async findAll() {
    const users = await this.usersRepo.find({
      relations: ['userType', 'organization', 'department', 'branch'],
      order: { created_at: 'DESC' },
    });

    return users.map((u) => this.sanitize(u));
  }

  // ─── Get single user ──────────────────────────────────────────────
  async findOne(id: string) {
    const user = await this.usersRepo.findOne({
      where: { id },
      relations: ['userType', 'appAccess', 'appAccess.application', 'organization', 'department', 'branch'],
    });
    if (!user) throw new NotFoundException('User not found');
    return this.sanitize(user);
  }

  // ─── Raw entity lookup (used by verify-session — no sanitize, no throw) ──
  async findRaw(id: string) {
    return this.usersRepo.findOne({ where: { id } });
  }

  // ─── Create user ──────────────────────────────────────────────────
  async create(dto: CreateUserDto, createdById: string) {
    const existing = await this.usersRepo.findOne({
      where: { email: dto.email },
    });
    if (existing) throw new ConflictException('Email already in use');

    const userType = await this.userTypeRepo.findOne({
      where: { slug: dto.user_type },
    });
    if (!userType) throw new BadRequestException('Invalid user type');

    if (dto.user_type === 'client' && !dto.org_id) {
      throw new BadRequestException('org_id is required for client users');
    }
    if (dto.user_type !== 'client' && !dto.department_id) {
      throw new BadRequestException('department_id is required for internal users');
    }

    const password_hash = await bcrypt.hash(dto.password, 10);

    const user = this.usersRepo.create({
      email: dto.email,
      password_hash,
      name: dto.name,
      userType,
      status: 'active',
      is_team_lead: dto.is_team_lead ?? false,
      company_email: dto.company_email ?? null,
    });

    if (dto.department_id) {
      user.department = await this.findDepartmentOrThrow(dto.department_id);
    }
    if (dto.branch_id) {
      user.branch = await this.findBranchOrThrow(dto.branch_id);
    }

    // Link client user to organization via direct FK
    if (dto.user_type === 'client' && dto.org_id) {
      const org = await this.clientOrgRepo.findOne({
        where: { id: dto.org_id },
      });
      if (!org) throw new NotFoundException('Client organization not found');
      user.organization = org;
    }

    const saved = await this.usersRepo.save(user);

    this.auditLog.log({
      actor_id: createdById,
      action: 'user.created',
      entity_type: 'user',
      entity_id: saved.id,
      after: { email: saved.email, name: saved.name, user_type: dto.user_type },
    }).catch(() => {});

    // Auto-assign department default apps
    if (user.department) {
      const defaultApps = await this.deptDefaultAppRepo.find({
        where: { department: { id: user.department.id } },
        relations: ['application'],
      });
      for (const defaultApp of defaultApps) {
        const already = await this.accessRepo.findOne({
          where: { user: { id: saved.id }, application: { id: defaultApp.application.id } },
        });
        if (!already) {
          await this.accessRepo.save({
            user: saved,
            application: defaultApp.application,
            is_enabled: true,
            is_app_admin: false,
            granted_by: createdById,
          });
        }
      }
    }

    // Auto-assign branch default apps
    if (user.branch) {
      const branchDefaultApps = await this.branchDefaultAppRepo.find({
        where: { branch: { id: user.branch.id } },
        relations: ['application'],
      });
      for (const defaultApp of branchDefaultApps) {
        const already = await this.accessRepo.findOne({
          where: { user: { id: saved.id }, application: { id: defaultApp.application.id } },
        });
        if (!already) {
          await this.accessRepo.save({
            user: saved,
            application: defaultApp.application,
            is_enabled: true,
            is_app_admin: false,
            granted_by: createdById,
          });
        }
      }
    }

    this.webhookService.notifyApps(saved.id, saved.email, 'user.created', {
      name: saved.name,
      company_email: saved.company_email,
      user_type: userType.slug,
      department_slug: saved.department?.slug ?? null,
      branch_slug: saved.branch?.slug ?? null,
      org_id: saved.organization?.id ?? null,
    }).catch(() => {});

    return this.sanitize(saved);
  }

  // ─── Update user ──────────────────────────────────────────────────
  async update(id: string, dto: UpdateUserDto, requesterId: string) {
    if (dto.status === 'disabled' && id === requesterId) {
      throw new BadRequestException('You cannot deactivate your own account');
    }
    const user = await this.usersRepo.findOne({
      where: { id },
      relations: ['userType', 'department', 'organization'],
    });
    if (!user) throw new NotFoundException('User not found');

    const before = { name: user.name, email: user.email, status: user.status, is_team_lead: user.is_team_lead };

    if (dto.name !== undefined) user.name = dto.name;
    if (dto.status !== undefined) user.status = dto.status;
    if (dto.is_team_lead !== undefined) user.is_team_lead = dto.is_team_lead;
    if (dto.company_email !== undefined) user.company_email = dto.company_email;

    if (dto.email !== undefined && dto.email !== user.email) {
      const taken = await this.usersRepo.findOne({ where: { email: dto.email } });
      if (taken) throw new ConflictException('Email already in use');
      user.email = dto.email;
    }

    if (dto.password !== undefined) {
      user.password_hash = await bcrypt.hash(dto.password, 10);
    }

    if (dto.department_id !== undefined) {
      if (dto.department_id === null) {
        if (user.userType?.slug !== 'client') {
          throw new BadRequestException(
            'Internal users must have a department assigned',
          );
        }
        user.department = null;
      } else {
        user.department = await this.findDepartmentOrThrow(dto.department_id);
      }
    }

    if (dto.branch_id !== undefined) {
      if (dto.branch_id === null) {
        user.branch = null;
      } else {
        user.branch = await this.findBranchOrThrow(dto.branch_id);
      }
    }

    const saved = await this.usersRepo.save(user);

    const after = { name: saved.name, email: saved.email, status: saved.status, is_team_lead: saved.is_team_lead };
    this.auditLog.log({
      actor_id: requesterId,
      action: 'user.updated',
      entity_type: 'user',
      entity_id: id,
      before,
      after,
    }).catch(() => {});
    if (dto.status !== undefined && dto.status !== before.status) {
      this.auditLog.log({
        actor_id: requesterId,
        action: 'user.status.changed',
        entity_type: 'user',
        entity_id: id,
        before: { status: before.status },
        after: { status: saved.status },
      }).catch(() => {});
    }

    // Re-fetch with full relations for webhook payload and return value
    const full = (await this.usersRepo.findOne({
      where: { id: saved.id },
      relations: ['userType', 'department', 'organization', 'branch'],
    }))!;

    // Fire webhook if status changed (lifecycle events)
    if (dto.status !== undefined) {
      const event = dto.status === 'active' ? 'user.reactivated' : 'user.deactivated';
      this.webhookService.notifyApps(id, full.email, event).catch(() => {});
    }

    // Always fire user.updated so apps can sync name/department/org changes
    this.webhookService.notifyApps(id, full.email, 'user.updated', {
      name: full.name,
      company_email: full.company_email,
      user_type: full.userType?.slug ?? '',
      department_slug: full.department?.slug ?? null,
      branch_slug: full.branch?.slug ?? null,
      org_id: full.organization?.id ?? null,
      status: full.status,
    }).catch(() => {});

    return this.sanitize(full);
  }

  // ─── Change own password ──────────────────────────────────────────
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ) {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) throw new BadRequestException('Current password is incorrect');

    user.password_hash = await bcrypt.hash(newPassword, 10);
    await this.usersRepo.save(user);

    return { message: 'Password changed successfully' };
  }

  // ─── Assign / revoke app access ───────────────────────────────────
  async assignAppAccess(
    userId: string,
    dto: AssignAppAccessDto,
    grantedById: string,
  ) {
    if (userId === grantedById) {
      throw new BadRequestException('You cannot manage your own app access');
    }
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const app = await this.appRepo.findOne({
      where: { slug: dto.app_slug, is_active: true },
    });
    if (!app) throw new NotFoundException('Application not found');

    const existing = await this.accessRepo.findOne({
      where: {
        user: { id: userId },
        application: { id: app.id },
      },
    });

    if (existing) {
      existing.is_enabled = dto.is_enabled;
      existing.is_app_admin = dto.is_app_admin ?? existing.is_app_admin ?? false;
      await this.accessRepo.save(existing);
    } else {
      await this.accessRepo.save({
        user,
        application: app,
        is_enabled: dto.is_enabled,
        is_app_admin: dto.is_app_admin ?? false,
        granted_by: grantedById,
      });
    }

    this.auditLog.log({
      actor_id: grantedById,
      action: dto.is_enabled ? 'app_access.granted' : 'app_access.revoked',
      entity_type: 'user',
      entity_id: userId,
      after: { app_slug: dto.app_slug, is_enabled: dto.is_enabled },
    }).catch(() => {});

    // Notify the specific app when its access is revoked
    if (!dto.is_enabled) {
      this.webhookService.notifyApps(
        userId,
        user.email,
        'user.app_access_revoked',
        { app_slug: dto.app_slug },
        dto.app_slug,
      ).catch(() => {});
    }

    return {
      message: `Access to ${app.name} ${dto.is_enabled ? 'granted' : 'revoked'}`,
    };
  }

  // ─── Get app access list for a user ──────────────────────────────
  async getAppAccess(userId: string) {
    const access = await this.accessRepo.find({
      where: { user: { id: userId } },
      relations: ['application'],
    });

    return access.map((a) => ({
      app_slug: a.application.slug,
      app_name: a.application.name,
      is_enabled: a.is_enabled,
      is_app_admin: a.is_app_admin,
      granted_at: a.granted_at,
    }));
  }

  // ─── Delete user ──────────────────────────────────────────────────
  async delete(id: string, requesterId: string) {
    if (id === requesterId) {
      throw new BadRequestException('You cannot delete your own account');
    }
    const user = await this.usersRepo.findOne({
      where: { id },
      relations: ['userType'],
    });
    if (!user) throw new NotFoundException('User not found');
    if (user.userType?.slug === 'admin') {
      throw new BadRequestException('Admin accounts cannot be deleted');
    }

    // Notify all apps BEFORE deleting (access records still exist at this point)
    await this.webhookService.notifyApps(id, user.email, 'user.deleted');

    // Remove FK-constrained child rows before deleting the user
    await this.accessRepo.delete({ user: { id } });

    await this.usersRepo.remove(user);

    this.auditLog.log({
      actor_id: requesterId,
      action: 'user.deleted',
      entity_type: 'user',
      entity_id: id,
      before: { email: user.email, name: user.name },
    }).catch(() => {});

    return { message: 'User deleted' };
  }

  // ─── Strip password_hash before returning ────────────────────────
  private sanitize(user: User) {
    const { password_hash, ...safe } = user as any;
    return safe;
  }

  // ─── Get full profile (for internal API) ─────────────────────────
  async getProfile(id: string) {
    const user = await this.usersRepo.findOne({
      where: { id },
      relations: ['userType', 'department', 'organization', 'branch'],
    });
    if (!user) throw new NotFoundException('User not found');
    return {
      id: user.id,
      email: user.email,
      company_email: user.company_email,
      name: user.name,
      user_type: user.userType.slug,
      status: user.status,
      department_id: user.department?.id ?? null,
      department_slug: user.department?.slug ?? null,
      department_name: user.department?.name ?? null,
      branch_id: user.branch?.id ?? null,
      branch_slug: user.branch?.slug ?? null,
      branch_name: user.branch?.name ?? null,
      org_id: user.organization?.id ?? null,
      org_name: user.organization?.name ?? null,
    };
  }

  // ─── Create user from an app (for internal API) ───────────────────
  async createFromApp(dto: CreateFromAppDto) {
    // Check if user already exists by email
    let user = await this.usersRepo.findOne({ where: { email: dto.email } });

    if (!user) {
      const employeeType = await this.userTypeRepo.findOne({
        where: { slug: 'employee' },
      });
      const department = dto.department_slug
        ? await this.deptRepo.findOne({ where: { slug: dto.department_slug } })
        : null;

      const password_hash = await bcrypt.hash(dto.password, 10);
      user = this.usersRepo.create({
        email: dto.email,
        name: dto.name,
        password_hash,
        userType: employeeType!,
        department: department ?? undefined,
        status: 'active',
      });
      user = await this.usersRepo.save(user);
    }

    // Grant access to the requesting app (is_app_admin = false by default)
    const app = await this.appRepo.findOne({ where: { slug: dto.app_slug } });
    if (app) {
      const exists = await this.accessRepo.findOne({
        where: { user: { id: user.id }, application: { id: app.id } },
      });
      if (!exists) {
        await this.accessRepo.save({
          user,
          application: app,
          is_enabled: true,
          is_app_admin: false,
          granted_by: dto.requested_by_os_user_id,
        });
      }
    }

    return { os_user_id: user.id, email: user.email, name: user.name };
  }

  // ─── List active departments ──────────────────────────────────────
  async getDepartments() {
    const depts = await this.deptRepo.find({
      where: { status: 'active' },
      relations: ['defaultApps', 'defaultApps.application'],
    });
    return depts.map((d) => ({
      id: d.id,
      slug: d.slug,
      name: d.name,
      default_apps: d.defaultApps?.map((da) => ({
        id: da.application.id,
        slug: da.application.slug,
        name: da.application.name,
      })) ?? [],
    }));
  }

  // ─── Create department ────────────────────────────────────────────
  async createDepartment(name: string, actorId: string) {
    const slug = name
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
    const existing = await this.deptRepo.findOne({ where: { slug } });
    if (existing)
      throw new ConflictException(
        'A department with this name already exists',
      );
    const saved = await this.deptRepo.save(
      this.deptRepo.create({ name: name.trim(), slug, status: 'active' }),
    );

    this.auditLog.log({
      actor_id: actorId,
      action: 'department.created',
      entity_type: 'department',
      entity_id: saved.id,
      after: { name: saved.name, slug: saved.slug },
    }).catch(() => {});

    this.webhookService.broadcastDepartment('department.created', {
      department_id: saved.id,
      department_slug: saved.slug,
      department_name: saved.name,
    }).catch(() => {});

    return saved;
  }

  // ─── Update department ────────────────────────────────────────────
  async updateDepartment(id: string, name: string, actorId: string) {
    const dept = await this.deptRepo.findOne({ where: { id } });
    if (!dept) throw new NotFoundException('Department not found');
    const oldName = dept.name;
    const oldSlug = dept.slug;
    dept.name = name.trim();
    dept.slug = name.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const slugConflict = await this.deptRepo.findOne({ where: { slug: dept.slug } });
    if (slugConflict && slugConflict.id !== id) {
      throw new ConflictException('A department with this name already exists');
    }
    const saved = await this.deptRepo.save(dept);

    this.auditLog.log({
      actor_id: actorId,
      action: 'department.updated',
      entity_type: 'department',
      entity_id: id,
      before: { name: oldName },
      after: { name: saved.name },
    }).catch(() => {});

    this.webhookService.broadcastDepartment('department.updated', {
      department_id: id,
      department_slug: oldSlug,
      department_name: oldName,
      new_slug: saved.slug,
      new_name: saved.name,
    }).catch(() => {});

    return saved;
  }

  // ─── Delete department ────────────────────────────────────────────
  async deleteDepartment(id: string, actorId: string) {
    const dept = await this.deptRepo.findOne({ where: { id } });
    if (!dept) throw new NotFoundException('Department not found');
    dept.status = 'deleted';
    await this.deptRepo.save(dept);

    this.auditLog.log({
      actor_id: actorId,
      action: 'department.deleted',
      entity_type: 'department',
      entity_id: id,
      before: { name: dept.name, slug: dept.slug },
    }).catch(() => {});

    this.webhookService.broadcastDepartment('department.deleted', {
      department_id: id,
      department_slug: dept.slug,
    }).catch(() => {});

    return { message: 'Department deleted' };
  }

  // ─── Add default app to department ───────────────────────────────
  async addDepartmentDefaultApp(departmentId: string, appId: string, actorId: string) {
    const dept = await this.deptRepo.findOne({ where: { id: departmentId } });
    if (!dept) throw new NotFoundException('Department not found');

    const app = await this.appRepo.findOne({ where: { id: appId } });
    if (!app) throw new NotFoundException('Application not found');

    const existing = await this.deptDefaultAppRepo.findOne({
      where: { department: { id: departmentId }, application: { id: appId } },
    });
    if (!existing) {
      await this.deptDefaultAppRepo.save({ department: dept, application: app });
      this.auditLog.log({
        actor_id: actorId,
        action: 'department.default_app.added',
        entity_type: 'department',
        entity_id: departmentId,
        after: { app_id: appId, app_slug: app.slug },
      }).catch(() => {});
    }

    return this.getDepartmentDefaultApps(departmentId);
  }

  // ─── Remove default app from department ──────────────────────────
  async removeDepartmentDefaultApp(departmentId: string, appId: string, actorId: string) {
    const row = await this.deptDefaultAppRepo.findOne({
      where: { department: { id: departmentId }, application: { id: appId } },
      relations: ['application'],
    });
    if (!row) throw new NotFoundException('Default app mapping not found');
    await this.deptDefaultAppRepo.remove(row);

    this.auditLog.log({
      actor_id: actorId,
      action: 'department.default_app.removed',
      entity_type: 'department',
      entity_id: departmentId,
      before: { app_id: appId, app_slug: row.application?.slug },
    }).catch(() => {});

    return this.getDepartmentDefaultApps(departmentId);
  }

  // ─── Get default apps for department ─────────────────────────────
  async getDepartmentDefaultApps(departmentId: string) {
    const rows = await this.deptDefaultAppRepo.find({
      where: { department: { id: departmentId } },
      relations: ['application'],
    });
    return rows.map((r) => ({
      id: r.application.id,
      slug: r.application.slug,
      name: r.application.name,
    }));
  }

  // ─── List active applications ─────────────────────────────────
  async getApplications() {
    return this.appRepo.find({
      where: { is_active: true },
      select: ['id', 'slug', 'name', 'url', 'icon_url'],
      order: { name: 'ASC' },
    });
  }

  // ─── Bulk create users ───────────────────────────────────────────
  async createBulk(dto: BulkCreateUserDto, createdById: string) {
    const results: { email: string; id: string }[] = [];
    const errors: { email: string; error: string }[] = [];

    const userTypes = await this.userTypeRepo.find();
    const typeMap = new Map(userTypes.map((t) => [t.slug, t]));

    for (const entry of dto.users) {
      try {
        const existing = await this.usersRepo.findOne({
          where: { email: entry.email },
        });
        if (existing) {
          errors.push({ email: entry.email, error: 'Email already in use' });
          continue;
        }

        const userType = typeMap.get(entry.user_type);
        if (!userType) {
          errors.push({ email: entry.email, error: 'Invalid user type' });
          continue;
        }
        if (entry.user_type !== 'client' && !entry.department_id) {
          errors.push({
            email: entry.email,
            error: 'department_id is required for internal users',
          });
          continue;
        }

        const password_hash = await bcrypt.hash(entry.password, 10);
        const user = this.usersRepo.create({
          email: entry.email,
          company_email: entry.company_email,
          password_hash,
          name: entry.name,
          userType,
          status: 'active',
          is_team_lead: entry.is_team_lead ?? false,
        });

        if (entry.department_id) {
          user.department = await this.findDepartmentOrThrow(entry.department_id);
        }
        if (entry.branch_id) {
          user.branch = await this.findBranchOrThrow(entry.branch_id);
        }

        if (entry.user_type === 'client' && entry.org_id) {
          user.organization = await this.clientOrgRepo.findOne({
            where: { id: entry.org_id },
          });
        }

        const saved = await this.usersRepo.save(user);

        // Handle explicit app access from the bulk upload
        const appSlugs = new Set(entry.app_slugs ?? []);
        const adminAppSlugs = new Set(entry.admin_app_slugs ?? []);
        const allAppSlugs = new Set([...appSlugs, ...adminAppSlugs]);

        // Assign branch default apps
        if (user.branch) {
          const branchDefaultApps = await this.branchDefaultAppRepo.find({
            where: { branch: { id: user.branch.id } },
            relations: ['application'],
          });
          for (const defaultApp of branchDefaultApps) {
            if (!allAppSlugs.has(defaultApp.application.slug)) {
              allAppSlugs.add(defaultApp.application.slug);
            }
          }
        }

        for (const slug of allAppSlugs) {
          const app = await this.appRepo.findOne({
            where: { slug, is_active: true },
          });
          if (app) {
            await this.accessRepo.save({
              user: saved,
              application: app,
              is_enabled: true,
              is_app_admin: adminAppSlugs.has(slug),
              granted_by: createdById,
            });
          }
        }

        // Fire audit log
        this.auditLog
          .log({
            actor_id: createdById,
            action: 'user.created',
            entity_type: 'user',
            entity_id: saved.id,
            after: {
              email: saved.email,
              name: saved.name,
              user_type: entry.user_type,
            },
          })
          .catch(() => {});

        // Fire webhook
        this.webhookService
          .notifyApps(saved.id, saved.email, 'user.created', {
            name: saved.name,
            user_type: userType.slug,
            department_slug: saved.department?.slug ?? null,
            branch_slug: saved.branch?.slug ?? null,
            org_id: saved.organization?.id ?? null,
          })
          .catch(() => {});

        results.push({ email: saved.email, id: saved.id });
      } catch (err: any) {
        errors.push({ email: entry.email, error: err.message });
      }
    }

    return { results, errors };
  }

  // ─── Broadcast all data to apps ──────────────────────────────────
  async syncAll(actorId: string) {
    const departments = await this.deptRepo.find({ where: { status: 'active' } });
    
    for (const d of departments) {
      await this.webhookService.broadcastDepartment('department.created', {
        department_id: d.id,
        department_slug: d.slug,
        department_name: d.name,
      });
    }

    this.auditLog.log({
      actor_id: actorId,
      action: 'system.sync_all',
      entity_type: 'system',
      entity_id: 'global',
      after: { department_count: departments.length },
    }).catch(() => {});

    return { message: 'Sync broadcast initiated', departments: departments.length };
  }

  private async findDepartmentOrThrow(departmentId: string) {
    const department = await this.deptRepo.findOne({
      where: { id: departmentId },
    });
    if (!department) {
      throw new NotFoundException('Department not found');
    }
    return department;
  }

  private async findBranchOrThrow(branchId: string) {
    const branch = await this.branchRepo.findOne({
      where: { id: branchId },
    });
    if (!branch) {
      throw new NotFoundException('Branch not found');
    }
    return branch;
  }
}
