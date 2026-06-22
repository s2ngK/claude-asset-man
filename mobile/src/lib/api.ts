// 모바일용 API 클라이언트 (Supabase 대체)
import * as SecureStore from 'expo-secure-store';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000';

// ── 토큰 관리 ─────────────────────────────────────────────────────────────────

const KEYS = { token: 'token', userId: 'user_id', groupId: 'group_id', displayName: 'display_name' };

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(KEYS.token);
}

export async function setSession(token: string, userId: string, groupId: string, displayName: string) {
  await Promise.all([
    SecureStore.setItemAsync(KEYS.token, token),
    SecureStore.setItemAsync(KEYS.userId, userId),
    SecureStore.setItemAsync(KEYS.groupId, groupId),
    SecureStore.setItemAsync(KEYS.displayName, displayName),
  ]);
}

export async function clearSession() {
  await Promise.all(Object.values(KEYS).map(k => SecureStore.deleteItemAsync(k)));
}

export async function getLocalUser() {
  const userId = await SecureStore.getItemAsync(KEYS.userId);
  if (!userId) return null;
  return {
    id: userId,
    group_id: (await SecureStore.getItemAsync(KEYS.groupId)) || '',
    display_name: (await SecureStore.getItemAsync(KEYS.displayName)) || '',
  };
}

// ── HTTP 기본 요청 ─────────────────────────────────────────────────────────────

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getToken();
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
export interface TokenResponse extends AuthUser { access_token: string; user_id: string; }

export async function login(inviteCode: string): Promise<TokenResponse> {
  const data = await request<TokenResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ invite_code: inviteCode }),
  });
  await setSession(data.access_token, data.user_id ?? data.id, data.group_id, data.display_name);
  return data;
}

export async function logout() {
  await clearSession();
}

export async function checkSession(): Promise<boolean> {
  const token = await getToken();
  return !!token;
}

// ── Transactions ──────────────────────────────────────────────────────────────

export interface Transaction {
  id: string; group_id: string; user_id: string;
  user_display_name: string | null; category_id: string;
  category_name: string | null; category_icon: string | null; category_color: string | null;
  type: 'income' | 'expense'; amount: number; description: string | null;
  date: string; created_at: string | null;
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
export interface TrendItem { month: string; income: number; expense: number; }
export interface CategoryStat { category_id: string; category_name: string; icon: string | null; color: string | null; total: number; percentage: number; }
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
