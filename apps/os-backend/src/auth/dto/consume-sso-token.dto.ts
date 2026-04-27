import { IsUUID } from 'class-validator';

export class ConsumeSsoTokenDto {
  @IsUUID()
  token_id: string;
}
