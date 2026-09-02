'use client';

import React, { useEffect, useState } from 'react';
import { DEFAULT_CATEGORIES } from '@/lib/constants';
import { TransactionType } from '@/types';
import { cn } from '@/lib/utils';
import type { Account, Category as ApiCategory } from '@/lib/api';
import { Button } from './ui/button';
import DatePicker from '@/components/DatePicker';
import { KIND_LABEL, expectedRepayment } from '@/lib/accounts';

/** 모달이 모아 돌려주는 값. 항목이 일곱 개가 되면서 위치 인자로는 읽을 수 없게 됐다. */
export interface EntryDraft {
  amount: number;
  categoryId: string;
  description: string;
  type: TransactionType;
  date: string;
  /** 고르지 않았으면 null 이다. 서버는 이 값으로 잔액을 움직인다. */
  accountId: string | null;
  /** 대출 상환일 때만 의미가 있다. 계좌를 안 골랐으면 null. */
  interestAmount: number | null;
}

interface AddEntryModalProps {
  onClose: () => void;
  /** 카테고리는 **id 로** 넘긴다. 이름으로 넘기면 서버에서 다시 찾아야 하고, `기타` 처럼
   *  수입·지출 양쪽에 있는 이름은 엉뚱한 것을 집을 수 있다 (#17). */
  onSave: (draft: EntryDraft) => void;
  /** 서버 카테고리 목록. **id 의 유일한 출처다.** 아직 못 받았으면 저장을 막는다. */
  categories: ApiCategory[];
  /** 연결할 수 있는 계좌 — 진행 중인 것만. 없으면 계좌 칸 자체가 안 보인다. */
  accounts?: Account[];
  /**
   * 있으면 **수정 모드**다. 폼을 이 값으로 채우고 문구만 바꾼다.
   * 만들기냐 고치기냐의 판단은 `MainView` 가 한다 — 이 컴포넌트는 값만 모아 돌려준다.
   */
  initial?: {
    amount: number;
    categoryId: string;
    description: string;
    type: TransactionType;
    date: string;
    accountId?: string | null;
    interestAmount?: number | null;
  };
}

const AddEntryModal: React.FC<AddEntryModalProps> = ({ onClose, onSave, categories, accounts = [], initial }) => {
  const isEditing = initial !== undefined;
  const [type, setType] = useState<TransactionType>(initial?.type ?? 'expense');
  const [amountStr, setAmountStr] = useState(initial ? String(initial.amount) : '0');
  const [pickedCatId, setPickedCatId] = useState(initial?.categoryId ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [date, setDate] = useState(initial?.date ?? new Date().toISOString().split('T')[0]);
  const [accountId, setAccountId] = useState(initial?.accountId ?? '');
  // 빈 문자열이면 "안 넣음" 이다. 0 과 구분해야 이자 없는 상환을 표현할 수 있다.
  const [interestStr, setInterestStr] = useState(
    initial?.interestAmount != null ? String(initial.interestAmount) : '',
  );
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

  // 서버 목록이 오기 전에는 저장할 수 없다 — 로컬 상수의 id 는 서버 id 가 아니다.
  const categoriesReady = categories.length > 0;
  const options = categoriesReady
    ? categories.filter(c => c.type === type)
    : DEFAULT_CATEGORIES.filter(c => c.type === type); // 첫 페인트용 이름 표시만

  // 아무것도 안 골랐을 때의 기본값. 서버 목록은 이름순이라 그대로 첫 항목을 쓰면 지출이
  // `교통` 으로 바뀐다 — 예전 기본값(지출 `식비`, 수입 `급여`)을 유지하려고
  // DEFAULT_CATEGORIES 의 첫 항목을 **이름 힌트로만** 쓴다. 못 찾으면 목록의 첫 항목이다.
  const preferredName = DEFAULT_CATEGORIES.find(c => c.type === type)?.name;
  const defaultCatId = options.find(c => c.name === preferredName)?.id ?? options[0]?.id ?? '';

  // 종류가 바뀌면 카테고리 목록도 갈린다. 고른 값이 새 목록에 없으면 `<select>` 는 첫
  // 항목을 보여주는데 state 만 옛 값이면 화면과 다른 카테고리로 저장된다.
  // state 를 고쳐 맞추는 대신 **읽을 때 파생시킨다** — 그러면 어긋나는 순간 자체가 없다.
  const selectedCatId = options.some(c => c.id === pickedCatId) ? pickedCatId : defaultCatId;

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

  const canSave = amountToSave > 0 && categoriesReady && selectedCatId !== '';

  // 고른 계좌는 **읽을 때 파생시킨다.** 목록이 바뀌어 사라진 id 가 남아 있어도
  // 화면과 state 가 어긋나지 않는다 (카테고리 선택과 같은 방식).
  const linkedAccount = accounts.find(a => a.id === accountId) ?? null;
  const isLoanLink = linkedAccount?.kind === 'loan';
  const interestValue = interestStr === '' ? 0 : Number(interestStr.replace(/[^0-9]/g, ''));
  // 금액을 아직 안 찍었으면 경고하지 않는다 — 계좌를 고르자마자 빨간 글씨가 뜨면
  // 사용자가 뭔가 잘못한 것처럼 읽힌다. 그 상태에서는 어차피 [완료] 가 잠겨 있다.
  const interestTooBig = isLoanLink && amountToSave > 0 && interestValue > amountToSave;

  // Esc 로도 닫는다. 바깥을 눌러 닫는 다이얼로그에서 키보드만 안 먹으면 앞뒤가 안 맞는다.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const handleDone = () => {
    if (!canSave || interestTooBig) return; // 금액은 서버 스키마가 > 0 을 요구하고, 카테고리는 id 가 있어야 한다
    onSave({
      amount: amountToSave,
      categoryId: selectedCatId,
      description,
      type,
      date,
      accountId: linkedAccount ? linkedAccount.id : null,
      // 계좌를 안 골랐으면 이자분도 없다 — 서버가 그 조합을 422 로 막는다.
      interestAmount: linkedAccount && isLoanLink ? interestValue : null,
    });
    onClose();
  };

  return (
    /* 좁은 화면에서는 아래에서 올라오는 전체 화면, 넓은 화면에서는 가운데 뜨는 다이얼로그.
       넓은 화면에서 전체를 덮으면 뒤 목록이 사라져 방금 무엇을 보고 있었는지 잃는다. */
    <div
      /* 바깥(=이 요소 자신)을 눌렀을 때만 닫는다. 안에서 눌렀다가 밖에서 손을 뗀 경우까지
         닫으면, 금액을 드래그 선택하다 창이 사라진다. */
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 z-50 flex sm:items-center sm:justify-center sm:bg-slate-900/40 sm:backdrop-blur-sm"
    >
    <div className="flex flex-col w-full h-full bg-white dark:bg-slate-950 animate-in slide-in-from-bottom duration-300
                    sm:h-auto sm:max-h-[92vh] sm:w-[26rem] sm:rounded-3xl sm:shadow-2xl sm:overflow-hidden sm:zoom-in-95">
      <div className="flex justify-center pt-3 pb-1">
        <div className="w-12 h-1 bg-slate-200 dark:bg-slate-700 rounded-full" />
      </div>
      <p className="text-center text-sm font-bold text-slate-700 dark:text-slate-200 pb-1">
        {isEditing ? '내역 수정' : '내역 추가'}
      </p>

      <div className="p-4 flex flex-col gap-4 overflow-y-auto no-scrollbar flex-1">
        <div className="flex gap-3">
          <button onClick={() => setType('expense')} className={cn("flex-1 py-4 border-2 rounded-2xl font-bold transition-all", type === 'expense' ? "border-rose-200 bg-rose-50 text-rose-500 dark:bg-rose-500/10 dark:border-rose-500/30" : "border-slate-100 dark:border-slate-800 text-slate-400")}>지출</button>
          <button onClick={() => setType('income')} className={cn("flex-1 py-4 border-2 rounded-2xl font-bold transition-all", type === 'income' ? "border-indigo-200 bg-indigo-50 text-indigo-600 dark:bg-indigo-600/10 dark:border-indigo-600/30" : "border-slate-100 dark:border-slate-800 text-slate-400")}>수입</button>
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
            {/* 네이티브 날짜 입력을 쓰지 않는다 — 브라우저 달력은 앱과 따로 논다
                (→ src/components/DatePicker.tsx) */}
            <DatePicker value={date} onChange={setDate} />
          </div>
          <div className="flex-1 flex flex-col gap-2">
            <span className="text-slate-400 text-xs font-bold px-1">카테고리</span>
            <select value={categoriesReady ? selectedCatId : ''} disabled={!categoriesReady}
              onChange={(e) => setPickedCatId(e.target.value)}
              className="bg-slate-50 dark:bg-slate-900 rounded-2xl h-14 px-4 w-full border-none outline-none text-slate-700 dark:text-slate-200 font-medium text-sm appearance-none disabled:opacity-50">
              {!categoriesReady && <option value="">불러오는 중…</option>}
              {options.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* 계좌 연결 — 이 거래가 대출 잔액이나 적금 잔액을 움직이게 한다.
            대부분의 거래는 계좌와 무관하므로 기본값은 "연결 안 함" 이다. */}
        {accounts.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="text-slate-400 text-xs font-bold px-1">계좌 연결 (선택)</span>
            <select value={accountId} onChange={(e) => {
              const next = e.target.value;
              setAccountId(next);
              // 대출을 고르면 **이번 회차 예상 이자**를 미리 채운다. 확정은 사람이 한다.
              const picked = accounts.find(a => a.id === next);
              setInterestStr(picked?.kind === 'loan' ? String(expectedRepayment(picked).interest) : '');
            }}
              className="bg-slate-50 dark:bg-slate-900 rounded-2xl h-14 px-4 w-full border-none outline-none text-slate-700 dark:text-slate-200 font-medium text-sm appearance-none">
              <option value="">연결 안 함</option>
              {accounts.map(a => (
                <option key={a.id} value={a.id}>{KIND_LABEL[a.kind]} · {a.name}</option>
              ))}
            </select>

            {isLoanLink && (
              <div className="flex flex-col gap-1.5 pt-1">
                <span className="text-slate-400 text-xs font-bold px-1">그중 이자</span>
                <input value={interestStr} inputMode="numeric"
                  onChange={(e) => setInterestStr(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="0"
                  className="w-full bg-slate-50 dark:bg-slate-900 rounded-2xl h-12 px-4 text-sm font-medium text-right outline-none border border-transparent focus:border-emerald-500" />
                <span className={cn('text-[11px] px-1', interestTooBig ? 'font-bold text-rose-500' : 'text-slate-400')}>
                  {interestTooBig
                    ? '이자가 금액보다 클 수 없습니다.'
                    : amountToSave === 0
                      ? '이번 회차 예상 이자입니다 — 실제 낸 금액으로 고쳐 주세요'
                      : `원금 ${fmt(Math.max(amountToSave - interestValue, 0))}원만큼 잔액이 줄어듭니다`}
                </span>
              </div>
            )}
            {linkedAccount && !isLoanLink && (
              <span className="text-[11px] text-slate-400 px-1">
                {fmt(amountToSave)}원이 <strong>{linkedAccount.name}</strong> 잔액에 더해집니다.
              </span>
            )}
          </div>
        )}
      </div>

      <div className="mt-auto bg-indigo-50/50 dark:bg-slate-900/50 p-4 border-t border-indigo-100 dark:border-slate-800">
        <div className="grid grid-cols-4 gap-3">
          {/* 계산기와 같은 배치다 — 오른쪽 열이 위에서부터 지우기·연산자·확정으로 내려간다.
              숫자는 전화기가 아니라 계산기 순서(아래로 갈수록 작아짐)를 따른다. */}
          {['7','8','9','back','4','5','6','+','1','2','3','-','0','00','C','완료'].map(label => (
            <KeypadButton key={label} label={label} onClick={handleKeyPress} onDone={handleDone}
              disabled={label === '완료' && (!canSave || interestTooBig)}
              variant={label === '완료' ? 'primary' : ['C','back','+','-'].includes(label) ? 'action' : 'number'} />
          ))}
        </div>
        <div className="mt-4">
          <Button variant="ghost" onClick={onClose} className="w-full text-slate-400">닫기</Button>
        </div>
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
