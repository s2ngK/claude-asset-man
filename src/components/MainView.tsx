'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import AddEntryModal from '@/components/AddEntryModal';
import TransactionItem from '@/components/TransactionItem';
import UndoToast from '@/components/UndoToast';
import { Transaction, TransactionType } from '@/types';
import {
  getTransactions, createTransaction, deleteTransaction,
  getCategories, getLocalUser,
  type Transaction as ApiTransaction,
} from '@/lib/api';

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
  } as any;
}

export default function MainView() {
  const [isAddEntryOpen, setIsAddEntryOpen] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date().toISOString().slice(0, 7));
  const [loading, setLoading] = useState(false);
  const [deletedItem, setDeletedItem] = useState<{ item: Transaction; index: number } | null>(null);
  const [showUndo, setShowUndo] = useState(false);
  const [deleteTimer, setDeleteTimer] = useState<NodeJS.Timeout | null>(null);

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

  const handleSaveEntry = async (amount: number, categoryName: string, desc: string, type: TransactionType, date: string) => {
    try {
      const cats = await getCategories();
      const cat = cats.find(c => c.name === categoryName && c.type === type) ?? cats.find(c => c.name === categoryName);
      if (!cat) throw new Error(`카테고리를 찾을 수 없습니다: ${categoryName}`);
      await createTransaction({ category_id: cat.id, type, amount, description: desc, date });
      await fetchTransactions();
    } catch (err: any) {
      alert('저장 실패: ' + err.message);
    }
  };

  const handleDelete = (id: string) => {
    const index = transactions.findIndex(t => t.id === id);
    if (index === -1) return;
    const itemToDelete = transactions[index];
    setTransactions(prev => prev.filter(t => t.id !== id));
    setDeletedItem({ item: itemToDelete, index });
    setShowUndo(true);
    if (deleteTimer) clearTimeout(deleteTimer);
    const timer = setTimeout(async () => {
      try { await deleteTransaction(id); } catch { fetchTransactions(); }
      setShowUndo(false);
      setDeletedItem(null);
    }, 4000);
    setDeleteTimer(timer);
  };

  const handleUndo = () => {
    if (deleteTimer) clearTimeout(deleteTimer);
    if (deletedItem) {
      const next = [...transactions];
      next.splice(deletedItem.index, 0, deletedItem.item);
      setTransactions(next);
    }
    setShowUndo(false);
    setDeletedItem(null);
  };

  const groupedTransactions = useMemo(() => {
    const groups: { [date: string]: Transaction[] } = {};
    transactions.forEach(t => { if (!groups[t.date]) groups[t.date] = []; groups[t.date].push(t); });
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [transactions]);

  const summary = useMemo(() => {
    const income = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    return { income, expense, balance: income - expense };
  }, [transactions]);

  return (
    <div className="relative min-h-screen pb-24 bg-slate-50 dark:bg-slate-950">
      <header className="sticky top-0 z-30 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 p-4">
        <div className="flex items-center justify-between max-w-md mx-auto">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <input type="month" value={currentMonth} onChange={(e) => setCurrentMonth(e.target.value)}
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

      <main className="max-w-md mx-auto">
        {loading && transactions.length === 0 ? (
          <div className="p-8 text-center text-slate-400">로딩 중...</div>
        ) : transactions.length === 0 ? (
          <div className="bg-slate-100 dark:bg-slate-900/50 rounded-xl p-8 text-center text-slate-500 mx-4 mt-4">
            <span className="material-symbols-outlined text-4xl mb-2">receipt_long</span>
            <p>아직 내역이 없습니다.</p>
          </div>
        ) : (
          groupedTransactions.map(([date, items]) => (
            <div key={date}>
              <div className="sticky top-[73px] z-20 bg-slate-50/95 dark:bg-slate-950/95 backdrop-blur-sm py-2 px-4 border-b border-slate-100 dark:border-slate-800/50 flex justify-between items-center">
                <h3 className="text-xs font-bold">{date}</h3>
                <span className="text-[10px] text-slate-400">{items.length}건</span>
              </div>
              {items.map(item => (
                <TransactionItem key={item.id} item={item} onDelete={() => handleDelete(item.id)} />
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

      {isAddEntryOpen && (
        <AddEntryModal onClose={() => setIsAddEntryOpen(false)} onSave={handleSaveEntry} />
      )}
      {showUndo && <UndoToast onUndo={handleUndo} onClose={() => setShowUndo(false)} />}
    </div>
  );
}