import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClientOrganization } from '../database/entities/client-organization.entity';

export interface CreateOrganizationDto {
  name: string;
  country?: string;
}

export interface UpdateOrganizationDto {
  name?: string;
  country?: string;
}

@Injectable()
export class OrganizationsService {
  constructor(
    @InjectRepository(ClientOrganization)
    private readonly orgRepo: Repository<ClientOrganization>,
  ) {}

  async findAll() {
    return this.orgRepo.find({
      where: { is_active: true },
      order: { name: 'ASC' },
    });
  }

  async findOne(id: string): Promise<ClientOrganization> {
    const org = await this.orgRepo.findOne({ where: { id, is_active: true } });
    if (!org) throw new NotFoundException('Organization not found');
    return org;
  }

  async create(dto: CreateOrganizationDto): Promise<ClientOrganization> {
    const existing = await this.orgRepo.findOne({ where: { name: dto.name } });
    if (existing) throw new ConflictException('An organization with this name already exists');
    return this.orgRepo.save(this.orgRepo.create({ name: dto.name.trim(), country: dto.country ?? undefined }));
  }

  async update(id: string, dto: UpdateOrganizationDto): Promise<ClientOrganization> {
    const org = await this.findOne(id);
    if (dto.name !== undefined) org.name = dto.name.trim();
    if (dto.country !== undefined) org.country = dto.country;
    return this.orgRepo.save(org);
  }

  async disable(id: string): Promise<{ message: string }> {
    const org = await this.findOne(id);
    org.is_active = false;
    await this.orgRepo.save(org);
    return { message: 'Organization disabled' };
  }
}
