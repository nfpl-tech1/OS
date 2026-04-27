import { IsString, IsBoolean, IsOptional } from 'class-validator';

export class AssignAppAccessDto {
  @IsString()
  app_slug: string;

  @IsBoolean()
  is_enabled: boolean;

  @IsOptional()
  @IsBoolean()
  is_app_admin?: boolean;
}
