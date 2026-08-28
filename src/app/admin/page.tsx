'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { cn, getErrorMessage } from '@/lib/utils';
import {
  AdminAuthError,
  adminLogin,
  clearAdminToken,
  createGroup,
  createUser,
  listGroups,
  listUsers,
  regenerateInviteCode,
  type AdminGroup,
  type AdminUser,
} from '@/lib/adminApi';
import { useAdminToken, useHydrated } from '@/lib/useAdminToken';

export default function AdminPage() {
  // 토큰은 sessionStorage 에 있고 서버는 모른다. 첫 렌더는 서버와 같은 모습이어야 하므로
  // 하이드레이션 전에는 아무것도 결정하지 않는다 (→ docs/pitfalls.md).
  const token = useAdminToken();
  const hydrated = useHydrated();

  if (!hydrated) return <Shell><p className="text-sm text-slate-400">불러오는 중…</p></Shell>;
  return token ? <Console onSignOut={clearAdminToken} /> : <SignIn />;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="sticky top-0 z-30 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 p-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <h1 className="text-lg font-bold">관리자</h1>
          <Link href="/" className="text-xs font-bold text-slate-400 hover:text-slate-600">가계부로</Link>
        </div>
      </header>
      <main className="max-w-2xl mx-auto p-4 space-y-6">{children}</main>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
      <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider">{title}</h2>
      {children}
    </section>
  );
}

const inputClass =
  'h-10 flex-1 min-w-0 rounded-xl bg-slate-50 dark:bg-slate-800 px-3 text-sm outline-none border border-transparent focus:border-emerald-500';
const buttonClass =
  'h-10 shrink-0 rounded-xl bg-emerald-500 px-4 text-sm font-bold text-white disabled:opacity-40';

// ── 인증 ─────────────────────────────────────────────────────────────────────

function SignIn() {
  const [key, setKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!key.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await adminLogin(key.trim());
      setKey(''); // 키는 화면에도 남기지 않는다 — 토큰이 생기면 화면은 알아서 바뀐다

    } catch (err) {
      setError(getErrorMessage(err, '관리자 인증에 실패했습니다.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell>
      <Card title="관리자 인증">
        <p className="text-xs text-slate-500">
          `ADMIN_KEY` 를 입력하면 <strong>만료가 있는 토큰</strong>으로 바꿔 보관합니다.
          키 자체는 저장하지 않고, 토큰은 탭을 닫으면 사라집니다.
        </p>
        <form onSubmit={submit} className="flex gap-2">
          <input
            type="password" value={key} onChange={(e) => setKey(e.target.value)}
            placeholder="ADMIN_KEY" autoComplete="off" className={inputClass}
          />
          <button type="submit" disabled={busy || !key.trim()} className={buttonClass}>
            {busy ? '확인 중…' : '입장'}
          </button>
        </form>
        {error && <p className="text-xs font-bold text-rose-500">{error}</p>}
      </Card>
    </Shell>
  );
}

// ── 관리 화면 ────────────────────────────────────────────────────────────────

function Console({ onSignOut }: { onSignOut: () => void }) {
  const [groups, setGroups] = useState<AdminGroup[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [g, u] = await Promise.all([listGroups(), listUsers()]);
      setGroups(g);
      setUsers(u);
      setError(null);
    } catch (err) {
      if (err instanceof AdminAuthError) { onSignOut(); return; }
      setError(getErrorMessage(err, '목록을 불러오지 못했습니다.'));
    } finally {
      setLoading(false);
    }
  }, [onSignOut]);

  useEffect(() => { refresh(); }, [refresh]);

  const run = async (action: () => Promise<unknown>) => {
    try {
      await action();
      await refresh();
    } catch (err) {
      if (err instanceof AdminAuthError) { onSignOut(); return; }
      setError(getErrorMessage(err, '요청에 실패했습니다.'));
    }
  };

  return (
    <Shell>
      {error && (
        <p className="rounded-xl bg-rose-50 dark:bg-rose-500/10 px-3 py-2 text-xs font-bold text-rose-600 dark:text-rose-400">
          {error}
        </p>
      )}

      <Card title={`그룹 ${groups.length}개`}>
        <NewGroupForm onCreate={(name) => run(() => createGroup(name))} />
        {loading && groups.length === 0 && <p className="text-sm text-slate-400">불러오는 중…</p>}
        {!loading && groups.length === 0 && <p className="text-sm text-slate-400">아직 그룹이 없습니다.</p>}
      </Card>

      {groups.map(group => (
        <GroupCard
          key={group.id}
          group={group}
          members={users.filter(u => u.group_id === group.id)}
          onCreateUser={(name, code) => run(() => createUser(group.id, name, code))}
          onRegenerate={(userId) => run(() => regenerateInviteCode(userId))}
        />
      ))}

      <button onClick={onSignOut} className="w-full h-10 rounded-xl text-sm font-bold text-slate-400 hover:text-slate-600">
        관리자 세션 종료
      </button>
    </Shell>
  );
}

function NewGroupForm({ onCreate }: { onCreate: (name: string) => void }) {
  const [name, setName] = useState('');
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); if (!name.trim()) return; onCreate(name.trim()); setName(''); }}
      className="flex gap-2"
    >
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="새 그룹 이름" className={inputClass} />
      <button type="submit" disabled={!name.trim()} className={buttonClass}>그룹 추가</button>
    </form>
  );
}

function GroupCard({
  group, members, onCreateUser, onRegenerate,
}: {
  group: AdminGroup;
  members: AdminUser[];
  onCreateUser: (displayName: string, inviteCode?: string) => void;
  onRegenerate: (userId: string) => void;
}) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');

  return (
    <Card title={`${group.name} · 구성원 ${members.length}명`}>
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {members.map(member => <MemberRow key={member.id} member={member} onRegenerate={onRegenerate} />)}
        {members.length === 0 && <p className="text-sm text-slate-400 pb-3">아직 구성원이 없습니다.</p>}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          onCreateUser(name.trim(), code.trim() || undefined);
          setName(''); setCode('');
        }}
        className="flex flex-wrap gap-2 pt-1"
      >
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="이름" className={inputClass} />
        <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="초대 코드 (비우면 자동)" className={inputClass} />
        <button type="submit" disabled={!name.trim()} className={buttonClass}>구성원 추가</button>
      </form>
      <p className="text-[11px] text-slate-400">그룹 ID: {group.id}</p>
    </Card>
  );
}

function MemberRow({ member, onRegenerate }: { member: AdminUser; onRegenerate: (id: string) => void }) {
  // 초대 코드는 곧 비밀번호다. 기본은 가리고, 어깨 너머로 읽히지 않게 눌러야 보인다.
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(member.invite_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setRevealed(true); // 클립보드가 막힌 환경이면 최소한 보여는 준다
    }
  };

  return (
    <div className="flex items-center gap-2 py-2.5">
      <span className="text-sm font-bold flex-1 min-w-0 truncate">{member.display_name}</span>
      <code className={cn(
        'text-xs px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 font-mono',
        !revealed && 'tracking-widest text-slate-400',
      )}>
        {revealed ? member.invite_code : '•'.repeat(Math.min(member.invite_code.length, 11))}
      </code>
      <button onClick={() => setRevealed(v => !v)} className="text-[11px] font-bold text-slate-400 hover:text-slate-600">
        {revealed ? '가리기' : '보기'}
      </button>
      <button onClick={copy} className="text-[11px] font-bold text-emerald-500 hover:text-emerald-600">
        {copied ? '복사됨' : '복사'}
      </button>
      <button onClick={() => onRegenerate(member.id)} className="text-[11px] font-bold text-rose-500 hover:text-rose-600">
        재발급
      </button>
    </div>
  );
}
