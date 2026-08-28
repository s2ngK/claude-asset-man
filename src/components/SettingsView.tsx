'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  createCategory, deleteCategory, getCategories, getMe, logout,
  type Category,
} from '@/lib/api';
import { getErrorMessage } from '@/lib/utils';
import { useLocalUser } from '@/lib/useLocalUser';
import { useRouter } from 'next/navigation';
import { TransactionType } from '@/types';

export default function SettingsView() {
  const router = useRouter();
  const user = useLocalUser();

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

        <CategorySection />

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

const inputClass =
  'h-10 flex-1 min-w-0 rounded-xl bg-slate-50 dark:bg-slate-800 px-3 text-sm outline-none border border-transparent focus:border-emerald-500';

/**
 * 그룹 전용 카테고리 관리. **그룹 관리자에게만 보인다** — 카테고리는 그룹이 함께 쓰는
 * 것이라 아무나 지우면 남의 거래 분류가 바뀐다. 권한 판단은 서버가 다시 한다.
 */
function CategorySection() {
  const [isGroupAdmin, setIsGroupAdmin] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('');
  const [type, setType] = useState<TransactionType>('expense');
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  // 다시 불러올 때 이 값을 올린다. effect 안에서 곧바로 setState 하는 대신
  // await 뒤에서만 상태를 건드린다 (`react-hooks/set-state-in-effect`).
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [me, list] = await Promise.all([getMe(), getCategories()]);
        if (cancelled) return;
        setIsGroupAdmin(me.is_group_admin);
        setCategories(list);
        setError(null);
      } catch (err) {
        console.error('category section', err);
      }
    })();
    return () => { cancelled = true; };
  }, [reloadKey]);

  const run = async (action: () => Promise<unknown>) => {
    try {
      await action();
      setError(null);
      setReloadKey(key => key + 1);
    } catch (err) {
      setError(getErrorMessage(err, '요청에 실패했습니다.'));
    }
  };

  if (!isGroupAdmin) return null;

  const ours = categories.filter(c => c.group_id !== null);
  const system = categories.filter(c => c.group_id === null);

  return (
    <section className="space-y-4">
      <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">카테고리 관리</h3>
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-4 space-y-4">
        {error && <p className="text-xs font-bold text-rose-500">{error}</p>}

        <div className="space-y-2">
          {ours.map(cat => (
            <div key={cat.id} className="flex items-center gap-2">
              <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: cat.color ?? '#94a3b8' }} />
              <span className="text-sm">{cat.icon} {cat.name}</span>
              <span className="text-[10px] text-slate-400">{cat.type === 'income' ? '수입' : '지출'}</span>
              <button
                onClick={() => {
                  if (pendingDelete === cat.id) { setPendingDelete(null); run(() => deleteCategory(cat.id)); }
                  else setPendingDelete(cat.id);
                }}
                className="ml-auto text-[11px] font-bold text-rose-500 hover:text-rose-600"
              >
                {pendingDelete === cat.id ? '지우면 내역은 기타로 옮겨집니다 · 한 번 더' : '삭제'}
              </button>
            </div>
          ))}
          {ours.length === 0 && (
            <p className="text-xs text-slate-400">우리 그룹이 추가한 카테고리가 아직 없습니다.</p>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            run(() => createCategory({ type, name: name.trim(), icon: icon.trim() || undefined }));
            setName(''); setIcon('');
          }}
          className="flex flex-wrap gap-2 border-t border-slate-100 dark:border-slate-800 pt-3"
        >
          <select value={type} onChange={(e) => setType(e.target.value as TransactionType)}
            aria-label="카테고리 종류"
            className="h-10 rounded-xl bg-slate-50 dark:bg-slate-800 px-3 text-sm outline-none">
            <option value="expense">지출</option>
            <option value="income">수입</option>
          </select>
          <input value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="🐶" maxLength={4}
            aria-label="아이콘" className="h-10 w-16 shrink-0 rounded-xl bg-slate-50 dark:bg-slate-800 px-3 text-sm text-center outline-none" />
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="카테고리 이름" maxLength={20}
            aria-label="카테고리 이름" className={inputClass} />
          <button type="submit" disabled={!name.trim()}
            className="h-10 shrink-0 rounded-xl bg-emerald-500 px-4 text-sm font-bold text-white disabled:opacity-40">
            추가
          </button>
        </form>

        {/* 색은 고를 수 없다. 왜 그런지 한 줄로 말해준다 */}
        <p className="text-[11px] text-slate-400">
          색은 자동으로 배정됩니다 — 차트에서 읽히도록 검증된 값만 씁니다. 이름과 아이콘을 정해주세요.
        </p>

        <details className="text-xs text-slate-400">
          <summary className="cursor-pointer">기본 카테고리 {system.length}개 (지울 수 없음)</summary>
          <p className="pt-2">{system.map(c => `${c.icon ?? ''}${c.name}`).join(' · ')}</p>
        </details>
      </div>
    </section>
  );
}
