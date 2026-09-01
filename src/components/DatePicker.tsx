'use client';

import React, { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { WEEKDAY_LABELS, weekdayTone } from '@/lib/constants';

const pad = (n: number) => String(n).padStart(2, '0');
const toKey = (year: number, month: number, day: number) => `${year}-${pad(month)}-${pad(day)}`;
const today = () => {
  const now = new Date();
  return toKey(now.getFullYear(), now.getMonth() + 1, now.getDate());
};

/**
 * 날짜 선택기. `MonthPicker` 와 **같은 옷을 입는다** — 같은 앱에서 달력이 두 벌로 보이면
 * 어느 쪽이 우리 것인지 알 수 없다.
 *
 * 네이티브 `<input type="date">` 를 쓰지 않는 이유도 같다 (→ MonthPicker).
 * `value` 는 `"YYYY-MM-DD"` 이고 비는 일이 없다.
 */
export default function DatePicker({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (date: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => value.slice(0, 7)); // 펼쳐 보고 있는 달
  const rootRef = useRef<HTMLDivElement>(null);

  const [year, month, day] = value.split('-').map(Number);
  const [viewYear, viewMonth] = view.split('-').map(Number);

  const toggle = () => {
    if (!open) setView(value.slice(0, 7)); // 고른 날의 달에서 시작한다
    setOpen(v => !v);
  };

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    // **캡처 단계**에서 잡고 전파를 끊는다. 이 선택기는 모달 안에 있고, 모달도 Esc 로
    // 닫힌다 — 그냥 두면 Esc 한 번에 둘 다 닫혀 입력하던 내용이 날아간다.
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      setOpen(false);
    };
    document.addEventListener('mousedown', onMouseDown);
    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('keydown', onKeyDown, true);
    };
  }, [open]);

  const shiftMonth = (delta: number) => {
    const next = new Date(viewYear, viewMonth - 1 + delta, 1);
    setView(`${next.getFullYear()}-${pad(next.getMonth() + 1)}`);
  };

  const pick = (picked: number) => {
    onChange(toKey(viewYear, viewMonth, picked));
    setOpen(false);
  };

  const daysInMonth = new Date(viewYear, viewMonth, 0).getDate();
  const leadingBlanks = new Date(viewYear, viewMonth - 1, 1).getDay();
  const current = today();

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        type="button"
        onClick={toggle}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="flex h-14 w-full items-center justify-between rounded-2xl bg-slate-50 px-4 text-sm font-medium text-slate-700 dark:bg-slate-900 dark:text-slate-200"
      >
        {year}년 {month}월 {day}일
        <span className={cn(
          'material-symbols-outlined text-[18px] text-slate-400 transition-transform',
          open && 'rotate-180',
        )}>
          expand_more
        </span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="날짜 선택"
          className="absolute bottom-full left-0 z-50 mb-2 w-64 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl dark:border-slate-700 dark:bg-slate-900"
        >
          <div className="mb-2 flex items-center justify-between">
            <button type="button" onClick={() => shiftMonth(-1)} aria-label="이전 달"
              className="flex size-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
              <span className="material-symbols-outlined text-[18px]">chevron_left</span>
            </button>
            <span className="text-sm font-bold tabular-nums">{viewYear}년 {viewMonth}월</span>
            <button type="button" onClick={() => shiftMonth(1)} aria-label="다음 달"
              className="flex size-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
              <span className="material-symbols-outlined text-[18px]">chevron_right</span>
            </button>
          </div>

          <div className="grid grid-cols-7 gap-0.5">
            {WEEKDAY_LABELS.map((label, i) => (
              <div key={label} className={cn('pb-1 text-center text-[10px] font-bold', weekdayTone(i))}>
                {label}
              </div>
            ))}

            {Array.from({ length: leadingBlanks }, (_, i) => <div key={`blank-${i}`} />)}

            {Array.from({ length: daysInMonth }, (_, i) => {
              const d = i + 1;
              const key = toKey(viewYear, viewMonth, d);
              const isSelected = key === value;
              const isToday = key === current;
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => pick(d)}
                  aria-current={isSelected ? 'date' : undefined}
                  className={cn(
                    'flex size-8 items-center justify-center rounded-lg text-xs tabular-nums transition-colors',
                    isSelected
                      ? 'bg-emerald-500 font-bold text-white'
                      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
                    // 오늘은 고르지 않았어도 표시해 둔다 — 어디를 보고 있는지 기준이 된다
                    !isSelected && isToday && 'ring-1 ring-inset ring-emerald-400 text-emerald-600 dark:text-emerald-400',
                  )}
                >
                  {d}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => { onChange(current); setOpen(false); }}
            className="mt-2 w-full rounded-lg py-2 text-xs font-bold text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
          >
            오늘로
          </button>
        </div>
      )}
    </div>
  );
}
