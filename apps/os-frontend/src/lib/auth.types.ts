export interface AppTile {
  slug: string;
  name: string;
  url: string;
  icon_url: string | null;
}

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  user_type: 'admin' | 'employee' | 'client';
  org_id: string | null;
}

export interface AuthState {
  user: CurrentUser | null;
  allowed_apps: AppTile[];
  loading: boolean;
}
