import { IsString, IsBoolean, IsOptional } from 'class-validator';

export class UpdateAppDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  url?: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsString()
  icon_url?: string | null;

  @IsOptional()
  @IsString()
  webhook_url?: string | null;
}
