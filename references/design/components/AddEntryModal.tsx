
import React, { useState, useEffect } from 'react';
import { CATEGORIES } from '../constants';
import { Transaction } from '../types';

interface AddEntryModalProps {
  onClose: () => void;
  onSave: (amount: number, categoryId: string, memo: string, type: 'expense' | 'income') => void;
  initialData?: Transaction;
  isEdit?: boolean;
}

const AddEntryModal: React.FC<AddEntryModalProps> = ({ onClose, onSave, initialData, isEdit = false }) => {
  const [entryMode, setEntryMode] = useState<'direct' | 'ai'>('direct');
  const [type, setType] = useState<'expense' | 'income'>(initialData?.type || 'expense');
  const [amountStr, setAmountStr] = useState(initialData?.amount?.toString() || '0');
  const [selectedCat, setSelectedCat] = useState(initialData?.category || 'food');
  const [memo, setMemo] = useState(initialData?.memo || '');

  const handleKeyPress = (key: string) => {
    if (key === 'back') {
      setAmountStr(prev => prev.length > 1 ? prev.slice(0, -1) : '0');
      return;
    }
    if (key === 'C') {
      setAmountStr('0');
      return;
    }
    setAmountStr(prev => {
      if (prev === '0') return key === '00' ? '0' : key;
      if (prev.length > 12) return prev;
      return prev + key;
    });
  };

  const handleDone = () => {
    onSave(parseInt(amountStr), selectedCat, memo, type);
    onClose();
  };

  const formattedAmount = new Intl.NumberFormat('ko-KR').format(parseInt(amountStr));

  return (
    <div className="fixed inset-0 z-[100] bg-background-light dark:bg-background-dark animate-in slide-in-from-bottom duration-300 flex flex-col max-w-md mx-auto h-full shadow-2xl overflow-hidden font-display">
      {/* Top Handle bar (Visual only) */}
      <div className="flex justify-center pt-3 pb-1">
        <div className="w-12 h-1 bg-slate-200 dark:bg-white/20 rounded-full" />
      </div>

      {/* Main Content Area */}
      <div className="p-4 flex flex-col gap-4 overflow-y-auto no-scrollbar">
        {/* Mode Toggle - HIDDEN in edit mode as requested */}
        {!isEdit && (
          <div className="bg-slate-100 dark:bg-white/5 p-1.5 rounded-2xl flex">
            <button 
              onClick={() => setEntryMode('direct')}
              className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${entryMode === 'direct' ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-400'}`}
            >
              직접 입력
            </button>
            <button 
              onClick={() => setEntryMode('ai')}
              className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${entryMode === 'ai' ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-400'}`}
            >
              AI 영수증 스캔
            </button>
          </div>
        )}

        {/* Expense / Income Toggle */}
        <div className="flex gap-3">
          <button 
            onClick={() => setType('expense')}
            className={`flex-1 py-4 border-2 rounded-2xl font-bold transition-all ${type === 'expense' ? 'border-rose-200 bg-rose-50 text-rose-500 dark:bg-rose-500/10 dark:border-rose-500/30' : 'border-slate-100 dark:border-white/5 text-slate-400'}`}
          >
            지출
          </button>
          <button 
            onClick={() => setType('income')}
            className={`flex-1 py-4 border-2 rounded-2xl font-bold transition-all ${type === 'income' ? 'border-indigo-200 bg-indigo-50 text-indigo-600 dark:bg-indigo-600/10 dark:border-indigo-600/30' : 'border-slate-100 dark:border-white/5 text-slate-400'}`}
          >
            수입
          </button>
        </div>

        {/* Amount Box */}
        <div className="bg-slate-100/50 dark:bg-white/5 rounded-2xl p-6 flex flex-col gap-1">
          <span className="text-slate-400 text-xs font-bold">{type === 'expense' ? '지출 금액' : '수입 금액'}</span>
          <div className="text-indigo-600 dark:text-indigo-400 text-3xl font-bold tracking-tight">
            {formattedAmount}
          </div>
        </div>

        {/* Description Input */}
        <div className="flex flex-col gap-2">
          <span className="text-slate-400 text-xs font-bold px-1">내용</span>
          <input 
            type="text" 
            placeholder={type === 'expense' ? "어디서 지출하셨나요?" : "어디서 수입이 발생했나요?"}
            className="w-full bg-slate-100/50 dark:bg-white/5 border-none rounded-2xl h-14 px-4 text-slate-800 dark:text-white placeholder:text-slate-400 font-medium focus:ring-2 focus:ring-indigo-500/20"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
          />
        </div>

        {/* Date & Category side-by-side */}
        <div className="flex gap-4">
          <div className="flex-1 flex flex-col gap-2">
            <span className="text-slate-400 text-xs font-bold px-1">날짜</span>
            <div className="bg-slate-100/50 dark:bg-white/5 rounded-2xl h-14 px-4 flex items-center justify-between">
              <span className="text-slate-700 dark:text-slate-200 font-medium text-sm">{initialData?.date || '2026-01-09'}</span>
              <span className="material-symbols-outlined text-slate-300 text-[20px]">calendar_today</span>
            </div>
          </div>
          <div className="flex-1 flex flex-col gap-2">
            <span className="text-slate-400 text-xs font-bold px-1">카테고리</span>
            <div className="bg-slate-100/50 dark:bg-white/5 rounded-2xl h-14 px-4 flex items-center justify-between">
              <span className="text-slate-700 dark:text-slate-200 font-medium text-sm">
                {CATEGORIES.find(c => c.id === selectedCat)?.name || '기타'}
              </span>
              <span className="material-symbols-outlined text-slate-300 text-[20px]">expand_more</span>
            </div>
          </div>
        </div>
      </div>

      {/* Custom Keypad Footer */}
      <div className="mt-auto bg-indigo-50/50 dark:bg-slate-900/50 p-4 border-t border-indigo-100 dark:border-white/5">
        <div className="grid grid-cols-4 gap-3">
          <KeypadButton label="7" onClick={handleKeyPress} />
          <KeypadButton label="8" onClick={handleKeyPress} />
          <KeypadButton label="9" onClick={handleKeyPress} />
          <KeypadButton label="C" onClick={handleKeyPress} variant="action" />

          <KeypadButton label="4" onClick={handleKeyPress} />
          <KeypadButton label="5" onClick={handleKeyPress} />
          <KeypadButton label="6" onClick={handleKeyPress} />
          <KeypadButton label="back" onClick={handleKeyPress} variant="action" icon="backspace" />

          <KeypadButton label="1" onClick={handleKeyPress} />
          <KeypadButton label="2" onClick={handleKeyPress} />
          <KeypadButton label="3" onClick={handleKeyPress} />
          <KeypadButton label="+" onClick={handleKeyPress} variant="action" />

          <KeypadButton label="0" onClick={handleKeyPress} />
          <KeypadButton label="00" onClick={handleKeyPress} />
          <KeypadButton label="-" onClick={handleKeyPress} variant="action" />
          <KeypadButton label="*" onClick={handleKeyPress} variant="action" />
        </div>

        <div className="mt-4 flex gap-3">
            <button onClick={onClose} className="flex-1 h-14 bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-slate-400 font-bold rounded-2xl shadow-sm">취소</button>
            <button onClick={handleDone} className="flex-[2] h-14 bg-background-dark dark:bg-primary dark:text-background-dark text-white font-bold rounded-2xl shadow-xl">완료</button>
        </div>
      </div>
    </div>
  );
};

const KeypadButton: React.FC<{ 
  label: string; 
  onClick: (k: string) => void; 
  variant?: 'number' | 'action';
  icon?: string;
}> = ({ label, onClick, variant = 'number', icon }) => {
  return (
    <button 
      onClick={() => onClick(label)}
      className={`h-14 flex items-center justify-center rounded-2xl text-xl font-bold shadow-sm active:scale-95 transition-transform ${variant === 'action' ? 'bg-indigo-50 dark:bg-white/5 text-indigo-500' : 'bg-white dark:bg-white/10 text-slate-800 dark:text-white'}`}
    >
      {icon ? <span className="material-symbols-outlined text-2xl">{icon}</span> : label}
    </button>
  );
};

export default AddEntryModal;
