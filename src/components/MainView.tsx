'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import AddEntryModal from '@/components/AddEntryModal';
import { TransactionType } from '@/types';

interface MainViewProps {
  groupName: string;
  inviteCode: string;
}

export default function MainView({ groupName, inviteCode }: MainViewProps) {
  const [isAddEntryOpen, setIsAddEntryOpen] = useState(false);

  const handleSaveEntry = (amount: number, category: string, desc: string, type: TransactionType, date: string) => {
    console.log('Saving entry:', { amount, category, desc, type, date });
    alert(`저장되었습니다! (아직 DB 미연동)\n${type === 'income' ? '+' : '-'}${amount}원`);
    // TODO: Task 7에서 Supabase Insert 구현
  };

  return (
    <div className="relative min-h-screen pb-24">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 p-4 flex items-center justify-between">
         <div>
            <h2 className="text-lg font-bold">{groupName}</h2>
            <p className="text-xs text-slate-500">코드: {inviteCode}</p>
         </div>
         <Button variant="ghost" size="icon">
           <span className="material-symbols-outlined">settings</span>
         </Button>
      </header>

      {/* Content Placeholder */}
      <main className="p-4 space-y-4">
        <div className="bg-slate-100 dark:bg-slate-900 rounded-xl p-8 text-center text-slate-500">
          <span className="material-symbols-outlined text-4xl mb-2">receipt_long</span>
          <p>아직 내역이 없습니다.</p>
          <p className="text-sm">아래 + 버튼을 눌러 첫 내역을 추가해보세요!</p>
        </div>
      </main>

      {/* Floating Action Button */}
      <button 
        onClick={() => setIsAddEntryOpen(true)}
        className="fixed right-6 bottom-24 z-40 flex items-center justify-center rounded-full size-14 bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 active:scale-95 transition-transform hover:scale-105"
      >
        <span className="material-symbols-outlined text-[32px]">add</span>
      </button>

      {/* Bottom Navigation (Placeholder) */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800 z-40 pb-safe">
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

      {/* Add Entry Modal */}
      {isAddEntryOpen && (
        <AddEntryModal 
          onClose={() => setIsAddEntryOpen(false)} 
          onSave={handleSaveEntry}
        />
      )}
    </div>
  );
}
