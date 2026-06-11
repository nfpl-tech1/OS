import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Branch } from '../database/entities/branch.entity';
import { BranchDefaultApp } from '../database/entities/branch-default-app.entity';
import { Application } from '../database/entities/application.entity';

@Injectable()
export class BranchesService {
  constructor(
    @InjectRepository(Branch)
    private branchRepo: Repository<Branch>,
    @InjectRepository(BranchDefaultApp)
    private branchDefaultAppRepo: Repository<BranchDefaultApp>,
    @InjectRepository(Application)
    private appRepo: Repository<Application>,
  ) {}

  async getBranches() {
    return this.branchRepo.find({
      where: { status: 'active' },
      order: { name: 'ASC' },
    });
  }

  async createBranch(name: string) {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const existing = await this.branchRepo.findOne({ where: { slug } });
    if (existing) {
      if (existing.status === 'deleted') {
        existing.status = 'active';
        existing.name = name;
        return this.branchRepo.save(existing);
      }
      throw new BadRequestException('A branch with this name already exists');
    }

    const branch = this.branchRepo.create({ name, slug, is_active: true, status: 'active' });
    return this.branchRepo.save(branch);
  }

  async updateBranch(id: string, name: string) {
    const branch = await this.branchRepo.findOne({ where: { id, status: 'active' } });
    if (!branch) throw new NotFoundException('Branch not found');

    const newSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    if (newSlug !== branch.slug) {
      const existing = await this.branchRepo.findOne({ where: { slug: newSlug } });
      if (existing && existing.id !== id) {
        throw new BadRequestException('A branch with this name already exists');
      }
      branch.slug = newSlug;
    }
    branch.name = name;
    return this.branchRepo.save(branch);
  }

  async deleteBranch(id: string) {
    const branch = await this.branchRepo.findOne({ where: { id, status: 'active' } });
    if (!branch) throw new NotFoundException('Branch not found');
    branch.status = 'deleted';
    branch.is_active = false;
    await this.branchRepo.save(branch);
    return { success: true };
  }

  async getBranchDefaultApps(id: string) {
    const defaultApps = await this.branchDefaultAppRepo.find({
      where: { branch: { id } },
      relations: ['application'],
    });
    return defaultApps.map(d => ({
      id: d.application.id,
      slug: d.application.slug,
      name: d.application.name,
    }));
  }

  async addDefaultApp(branchId: string, appId: string) {
    const branch = await this.branchRepo.findOne({ where: { id: branchId } });
    if (!branch) throw new NotFoundException('Branch not found');

    const app = await this.appRepo.findOne({ where: { id: appId } });
    if (!app) throw new NotFoundException('App not found');

    const existing = await this.branchDefaultAppRepo.findOne({
      where: { branch: { id: branchId }, application: { id: appId } }
    });
    if (existing) return existing;

    const defaultApp = this.branchDefaultAppRepo.create({ branch, application: app });
    return this.branchDefaultAppRepo.save(defaultApp);
  }

  async removeDefaultApp(branchId: string, appId: string) {
    await this.branchDefaultAppRepo.delete({ branch: { id: branchId }, application: { id: appId } });
    return { success: true };
  }
}
