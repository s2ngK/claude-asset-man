
import React, { useState, useMemo } from 'react';
import { Transaction } from '../types';
import TransactionItem from './TransactionItem';

interface SearchModalProps {
  transactions: Transaction[];
  onClose: () => void;
  onDeleteTransaction: (id: string) => void;
}

const SearchModal: React.FC<SearchModalProps> = ({ transactions, onClose, onDeleteTransaction }) => {
  const [query, setQuery] = useState('');

  const filteredResults = useMemo(() => {
    if (!query.trim()) return [];
    const lowerQuery = query.toLowerCase();
    return transactions.filter(t => 
      t.title.toLowerCase().includes(lowerQuery) || 
      (t.memo && t.memo.toLowerCase().includes(lowerQuery))
    );
  }, [query, transactions]);

  return (
    <div className="fixed inset-0 z-[110] bg-background-light dark:bg-background-dark animate-in slide-in-from-top duration-300 flex flex-col max-w-md mx-auto h-full">
      <header className="p-4 border-b border-slate-200 dark:border-white/10 flex items-center gap-3">
        <button onClick={onClose} className="p-1 text-slate-500 dark:text-slate-400">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <div className="flex-1 relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-400 text-xl">search</span>
          <input 
            autoFocus
            type="text"
            placeholder="내역 검색 (상호명, 메모 등)"
            className="w-full h-11 bg-slate-100 dark:bg-white/5 border-none rounded-xl pl-10 pr-4 text-sm focus:ring-2 focus:ring-primary/50 text-slate-900 dark:text-white"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {query && (
          <button onClick={() => setQuery('')} className="text-slate-400 text-xs font-bold">지우기</button>
        )}
      </header>

      <main className="flex-1 overflow-y-auto no-scrollbar">
        {!query && (
          <div className="p-8 text-center flex flex-col items-center justify-center h-full opacity-50">
            <span className="material-symbols-outlined text-6xl mb-4">search_off</span>
            <p className="text-sm font-medium">검색어를 입력하여 지출 내역을 찾아보세요.</p>
          </div>
        )}
        
        {query && filteredResults.length === 0 && (
          <div className="p-8 text-center flex flex-col items-center justify-center h-full">
            <span className="material-symbols-outlined text-6xl mb-4 text-slate-200">sentiment_dissatisfied</span>
            <p className="text-slate-500">검색 결과가 없습니다.</p>
          </div>
        )}

        {query && filteredResults.length > 0 && (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            <p className="px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-widest bg-slate-50 dark:bg-white/5">검색 결과 {filteredResults.length}건</p>
            {filteredResults.map(item => (
              <TransactionItem 
                key={item.id} 
                item={item} 
                onDelete={() => onDeleteTransaction(item.id)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default SearchModal;
