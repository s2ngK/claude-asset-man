'use client';

import { useSyncExternalStore } from 'react';
import { getLocalUser } from '@/lib/api';

type LocalUser = ReturnType<typeof getLocalUser>;

/**
 * `localStorage` 는 React 밖에 있는 저장소다. 그래서 `useSyncExternalStore` 로 읽는다.
 *
 * 렌더 본문에서 `getLocalUser()` 를 부르면 서버에서는 `null`, 클라이언트에서는 실제 값이
 * 나와 하이드레이션 불일치가 난다 (#16). 이 훅은 **서버 스냅샷을 명시적으로 `null` 로**
 * 주기 때문에 서버 HTML 과 첫 클라이언트 렌더가 일치한다.
 *
 * 그래서 **첫 페인트에는 항상 `null`** 이다. 쓰는 쪽은 "아직 모른다" 를 표현할 수 있어야
 * 하고, 모르는 동안에는 권한을 주는 쪽이 아니라 막는 쪽으로 기울여야 안전하다.
 */

// getSnapshot 은 값이 안 바뀌면 **같은 객체**를 돌려줘야 한다. 매번 새 객체를 만들면
// React 가 계속 바뀐 것으로 보고 무한 렌더에 빠진다.
let cachedKey: string | null = null;
let cachedUser: LocalUser = null;

function getSnapshot(): LocalUser {
  const key = [
    localStorage.getItem('user_id'),
    localStorage.getItem('group_id'),
    localStorage.getItem('display_name'),
  ].join(' ');
  if (key !== cachedKey) {
    cachedKey = key;
    cachedUser = getLocalUser();
  }
  return cachedUser;
}

// 다른 탭에서 로그아웃하면 storage 이벤트가 온다. 이 탭도 따라 비운다.
function subscribe(onChange: () => void): () => void {
  window.addEventListener('storage', onChange);
  return () => window.removeEventListener('storage', onChange);
}

export function useLocalUser(): LocalUser {
  return useSyncExternalStore(subscribe, getSnapshot, () => null);
}
