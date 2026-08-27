// 자체 백엔드 API 클라이언트 (Supabase 대체)
const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// ── 토큰 관리 (localStorage + cookie) ─────────────────────────────────────────

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}

// 쿠키 수명은 **서버가 준 만료 시각에서 계산한다.** 예전엔 30일이 하드코딩돼 있어
// TOKEN_EXPIRE_DAYS 를 줄이면 토큰은 죽었는데 쿠키는 살아 있었고, proxy 는 쿠키만 보므로
// 로그인된 화면이 열린 채 데이터만 비어 보였다.
export function setToken(token: string, displayName: string, userId: string, groupId: string, expiresAt: string) {
  localStorage.setItem('token', token);
  localStorage.setItem('display_name', displayName);
  localStorage.setItem('user_id', userId);
  localStorage.setItem('group_id', groupId);
  localStorage.setItem('expires_at', expiresAt);

  const maxAge = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
  // HTTPS 로 서비스할 때는 Secure 를 붙인다. HttpOnly 는 document.cookie 로 심는 이상 불가능하다.
  const secure = typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `token=${token}; path=/; max-age=${maxAge}; SameSite=Lax${secure}`;
}

export function clearToken() {
  localStorage.removeItem('token');
  localStorage.removeItem('display_name');
  localStorage.removeItem('user_id');
  localStorage.removeItem('group_id');
  localStorage.removeItem('expires_at');
  document.cookie = 'token=; path=/; max-age=0';
}

/** 로그인 화면으로 돌려보낼 때 붙이는 표시. 로그인 화면이 이 값을 읽어 안내를 띄운다. */
export const SESSION_EXPIRED_PARAM = 'reason=expired';

/** 서버가 401 을 주면 **그 자리에서 세션을 정리하고 로그인으로 보낸다.**
 *
 *  이걸 안 하면 쿠키가 남아 있어 proxy 가 통과시키고, 화면은 로그인된 모습 그대로인데
 *  모든 요청이 401 이라 "아직 내역이 없습니다" 만 보인다. 콘솔을 열기 전에는 알 수 없다. */
function handleUnauthorized() {
  if (typeof window === 'undefined') return;
  clearToken();
  if (window.location.pathname.startsWith('/login')) return; // 리다이렉트 루프 방지
  window.location.replace(`/login?${SESSION_EXPIRED_PARAM}`);
}

export function getLocalUser() {
  if (typeof window === 'undefined') return null;
  const userId = localStorage.getItem('user_id');
  if (!userId) return null;
  return {
    id: userId,
    group_id: localStorage.getItem('group_id') || '',
    display_name: localStorage.getItem('display_name') || '',
  };
}

// ── HTTP 기본 요청 ─────────────────────────────────────────────────────────────

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    // 로그인 요청의 401 은 "초대 코드가 틀렸다" 라서 세션을 지울 일이 아니다.
    if (res.status === 401 && !path.startsWith('/api/auth/login')) {
      handleUnauthorized();
      throw new Error('세션이 만료되었습니다. 다시 로그인해 주세요.');
    }
    throw new Error(err.detail || '요청 실패');
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export interface AuthUser { id: string; group_id: string; display_name: string; }
// /api/auth/login 응답은 `id`가 아니라 `user_id`를 돌려줌 (backend/app/schemas.py TokenResponse)
export interface TokenResponse { access_token: string; token_type: string; user_id: string; group_id: string; display_name: string; expires_at: string; }

export async function login(inviteCode: string): Promise<TokenResponse> {
  const data = await request<TokenResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ invite_code: inviteCode }),
  });
  setToken(data.access_token, data.display_name, data.user_id, data.group_id, data.expires_at);
  return data;
}

export async function getMe(): Promise<AuthUser> {
  return request<AuthUser>('/api/auth/me');
}

export function logout() {
  clearToken();
}

// ── Transactions ──────────────────────────────────────────────────────────────

export interface Transaction {
  id: string;
  group_id: string;
  user_id: string;
  user_display_name: string | null;
  category_id: string;
  category_name: string | null;
  category_icon: string | null;
  category_color: string | null;
  type: 'income' | 'expense';
  amount: number;
  description: string | null;
  date: string;
  created_at: string | null;
}

export async function getTransactions(month?: string): Promise<Transaction[]> {
  const q = month ? `?month=${month}` : '';
  return request<Transaction[]>(`/api/transactions${q}`);
}

export async function createTransaction(data: {
  category_id: string; type: string; amount: number; description?: string; date: string;
}): Promise<Transaction> {
  return request<Transaction>('/api/transactions', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateTransaction(id: string, data: Partial<{
  category_id: string; type: string; amount: number; description: string; date: string;
}>): Promise<Transaction> {
  return request<Transaction>(`/api/transactions/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function deleteTransaction(id: string): Promise<void> {
  return request<void>(`/api/transactions/${id}`, { method: 'DELETE' });
}

// ── Categories ────────────────────────────────────────────────────────────────

export interface Category {
  id: string; group_id: string | null; type: string;
  name: string; icon: string | null; color: string | null; is_default: boolean;
}

export async function getCategories(): Promise<Category[]> {
  return request<Category[]>('/api/categories');
}

// ── Stats ─────────────────────────────────────────────────────────────────────

export interface MonthlySummary { income: number; expense: number; balance: number; }
export interface CategoryStat { category_id: string; category_name: string; icon: string | null; color: string | null; total: number; percentage: number; }
export interface TrendItem { month: string; income: number; expense: number; }
export interface MemberStat { user_id: string; display_name: string; total: number; percentage: number; }

export async function getSummary(month: string, userOnly = false): Promise<MonthlySummary> {
  return request<MonthlySummary>(`/api/stats/summary?month=${month}&user_only=${userOnly}`);
}

export async function getCategoryStats(month: string, userOnly = false): Promise<CategoryStat[]> {
  return request<CategoryStat[]>(`/api/stats/categories?month=${month}&user_only=${userOnly}`);
}

export async function getTrend(): Promise<TrendItem[]> {
  return request<TrendItem[]>('/api/stats/trend');
}

export async function getMemberStats(month: string): Promise<MemberStat[]> {
  return request<MemberStat[]>(`/api/stats/members?month=${month}`);
}
