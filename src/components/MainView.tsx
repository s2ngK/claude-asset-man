'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import AddEntryModal from '@/components/AddEntryModal';
import TransactionItem from '@/components/TransactionItem';
import UndoToast from '@/components/UndoToast';
import { Transaction, TransactionType } from '@/types';
import { DEFAULT_CATEGORIES } from '@/lib/constants';

interface MainViewProps {
  groupName: string;
  inviteCode: string;
}

export default function MainView({ groupName, inviteCode }: MainViewProps) {
  const [isAddEntryOpen, setIsAddEntryOpen] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [loading, setLoading] = useState(false);
  
  // Undo related state
  const [deletedItem, setDeletedItem] = useState<{ item: Transaction, index: number } | null>(null);
  const [showUndo, setShowUndo] = useState(false);
  const [deleteTimer, setDeleteTimer] = useState<NodeJS.Timeout | null>(null);

  const supabase = createClient();

  // 1. Fetch Transactions
  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Get current user's group_id first (optimization: pass from props if possible, but safe here)
    const { data: profile } = await supabase
      .from('profiles')
      .select('group_id')
      .eq('id', user.id)
      .single();
    
    if (!profile?.group_id) return;

    const startDate = `${currentMonth}-01`;
    const endDate = `${currentMonth}-31`; // Simple approximation

    const { data, error } = await supabase
      .from('transactions')
      .select(`
        *,
        categories (id, name, icon, color)
      `)
      .eq('user_id', user.id)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching transactions:', error);
    } else {
      setTransactions(data as Transaction[]);
    }
    setLoading(false);
  }, [currentMonth, supabase]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  // 2. Save Transaction (Insert)
  const handleSaveEntry = async (amount: number, categoryName: string, desc: string, type: TransactionType, date: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user');

      const { data: profile } = await supabase.from('profiles').select('group_id').eq('id', user.id).single();
      if (!profile?.group_id) throw new Error('No group');

      // Find Category ID by Name
      // First, try to find in DEFAULT_CATEGORIES to match the UI
      const defaultCat = DEFAULT_CATEGORIES.find(c => c.name === categoryName);
      
      // We need real DB category ID. 
      // Strategy: Look up in 'categories' table. If not found, use a fallback or error.
      // For MVP, we assume categories are already seeded as per Schema.
      let { data: catData } = await supabase
        .from('categories')
        .select('id')
        .eq('name', categoryName)
        .eq('type', type) // Ensure type matches
        .maybeSingle(); // Use maybeSingle to avoid error if not found immediately

      if (!catData) {
         // Fallback: Query without type if name is unique enough, or just pick first
         const { data: retryCat } = await supabase.from('categories').select('id').eq('name', categoryName).limit(1).single();
         catData = retryCat;
      }

      if (!catData) throw new Error(`Category not found: ${categoryName}`);

      const newTx = {
        group_id: profile.group_id,
        user_id: user.id,
        category_id: catData.id,
        type,
        amount,
        description: desc,
        date,
      };

      const { error } = await supabase.from('transactions').insert([newTx]);

      if (error) throw error;

      await fetchTransactions(); // Refresh list
    } catch (error: any) {
      console.error('Save failed:', error);
      alert('저장에 실패했습니다: ' + error.message);
    }
  };

  // 3. Delete Logic with Undo
  const handleDelete = (id: string) => {
    const index = transactions.findIndex(t => t.id === id);
    if (index === -1) return;

    const itemToDelete = transactions[index];
    
    // UI Optimistic Update
    setTransactions(prev => prev.filter(t => t.id !== id));
    setDeletedItem({ item: itemToDelete, index });
    setShowUndo(true);

    // Set Timer for actual deletion
    if (deleteTimer) clearTimeout(deleteTimer);
    
    const timer = setTimeout(async () => {
      // Actually delete from DB
      const { error } = await supabase.from('transactions').delete().eq('id', id);
      if (error) {
        console.error('Delete failed:', error);
        // Rollback UI if failed (optional, complicated)
        alert('삭제 중 오류가 발생했습니다.');
        fetchTransactions(); 
      }
      setShowUndo(false);
      setDeletedItem(null);
    }, 4000); // 4 seconds delay

    setDeleteTimer(timer);
  };

  const handleUndo = () => {
    if (deleteTimer) clearTimeout(deleteTimer);
    if (deletedItem) {
      const newTransactions = [...transactions];
      newTransactions.splice(deletedItem.index, 0, deletedItem.item);
      setTransactions(newTransactions);
    }
    setShowUndo(false);
    setDeletedItem(null);
  };

  // Grouping for Display
  const groupedTransactions = useMemo(() => {
    const groups: { [date: string]: Transaction[] } = {};
    transactions.forEach(t => {
      if (!groups[t.date]) groups[t.date] = [];
      groups[t.date].push(t);
    });
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [transactions]);

  // Summary
  const summary = useMemo(() => {
    const income = transactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
    const expense = transactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
    return { income, expense, balance: income - expense };
  }, [transactions]);

  const handleSignOut = async () => {
    if (confirm('로그아웃 하시겠습니까?')) {
      await supabase.auth.signOut();
      window.location.href = '/login';
    }
  };

  return (
    <div className="relative min-h-screen pb-24 bg-slate-50 dark:bg-slate-950">
      {/* Header with Month Selector */}
      <header className="sticky top-0 z-30 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 p-4">
         <div className="flex items-center justify-between max-w-md mx-auto">
             <div className="flex flex-col">
                <div className="flex items-center gap-2">
                    <input 
                        type="month" 
                        value={currentMonth}
                        onChange={(e) => setCurrentMonth(e.target.value)}
                        className="bg-transparent text-lg font-bold border-none p-0 focus:ring-0 cursor-pointer"
                    />
                    <span className="material-symbols-outlined text-slate-400">expand_more</span>
                </div>
                <p className="text-xs text-slate-500 font-medium">{groupName}</p>
             </div>
             <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="text-slate-400" onClick={() => alert('검색 기능은 준비 중입니다.')}>
                  <span className="material-symbols-outlined">search</span>
                </Button>
                <Button variant="ghost" size="icon" className="text-slate-400" onClick={handleSignOut}>
                  <span className="material-symbols-outlined">logout</span>
                </Button>
             </div>
         </div>
      </header>

      {/* Summary Card */}
      <div className="p-4 max-w-md mx-auto">
        <div className="rounded-2xl p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col gap-4">
          <div className="flex justify-between items-end">
            <div className="flex flex-col gap-1">
              <p className="text-slate-500 dark:text-slate-400 text-xs font-medium uppercase tracking-wider">이번 달 잔액</p>
              <p className="text-slate-900 dark:text-white tracking-tight text-3xl font-bold leading-tight">
                {new Intl.NumberFormat('ko-KR').format(summary.balance)}원
              </p>
            </div>
          </div>
          <div className="h-[1px] bg-slate-100 dark:bg-slate-800 w-full" />
          <div className="flex justify-between gap-4">
            <div className="flex flex-col gap-1 flex-1">
              <p className="text-slate-500 dark:text-slate-400 text-[10px] font-medium uppercase tracking-wider">수입</p>
              <p className="text-emerald-500 text-lg font-bold leading-tight">
                {new Intl.NumberFormat('ko-KR').format(summary.income)}
              </p>
            </div>
            <div className="flex flex-col gap-1 flex-1 text-right">
              <p className="text-slate-500 dark:text-slate-400 text-[10px] font-medium uppercase tracking-wider">지출</p>
              <p className="text-rose-500 text-lg font-bold leading-tight">
                {new Intl.NumberFormat('ko-KR').format(summary.expense)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Transactions List */}
      <main className="space-y-0 max-w-md mx-auto">
        {loading && transactions.length === 0 ? (
           <div className="p-8 text-center text-slate-400">로딩 중...</div>
        ) : transactions.length === 0 ? (
            <div className="bg-slate-100 dark:bg-slate-900/50 rounded-xl p-8 text-center text-slate-500 mx-4 mt-4">
            <span className="material-symbols-outlined text-4xl mb-2">receipt_long</span>
            <p>아직 내역이 없습니다.</p>
            <p className="text-sm">아래 + 버튼을 눌러 첫 내역을 추가해보세요!</p>
            </div>
        ) : (
            groupedTransactions.map(([date, items]) => (
                <div key={date}>
                    <div className="sticky top-[73px] z-20 bg-slate-50/95 dark:bg-slate-950/95 backdrop-blur-sm py-2 px-4 border-b border-slate-100 dark:border-slate-800/50 flex justify-between items-center">
                    <h3 className="text-slate-900 dark:text-white text-xs font-bold leading-tight tracking-tight uppercase">
                        {date}
                    </h3>
                    <span className="text-[10px] text-slate-400 font-medium">
                        {items.length}건
                    </span>
                    </div>
                    <div>
                    {items.map(item => (
                        <TransactionItem 
                        key={item.id} 
                        item={item} 
                        onDelete={() => handleDelete(item.id)}
                        />
                    ))}
                    </div>
                </div>
            ))
        )}
      </main>

      {/* Floating Action Button */}
      <button 
        onClick={() => setIsAddEntryOpen(true)}
        className="fixed right-6 bottom-24 z-40 flex items-center justify-center rounded-full size-14 bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 active:scale-95 transition-transform hover:scale-105"
      >
        <span className="material-symbols-outlined text-[32px]">add</span>
      </button>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800 z-40 pb-safe">
        <div className="flex justify-around items-center h-16 max-w-md mx-auto px-6">
          <Link href="/" className="flex flex-col items-center gap-1 text-emerald-500">
            <span className="material-symbols-outlined text-[24px]">home</span>
            <span className="text-[10px] font-bold">홈</span>
          </Link>
          <Link href="/stats" className="flex flex-col items-center gap-1 text-slate-400 hover:text-slate-600">
            <span className="material-symbols-outlined text-[24px]">insights</span>
            <span className="text-[10px] font-medium">통계</span>
          </Link>
        </div>
      </nav>

      {/* Add Entry Modal */}
      {isAddEntryOpen && (
        <AddEntryModal 
          onClose={() => setIsAddEntryOpen(false)} 
          onSave={handleSaveEntry}
        />
      )}

      {/* Undo Toast */}
      {showUndo && (
        <UndoToast onUndo={handleUndo} onClose={() => setShowUndo(false)} />
      )}
    </div>
  );
}
