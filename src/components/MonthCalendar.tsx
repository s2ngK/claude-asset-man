'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { WEEKDAY_LABELS, weekdayTone } from '@/lib/constants';
import type { DailyTotal } from '@/lib/api';

/** 칸 안에는 **숫자만** 적는다. `만`·`천` 같은 단위를 붙이면 자릿수를 눈으로 못 센다. */
const number = (amount: number) => new Intl.NumberFormat('ko-KR').format(amount);

const full = (amount: number) => `${number(amount)}원`;

/**
 * 그 달 전체에서 이 날이 차지하는 몫.
 *
 * 반올림해서 `0%` 가 되는 날은 `<1%` 로 적는다 — 금액이 있는데 `0%` 라고 하면 틀린 말이다.
 */
const share = (amount: number, total: number) => {
  if (total <= 0) return null;
  const percent = Math.round((amount / total) * 100);
  return percent === 0 ? '<1%' : `${percent}%`;
};

/**
 * 한 달을 달력으로 펼쳐 **날짜별 수입·지출 소계**를 보여준다.
 *
 * 목록을 훑지 않고 "어느 날에 많이 썼나" 를 찾자는 것이다. 그래서 지출을 위에 크게,
 * 수입을 아래에 둔다. 그 달 **지출이 가장 큰 날**은 따로 표시한다.
 *
 * 색으로 금액 크기를 나타내지 않는다. 숫자가 이미 칸 안에 있고, 색조로 크기를 말하려면
 * 순차 팔레트가 필요한데 그건 카테고리 색과 섞여 읽힌다 (→ docs/stats-rules.md).
 */
export default function MonthCalendar({ month, totals }: { month: string; totals: DailyTotal[] }) {
  const [year, monthIndex] = month.split('-').map(Number);
  if (!year || !monthIndex) return null;

  // `new Date(year, month, 0)` 은 그 달의 마지막 날이다.
  const daysInMonth = new Date(year, monthIndex, 0).getDate();
  const leadingBlanks = new Date(year, monthIndex - 1, 1).getDay();

  const byDay = new Map<number, DailyTotal>();
  totals.forEach(row => byDay.set(Number(row.date.slice(8, 10)), row));

  const busiest = totals.reduce<DailyTotal | null>(
    (max, row) => (row.expense > 0 && (max === null || row.expense > max.expense) ? row : max),
    null,
  );
  const busiestDay = busiest ? Number(busiest.date.slice(8, 10)) : null;

  const monthExpense = totals.reduce((sum, row) => sum + row.expense, 0);
  const monthIncome = totals.reduce((sum, row) => sum + row.income, 0);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 lg:p-6 shadow-sm border border-slate-100 dark:border-slate-800">
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="text-base font-bold">날짜별 수입·지출</h2>
        {busiest && (
          <p className="text-[11px] font-medium text-slate-400">
            가장 많이 쓴 날 <strong className="text-rose-500">{busiestDay}일 · {full(busiest.expense)}</strong>
          </p>
        )}
      </div>

      {/* 좁은 화면에서 일곱 칸을 다 넣으면 칸 폭이 40px 로 떨어져 `1,500,000` 이 잘린다.
          숫자를 줄이거나 글자를 더 작게 하는 대신 **달력을 옆으로 밀어 보게** 한다 —
          자릿수를 세는 것이 이 표의 목적이라 숫자가 온전해야 한다. */}
      <div className="-mx-1 overflow-x-auto px-1">
      <div className="grid grid-cols-7 gap-1 min-w-[34rem]">
        {WEEKDAY_LABELS.map((label, i) => (
          <div key={label} className={cn('pb-1 text-center text-[10px] font-bold', weekdayTone(i))}>
            {label}
          </div>
        ))}

        {/* 1일이 무슨 요일인지에 따라 앞을 비운다 */}
        {Array.from({ length: leadingBlanks }, (_, i) => <div key={`blank-${i}`} />)}

        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1;
          const row = byDay.get(day);
          const isBusiest = day === busiestDay;
          const dayShare = row && row.expense > 0
            ? { label: share(row.expense, monthExpense), tone: 'text-rose-400' }
            : row && row.income > 0
              ? { label: share(row.income, monthIncome), tone: 'text-emerald-400' }
              : null;
          return (
            <div
              key={day}
              className={cn(
                'min-h-[58px] rounded-lg border p-1 flex flex-col gap-0.5',
                isBusiest
                  ? 'border-rose-200 bg-rose-50 dark:border-rose-500/30 dark:bg-rose-500/10'
                  : 'border-slate-100 dark:border-slate-800',
              )}
            >
              <span className="flex items-baseline justify-between gap-1 leading-none">
                <span className={cn('text-[10px]', isBusiest ? 'font-bold text-rose-500' : 'text-slate-400')}>
                  {day}
                </span>
                {/* 날짜 옆의 몫. 지출이 있으면 지출 기준, 수입만 있는 날은 수입 기준이다.
                    어느 쪽인지는 색이 말한다 — 숫자만 보고 헷갈릴 일이 없다. */}
                {dayShare?.label && (
                  <span className={cn('text-[9px] font-bold tabular-nums', dayShare.tone)}>{dayShare.label}</span>
                )}
              </span>
              {row && row.expense > 0 && (
                <span title={full(row.expense)} className="text-right text-[11px] font-bold leading-tight text-rose-500 tabular-nums">
                  {number(row.expense)}
                </span>
              )}
              {row && row.income > 0 && (
                <span title={full(row.income)} className="text-right text-[11px] font-bold leading-tight text-emerald-500 tabular-nums">
                  {number(row.income)}
                </span>
              )}
            </div>
          );
        })}
      </div>
      </div>

      {totals.length === 0 && (
        <p className="pt-4 text-center text-sm text-slate-400">이 달에는 내역이 없습니다.</p>
      )}
    </div>
  );
}
