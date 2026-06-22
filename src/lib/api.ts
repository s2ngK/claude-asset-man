// 자체 백엔드 API 클라이언트 (Supabase 대체)
const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// ── 토큰 관리 (localStorage + cookie) ─────────────────────────────────────────

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}

export function setToken(token: string, displayName: string, userId: string, groupId: string) {
  localStorage.setItem('token', token);
  localStorage.setItem('display_name', displayName);
  localStorage.setItem('user_id', userId);
  localStorage.setItem('group_id', groupId);
  // 미들웨어 인증용 쿠키 설정
  document.cookie = `token=${token}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`;
}

export function clearToken() {
  localStorage.removeItem('token');
  localStorage.removeItem('display_name');
  localStorage.removeItem('user_id');
  localStorage.removeItem('group_id');
  document.cookie = 'token=; path=/; max-age=0';
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
    throw new Error(err.detail || '요청 실패');
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export interface AuthUser { id: string; group_id: string; display_name: string; }
export interface TokenResponse extends AuthUser { access_token: string; token_type: string; }

export async function login(inviteCode: string): Promise<TokenResponse> {
  const data = await request<TokenResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ invite_code: inviteCode }),
  });
  setToken(data.access_token, data.display_name, data.user_id ?? data.id, data.group_id);
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
