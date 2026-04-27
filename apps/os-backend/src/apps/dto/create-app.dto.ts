import { IsString, IsBoolean, IsOptional, Matches } from 'class-validator';

export class CreateAppDto {
  @IsString()
  @Matches(/^[a-z0-9-]+$/, { message: 'Slug must be lowercase alphanumeric with dashes only' })
  slug: string;

  @IsString()
  name: string;

  @IsString()
  url: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsString()
  webhook_url?: string | null;
}
