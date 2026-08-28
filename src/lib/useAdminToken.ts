'use client';

import { useSyncExternalStore } from 'react';
import { getAdminToken, subscribeAdminToken } from '@/lib/adminApi';

/**
 * 관리자 토큰을 `sessionStorage` 에서 읽는다. 서버 스냅샷은 `null` 이라 서버 HTML 과
 * 첫 클라이언트 렌더가 일치한다 (→ docs/pitfalls.md 의 하이드레이션 항목).
 * 스냅샷이 문자열/`null` 이라 객체 캐시가 필요 없다.
 */
export function useAdminToken(): string | null {
  return useSyncExternalStore(subscribeAdminToken, getAdminToken, () => null);
}

const noopSubscribe = () => () => {};

/**
 * 하이드레이션이 끝났는지. 서버에서는 `false`, 클라이언트에서는 `true` 다.
 *
 * 토큰이 있어도 첫 렌더에는 `null` 로 보이기 때문에, 이걸로 한 프레임을 가리지 않으면
 * **이미 인증된 사람에게 로그인 폼이 깜빡인다.**
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}
