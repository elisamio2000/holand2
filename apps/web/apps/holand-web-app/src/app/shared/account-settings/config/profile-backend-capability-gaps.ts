export type ProfileBackendGapPriority = 'P0' | 'P1' | 'P2';

export type ProfileUiSurface = 'profile' | 'avatar' | 'personal' | 'password';

export interface ProfileBackendCapabilityGap {
  id: string;
  capability: string;
  feWorkaround: string;
  requiredApi: string;
  feRequest: string;
  expectedResponse: string;
  acceptance: string;
  priority: ProfileBackendGapPriority;
  uiSurface: ProfileUiSurface;
  resolved?: boolean;
}

export function profileGapI18nKey(id: string) {
  return `account.devRequirements.gaps.${id}`;
}

export const PROFILE_BACKEND_CAPABILITY_GAPS: ProfileBackendCapabilityGap[] = [
  {
    id: 'avatar-url-upload',
    capability: 'Persist uploaded avatar_url on user profile',
    feWorkaround:
      'Client uploads image through gateway endpoint and stores returned avatar_url',
    requiredApi: 'UserUpdate.avatar_url: str | null (http/https path)',
    feRequest: `PATCH /admin/users/{user_id}
{
  "display_name": "Alex",
  "email": "user@example.com",
  "avatar_url": "https://cdn.example.com/avatars/user-123.png"
}`,
    expectedResponse: `HTTP 200
{
  "id": "user-uuid",
  "avatar_url": "https://cdn.example.com/avatars/user-123.png"
}`,
    acceptance:
      'PATCH with uploaded URL returns 200 and GET /auth/me returns same avatar_url',
    priority: 'P0',
    uiSurface: 'avatar',
  },
  {
    id: 'avatar-url-text-column',
    capability: 'DB column supports standard avatar URL length',
    feWorkaround: 'None — Save fails with HTTP 422 today',
    requiredApi: 'users.avatar_url VARCHAR/TEXT for standard URL sizes',
    feRequest: 'Auth Service UserUpdate + DB migration',
    expectedResponse: 'Stores regular uploaded/avatar CDN URLs without validation error',
    acceptance: 'No 422 on valid avatar URLs',
    priority: 'P0',
    uiSurface: 'avatar',
  },
  {
    id: 'userupdate-display-name',
    capability: 'Gateway forwards display_name on PATCH /admin/users/{id}',
    feWorkaround: 'Field wired; depends on gateway UserUpdate schema',
    requiredApi: 'UserUpdate.display_name?: string | null',
    feRequest: `PATCH /admin/users/{user_id}
{ "display_name": "Alex" }`,
    expectedResponse: '200 with updated display_name in response and GET /auth/me',
    acceptance: 'display_name persists and appears in session after save',
    priority: 'P1',
    uiSurface: 'profile',
  },
  {
    id: 'personal-info-extended-fields',
    capability: 'Extended personal profile fields',
    feWorkaround: 'Orange dashed placeholder blocks in My Details tab',
    requiredApi: 'UserUpdate: country, timezone, bio, portfolios',
    feRequest: 'PATCH /users/{id} with extended profile fields',
    expectedResponse: '200 with all profile fields persisted',
    acceptance: 'My Details form saves country/timezone/bio without dev placeholders',
    priority: 'P2',
    uiSurface: 'personal',
  },
  {
    id: 'profile-extended-fields',
    capability: 'Website, bio, job title, alt email on profile tab',
    feWorkaround: 'Fields removed from UI — not in UserUpdate schema',
    requiredApi: 'UserUpdate: website, bio, job_title, alt_email',
    feRequest: 'PATCH /admin/users/{id} with extended fields',
    expectedResponse: '200 with extended profile metadata',
    acceptance: 'Profile tab can expose fields without dev warnings',
    priority: 'P2',
    uiSurface: 'profile',
  },
  {
    id: 'auth-sessions-list',
    capability: 'List active login sessions / devices',
    feWorkaround: 'Logged devices section removed from Password tab',
    requiredApi: 'GET /auth/sessions',
    feRequest: 'GET /auth/sessions → [{ device, ip, last_active, is_current }]',
    expectedResponse: 'Session list for password settings security panel',
    acceptance: 'Password tab can show logged-in devices with revoke action',
    priority: 'P2',
    uiSurface: 'password',
  },
];
