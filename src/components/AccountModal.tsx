'use client';

import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import DatePicker from '@/components/DatePicker';
import { KIND_LABEL, REPAY_LABEL } from '@/lib/accounts';
import type { Account, AccountInput, AccountKind, RepayMethod } from '@/lib/api';

const KINDS: AccountKind[] = ['loan', 'deposit', 'installment'];
const METHODS: RepayMethod[] = ['equal_payment', 'equal_principal', 'bullet'];

/** `amount` 는 종류마다 뜻이 다르다. 라벨이 그것을 말해주지 않으면 아무도 모른다. */
const AMOUNT_LABEL: Record<AccountKind, string> = {
  loan: '대출 원금',
  deposit: '예치 금액',
  installment: '월 납입액',
};

const field = 'w-full bg-slate-50 dark:bg-slate-900 rounded-2xl h-12 px-4 text-sm font-medium outline-none border border-transparent focus:border-emerald-500';

const oneYearOut = () => {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
};

/**
 * 계좌를 만들고 고치는 모달. `initial` 이 있으면 수정 모드다 — `AddEntryModal` 과 같은 방식이다.
 *
 * **종류(`kind`)는 수정할 수 없다.** 예금을 대출로 바꾸면 `amount` 의 뜻과 잔액 계산식이
 * 통째로 달라져 이미 붙어 있는 거래들의 해석이 뒤집힌다.
 */
export default function AccountModal({
  onClose,
  onSave,
  initial,
}: {
  onClose: () => void;
  onSave: (data: AccountInput) => void;
  initial?: Account;
}) {
  const isEditing = initial !== undefined;
  const [kind, setKind] = useState<AccountKind>(initial?.kind ?? 'loan');
  const [name, setName] = useState(initial?.name ?? '');
  const [amount, setAmount] = useState(initial ? String(initial.amount) : '');
  const [rate, setRate] = useState(initial ? String(initial.rate) : '');
  const [startedOn, setStartedOn] = useState(initial?.started_on ?? new Date().toISOString().slice(0, 10));
  const [maturesOn, setMaturesOn] = useState(initial?.matures_on ?? oneYearOut());
  const [repayMethod, setRepayMethod] = useState<RepayMethod>(initial?.repay_method ?? 'equal_payment');

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const amountValue = Number(amount.replace(/[^0-9]/g, '')) || 0;
  const datesOk = maturesOn >= startedOn;
  const canSave = name.trim().length > 0 && amountValue > 0 && datesOk;

  const submit = () => {
    if (!canSave) return;
    onSave({
      kind,
      name: name.trim(),
      amount: amountValue,
      rate: Number(rate) || 0,
      started_on: startedOn,
      matures_on: maturesOn,
      // 대출이 아니면 서버가 어차피 지운다. 여기서도 보내지 않아 뜻을 분명히 한다.
      repay_method: kind === 'loan' ? repayMethod : null,
    });
    onClose();
  };

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
          {isEditing ? '계좌 수정' : '계좌 추가'}
        </p>

        <div className="p-4 flex flex-col gap-4 overflow-y-auto no-scrollbar flex-1">
          <div className="flex flex-col gap-2">
            <span className="text-slate-400 text-xs font-bold px-1">종류</span>
            <div className="flex gap-2">
              {KINDS.map(k => (
                <button
                  key={k}
                  type="button"
                  disabled={isEditing}
                  onClick={() => setKind(k)}
                  className={cn(
                    'flex-1 py-3 border-2 rounded-2xl text-sm font-bold transition-all disabled:opacity-40',
                    kind === k
                      ? k === 'loan'
                        ? 'border-rose-200 bg-rose-50 text-rose-500 dark:bg-rose-500/10 dark:border-rose-500/30'
                        : 'border-emerald-200 bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:border-emerald-500/30'
                      : 'border-slate-100 dark:border-slate-800 text-slate-400',
                  )}
                >
                  {KIND_LABEL[k]}
                </button>
              ))}
            </div>
            {isEditing && (
              <span className="text-[11px] text-slate-400 px-1">
                종류는 바꿀 수 없습니다 — 금액의 뜻과 잔액 계산이 달라집니다.
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-slate-400 text-xs font-bold px-1">이름</span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40}
              placeholder={kind === 'loan' ? '전세자금대출' : '주택청약'} className={field} />
          </div>

          <div className="flex gap-3">
            <div className="flex-1 flex flex-col gap-2 min-w-0">
              <span className="text-slate-400 text-xs font-bold px-1">{AMOUNT_LABEL[kind]}</span>
              <input value={amount} inputMode="numeric"
                onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="0" className={cn(field, 'text-right')} />
            </div>
            <div className="w-28 shrink-0 flex flex-col gap-2">
              <span className="text-slate-400 text-xs font-bold px-1">연이율 %</span>
              <input value={rate} inputMode="decimal"
                onChange={(e) => setRate(e.target.value.replace(/[^0-9.]/g, ''))}
                placeholder="3.5" className={cn(field, 'text-right')} />
            </div>
          </div>
          {amountValue > 0 && (
            <p className="text-[11px] text-slate-400 -mt-2 px-1 text-right">
              {new Intl.NumberFormat('ko-KR').format(amountValue)}원
            </p>
          )}

          {kind === 'loan' && (
            <div className="flex flex-col gap-2">
              <span className="text-slate-400 text-xs font-bold px-1">상환방식</span>
              <div className="flex gap-2">
                {METHODS.map(m => (
                  <button key={m} type="button" onClick={() => setRepayMethod(m)}
                    className={cn(
                      'flex-1 py-2.5 rounded-xl text-xs font-bold transition-all',
                      repayMethod === m
                        ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900'
                        : 'bg-slate-50 dark:bg-slate-900 text-slate-400',
                    )}>
                    {REPAY_LABEL[m]}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <div className="flex-1 flex flex-col gap-2 min-w-0">
              <span className="text-slate-400 text-xs font-bold px-1">시작일</span>
              <DatePicker value={startedOn} onChange={setStartedOn} />
            </div>
            <div className="flex-1 flex flex-col gap-2 min-w-0">
              <span className="text-slate-400 text-xs font-bold px-1">만기일</span>
              <DatePicker value={maturesOn} onChange={setMaturesOn} />
            </div>
          </div>
          {!datesOk && <p className="text-[11px] font-bold text-rose-500 px-1">만기일이 시작일보다 빠릅니다.</p>}

          <p className="text-[11px] text-slate-400 px-1">
            잔액은 저장하지 않습니다 — 이 계좌에 연결한 내역에서 계산합니다.
          </p>
        </div>

        <div className="mt-auto p-4 border-t border-slate-100 dark:border-slate-800 flex gap-3">
          <button onClick={onClose}
            className="h-12 flex-1 rounded-2xl bg-slate-100 dark:bg-slate-800 text-sm font-bold text-slate-500">
            닫기
          </button>
          <button onClick={submit} disabled={!canSave}
            className="h-12 flex-[2] rounded-2xl bg-emerald-500 text-sm font-bold text-white disabled:opacity-40">
            {isEditing ? '저장' : '추가'}
          </button>
        </div>
      </div>
    </div>
  );
}
