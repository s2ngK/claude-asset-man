'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import AddEntryModal from '@/components/AddEntryModal';
import TransactionItem from '@/components/TransactionItem';
import UndoToast from '@/components/UndoToast';
import { Transaction, TransactionType } from '@/types';
import { cn, getErrorMessage } from '@/lib/utils';
import {
  getTransactions, createTransaction, updateTransaction, deleteTransaction,
  getCategories, getLocalUser,
  type Transaction as ApiTransaction,
  type Category as ApiCategory,
} from '@/lib/api';

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
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all'); // category_id 또는 'all'

  const user = getLocalUser();

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

  useEffect(() => { fetchTransactions(); }, [fetchTransactions]);

  // 필터 드롭다운과 저장 시 이름→id 매칭에 함께 쓴다. 한 번만 받아둔다.
  useEffect(() => {
    getCategories().then(setCategories).catch(err => console.error('category fetch error', err));
  }, []);

  const handleSaveEntry = async (amount: number, categoryName: string, desc: string, type: TransactionType, date: string) => {
    try {
      const cats = categories.length ? categories : await getCategories();
      const cat = cats.find(c => c.name === categoryName && c.type === type) ?? cats.find(c => c.name === categoryName);
      if (!cat) throw new Error(`카테고리를 찾을 수 없습니다: ${categoryName}`);
      const payload = { category_id: cat.id, type, amount, description: desc, date };
      // editing 은 모달이 닫히기 전에 읽힌다 (onSave → onClose 순서).
      if (editing) {
        await updateTransaction(editing.id, payload);
      } else {
        await createTransaction(payload);
      }
      await fetchTransactions();
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
      });
    } catch (err) {
      alert('되돌리기 실패: ' + getErrorMessage(err, '알 수 없는 오류'));
    }
    await fetchTransactions();
  };

  const filterActive = typeFilter !== 'all' || categoryFilter !== 'all';

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
      (categoryFilter === 'all' || t.category_id === categoryFilter)
    );
    // 같은 날짜 안에서는 **입력 순서**로 가른다. 날짜만 보면 오늘 넣은 것들의 순서가
    // 서버가 준 순서에 맡겨져, 방금 적은 항목이 어디 있는지 알 수 없다.
    const key = (t: Transaction) => `${t.date} ${t.created_at ?? ''}`;
    return [...filtered].sort((a, b) =>
      sortOrder === 'newest' ? key(b).localeCompare(key(a)) : key(a).localeCompare(key(b)));
  }, [transactions, typeFilter, categoryFilter, sortOrder]);

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

  // 요약 카드는 **필터와 무관하게 그 달 전체**를 보여준다. 기준점이 필터마다 흔들리면
  // (수입만 보면 지출이 0 으로 떨어진다) 무엇과 비교하는 숫자인지 알 수 없다.
  const summary = useMemo(() => totals(transactions), [transactions]);
  // 대신 "지금 걸러낸 것들의 합" 은 목록 바로 위 한 줄로 따로 말해준다.
  const filteredSummary = useMemo(() => totals(visibleTransactions), [visibleTransactions]);

  return (
    <div className="relative min-h-screen pb-24 bg-slate-50 dark:bg-slate-950">
      <header className="sticky top-0 z-30 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 p-4">
        <div className="flex items-center justify-between max-w-md mx-auto">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              {/* required 를 주면 크롬 월 선택기에서 [삭제](지우기)가 사라진다. 값을 비우면
                  month 파라미터가 빠져 그 달이 아니라 전체가 조회되므로, 애초에 못 비우게 한다.
                  다른 브라우저를 대비해 onChange 에서도 빈 값을 막는다. */}
              <input type="month" value={currentMonth} required
                onChange={(e) => { if (e.target.value) setCurrentMonth(e.target.value); }}
                className="bg-transparent text-lg font-bold border-none p-0 focus:ring-0 cursor-pointer" />
              <span className="material-symbols-outlined text-slate-400">expand_more</span>
            </div>
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

      <div className="p-4 max-w-md mx-auto">
        <div className="rounded-2xl p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col gap-4">
          <div>
            <p className="text-slate-500 dark:text-slate-400 text-xs font-medium uppercase tracking-wider">이번 달 잔액</p>
            <p className="text-slate-900 dark:text-white tracking-tight text-3xl font-bold">
              {new Intl.NumberFormat('ko-KR').format(summary.balance)}원
            </p>
          </div>
          <div className="h-[1px] bg-slate-100 dark:bg-slate-800 w-full" />
          <div className="flex justify-between gap-4">
            <div>
              <p className="text-slate-500 dark:text-slate-400 text-[10px] font-medium uppercase tracking-wider">수입</p>
              <p className="text-emerald-500 text-lg font-bold">{new Intl.NumberFormat('ko-KR').format(summary.income)}</p>
            </div>
            <div className="text-right">
              <p className="text-slate-500 dark:text-slate-400 text-[10px] font-medium uppercase tracking-wider">지출</p>
              <p className="text-rose-500 text-lg font-bold">{new Intl.NumberFormat('ko-KR').format(summary.expense)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 pb-3 max-w-md mx-auto flex items-center gap-2 flex-wrap">
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

        <button onClick={() => setSortOrder(prev => prev === 'newest' ? 'oldest' : 'newest')}
          className="ml-auto flex items-center gap-1 h-8 px-3 rounded-xl bg-slate-100 dark:bg-slate-900 text-xs font-bold text-slate-600 dark:text-slate-300">
          <span className="material-symbols-outlined text-[16px]">swap_vert</span>
          {sortOrder === 'newest' ? '최신순' : '오래된순'}
        </button>
      </div>

      {filterActive && (
        <p className="px-4 pb-2 max-w-md mx-auto text-[11px] font-bold text-slate-500 dark:text-slate-400">
          필터 결과 {visibleTransactions.length}건
          {filteredSummary.income > 0 && ` · 수입 ${new Intl.NumberFormat('ko-KR').format(filteredSummary.income)}원`}
          {filteredSummary.expense > 0 && ` · 지출 ${new Intl.NumberFormat('ko-KR').format(filteredSummary.expense)}원`}
        </p>
      )}

      <main className="max-w-md mx-auto">
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
                <button onClick={() => { setTypeFilter('all'); setCategoryFilter('all'); }}
                  className="mt-3 text-xs font-bold text-emerald-500">필터 초기화</button>
              </>
            )}
          </div>
        ) : (
          groupedTransactions.map(([date, items]) => (
            <div key={date}>
              <div className="sticky top-[73px] z-20 bg-slate-50/95 dark:bg-slate-950/95 backdrop-blur-sm py-2 px-4 border-b border-slate-100 dark:border-slate-800/50 flex justify-between items-center">
                <h3 className="text-xs font-bold">{date}</h3>
                <span className="text-[10px] text-slate-400">{items.length}건</span>
              </div>
              {items.map(item => (
                <TransactionItem key={item.id} item={item}
                  onDelete={() => handleDelete(item.id)}
                  onEdit={item.user_id === user?.id ? () => setEditing(item) : undefined} />
              ))}
            </div>
          ))
        )}
      </main>

      <button onClick={() => setIsAddEntryOpen(true)}
        className="fixed right-6 bottom-24 z-40 flex items-center justify-center rounded-full size-14 bg-emerald-500 text-white shadow-lg active:scale-95 transition-transform">
        <span className="material-symbols-outlined text-[32px]">add</span>
      </button>

      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800 z-40">
        <div className="flex justify-around items-center h-16 max-w-md mx-auto px-6">
          <Link href="/" className="flex flex-col items-center gap-1 text-emerald-500">
            <span className="material-symbols-outlined text-[24px]">home</span>
            <span className="text-[10px] font-bold">홈</span>
          </Link>
          <Link href="/stats" className="flex flex-col items-center gap-1 text-slate-400">
            <span className="material-symbols-outlined text-[24px]">insights</span>
            <span className="text-[10px] font-medium">통계</span>
          </Link>
        </div>
      </nav>

      {(isAddEntryOpen || editing) && (
        <AddEntryModal
          onClose={() => { setIsAddEntryOpen(false); setEditing(null); }}
          onSave={handleSaveEntry}
          initial={editing ? {
            amount: editing.amount,
            categoryName: editing.categories?.name ?? '기타',
            description: editing.description,
            type: editing.type,
            date: editing.date,
          } : undefined}
        />
      )}
      {showUndo && <UndoToast onUndo={handleUndo} onClose={() => setShowUndo(false)} />}
    </div>
  );
}