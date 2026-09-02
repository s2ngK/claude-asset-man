'use client';

import React, { useEffect, useState } from 'react';
import { cn, getErrorMessage } from '@/lib/utils';
import { useLocalUser } from '@/lib/useLocalUser';
import AppNav, { SIDEBAR_WIDTH } from '@/components/AppNav';
import AccountModal from '@/components/AccountModal';
import SettleModal from '@/components/SettleModal';
import {
  createAccount, deleteAccount, getAccounts, getCategories, settleAccount, updateAccount,
  type Account, type AccountInput, type Category,
} from '@/lib/api';
import {
  KIND_LABEL, REPAY_LABEL, STATUS_LABEL, expectedRepayment, isDebt, monthsLeft, progress,
} from '@/lib/accounts';

const won = (n: number) => new Intl.NumberFormat('ko-KR').format(n);

/**
 * 대출·예금·적금 화면.
 *
 * 가계부가 **흐름**만 다루기 때문에 남은 빚과 모아둔 돈이 어디에도 없었다. 이 화면은
 * 그 **잔액과 만기**를 보는 곳이지 두 번째 가계부가 아니다 — 여기서 거래를 만들지 않는다.
 *
 * 잔액은 전부 서버가 거래에서 계산해 실어준 값이다 (→ docs/accounts.md).
 */
export default function AccountsView() {
  const me = useLocalUser();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Account | null>(null);
  const [settling, setSettling] = useState<Account | null>(null);
  const [creating, setCreating] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  // 다시 불러올 때 올린다. 효과 안에서 곧바로 setState 하지 않는다
  // (`react-hooks/set-state-in-effect` → docs/pitfalls.md).
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [list, cats] = await Promise.all([getAccounts(), getCategories()]);
        if (cancelled) return;
        setAccounts(list);
        setCategories(cats);
        setError(null);
      } catch (err) {
        if (!cancelled) setError(getErrorMessage(err, '계좌를 불러오지 못했습니다.'));
      } finally {
        if (!cancelled) setLoading(false);
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

  const live = accounts.filter(a => a.status === 'active');
  const debts = live.filter(a => isDebt(a.kind));
  const assets = live.filter(a => !isDebt(a.kind));
  const finished = accounts.filter(a => a.status !== 'active');

  const totalAsset = assets.reduce((sum, a) => sum + a.balance, 0);
  const totalDebt = debts.reduce((sum, a) => sum + a.balance, 0);
  // 계좌의 기본 카테고리는 지출만이다 — 계좌를 움직이는 거래는 상환·납입·예치뿐이다.
  const expenseCategories = categories.filter(c => c.type === 'expense');

  return (
    <div className={cn('min-h-screen bg-slate-50 dark:bg-slate-950 pb-24 lg:pb-8', SIDEBAR_WIDTH)}>
      <header className="sticky top-0 z-30 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 p-4 flex items-center justify-between">
        <h2 className="text-lg font-bold">자산</h2>
        <button onClick={() => setCreating(true)}
          className="h-9 rounded-xl bg-emerald-500 px-3 text-sm font-bold text-white flex items-center gap-1">
          <span className="material-symbols-outlined text-[18px]">add</span>계좌
        </button>
      </header>

      <main className="max-w-md lg:max-w-4xl mx-auto p-4 space-y-6">
        {error && <p className="text-xs font-bold text-rose-500">{error}</p>}

        <section className="grid grid-cols-2 gap-3">
          <Total label="총 자산" value={totalAsset} tone="emerald" />
          <Total label="총 부채" value={totalDebt} tone="rose" />
        </section>

        {loading ? (
          <p className="text-sm text-slate-400 text-center py-10">불러오는 중…</p>
        ) : accounts.length === 0 ? (
          <Empty onAdd={() => setCreating(true)} />
        ) : (
          <div className="space-y-6 lg:grid lg:grid-cols-2 lg:gap-6 lg:space-y-0 lg:items-start">
            <Group title="대출" accounts={debts} empty="등록된 대출이 없습니다.">
              {debts.map(a => (
                <Card key={a.id} account={a} mine={a.user_id === me?.id}
                  onEdit={() => setEditing(a)} onSettle={() => setSettling(a)}
                  pendingDelete={pendingDelete === a.id}
                  onDelete={() => {
                    if (pendingDelete === a.id) { setPendingDelete(null); run(() => deleteAccount(a.id)); }
                    else setPendingDelete(a.id);
                  }} />
              ))}
            </Group>

            <Group title="예금·적금" accounts={assets} empty="등록된 예적금이 없습니다.">
              {assets.map(a => (
                <Card key={a.id} account={a} mine={a.user_id === me?.id}
                  onEdit={() => setEditing(a)} onSettle={() => setSettling(a)}
                  pendingDelete={pendingDelete === a.id}
                  onDelete={() => {
                    if (pendingDelete === a.id) { setPendingDelete(null); run(() => deleteAccount(a.id)); }
                    else setPendingDelete(a.id);
                  }} />
              ))}
            </Group>
          </div>
        )}

        {finished.length > 0 && (
          <details className="text-sm">
            <summary className="cursor-pointer text-xs font-bold text-slate-400 uppercase tracking-wider">
              끝난 계좌 {finished.length}개
            </summary>
            <div className="pt-3 space-y-2">
              {finished.map(a => (
                <div key={a.id}
                  className="bg-white dark:bg-slate-900 rounded-2xl px-4 py-3 border border-slate-100 dark:border-slate-800 flex items-center gap-2 text-xs">
                  <span className="font-bold">{a.name}</span>
                  <StatusBadge status={a.status} />
                  <span className="ml-auto tabular-nums text-slate-500">
                    {a.settled_on} · {won(a.settled_amount ?? 0)}원
                  </span>
                </div>
              ))}
            </div>
          </details>
        )}

        <p className="text-[11px] text-slate-400 leading-relaxed">
          잔액은 저장하지 않고 <strong>연결된 내역에서 계산</strong>합니다. 상환·납입은 홈에서 내역을 추가할 때
          계좌를 고르면 반영됩니다. 계좌는 만든 사람만 고칠 수 있고, 목록은 그룹 전체가 함께 봅니다.
        </p>
      </main>

      {creating && (
        <AccountModal onClose={() => setCreating(false)}
          categories={expenseCategories}
          onSave={(data: AccountInput) => run(() => createAccount(data))} />
      )}
      {editing && (
        <AccountModal initial={editing} onClose={() => setEditing(null)}
          categories={expenseCategories}
          onSave={(data: AccountInput) => run(() => updateAccount(editing.id, data))} />
      )}
      {settling && (
        <SettleModal account={settling} incomeCategories={categories.filter(c => c.type === 'income')}
          onClose={() => setSettling(null)}
          onSettle={(data) => run(() => settleAccount(settling.id, data))} />
      )}

      <AppNav />
    </div>
  );
}

function Total({ label, value, tone }: { label: string; value: number; tone: 'emerald' | 'rose' }) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 shadow-sm">
      <p className="text-xs font-bold text-slate-400">{label}</p>
      <p className={cn(
        'text-xl font-bold tabular-nums mt-1',
        tone === 'emerald' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500',
      )}>
        {won(value)}<span className="text-sm text-slate-400 ml-0.5">원</span>
      </p>
    </div>
  );
}

function Group({
  title, accounts, empty, children,
}: { title: string; accounts: Account[]; empty: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">{title}</h3>
      {accounts.length === 0 ? <p className="text-xs text-slate-400">{empty}</p> : <div className="space-y-3">{children}</div>}
    </section>
  );
}

function StatusBadge({ status }: { status: Account['status'] }) {
  return (
    <span className={cn(
      'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold',
      status === 'active' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10'
        : status === 'matured' ? 'bg-slate-100 text-slate-500 dark:bg-slate-800'
        : 'bg-amber-50 text-amber-600 dark:bg-amber-500/10',
    )}>
      {STATUS_LABEL[status]}
    </span>
  );
}

function Card({
  account, mine, onEdit, onSettle, onDelete, pendingDelete,
}: {
  account: Account;
  mine: boolean;
  onEdit: () => void;
  onSettle: () => void;
  onDelete: () => void;
  pendingDelete: boolean;
}) {
  const debt = isDebt(account.kind);
  const left = monthsLeft(account.matures_on);
  const ratio = progress(account);
  const next = debt ? expectedRepayment(account) : null;

  return (
    <div className={cn(
      'relative overflow-hidden bg-white dark:bg-slate-900 rounded-2xl p-4 border shadow-sm',
      // 내 계좌를 왼쪽 막대로 구분한다 — 목록의 내 내역과 같은 표시다.
      mine ? 'border-slate-100 dark:border-slate-800' : 'border-slate-100 dark:border-slate-800',
    )}>
      {mine && <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-emerald-400 dark:bg-emerald-500" />}

      <div className="flex items-start gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="font-bold truncate">{account.name}</p>
            <span className="shrink-0 rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-500">
              {KIND_LABEL[account.kind]}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {account.user_display_name}
            {mine && <span className="text-emerald-600 dark:text-emerald-400 font-bold"> · 나</span>}
            {' · '}연 {account.rate}%
            {account.repay_method && ` · ${REPAY_LABEL[account.repay_method]}`}
            {account.category_name && ` · ${account.category_icon ?? ''}${account.category_name}`}
          </p>
        </div>
        <div className="ml-auto text-right shrink-0">
          <p className="text-[11px] text-slate-400">{debt ? '남은 원금' : '잔액'}</p>
          <p className={cn(
            'text-lg font-bold tabular-nums',
            debt ? 'text-rose-500' : 'text-emerald-600 dark:text-emerald-400',
          )}>
            {won(account.balance)}<span className="text-xs text-slate-400 ml-0.5">원</span>
          </p>
        </div>
      </div>

      <div className="mt-3">
        <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
          <div className={cn('h-full rounded-full', debt ? 'bg-rose-400' : 'bg-emerald-400')}
            style={{ width: `${Math.round(ratio * 100)}%` }} />
        </div>
        <div className="flex justify-between text-[11px] text-slate-400 mt-1.5 tabular-nums">
          {/* 예금은 "넣은 돈" 이 잔액과 같은 말이라 두 번 적을 이유가 없다. 대신 언제 넣었는지를 적는다. */}
          <span>
            {debt
              ? `갚은 원금 ${won(account.paid_principal)}원`
              : account.kind === 'deposit'
                ? `${account.started_on} 예치`
                : `넣은 돈 ${won(account.paid_principal)}원`}
          </span>
          <span>{left > 0 ? `만기까지 ${left}개월` : '만기일 지남'}</span>
        </div>
      </div>

      {next && next.total > 0 && (
        <p className="mt-2 text-[11px] text-slate-400">
          이번 회차 예상 <strong className="text-slate-600 dark:text-slate-300">{won(next.total)}원</strong>
          {' '}(이자 {won(next.interest)}원)
          <span className="block text-slate-300 dark:text-slate-600">실제 낸 금액으로 내역을 넣어 주세요</span>
        </p>
      )}

      {mine && (
        <div className="mt-3 flex gap-2 border-t border-slate-100 dark:border-slate-800 pt-3">
          <button onClick={onEdit} className="text-[11px] font-bold text-slate-500 hover:text-slate-700">수정</button>
          <button onClick={onSettle} className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700">정산</button>
          <button onClick={onDelete} className="ml-auto text-[11px] font-bold text-rose-500 hover:text-rose-600">
            {pendingDelete ? '지워도 내역은 남습니다 · 한 번 더' : '삭제'}
          </button>
        </div>
      )}
    </div>
  );
}

function Empty({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-8 text-center space-y-3">
      <span className="material-symbols-outlined text-4xl text-slate-300">account_balance</span>
      <p className="text-sm font-bold">아직 등록된 계좌가 없습니다</p>
      <p className="text-xs text-slate-400 leading-relaxed">
        대출·예금·적금을 등록하면 남은 빚과 모아둔 돈을 여기서 함께 봅니다.
      </p>
      <button onClick={onAdd} className="h-10 rounded-xl bg-emerald-500 px-5 text-sm font-bold text-white">
        계좌 추가
      </button>
    </div>
  );
}
