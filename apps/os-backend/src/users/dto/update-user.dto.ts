import { IsString, IsBoolean, IsOptional, IsUUID, IsIn, IsEmail, MinLength } from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsEmail()
  company_email?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @IsOptional()
  @IsIn(['active', 'disabled', 'deleted'])
  status?: 'active' | 'disabled' | 'deleted';

  @IsOptional()
  @IsUUID()
  department_id?: string;

  @IsOptional()
  @IsBoolean()
  is_team_lead?: boolean;
}
