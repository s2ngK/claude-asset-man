'use client';

import React, { useState } from 'react';
import { DEFAULT_CATEGORIES } from '@/lib/constants';
import { TransactionType } from '@/types';
import { cn } from '@/lib/utils';
import { Button } from './ui/button';

interface AddEntryModalProps {
  onClose: () => void;
  onSave: (amount: number, categoryName: string, description: string, type: TransactionType, date: string) => void;
  /**
   * 있으면 **수정 모드**다. 폼을 이 값으로 채우고 문구만 바꾼다.
   * 만들기냐 고치기냐의 판단은 `MainView` 가 한다 — 이 컴포넌트는 값만 모아 돌려준다.
   */
  initial?: {
    amount: number;
    categoryName: string;
    description: string;
    type: TransactionType;
    date: string;
  };
}

const AddEntryModal: React.FC<AddEntryModalProps> = ({ onClose, onSave, initial }) => {
  const isEditing = initial !== undefined;
  const [type, setType] = useState<TransactionType>(initial?.type ?? 'expense');
  const [amountStr, setAmountStr] = useState(initial ? String(initial.amount) : '0');
  const [selectedCat, setSelectedCat] = useState(initial?.categoryName ?? '식비');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [date, setDate] = useState(initial?.date ?? new Date().toISOString().split('T')[0]);
  // +/- 를 누르면 지금까지의 값이 여기로 확정되고, 키패드는 다음 피연산자를 받는다.
  const [pending, setPending] = useState<{ value: number; op: '+' | '-' } | null>(null);

  const fmt = (n: number) => new Intl.NumberFormat('ko-KR').format(n);
  const currentAmount = parseInt(amountStr.replace(/[^0-9]/g, '') || '0', 10);
  const evaluated = pending === null
    ? currentAmount
    : pending.op === '+' ? pending.value + currentAmount : pending.value - currentAmount;

  // 수정 모드에서 금액을 다 지우면 **원래 값이 placeholder 로 남는다.** 그대로 저장하면
  // 원래 금액이 유지된다 — 서버가 amount > 0 만 받으므로 0 을 보낼 방법도 없다.
  const showsPlaceholder = isEditing && pending === null && amountStr === '0';
  const amountToSave = showsPlaceholder ? initial.amount : evaluated;

  // 카테고리 목록이 수입/지출로 갈린다. 종류를 바꿨는데 이전 선택이 새 목록에 없으면
  // `<select>` 는 첫 항목을 보여주지만 state 는 옛 이름을 들고 있다 — 그대로 저장하면
  // 화면과 다른 카테고리가 붙는다. 그래서 여기서 첫 항목으로 맞춰준다.
  const changeType = (next: TransactionType) => {
    setType(next);
    const list = DEFAULT_CATEGORIES.filter(c => c.type === next);
    if (!list.some(c => c.name === selectedCat)) setSelectedCat(list[0].name);
  };

  const handleKeyPress = (key: string) => {
    if (key === 'back') { setAmountStr((prev) => prev.length > 1 ? prev.slice(0, -1) : '0'); return; }
    if (key === 'C') { setAmountStr('0'); setPending(null); return; }
    if (key === '+' || key === '-') {
      // placeholder 상태에서 누르면 원래 금액에서 시작한다 (0 에서 시작하면 쓸모가 없다).
      setPending({ value: amountToSave, op: key });
      setAmountStr('0');
      return;
    }
    setAmountStr((prev) => {
      if (prev === '0') return key === '00' ? '0' : key;
      if (prev.length > 12) return prev;
      return prev + key;
    });
  };

  const handleDone = () => {
    if (amountToSave <= 0) return; // 서버 스키마가 amount > 0 을 요구한다
    onSave(amountToSave, selectedCat, description, type, date);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-white dark:bg-slate-950 flex flex-col max-w-md mx-auto h-full animate-in slide-in-from-bottom duration-300">
      <div className="flex justify-center pt-3 pb-1">
        <div className="w-12 h-1 bg-slate-200 dark:bg-slate-700 rounded-full" />
      </div>
      <p className="text-center text-sm font-bold text-slate-700 dark:text-slate-200 pb-1">
        {isEditing ? '내역 수정' : '내역 추가'}
      </p>

      <div className="p-4 flex flex-col gap-4 overflow-y-auto no-scrollbar flex-1">
        <div className="flex gap-3">
          <button onClick={() => changeType('expense')} className={cn("flex-1 py-4 border-2 rounded-2xl font-bold transition-all", type === 'expense' ? "border-rose-200 bg-rose-50 text-rose-500 dark:bg-rose-500/10 dark:border-rose-500/30" : "border-slate-100 dark:border-slate-800 text-slate-400")}>지출</button>
          <button onClick={() => changeType('income')} className={cn("flex-1 py-4 border-2 rounded-2xl font-bold transition-all", type === 'income' ? "border-indigo-200 bg-indigo-50 text-indigo-600 dark:bg-indigo-600/10 dark:border-indigo-600/30" : "border-slate-100 dark:border-slate-800 text-slate-400")}>수입</button>
        </div>

        <div className="bg-slate-50 dark:bg-slate-900 rounded-2xl p-6 flex flex-col gap-1 text-right">
          <span className="text-slate-400 text-xs font-bold">{type === 'expense' ? '지출 금액' : '수입 금액'}</span>
          {pending && (
            <div className="text-slate-400 text-sm font-medium">
              {/* 연산자를 막 누른 참이면 "12,000 + 0" 대신 "12,000 +" 로 둔다 — 아직 안 찍은 0 이다 */}
              {fmt(pending.value)} {pending.op}{amountStr === '0' ? '' : ` ${fmt(currentAmount)}`}
            </div>
          )}
          <div className={cn(
            "text-4xl font-bold tracking-tight",
            showsPlaceholder ? "text-slate-300 dark:text-slate-700" : "text-indigo-600 dark:text-indigo-400"
          )}>
            {fmt(amountToSave)}<span className="text-xl text-slate-400 ml-1">원</span>
          </div>
          {showsPlaceholder && (
            <span className="text-[11px] font-medium text-slate-400">비워두면 원래 금액이 그대로 저장됩니다</span>
          )}
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
          {/* 계산기와 같은 배치다 — 오른쪽 열이 위에서부터 지우기·연산자·확정으로 내려간다.
              숫자는 전화기가 아니라 계산기 순서(아래로 갈수록 작아짐)를 따른다. */}
          {['7','8','9','back','4','5','6','+','1','2','3','-','0','00','C','완료'].map(label => (
            <KeypadButton key={label} label={label} onClick={handleKeyPress} onDone={handleDone}
              disabled={label === '완료' && amountToSave <= 0}
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

const KeypadButton: React.FC<{ label: string; onClick: (k: string) => void; onDone: () => void; variant?: 'number' | 'action' | 'primary'; disabled?: boolean; }> = ({ label, onClick, onDone, variant = 'number', disabled = false }) => {
  const bgColor = variant === 'primary' ? 'bg-indigo-600 text-white' : variant === 'action' ? 'bg-indigo-50 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400' : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-white';
  return (
    <button onClick={() => label === '완료' ? onDone() : onClick(label)} disabled={disabled}
      className={cn("h-14 flex items-center justify-center rounded-2xl text-xl font-bold shadow-sm active:scale-95 transition-transform", bgColor,
        disabled && "opacity-40 cursor-not-allowed active:scale-100")}>
      {label === 'back' ? <span className="material-symbols-outlined text-2xl">backspace</span> : label}
    </button>
  );
};

export default AddEntryModal;
