'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const ITEMS = [
  { href: '/', label: '홈', icon: 'home' },
  { href: '/stats', label: '통계', icon: 'insights' },
  { href: '/settings', label: '설정', icon: 'settings' },
] as const;

/** 데스크톱 사이드바가 차지하는 폭. 본문은 이만큼 왼쪽을 비워야 한다. */
export const SIDEBAR_WIDTH = 'lg:pl-56';

/**
 * 화면 폭에 따라 **모습이 바뀌는 하나의 내비게이션**.
 *
 * - 좁은 화면: 하단 탭바 (엄지로 닿는 자리). PWA 로 설치된 모바일 경험이 이것이다
 * - 넓은 화면(`lg` 이상): 왼쪽 세로 바. 가로가 남는데 아래를 가로지르는 바를 두면
 *   본문이 세로로만 길어지고 눌러야 할 곳이 화면 반대편에 있다
 *
 * 두 벌을 각 화면이 따로 들고 있으면 항목이 어긋난다. 여기 한 곳에 둔다.
 */
export default function AppNav() {
  const pathname = usePathname();
  const isCurrent = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

  return (
    <>
      {/* 좁은 화면 — 하단 탭바 */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800 pb-safe">
        <div className="flex justify-around items-center h-16 max-w-md mx-auto px-6">
          {ITEMS.map(item => (
            <Link key={item.href} href={item.href}
              className={cn(
                'flex flex-col items-center gap-1',
                isCurrent(item.href) ? 'text-emerald-500' : 'text-slate-400',
              )}>
              <span className="material-symbols-outlined text-[24px]">{item.icon}</span>
              <span className={cn('text-[10px]', isCurrent(item.href) ? 'font-bold' : 'font-medium')}>
                {item.label}
              </span>
            </Link>
          ))}
        </div>
      </nav>

      {/* 넓은 화면 — 왼쪽 세로 바 */}
      <nav className="hidden lg:flex fixed inset-y-0 left-0 z-40 w-56 flex-col gap-1 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-4">
        <p className="px-3 pb-4 pt-2 text-sm font-bold">가계부</p>
        {ITEMS.map(item => (
          <Link key={item.href} href={item.href}
            className={cn(
              'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors',
              isCurrent(item.href)
                ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold'
                : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-900 font-medium',
            )}>
            <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
