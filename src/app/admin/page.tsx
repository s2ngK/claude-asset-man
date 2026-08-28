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
  deactivateGroup,
  adminScopeOf,
  listGroups,
  listUsers,
  regenerateGroupAdminCode,
  regenerateInviteCode,
  restoreGroup,
  type AdminGroup,
  type AdminScope,
  type AdminUser,
} from '@/lib/adminApi';
import { useAdminToken, useHydrated } from '@/lib/useAdminToken';

export default function AdminPage() {
  // 토큰은 sessionStorage 에 있고 서버는 모른다. 첫 렌더는 서버와 같은 모습이어야 하므로
  // 하이드레이션 전에는 아무것도 결정하지 않는다 (→ docs/pitfalls.md).
  const token = useAdminToken();
  const hydrated = useHydrated();

  if (!hydrated) return <Shell><p className="text-sm text-slate-400">불러오는 중…</p></Shell>;
  if (!token) return <SignIn />;
  // 신원은 토큰에서 파생한다 — 따로 저장하면 둘이 어긋나는 순간이 생긴다.
  return <Console key={token} scope={adminScopeOf(token)} onSignOut={clearAdminToken} />;
}

function Shell({ children, subtitle }: { children: React.ReactNode; subtitle?: string }) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="sticky top-0 z-30 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 p-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold">관리자</h1>
            {subtitle && <p className="text-[11px] font-medium text-slate-400">{subtitle}</p>}
          </div>
          <Link href="/" className="text-xs font-bold text-slate-400 hover:text-slate-600">가계부로</Link>
        </div>
      </header>
      <main className="max-w-2xl mx-auto p-4 space-y-6">{children}</main>
    </div>
  );
}

function Card({ title, badge, children }: { title: string; badge?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider">{title}</h2>
        {badge}
      </div>
      {children}
    </section>
  );
}

const inputClass =
  'h-10 flex-1 min-w-0 rounded-xl bg-slate-50 dark:bg-slate-800 px-3 text-sm outline-none border border-transparent focus:border-emerald-500';
const buttonClass =
  'h-10 shrink-0 rounded-xl bg-emerald-500 px-4 text-sm font-bold text-white disabled:opacity-40';
const linkButtonClass = 'text-[11px] font-bold text-slate-400 hover:text-slate-600';

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
          전체 관리자 키(<code>ADMIN_KEY</code>) 또는 <strong>그룹 관리자 인증키</strong>를 입력하세요.
          입력한 키는 <strong>만료가 있는 토큰</strong>으로 바뀌어 보관되며, 키 자체는 저장하지 않습니다.
        </p>
        <form onSubmit={submit} className="flex gap-2">
          <input
            type="password" value={key} onChange={(e) => setKey(e.target.value)}
            placeholder="관리자 키 또는 그룹 인증키" autoComplete="off" className={inputClass}
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

function Console({ scope, onSignOut }: { scope: AdminScope | null; onSignOut: () => void }) {
  const isSuper = scope === null;
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
    <Shell subtitle={isSuper ? '전체 관리자' : `그룹 관리자 · ${scope.groupName}`}>
      {error && (
        <p className="rounded-xl bg-rose-50 dark:bg-rose-500/10 px-3 py-2 text-xs font-bold text-rose-600 dark:text-rose-400">
          {error}
        </p>
      )}

      {isSuper && (
        <Card title={`그룹 ${groups.length}개`}>
          <NewGroupForm onCreate={(name) => run(() => createGroup(name))} />
          {loading && groups.length === 0 && <p className="text-sm text-slate-400">불러오는 중…</p>}
          {!loading && groups.length === 0 && <p className="text-sm text-slate-400">아직 그룹이 없습니다.</p>}
        </Card>
      )}

      {groups.map(group => (
        <GroupCard
          key={group.id}
          group={group}
          isSuper={isSuper}
          members={users.filter(u => u.group_id === group.id)}
          onCreateUser={(name, code) => run(() => createUser(group.id, name, code))}
          onRegenerate={(userId) => run(() => regenerateInviteCode(userId))}
          onDeactivate={() => run(() => deactivateGroup(group.id))}
          onRestore={() => run(() => restoreGroup(group.id))}
          onRotateAdminCode={() => run(() => regenerateGroupAdminCode(group.id))}
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
  group, isSuper, members, onCreateUser, onRegenerate, onDeactivate, onRestore, onRotateAdminCode,
}: {
  group: AdminGroup;
  isSuper: boolean;
  members: AdminUser[];
  onCreateUser: (displayName: string, inviteCode?: string) => void;
  onRegenerate: (userId: string) => void;
  onDeactivate: () => void;
  onRestore: () => void;
  onRotateAdminCode: () => void;
}) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');

  return (
    <Card
      title={`${group.name} · 구성원 ${members.length}명`}
      badge={!group.is_active && (
        <span className="rounded-full bg-slate-200 dark:bg-slate-700 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:text-slate-300">
          비활성
        </span>
      )}
    >
      {!group.is_active && (
        <p className="rounded-xl bg-amber-50 dark:bg-amber-500/10 px-3 py-2 text-[11px] font-medium text-amber-700 dark:text-amber-400">
          구성원이 로그인할 수 없습니다. <strong>기록은 그대로 남아 있고</strong> 복구할 수 있지만,
          인증키는 비활성화 시점에 전부 새로 발급됐습니다 — 복구 후 다시 나눠줘야 합니다.
        </p>
      )}

      <p className="text-[11px] text-slate-500">
        그룹 관리자{' '}
        {group.admin_user_name
          ? <strong className="text-slate-700 dark:text-slate-200">{group.admin_user_name}</strong>
          : <span className="text-slate-400">아직 없음 — 첫 구성원이 관리자가 됩니다</span>}
      </p>

      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {members.map(member => (
          <MemberRow
            key={member.id}
            member={member}
            isGroupAdmin={member.id === group.admin_user_id}
            onRegenerate={onRegenerate}
          />
        ))}
        {members.length === 0 && <p className="text-sm text-slate-400 pb-3">아직 구성원이 없습니다.</p>}
      </div>

      {group.is_active && (
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
      )}

      {isSuper && (
        <div className="space-y-2 border-t border-slate-100 dark:border-slate-800 pt-3">
          {group.admin_code && (
            <SecretRow label="그룹 관리자 인증키" value={group.admin_code}>
              <button onClick={onRotateAdminCode} className="text-[11px] font-bold text-rose-500 hover:text-rose-600">
                재발급
              </button>
            </SecretRow>
          )}
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-slate-400">그룹 ID: {group.id}</p>
            {group.is_active
              ? <ConfirmButton label="그룹 비활성화" confirmLabel="정말 비활성화할까요?" onConfirm={onDeactivate} />
              : <button onClick={onRestore} className="text-[11px] font-bold text-emerald-500 hover:text-emerald-600">그룹 복구</button>}
          </div>
        </div>
      )}
    </Card>
  );
}

/**
 * 되돌리기 어려운 동작은 두 번 누르게 한다.
 * `confirm()` 같은 브라우저 모달을 쓰지 않는다 — 화면 안에서 끝내는 편이 덜 거슬린다.
 */
function ConfirmButton({ label, confirmLabel, onConfirm }: { label: string; confirmLabel: string; onConfirm: () => void }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), 4000); // 눌러둔 채로 잊지 않게
    return () => clearTimeout(timer);
  }, [armed]);

  return (
    <button
      onClick={() => { if (armed) { onConfirm(); setArmed(false); } else { setArmed(true); } }}
      className={cn('text-[11px] font-bold', armed ? 'text-rose-600 underline' : 'text-rose-500 hover:text-rose-600')}
    >
      {armed ? confirmLabel : label}
    </button>
  );
}

/** 인증키·초대 코드처럼 **어깨 너머로 읽히면 안 되는 값**을 가려서 보여준다. */
function SecretRow({ label, value, children }: { label: string; value: string; children?: React.ReactNode }) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setRevealed(true); // 클립보드가 막힌 환경이면 최소한 보여는 준다
    }
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] font-bold text-slate-400 shrink-0">{label}</span>
      <code className={cn(
        'text-xs px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 font-mono flex-1 min-w-0 truncate',
        !revealed && 'tracking-widest text-slate-400',
      )}>
        {revealed ? value : '•'.repeat(Math.min(value.length, 16))}
      </code>
      <button onClick={() => setRevealed(v => !v)} className={linkButtonClass}>{revealed ? '가리기' : '보기'}</button>
      <button onClick={copy} className="text-[11px] font-bold text-emerald-500 hover:text-emerald-600">
        {copied ? '복사됨' : '복사'}
      </button>
      {children}
    </div>
  );
}

function MemberRow({
  member, isGroupAdmin, onRegenerate,
}: { member: AdminUser; isGroupAdmin: boolean; onRegenerate: (id: string) => void }) {
  return (
    <div className="flex items-center gap-2 py-2.5">
      <span className="text-sm font-bold w-24 shrink-0 truncate">
        {member.display_name}
        {isGroupAdmin && (
          <span className="ml-1 rounded-full bg-emerald-100 dark:bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700 dark:text-emerald-400 align-middle">
            관리자
          </span>
        )}
      </span>
      <SecretRow label="초대 코드" value={member.invite_code}>
        <button onClick={() => onRegenerate(member.id)} className="text-[11px] font-bold text-rose-500 hover:text-rose-600">
          재발급
        </button>
      </SecretRow>
    </div>
  );
}
