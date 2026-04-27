import { IsEmail, IsString, IsOptional } from 'class-validator';

export class CreateFromAppDto {
  @IsEmail()
  email: string;

  @IsString()
  name: string;

  @IsString()
  password: string;

  @IsOptional()
  @IsString()
  department_slug?: string;

  @IsString()
  app_slug: string; // which app is making this request

  @IsString()
  requested_by_os_user_id: string; // the app admin's OS user id
}
