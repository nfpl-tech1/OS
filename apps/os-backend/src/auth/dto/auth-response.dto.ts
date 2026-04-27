export interface AppAccess {
  slug: string;
  name: string;
  url: string;
  icon_url: string;
}

export class AuthResponseDto {
  user: {
    id: string;
    email: string;
    name: string;
    user_type: string;
    org_id: string | null;
  };
  allowed_apps: AppAccess[];
}
