// 관리자 전용 API 클라이언트. 일반 사용자 API(`api.ts`)와 **토큰도 저장소도 분리한다.**

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// sessionStorage 를 쓴다. 관리자 세션은 탭을 닫으면 끝나는 편이 맞다 —
// 이 토큰 하나로 모든 그룹을 만들고 볼 수 있다.
const TOKEN_KEY = 'admin_token';

export function getAdminToken(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(TOKEN_KEY);
}

// sessionStorage 는 React 밖의 저장소다. 화면이 `useSyncExternalStore` 로 읽을 수 있게
// 구독 지점을 여기 둔다. `storage` 이벤트는 **다른 탭에서만** 오므로, 같은 탭의 변경은
// 우리가 직접 알린다.
type Listener = () => void;
const listeners = new Set<Listener>();

function notifyTokenChanged() {
  listeners.forEach(listener => listener());
}

export function subscribeAdminToken(listener: Listener): () => void {
  listeners.add(listener);
  window.addEventListener('storage', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}

export function clearAdminToken() {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(TOKEN_KEY);
  notifyTokenChanged();
}

export interface AdminScope {
  groupId: string;
  groupName: string;
}

/**
 * 그룹 관리자면 자기 그룹, 전체 관리자면 `null`.
 *
 * **토큰에서 직접 읽는다.** 권한과 표시를 따로 저장했더니 로그인 직후 한 번,
 * 화면은 "전체 관리자" 인데 데이터는 그룹 범위인 상태가 나왔다. 출처를 하나로 두면
 * 그 어긋남이 생길 자리가 없다. 서명은 검증하지 않는다 — 실제 권한은 서버가 토큰을
 * 다시 열어 판단하고, 여기서 읽는 값은 화면 표시일 뿐이다.
 */
export function adminScopeOf(token: string | null): AdminScope | null {
  if (!token) return null;
  const payload = token.split('.')[1];
  if (!payload) return null;
  try {
    const claims = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    if (claims.scope !== 'group_admin') return null;
    return { groupId: String(claims.group_id), groupName: String(claims.group_name ?? '') };
  } catch {
    return null;
  }
}

/** 관리자 토큰이 죽었을 때 던진다. 화면은 이걸 보고 로그인 폼으로 돌아간다. */
export class AdminAuthError extends Error {}

async function adminRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getAdminToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      // 관리자 키 원문은 절대 브라우저에 두지 않는다. 토큰만 보낸다.
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (res.status === 403 || res.status === 401) {
    clearAdminToken();
    throw new AdminAuthError('관리자 세션이 만료되었습니다. 다시 인증해 주세요.');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || '요청 실패');
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

/** 관리자 키를 **한 번만** 보내 토큰으로 바꾼다. 키는 여기서 버려진다. */
export async function adminLogin(adminKey: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ admin_key: adminKey }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || '관리자 인증에 실패했습니다.');
  }
  const data: { access_token: string } = await res.json();
  sessionStorage.setItem(TOKEN_KEY, data.access_token);
  notifyTokenChanged();
}

export interface AdminGroup {
  id: string;
  name: string;
  is_active: boolean;
  /** 그룹 관리자 인증키. **전체 관리자에게만** 내려온다. */
  admin_code: string | null;
}

export interface AdminUser {
  id: string;
  group_id: string;
  display_name: string;
  invite_code: string;
}

export async function listGroups(): Promise<AdminGroup[]> {
  return adminRequest<AdminGroup[]>('/api/admin/groups');
}

export async function createGroup(name: string): Promise<AdminGroup> {
  return adminRequest<AdminGroup>('/api/admin/groups', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export async function listUsers(): Promise<AdminUser[]> {
  return adminRequest<AdminUser[]>('/api/admin/users');
}

export async function createUser(
  groupId: string,
  displayName: string,
  inviteCode?: string,
): Promise<AdminUser> {
  return adminRequest<AdminUser>('/api/admin/users', {
    method: 'POST',
    body: JSON.stringify({
      group_id: groupId,
      display_name: displayName,
      // 비우면 서버가 만들어 준다. 사람이 고른 코드보다 그쪽이 낫다.
      ...(inviteCode ? { invite_code: inviteCode } : {}),
    }),
  });
}

export async function regenerateInviteCode(userId: string): Promise<AdminUser> {
  return adminRequest<AdminUser>(`/api/admin/users/${userId}/invite-code`, { method: 'POST' });
}

export async function deactivateGroup(groupId: string): Promise<AdminGroup> {
  return adminRequest<AdminGroup>(`/api/admin/groups/${groupId}/deactivate`, { method: 'POST' });
}

export async function restoreGroup(groupId: string): Promise<AdminGroup> {
  return adminRequest<AdminGroup>(`/api/admin/groups/${groupId}/restore`, { method: 'POST' });
}

export async function regenerateGroupAdminCode(groupId: string): Promise<AdminGroup> {
  return adminRequest<AdminGroup>(`/api/admin/groups/${groupId}/admin-code`, { method: 'POST' });
}
