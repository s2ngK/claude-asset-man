'use client';

import React, { useState } from 'react';
import { DEFAULT_CATEGORIES } from '@/lib/constants';
import { TransactionType } from '@/types';
import { cn } from '@/lib/utils';
import { Button } from './ui/button';

interface AddEntryModalProps {
  onClose: () => void;
  onSave: (amount: number, categoryName: string, description: string, type: TransactionType, date: string) => void;
  initialData?: any;
}

const AddEntryModal: React.FC<AddEntryModalProps> = ({ onClose, onSave, initialData }) => {
  const [type, setType] = useState<TransactionType>(initialData?.type || 'expense');
  const [amountStr, setAmountStr] = useState(initialData?.amount?.toString() || '0');
  const [selectedCat, setSelectedCat] = useState(initialData?.category || '식비');
  const [description, setDescription] = useState(initialData?.description || '');
  const [date, setDate] = useState(initialData?.date || new Date().toISOString().split('T')[0]);

  const handleKeyPress = (key: string) => {
    if (key === 'back') { setAmountStr((prev) => prev.length > 1 ? prev.slice(0, -1) : '0'); return; }
    if (key === 'C') { setAmountStr('0'); return; }
    setAmountStr((prev) => {
      if (prev === '0') return key === '00' ? '0' : key;
      if (prev.length > 12) return prev;
      return prev + key;
    });
  };

  const handleDone = () => {
    onSave(parseInt(amountStr.replace(/[^0-9]/g, '') || '0'), selectedCat, description, type, date);
    onClose();
  };

  const formattedAmount = new Intl.NumberFormat('ko-KR').format(parseInt(amountStr.replace(/[^0-9]/g, '') || '0'));

  return (
    <div className="fixed inset-0 z-50 bg-white dark:bg-slate-950 flex flex-col max-w-md mx-auto h-full animate-in slide-in-from-bottom duration-300">
      <div className="flex justify-center pt-3 pb-1">
        <div className="w-12 h-1 bg-slate-200 dark:bg-slate-700 rounded-full" />
      </div>

      <div className="p-4 flex flex-col gap-4 overflow-y-auto no-scrollbar flex-1">
        <div className="flex gap-3">
          <button onClick={() => setType('expense')} className={cn("flex-1 py-4 border-2 rounded-2xl font-bold transition-all", type === 'expense' ? "border-rose-200 bg-rose-50 text-rose-500 dark:bg-rose-500/10 dark:border-rose-500/30" : "border-slate-100 dark:border-slate-800 text-slate-400")}>지출</button>
          <button onClick={() => setType('income')} className={cn("flex-1 py-4 border-2 rounded-2xl font-bold transition-all", type === 'income' ? "border-indigo-200 bg-indigo-50 text-indigo-600 dark:bg-indigo-600/10 dark:border-indigo-600/30" : "border-slate-100 dark:border-slate-800 text-slate-400")}>수입</button>
        </div>

        <div className="bg-slate-50 dark:bg-slate-900 rounded-2xl p-6 flex flex-col gap-1 text-right">
          <span className="text-slate-400 text-xs font-bold">{type === 'expense' ? '지출 금액' : '수입 금액'}</span>
          <div className="text-indigo-600 dark:text-indigo-400 text-4xl font-bold tracking-tight">
            {formattedAmount}<span className="text-xl text-slate-400 ml-1">원</span>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-slate-400 text-xs font-bold px-1">내용</span>
          <input type="text" placeholder={type === 'expense' ? "어디서 지출하셨나요?" : "어디서 수입이 발생했나요?"}
            className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl h-14 px-4 text-slate-800 dark:text-white placeholder:text-slate-400 font-medium focus:ring-2 focus:ring-indigo-500/20 outline-none"
            value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>

        <div className="flex gap-4">
          <div className="flex-1 flex flex-col gap-2">
            <span className="text-slate-400 text-xs font-bold px-1">날짜</span>
            <div className="bg-slate-50 dark:bg-slate-900 rounded-2xl h-14 px-4 flex items-center">
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                className="bg-transparent border-none text-slate-700 dark:text-slate-200 font-medium text-sm w-full outline-none" />
            </div>
          </div>
          <div className="flex-1 flex flex-col gap-2">
            <span className="text-slate-400 text-xs font-bold px-1">카테고리</span>
            <select value={selectedCat} onChange={(e) => setSelectedCat(e.target.value)}
              className="bg-slate-50 dark:bg-slate-900 rounded-2xl h-14 px-4 w-full border-none outline-none text-slate-700 dark:text-slate-200 font-medium text-sm appearance-none">
              {DEFAULT_CATEGORIES.filter(c => c.type === type).map(cat => (
                <option key={cat.id} value={cat.name}>{cat.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="mt-auto bg-indigo-50/50 dark:bg-slate-900/50 p-4 border-t border-indigo-100 dark:border-slate-800">
        <div className="grid grid-cols-4 gap-3">
          {['7','8','9','C','4','5','6','back','1','2','3','+','0','00','-','완료'].map(label => (
            <KeypadButton key={label} label={label} onClick={handleKeyPress} onDone={handleDone}
              variant={label === '완료' ? 'primary' : ['C','back','+','-'].includes(label) ? 'action' : 'number'} />
          ))}
        </div>
        <div className="mt-4">
          <Button variant="ghost" onClick={onClose} className="w-full text-slate-400">닫기</Button>
        </div>
      </div>
    </div>
  );
};

const KeypadButton: React.FC<{ label: string; onClick: (k: string) => void; onDone: () => void; variant?: 'number' | 'action' | 'primary'; }> = ({ label, onClick, onDone, variant = 'number' }) => {
  const bgColor = variant === 'primary' ? 'bg-indigo-600 text-white' : variant === 'action' ? 'bg-indigo-50 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400' : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-white';
  return (
    <button onClick={() => label === '완료' ? onDone() : onClick(label)}
      className={cn("h-14 flex items-center justify-center rounded-2xl text-xl font-bold shadow-sm active:scale-95 transition-transform", bgColor)}>
      {label === 'back' ? <span className="material-symbols-outlined text-2xl">backspace</span> : label}
    </button>
  );
};

export default AddEntryModal;
