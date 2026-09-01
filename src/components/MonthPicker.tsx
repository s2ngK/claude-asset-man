'use client';

import React, { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

const MONTH_LABELS = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];

const thisMonth = () => new Date().toISOString().slice(0, 7);

/**
 * 월 선택기. **네이티브 `<input type="month">` 를 쓰지 않는다.**
 *
 * 브라우저가 띄우는 달력은 우리 CSS 가 닿지 않는 영역이라 앱과 따로 논다. 생김새가
 * 브라우저마다 다르고, 크롬에서는 값을 비우는 [삭제] 버튼까지 들어 있었다 — 비우면
 * `month` 파라미터가 빠져 그 달이 아니라 전체가 조회된다. 직접 만들면 그런 상태가
 * 아예 만들어지지 않는다.
 *
 * `value` 는 `"YYYY-MM"` 이고 비는 일이 없다.
 */
export default function MonthPicker({
  value,
  onChange,
  className,
  labelClassName,
}: {
  value: string;
  onChange: (month: string) => void;
  className?: string;
  labelClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(() => Number(value.slice(0, 4)));
  const rootRef = useRef<HTMLDivElement>(null);

  const selectedYear = Number(value.slice(0, 4));
  const selectedMonth = Number(value.slice(5, 7));

  // 열 때마다 보고 있던 값의 연도에서 시작한다. 지난달을 보다 열었는데 올해가 뜨면
  // 한 번 더 눌러야 한다.
  const toggle = () => {
    if (!open) setYear(selectedYear);
    setOpen(v => !v);
  };

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const pick = (month: number) => {
    onChange(`${year}-${String(month).padStart(2, '0')}`);
    setOpen(false);
  };

  const current = thisMonth();

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        type="button"
        onClick={toggle}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="flex w-full items-center justify-center gap-1.5 rounded-xl px-2 py-1 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
      >
        <span className={cn('font-bold', labelClassName)}>{selectedYear}년 {selectedMonth}월</span>
        <span className={cn(
          'material-symbols-outlined text-[20px] text-slate-400 transition-transform',
          open && 'rotate-180',
        )}>
          expand_more
        </span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="월 선택"
          className="absolute left-1/2 z-50 mt-2 w-64 -translate-x-1/2 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl dark:border-slate-700 dark:bg-slate-900"
        >
          <div className="mb-2 flex items-center justify-between">
            <button type="button" onClick={() => setYear(y => y - 1)} aria-label="이전 해"
              className="flex size-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
              <span className="material-symbols-outlined text-[18px]">chevron_left</span>
            </button>
            <span className="text-sm font-bold tabular-nums">{year}년</span>
            <button type="button" onClick={() => setYear(y => y + 1)} aria-label="다음 해"
              className="flex size-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
              <span className="material-symbols-outlined text-[18px]">chevron_right</span>
            </button>
          </div>

          <div className="grid grid-cols-3 gap-1">
            {MONTH_LABELS.map((label, i) => {
              const month = i + 1;
              const key = `${year}-${String(month).padStart(2, '0')}`;
              const isSelected = key === value;
              // 오늘이 속한 달은 고르지 않았어도 표시해 둔다 — 어디를 보고 있는지 기준이 된다.
              const isCurrent = key === current;
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => pick(month)}
                  aria-current={isSelected ? 'true' : undefined}
                  className={cn(
                    'h-9 rounded-lg text-sm font-medium transition-colors',
                    isSelected
                      ? 'bg-emerald-500 font-bold text-white'
                      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
                    !isSelected && isCurrent && 'ring-1 ring-inset ring-emerald-400 text-emerald-600 dark:text-emerald-400',
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => { onChange(current); setOpen(false); }}
            className="mt-2 w-full rounded-lg py-2 text-xs font-bold text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
          >
            이번 달로
          </button>
        </div>
      )}
    </div>
  );
}
