
import React, { useMemo } from 'react';
import { Transaction } from '../types';
import TransactionItem from './TransactionItem';

interface HomeViewProps {
  transactions: Transaction[];
  onDeleteTransaction: (id: string) => void;
  onOpenSearch: () => void;
  onEditTransaction: (id: string) => void;
}

const HomeView: React.FC<HomeViewProps> = ({ transactions, onDeleteTransaction, onOpenSearch, onEditTransaction }) => {
  const summary = useMemo(() => {
    const income = transactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
    const expense = transactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
    return { income, expense, balance: income - expense };
  }, [transactions]);

  const groupedTransactions = useMemo(() => {
    const groups: { [date: string]: Transaction[] } = {};
    transactions.forEach(t => {
      if (!groups[t.date]) groups[t.date] = [];
      groups[t.date].push(t);
    });
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [transactions]);

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(amount);
  };

  return (
    <div className="animate-in fade-in duration-300">
      <header className="sticky top-0 z-30 bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center p-4 justify-between">
          <div className="size-10 rounded-full border-2 border-primary/20 bg-cover bg-center" style={{ backgroundImage: 'url(https://picsum.photos/seed/user/100)' }}></div>
          <div className="flex flex-col items-center">
            <h2 className="text-slate-900 dark:text-white text-base font-bold leading-tight tracking-tight">2023년 10월</h2>
            <span className="text-[10px] uppercase tracking-widest text-primary font-semibold">가계부</span>
          </div>
          <button 
            onClick={onOpenSearch}
            className="flex items-center justify-center rounded-full h-10 w-10 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 active:scale-90 transition-all"
          >
            <span className="material-symbols-outlined text-[24px]">search</span>
          </button>
        </div>
      </header>

      <div className="p-4">
        <div className="rounded-xl p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col gap-4">
          <div className="flex justify-between items-end">
            <div className="flex flex-col gap-1">
              <p className="text-slate-500 dark:text-slate-400 text-xs font-medium uppercase tracking-wider">이번 달 잔액</p>
              <p className="text-slate-900 dark:text-white tracking-tight text-3xl font-bold leading-tight">{formatAmount(summary.balance)}</p>
            </div>
            <div className="bg-primary/10 text-primary px-2 py-1 rounded text-xs font-bold">
              지난달보다 +8.4%
            </div>
          </div>
          <div className="h-[1px] bg-slate-100 dark:bg-slate-800 w-full" />
          <div className="flex justify-between gap-4">
            <div className="flex flex-col gap-1 flex-1">
              <p className="text-slate-500 dark:text-slate-400 text-[10px] font-medium uppercase tracking-wider">수입</p>
              <p className="text-primary text-lg font-bold leading-tight">{formatAmount(summary.income)}</p>
            </div>
            <div className="flex flex-col gap-1 flex-1 text-right">
              <p className="text-slate-500 dark:text-slate-400 text-[10px] font-medium uppercase tracking-wider">지출</p>
              <p className="text-rose-500 text-lg font-bold leading-tight">{formatAmount(summary.expense)}</p>
            </div>
          </div>
        </div>
      </div>

      <section>
        {groupedTransactions.map(([date, items]) => (
          <div key={date}>
            <div className="sticky top-[73px] z-20 bg-background-light dark:bg-background-dark py-2 px-4">
              <h3 className="text-slate-900 dark:text-white text-sm font-bold leading-tight tracking-tight uppercase">
                {date === '2023-10-27' ? '오늘, 10월 27일' : date === '2023-10-26' ? '어제, 10월 26일' : date}
              </h3>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {items.map(item => (
                <TransactionItem 
                  key={item.id} 
                  item={item} 
                  onDelete={() => onDeleteTransaction(item.id)}
                  onEdit={() => onEditTransaction(item.id)}
                />
              ))}
            </div>
          </div>
        ))}
        {transactions.length === 0 && (
          <div className="p-12 text-center">
            <span className="material-symbols-outlined text-slate-300 text-6xl mb-4">history</span>
            <p className="text-slate-400">내역이 없습니다.</p>
          </div>
        )}
      </section>
    </div>
  );
};

export default HomeView;
