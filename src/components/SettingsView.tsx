'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { logout, getLocalUser } from '@/lib/api';
import { useRouter } from 'next/navigation';

export default function SettingsView() {
  const router = useRouter();
  const user = getLocalUser();

  const handleCopyCode = () => {
    if (user?.id) {
      navigator.clipboard.writeText(user.id);
      alert('사용자 ID가 복사되었습니다.');
    }
  };

  const handleLogout = () => {
    logout();
    router.push('/login');
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-24">
      <header className="sticky top-0 z-30 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 p-4 flex items-center gap-3">
        <Link href="/" className="text-slate-500">
          <span className="material-symbols-outlined">arrow_back</span>
        </Link>
        <h2 className="text-lg font-bold">설정</h2>
      </header>

      <main className="max-w-md mx-auto p-4 space-y-8">
        {/* Profile Section */}
        <section className="space-y-4">
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">내 프로필</h3>
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col items-center gap-4">
            <div className="size-20 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-400">
              <span className="material-symbols-outlined text-4xl">person</span>
            </div>
            <p className="text-xl font-bold">{user?.display_name ?? '-'}</p>
            <p className="text-xs text-slate-400">그룹 ID: {user?.group_id ?? '-'}</p>
          </div>
        </section>

        {/* Account Section */}
        <section className="space-y-4">
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">계정 관리</h3>
          <div className="bg-white dark:bg-slate-900 rounded-2xl overflow-hidden shadow-sm border border-slate-100 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-left"
            >
              <span className="font-medium text-slate-700 dark:text-slate-300">로그아웃</span>
              <span className="material-symbols-outlined text-slate-400">logout</span>
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
