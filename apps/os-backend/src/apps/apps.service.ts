import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { join } from 'path';
import * as fs from 'fs';
import { Application } from '../database/entities/application.entity';
import { UserAppAccess } from '../database/entities/user-app-access.entity';
import { UpdateAppDto } from './dto/update-app.dto';
import { CreateAppDto } from './dto/create-app.dto';

@Injectable()
export class AppsService {
  constructor(
    @InjectRepository(Application)
    private appRepo: Repository<Application>,
    @InjectRepository(UserAppAccess)
    private accessRepo: Repository<UserAppAccess>,
  ) {}

  findAll() {
    return this.appRepo.find({ order: { name: 'ASC' } });
  }

  async create(dto: CreateAppDto) {
    const existing = await this.appRepo.findOne({ where: { slug: dto.slug } });
    if (existing) throw new ConflictException('An application with this slug already exists');
    const app = this.appRepo.create({
      slug: dto.slug,
      name: dto.name,
      url: dto.url,
      is_active: dto.is_active ?? true,
      icon_url: null,
      webhook_url: dto.webhook_url ?? null,
    });
    return this.appRepo.save(app);
  }

  async update(id: string, dto: UpdateAppDto) {
    const app = await this.appRepo.findOne({ where: { id } });
    if (!app) throw new NotFoundException('Application not found');

    if (dto.name !== undefined) app.name = dto.name;
    if (dto.url !== undefined) app.url = dto.url;
    if (dto.is_active !== undefined) app.is_active = dto.is_active;
    if (dto.icon_url !== undefined) app.icon_url = dto.icon_url;
    if (dto.webhook_url !== undefined) app.webhook_url = dto.webhook_url;

    return this.appRepo.save(app);
  }

  async remove(id: string) {
    const app = await this.appRepo.findOne({ where: { id } });
    if (!app) throw new NotFoundException('Application not found');

    if (app.icon_url) {
      try {
        const filename = app.icon_url.split('/').pop()!;
        const imagePath = join(process.cwd(), 'uploads', 'app-images', filename);
        if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
      } catch {
        // Ignore image cleanup failures and continue deleting the record.
      }
    }

    await this.accessRepo.delete({ application: { id } });
    await this.appRepo.remove(app);

    return { message: 'Application deleted' };
  }

  async uploadImage(id: string, file: Express.Multer.File) {
    const app = await this.appRepo.findOne({ where: { id } });
    if (!app) {
      fs.unlinkSync(file.path);
      throw new NotFoundException('Application not found');
    }
    // Delete old image file if it exists on disk
    if (app.icon_url) {
      try {
        const filename = app.icon_url.split('/').pop()!;
        const oldPath = join(process.cwd(), 'uploads', 'app-images', filename);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      } catch { /* ignore */ }
    }
    app.icon_url = `/api/uploads/app-images/${file.filename}`;
    return this.appRepo.save(app);
  }
}
