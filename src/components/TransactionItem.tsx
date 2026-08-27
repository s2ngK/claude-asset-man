'use client';

import React, { useRef, useState } from 'react';
import { Transaction } from '@/types';
import { DEFAULT_CATEGORIES } from '@/lib/constants';
import { cn } from '@/lib/utils';

interface TransactionItemProps {
  item: Transaction;
  onDelete: () => void;
  onEdit?: () => void;
}

const TransactionItem: React.FC<TransactionItemProps> = ({ item, onDelete, onEdit }) => {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);

  // 드래그 상태는 ref 에 둔다. move 마다 setState 로 넘기면 첫 이동에서 아직
  // 반영 안 된 시작점을 읽는다 (터치 구현이 touchStart 를 state 로 들고 있어 그랬다).
  const drag = useRef<{ startX: number; pointerId: number; moved: boolean } | null>(null);
  // 드래그가 끝나면 click 이 한 번 더 온다. 그걸 편집으로 오해하지 않게 한 번만 삼킨다.
  const swallowClick = useRef(false);

  const minSwipeDistance = 50;
  const maxOffset = 80;
  const dragThreshold = 4; // 이만큼은 움직여야 드래그로 친다 (클릭할 때의 손떨림 무시)

  // 터치가 아니라 **포인터** 이벤트를 쓴다. 마우스·터치·펜이 같은 코드로 처리돼
  // 데스크톱 브라우저에서도 스와이프가 먹는다. 터치 전용이던 시절엔 마우스로는
  // 삭제 버튼에 닿을 방법이 아예 없었다.
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return; // 왼쪽 버튼만
    drag.current = { startX: e.clientX, pointerId: e.pointerId, moved: false };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const diff = d.startX - e.clientX;

    if (!d.moved) {
      if (Math.abs(diff) < dragThreshold) return;
      d.moved = true;
      setDragging(true);
      // 포인터를 잡아둬야 커서가 행 밖으로 나가도 move/up 이 계속 들어온다.
      e.currentTarget.setPointerCapture(e.pointerId);
    }

    // 왼쪽으로만 열린다
    setOffset(diff > 0 ? Math.min(diff, maxOffset + 20) : 0);
  };

  const releaseCapture = (e: React.PointerEvent) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    drag.current = null;
    releaseCapture(e);
    if (!d.moved) return; // 그냥 탭/클릭이었다 — onClick 이 알아서 처리한다

    setDragging(false);
    swallowClick.current = true;
    setOffset(d.startX - e.clientX > minSwipeDistance ? maxOffset : 0);
  };

  // 브라우저가 제스처를 가져가면(스크롤 등) 열다 만 상태로 두지 않고 닫는다.
  const onPointerCancel = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    drag.current = null;
    releaseCapture(e);
    if (d.moved) {
      setDragging(false);
      setOffset(0);
    }
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
          if (swallowClick.current) {
            swallowClick.current = false;
            return;
          }
          if (offset === 0) {
            onEdit?.();
          } else {
            setOffset(0);
          }
        }}
        className={cn(
          "relative bg-white dark:bg-slate-900 flex items-center gap-4 px-4 min-h-[72px] py-2 justify-between cursor-pointer active:bg-slate-50 dark:active:bg-slate-800",
          // 끄는 동안엔 전환을 끈다. 안 그러면 200ms 씩 뒤따라와 손에 안 붙는다.
          !dragging && "transition-transform duration-200 ease-out"
        )}
        // pan-y: 세로 스크롤은 브라우저에 넘기고 가로 제스처만 우리가 받는다.
        style={{ transform: `translateX(-${offset}px)`, touchAction: 'pan-y' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
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
