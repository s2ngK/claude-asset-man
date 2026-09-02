'use client';

import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import DatePicker from '@/components/DatePicker';
import { KIND_LABEL, expectedMaturity } from '@/lib/accounts';
import type { Account, Category } from '@/lib/api';

const won = (n: number) => new Intl.NumberFormat('ko-KR').format(n);

const field = 'w-full bg-slate-50 dark:bg-slate-900 rounded-2xl h-12 px-4 text-sm font-medium outline-none border border-transparent focus:border-emerald-500';

/**
 * 만기·중도해지 정산.
 *
 * **계산값은 기본값일 뿐이다.** 화면이 금리로 예상액을 채워주지만 실제 수령액은
 * 우대금리·중도해지이율·세금우대 때문에 늘 어긋난다. 그래서 칸을 열어두고 사람이 고친다
 * (→ docs/accounts.md).
 *
 * 예적금이면 확정액에서 넣은 원금을 뺀 만큼이 **이자 수입 거래로 남는다.** 그래야
 * 통계의 수입에 실제로 받은 이자가 잡힌다.
 */
export default function SettleModal({
  account,
  incomeCategories,
  onClose,
  onSettle,
}: {
  account: Account;
  incomeCategories: Category[];
  onClose: () => void;
  onSettle: (data: {
    status: 'matured' | 'closed';
    settled_on: string;
    settled_amount: number;
    interest_category_id?: string;
  }) => void;
}) {
  const isLoan = account.kind === 'loan';
  const estimate = expectedMaturity(account);
  // 대출은 다 갚으면 0 이다. 예적금은 예상 수령액에서 시작한다.
  const suggested = isLoan ? account.balance : estimate.total;

  const [status, setStatus] = useState<'matured' | 'closed'>('matured');
  const [settledOn, setSettledOn] = useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState(String(suggested));
  const [categoryId, setCategoryId] = useState(
    incomeCategories.find(c => c.name === '금융수입')?.id ?? incomeCategories[0]?.id ?? '',
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const settledAmount = Number(amount.replace(/[^0-9]/g, '')) || 0;
  // 예금은 예치액이, 적금은 부은 돈이 원금이다.
  const deposited = account.kind === 'deposit' ? account.amount : account.paid_principal;
  const gain = settledAmount - deposited;

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 z-50 flex sm:items-center sm:justify-center sm:bg-slate-900/40 sm:backdrop-blur-sm"
    >
      <div className="flex flex-col w-full h-full bg-white dark:bg-slate-950 animate-in slide-in-from-bottom duration-300
                      sm:h-auto sm:max-h-[92vh] sm:w-[26rem] sm:rounded-3xl sm:shadow-2xl sm:zoom-in-95">
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-12 h-1 bg-slate-200 dark:bg-slate-700 rounded-full" />
        </div>
        <p className="text-center text-sm font-bold text-slate-700 dark:text-slate-200 pb-1">
          {KIND_LABEL[account.kind]} 정산 · {account.name}
        </p>

        <div className="p-4 flex flex-col gap-4 overflow-y-auto no-scrollbar flex-1">
          <div className="flex gap-2">
            {(['matured', 'closed'] as const).map(s => (
              <button key={s} type="button" onClick={() => setStatus(s)}
                className={cn(
                  'flex-1 py-3 border-2 rounded-2xl text-sm font-bold transition-all',
                  status === s
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:border-emerald-500/30'
                    : 'border-slate-100 dark:border-slate-800 text-slate-400',
                )}>
                {s === 'matured' ? '만기' : isLoan ? '조기상환' : '중도해지'}
              </button>
            ))}
          </div>

          {!isLoan && (
            <div className="bg-slate-50 dark:bg-slate-900 rounded-2xl p-4 text-xs space-y-1.5">
              <p className="font-bold text-slate-500">예상치 (단리·세후 기준)</p>
              <Row label="넣은 원금" value={deposited} />
              <Row label="예상 이자" value={estimate.interest} />
              <Row label="예상 수령액" value={estimate.total} strong />
              <p className="text-[11px] text-slate-400 pt-1">
                우대금리·중도해지이율은 반영되지 않습니다. <strong>실제 받은 금액으로 고쳐 주세요.</strong>
              </p>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <span className="text-slate-400 text-xs font-bold px-1">
              {isLoan ? '최종 상환액' : '실제 수령액'}
            </span>
            <input value={amount} inputMode="numeric"
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ''))}
              className={cn(field, 'text-right text-base font-bold')} />
            <span className="text-[11px] text-slate-400 px-1 text-right">{won(settledAmount)}원</span>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-slate-400 text-xs font-bold px-1">정산일</span>
            <DatePicker value={settledOn} onChange={setSettledOn} />
          </div>

          {!isLoan && gain > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-slate-400 text-xs font-bold px-1">이자를 담을 카테고리</span>
              <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}
                className={cn(field, 'appearance-none')}>
                {incomeCategories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <span className="text-[11px] text-slate-400 px-1">
                수입 <strong className="text-emerald-600">{won(gain)}원</strong>이 내역에 추가됩니다.
              </span>
            </div>
          )}
          {!isLoan && gain <= 0 && (
            <p className="text-[11px] text-slate-400 px-1">
              원금보다 적거나 같아 수입 내역은 만들지 않습니다.
            </p>
          )}
          {isLoan && (
            <p className="text-[11px] text-slate-400 px-1">
              상환 내역은 회차마다 이미 입력돼 있습니다. 여기서는 <strong>끝났다는 사실만</strong> 기록합니다.
            </p>
          )}
        </div>

        <div className="mt-auto p-4 border-t border-slate-100 dark:border-slate-800 flex gap-3">
          <button onClick={onClose}
            className="h-12 flex-1 rounded-2xl bg-slate-100 dark:bg-slate-800 text-sm font-bold text-slate-500">
            닫기
          </button>
          <button
            onClick={() => {
              onSettle({
                status,
                settled_on: settledOn,
                settled_amount: settledAmount,
                interest_category_id: !isLoan && gain > 0 ? categoryId : undefined,
              });
              onClose();
            }}
            className="h-12 flex-[2] rounded-2xl bg-emerald-500 text-sm font-bold text-white">
            정산 확정
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className="flex justify-between tabular-nums">
      <span className="text-slate-400">{label}</span>
      <span className={cn(strong ? 'font-bold' : 'font-medium')}>{won(value)}원</span>
    </div>
  );
}
