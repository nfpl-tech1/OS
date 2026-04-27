import { Type } from 'class-transformer';
import {
  IsArray,
  ValidateNested,
  IsString,
  IsOptional,
  IsBoolean,
  IsEmail,
  IsIn,
  IsUUID,
  MinLength,
} from 'class-validator';

export class BulkUserEntry {
  @IsEmail()
  email: string;

  @IsOptional()
  @IsEmail()
  company_email?: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  name: string;

  @IsIn(['employee', 'client'])
  user_type: 'employee' | 'client';

  @IsOptional()
  @IsUUID()
  org_id?: string;

  @IsOptional()
  @IsUUID()
  department_id?: string;

  @IsOptional()
  @IsBoolean()
  is_team_lead?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  app_slugs?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  admin_app_slugs?: string[];
}

export class BulkCreateUserDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkUserEntry)
  users: BulkUserEntry[];
}
