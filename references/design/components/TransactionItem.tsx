
import React, { useState } from 'react';
import { Transaction } from '../types';
import { CATEGORIES } from '../constants';

interface TransactionItemProps {
  item: Transaction;
  onDelete: () => void;
  onEdit?: () => void;
}

const TransactionItem: React.FC<TransactionItemProps> = ({ item, onDelete, onEdit }) => {
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [offset, setOffset] = useState(0);
  
  const minSwipeDistance = 50;
  const maxOffset = 80;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    const currentTouch = e.targetTouches[0].clientX;
    const diff = touchStart - currentTouch;
    
    // Only allow swiping left
    if (diff > 0) {
      setOffset(Math.min(diff, maxOffset + 20)); // Allow a bit of overscroll
    } else {
      setOffset(0);
    }
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    const touchEnd = e.changedTouches[0].clientX;
    const distance = touchStart - touchEnd;
    
    if (distance > minSwipeDistance) {
      setOffset(maxOffset);
    } else {
      setOffset(0);
    }
    setTouchStart(null);
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(amount);
  };

  const getCategoryIcon = (catId: string) => {
    const cat = CATEGORIES.find(c => c.id === catId);
    return {
      icon: cat?.icon || 'help',
      color: cat?.color || 'bg-slate-500'
    };
  };

  const { icon, color } = getCategoryIcon(item.category);

  return (
    <div className="relative overflow-hidden group select-none bg-background-light dark:bg-background-dark">
      {/* Background Delete Action - Revealed on swipe */}
      <div 
        className="absolute inset-y-0 right-0 bg-[#f43f5e] flex items-center justify-end overflow-hidden transition-opacity duration-200"
        style={{ width: `${Math.max(offset, 0)}px`, opacity: offset > 20 ? 1 : 0 }}
      >
        <button 
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
            setOffset(0);
          }}
          className="h-full w-20 flex flex-col items-center justify-center text-white gap-0.5 shrink-0"
        >
          <span className="material-symbols-outlined text-[20px]">delete</span>
          <span className="text-[11px] font-bold">삭제</span>
        </button>
      </div>

      {/* Foreground Content */}
      <div 
        onClick={() => {
          if (offset === 0 && onEdit) {
            onEdit();
          } else {
            setOffset(0);
          }
        }}
        className="relative bg-background-light dark:bg-background-dark transition-transform duration-200 ease-out flex items-center gap-4 px-4 min-h-[72px] py-2 justify-between cursor-pointer active:bg-slate-100 dark:active:bg-white/5"
        style={{ transform: `translateX(-${offset}px)` }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div className="flex items-center gap-4">
          <div className={`flex items-center justify-center rounded-xl ${color}/10 text-${color.replace('bg-', '')} shrink-0 size-11 transition-transform duration-300 group-hover:scale-105 border border-${color.replace('bg-', '')}/10`}>
            <span className="material-symbols-outlined text-[22px]">{icon}</span>
          </div>
          <div className="flex flex-col justify-center">
            <p className="text-slate-900 dark:text-white text-[15px] font-semibold leading-tight line-clamp-1">{item.title}</p>
            <p className="text-slate-500 dark:text-slate-400 text-[11px] font-medium leading-normal mt-0.5">{item.memo || '메모 없음'}</p>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className={`text-[15px] font-bold leading-normal font-display ${item.type === 'income' ? 'text-primary' : 'text-slate-900 dark:text-white'}`}>
            {item.type === 'income' ? '+' : '-'}{formatAmount(item.amount)}
          </p>
        </div>
      </div>
    </div>
  );
};

export default TransactionItem;
