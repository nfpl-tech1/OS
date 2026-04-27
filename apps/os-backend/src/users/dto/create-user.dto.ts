import {
  IsEmail,
  IsString,
  MinLength,
  IsIn,
  IsOptional,
  IsUUID,
  IsBoolean,
} from 'class-validator';

export class CreateUserDto {
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

  // Required only when user_type = 'client'
  @IsOptional()
  @IsUUID()
  org_id?: string;

  @IsOptional()
  @IsUUID()
  department_id?: string;

  @IsOptional()
  @IsBoolean()
  is_team_lead?: boolean;
}
