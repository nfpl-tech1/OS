import { IsEmail, IsString } from 'class-validator';

export class VerifyPasswordDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;

  @IsString()
  app_slug: string; // which app is requesting verification
}
