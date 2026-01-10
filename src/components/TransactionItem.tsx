'use client';

import React, { useState } from 'react';
import { Transaction } from '@/types';
import { DEFAULT_CATEGORIES } from '@/lib/constants';
import { cn } from '@/lib/utils';

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

  const getCategoryInfo = (catName: string) => {
    // category_id 대신 name으로 매칭 (임시) 또는 category object 사용
    // DB에서 조인된 category가 있으면 그것을 사용
    if (item.categories) {
      return { icon: item.categories.icon, color: item.categories.color };
    }
    const cat = DEFAULT_CATEGORIES.find(c => c.name === catName) || DEFAULT_CATEGORIES.find(c => c.id === 'etc');
    return {
      icon: cat?.icon || 'help',
      color: cat?.color || '#808080'
    };
  };

  // item.category_id가 실제로는 카테고리 이름이 들어갈 수도 있고 ID가 들어갈 수도 있음.
  // 현재 로직상 AddEntryModal에서 이름을 넘겨줌.
  // 추후 DB 연동 시 category_id로 변경 필요. 현재는 category_id 필드에 '식비' 같은 이름이 들어가는 과도기일 수 있음 주의.
  // DB 스키마상 category_id는 UUID임. 따라서 Insert 시에 이름을 ID로 변환해서 넣어야 함.
  
  const { icon, color } = getCategoryInfo(item.categories?.name || '기타'); 

  return (
    <div className="relative overflow-hidden group select-none bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 last:border-0">
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
        className="relative bg-white dark:bg-slate-900 transition-transform duration-200 ease-out flex items-center gap-4 px-4 min-h-[72px] py-2 justify-between cursor-pointer active:bg-slate-50 dark:active:bg-slate-800"
        style={{ transform: `translateX(-${offset}px)` }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div className="flex items-center gap-4">
          <div 
            className="flex items-center justify-center rounded-xl shrink-0 size-11 transition-transform duration-300 group-hover:scale-105"
            style={{ backgroundColor: `${color}20`, color: color }}
          >
            <span className="material-symbols-outlined text-[22px]">{icon}</span>
          </div>
          <div className="flex flex-col justify-center">
            <p className="text-slate-900 dark:text-white text-[15px] font-semibold leading-tight line-clamp-1">
              {item.description || item.categories?.name}
            </p>
            <p className="text-slate-500 dark:text-slate-400 text-[11px] font-medium leading-normal mt-0.5">
              {item.date} • {item.profiles?.full_name || '나'}
            </p>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className={cn(
            "text-[15px] font-bold leading-normal",
            item.type === 'income' ? "text-emerald-500" : "text-slate-900 dark:text-white"
          )}>
            {item.type === 'income' ? '+' : '-'}{formatAmount(item.amount)}
          </p>
        </div>
      </div>
    </div>
  );
};

export default TransactionItem;
