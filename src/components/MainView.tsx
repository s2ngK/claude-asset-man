'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import AddEntryModal, { type EntryDraft } from '@/components/AddEntryModal';
import AppNav, { SIDEBAR_WIDTH } from '@/components/AppNav';
import MonthPicker from '@/components/MonthPicker';
import TransactionItem from '@/components/TransactionItem';
import UndoToast from '@/components/UndoToast';
import { Transaction, TransactionType } from '@/types';
import { cn, getErrorMessage } from '@/lib/utils';
import {
  getTransactions, createTransaction, updateTransaction, deleteTransaction,
  getCategories, getSummary, getAccounts,
  type Transaction as ApiTransaction,
  type Category as ApiCategory,
  type MonthlySummary,
  type Account,
} from '@/lib/api';
import { useLocalUser } from '@/lib/useLocalUser';

type SortOrder = 'newest' | 'oldest';
type TypeFilter = 'all' | TransactionType;

// API 응답 → 내부 타입 변환
function toLocalTx(t: ApiTransaction): Transaction {
  return {
    id: t.id,
    group_id: t.group_id,
    user_id: t.user_id,
    category_id: t.category_id,
    type: t.type as TransactionType,
    amount: t.amount,
    description: t.description ?? '',
    date: t.date,
    created_at: t.created_at ?? '',
    account_id: t.account_id,
    account_name: t.account_name,
    interest_amount: t.interest_amount,
    user_display_name: t.user_display_name ?? undefined,
    categories: t.category_name ? { id: t.category_id, name: t.category_name, icon: t.category_icon ?? '', color: t.category_color ?? '' } : null,
  };
}

export default function MainView() {
  const [isAddEntryOpen, setIsAddEntryOpen] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date().toISOString().slice(0, 7));
  const [loading, setLoading] = useState(false);
  const [deletedItem, setDeletedItem] = useState<{ item: Transaction; index: number } | null>(null);
  const [showUndo, setShowUndo] = useState(false);
  // 수정 대상. null 이면 추가 모드다 — 같은 모달을 쓰고 이 값으로 갈린다.
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  // 내역에 연결할 수 있는 계좌 — **진행 중인 것만.** 끝난 계좌에 새 상환을 붙일 일은 없다.
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all'); // category_id 또는 'all'
  const [memberFilter, setMemberFilter] = useState<string>('all');     // user_id 또는 'all'
  // 이 달 전체 합계는 **서버가 낸 값**이다. 목록을 reduce 하면 지금은 같은 값이 나오지만,
  // 페이지네이션을 넣는 순간 화면에 있는 것만 더하게 되어 조용히 틀려진다 (#14).
  const [monthSummary, setMonthSummary] = useState<MonthlySummary>({ income: 0, expense: 0, balance: 0 });

  const user = useLocalUser();

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getTransactions(currentMonth);
      setTransactions(data.map(toLocalTx));
    } catch (err) {
      console.error('fetch error', err);
    } finally {
      setLoading(false);
    }
  }, [currentMonth]);

  const fetchSummary = useCallback(async () => {
    try {
      setMonthSummary(await getSummary(currentMonth));
    } catch (err) {
      console.error('summary fetch error', err);
    }
  }, [currentMonth]);

  /** 잔액은 거래에서 계산되므로, 거래를 건드릴 때마다 계좌도 다시 받는다. */
  const refreshAccounts = useCallback(async () => {
    try {
      // 끝난 계좌에는 새 상환·납입을 붙일 일이 없다.
      setAccounts((await getAccounts()).filter(a => a.status === 'active'));
    } catch (err) {
      console.error('account fetch error', err);
    }
  }, []);

  useEffect(() => { fetchTransactions(); }, [fetchTransactions]);
  useEffect(() => { fetchSummary(); }, [fetchSummary]);
  useEffect(() => { refreshAccounts(); }, [refreshAccounts]);

  // 필터 드롭다운과 저장 시 이름→id 매칭에 함께 쓴다. 한 번만 받아둔다.
  useEffect(() => {
    getCategories().then(setCategories).catch(err => console.error('category fetch error', err));
  }, []);

  const handleSaveEntry = async (draft: EntryDraft) => {
    try {
      // 모달이 서버 카테고리 id 를 그대로 준다 — 이름으로 되찾을 일이 없다 (#17).
      const payload = {
        category_id: draft.categoryId,
        type: draft.type,
        amount: draft.amount,
        description: draft.description,
        date: draft.date,
        account_id: draft.accountId,
        interest_amount: draft.interestAmount,
      };
      // editing 은 모달이 닫히기 전에 읽힌다 (onSave → onClose 순서).
      if (editing) {
        await updateTransaction(editing.id, payload);
      } else {
        await createTransaction(payload);
      }
      // 계좌 잔액도 이 거래에서 계산되므로 함께 다시 받는다.
      await Promise.all([fetchTransactions(), fetchSummary(), refreshAccounts()]);
    } catch (err) {
      alert('저장 실패: ' + getErrorMessage(err, '알 수 없는 오류'));
    }
  };

  const restoreAt = (item: Transaction, index: number) => {
    setTransactions(prev => {
      const next = [...prev];
      next.splice(index, 0, item);
      return next;
    });
  };

  // 삭제는 서버에 바로 반영한다. 예전에는 4초 뒤에 커밋하고 그 사이 되돌리기를
  // 타이머 취소로 처리했는데, 타이머 핸들이 하나뿐이라 연속 삭제 시 앞 항목의
  // 서버 요청까지 취소됐고(화면엔 없는데 서버엔 남음), 4초 안에 화면을 벗어나면
  // 삭제 자체가 유실됐다. 되돌리기를 재생성으로 바꾸면 그 지연 커밋이 필요 없어진다.
  const handleDelete = async (id: string) => {
    const index = transactions.findIndex(t => t.id === id);
    if (index === -1) return;
    const item = transactions[index];

    setTransactions(prev => prev.filter(t => t.id !== id));
    try {
      await deleteTransaction(id);
    } catch (err) {
      restoreAt(item, index);
      alert('삭제 실패: ' + getErrorMessage(err, '알 수 없는 오류'));
      return;
    }
    setDeletedItem({ item, index });
    setShowUndo(true);
    fetchSummary(); // 목록은 낙관적으로 지웠지만 합계는 서버가 낸다
  };

  // 되돌리기는 취소가 아니라 같은 내용으로 다시 만드는 것이다.
  // 서버가 새 id 를 발급하므로 저장 후 목록을 다시 받아 화면과 서버를 맞춘다.
  const handleUndo = async () => {
    if (!deletedItem) return;
    const { item } = deletedItem;
    setShowUndo(false);
    setDeletedItem(null);
    try {
      await createTransaction({
        category_id: item.category_id,
        type: item.type,
        amount: item.amount,
        description: item.description,
        date: item.date,
        // 계좌 연결까지 되살린다. 빠뜨리면 되돌린 뒤 잔액만 조용히 어긋난다.
        account_id: item.account_id ?? null,
        interest_amount: item.interest_amount ?? null,
      });
    } catch (err) {
      alert('되돌리기 실패: ' + getErrorMessage(err, '알 수 없는 오류'));
    }
    await Promise.all([fetchTransactions(), fetchSummary()]);
  };

  const filterActive = typeFilter !== 'all' || categoryFilter !== 'all' || memberFilter !== 'all';

  // 구성원 목록은 **이 달 거래에서 뽑는다.** 따로 받아올 필요가 없고, 이번 달에 아무것도
  // 안 쓴 사람은 골라봐야 0건이라 목록에 없는 편이 낫다.
  const memberOptions = useMemo(() => {
    const seen = new Map<string, string>();
    transactions.forEach(t => {
      if (!seen.has(t.user_id)) seen.set(t.user_id, t.user_display_name ?? '알 수 없음');
    });
    return [...seen].map(([id, name]) => ({
      id,
      // 자기 것은 목록에서도 '나' 로 부른다. 행 표시와 같은 말을 써야 헷갈리지 않는다.
      label: id === user?.id ? '나' : name,
      isMine: id === user?.id,
    })).sort((a, b) => Number(b.isMine) - Number(a.isMine) || a.label.localeCompare(b.label));
  }, [transactions, user?.id]);

  // 카테고리 드롭다운은 고른 종류에 맞는 것만 보여준다 (지출을 고르고 '급여'를 남겨두지 않는다).
  const categoryOptions = useMemo(
    () => categories.filter(c => typeFilter === 'all' || c.type === typeFilter),
    [categories, typeFilter],
  );

  const changeTypeFilter = (next: TypeFilter) => {
    setTypeFilter(next);
    // 고른 카테고리가 새 종류에 없으면 조건이 영영 0건이 된다. 같이 푼다.
    if (categoryFilter !== 'all' && next !== 'all') {
      const picked = categories.find(c => c.id === categoryFilter);
      if (picked && picked.type !== next) setCategoryFilter('all');
    }
  };

  const visibleTransactions = useMemo(() => {
    const filtered = transactions.filter(t =>
      (typeFilter === 'all' || t.type === typeFilter) &&
      (categoryFilter === 'all' || t.category_id === categoryFilter) &&
      (memberFilter === 'all' || t.user_id === memberFilter)
    );
    // 같은 날짜 안에서는 **입력 순서**로 가른다. 날짜만 보면 오늘 넣은 것들의 순서가
    // 서버가 준 순서에 맡겨져, 방금 적은 항목이 어디 있는지 알 수 없다.
    const key = (t: Transaction) => `${t.date} ${t.created_at ?? ''}`;
    return [...filtered].sort((a, b) =>
      sortOrder === 'newest' ? key(b).localeCompare(key(a)) : key(a).localeCompare(key(b)));
  }, [transactions, typeFilter, categoryFilter, memberFilter, sortOrder]);

  const groupedTransactions = useMemo(() => {
    const groups: { [date: string]: Transaction[] } = {};
    // visibleTransactions 가 이미 정렬돼 있으므로 그룹 안 순서는 그대로 따라간다.
    visibleTransactions.forEach(t => { if (!groups[t.date]) groups[t.date] = []; groups[t.date].push(t); });
    return Object.entries(groups).sort((a, b) =>
      sortOrder === 'newest' ? b[0].localeCompare(a[0]) : a[0].localeCompare(b[0]));
  }, [visibleTransactions, sortOrder]);

  const totals = (list: Transaction[]) => {
    const income = list.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expense = list.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    return { income, expense, balance: income - expense };
  };

  // "지금 걸러낸 것들의 합" 은 화면에 보이는 것에 대한 이야기라 여기서 센다.
  // (그 달 전체 합계인 monthSummary 와 달리 서버에 물어볼 것이 아니다.)
  const filteredSummary = useMemo(() => totals(visibleTransactions), [visibleTransactions]);

  return (
    <div className={cn('relative min-h-screen pb-24 bg-slate-50 dark:bg-slate-950 lg:pb-8', SIDEBAR_WIDTH)}>
      <header className="sticky top-0 z-30 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 p-4">
        <div className="flex items-center justify-between max-w-md lg:max-w-5xl mx-auto">
          <div className="flex flex-col">
            {/* 네이티브 월 입력을 쓰지 않는다 — 브라우저 달력은 앱과 따로 놀고, 크롬에서는
                값을 비우는 [삭제] 까지 들어 있었다 (→ src/components/MonthPicker.tsx) */}
            <MonthPicker value={currentMonth} onChange={setCurrentMonth} labelClassName="text-lg" className="-ml-2" />
            <p className="text-xs text-slate-500 font-medium">{user?.display_name ?? ''}</p>
          </div>
          <div className="flex items-center gap-1">
            <Link href="/settings">
              <Button variant="ghost" size="icon" className="text-slate-400">
                <span className="material-symbols-outlined">settings</span>
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* 넓은 화면에서는 왼쪽에 "이 달이 어떤 상황인가"(요약·필터), 오른쪽에 목록을 둔다.
          좁은 화면에서는 지금처럼 위아래로 쌓인다. */}
      <div className="mx-auto w-full max-w-md lg:max-w-5xl lg:grid lg:grid-cols-[20rem_1fr] lg:gap-6 lg:items-start lg:px-4">
      <div className="lg:sticky lg:top-[89px]">
      <div className="p-4 lg:px-0">
        <div className="rounded-2xl p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col gap-4">
          <div>
            <p className="text-slate-500 dark:text-slate-400 text-xs font-medium uppercase tracking-wider">이번 달 잔액</p>
            <p className="text-slate-900 dark:text-white tracking-tight text-3xl font-bold">
              {new Intl.NumberFormat('ko-KR').format(monthSummary.balance)}원
            </p>
          </div>
          <div className="h-[1px] bg-slate-100 dark:bg-slate-800 w-full" />
          <div className="flex justify-between gap-4">
            <div>
              <p className="text-slate-500 dark:text-slate-400 text-[10px] font-medium uppercase tracking-wider">수입</p>
              <p className="text-emerald-500 text-lg font-bold">{new Intl.NumberFormat('ko-KR').format(monthSummary.income)}</p>
            </div>
            <div className="text-right">
              <p className="text-slate-500 dark:text-slate-400 text-[10px] font-medium uppercase tracking-wider">지출</p>
              <p className="text-rose-500 text-lg font-bold">{new Intl.NumberFormat('ko-KR').format(monthSummary.expense)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 lg:px-0 pb-3 flex items-center gap-2 flex-wrap">
        <div className="flex rounded-xl bg-slate-100 dark:bg-slate-900 p-1">
          {([['all', '전체'], ['income', '수입'], ['expense', '지출']] as const).map(([value, label]) => (
            <button key={value} onClick={() => changeTypeFilter(value)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-colors",
                typeFilter === value
                  ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm"
                  : "text-slate-400"
              )}>
              {label}
            </button>
          ))}
        </div>

        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}
          aria-label="카테고리 필터"
          className="h-8 rounded-xl bg-slate-100 dark:bg-slate-900 px-3 text-xs font-bold text-slate-600 dark:text-slate-300 border-none outline-none">
          <option value="all">전체 카테고리</option>
          {categoryOptions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        {/* 혼자 쓰는 달에는 고를 것이 없다. 그때는 아예 내보내지 않는다. */}
        {memberOptions.length > 1 && (
          <select value={memberFilter} onChange={(e) => setMemberFilter(e.target.value)}
            aria-label="구성원 필터"
            className="h-8 rounded-xl bg-slate-100 dark:bg-slate-900 px-3 text-xs font-bold text-slate-600 dark:text-slate-300 border-none outline-none">
            <option value="all">전체 구성원</option>
            {memberOptions.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        )}

        <button onClick={() => setSortOrder(prev => prev === 'newest' ? 'oldest' : 'newest')}
          className="ml-auto lg:ml-0 flex items-center gap-1 h-8 px-3 rounded-xl bg-slate-100 dark:bg-slate-900 text-xs font-bold text-slate-600 dark:text-slate-300">
          <span className="material-symbols-outlined text-[16px]">swap_vert</span>
          {sortOrder === 'newest' ? '최신순' : '오래된순'}
        </button>
      </div>

      </div>

      <div className="lg:pt-4">
      {filterActive && (
        <p className="px-4 lg:px-0 pb-2 text-[11px] font-bold text-slate-500 dark:text-slate-400">
          필터 결과 {visibleTransactions.length}건
          {filteredSummary.income > 0 && ` · 수입 ${new Intl.NumberFormat('ko-KR').format(filteredSummary.income)}원`}
          {filteredSummary.expense > 0 && ` · 지출 ${new Intl.NumberFormat('ko-KR').format(filteredSummary.expense)}원`}
        </p>
      )}

      <main className="lg:rounded-2xl lg:overflow-hidden lg:border lg:border-slate-200 lg:dark:border-slate-800">
        {loading && transactions.length === 0 ? (
          <div className="p-8 text-center text-slate-400">로딩 중...</div>
        ) : visibleTransactions.length === 0 ? (
          <div className="bg-slate-100 dark:bg-slate-900/50 rounded-xl p-8 text-center text-slate-500 mx-4 mt-4">
            <span className="material-symbols-outlined text-4xl mb-2">receipt_long</span>
            {transactions.length === 0 ? (
              <p>아직 내역이 없습니다.</p>
            ) : (
              <>
                <p>조건에 맞는 내역이 없습니다.</p>
                <button onClick={() => { setTypeFilter('all'); setCategoryFilter('all'); setMemberFilter('all'); }}
                  className="mt-3 text-xs font-bold text-emerald-500">필터 초기화</button>
              </>
            )}
          </div>
        ) : (
          groupedTransactions.map(([date, items]) => (
            <div key={date}>
              <div className="sticky lg:static top-[73px] z-20 bg-slate-50/95 dark:bg-slate-950/95 lg:bg-slate-50 lg:dark:bg-slate-900/60 backdrop-blur-sm py-2 px-4 border-b border-slate-100 dark:border-slate-800/50 flex justify-between items-center">
                <h3 className="text-xs font-bold">{date}</h3>
                <span className="text-[10px] text-slate-400">{items.length}건</span>
              </div>
              {items.map(item => (
                <TransactionItem key={item.id} item={item}
                  isMine={item.user_id === user?.id}
                  onDelete={() => handleDelete(item.id)}
                  onEdit={() => setEditing(item)} />
              ))}
            </div>
          ))
        )}
      </main>
      </div>
      </div>

      {/* 아래 탭바가 없는 넓은 화면에서는 버튼을 더 아래로 내린다 */}
      <button onClick={() => setIsAddEntryOpen(true)}
        className="fixed right-6 bottom-24 lg:bottom-8 lg:right-8 z-40 flex items-center justify-center rounded-full size-14 bg-emerald-500 text-white shadow-lg active:scale-95 transition-transform">
        <span className="material-symbols-outlined text-[32px]">add</span>
      </button>

      <AppNav />

      {(isAddEntryOpen || editing) && (
        <AddEntryModal
          onClose={() => { setIsAddEntryOpen(false); setEditing(null); }}
          onSave={handleSaveEntry}
          categories={categories}
          accounts={accounts}
          initial={editing ? {
            amount: editing.amount,
            categoryId: editing.category_id,
            description: editing.description,
            type: editing.type,
            date: editing.date,
            accountId: editing.account_id ?? null,
            interestAmount: editing.interest_amount ?? null,
          } : undefined}
        />
      )}
      {showUndo && <UndoToast onUndo={handleUndo} onClose={() => setShowUndo(false)} />}
    </div>
  );
}