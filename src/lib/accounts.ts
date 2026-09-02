import type { Account, AccountKind, RepayMethod } from '@/lib/api';

/**
 * 계좌 관련 **예상치 계산**.
 *
 * 여기서 나오는 숫자는 전부 화면의 기본값일 뿐이다. 확정 금액은 사람이 넣는다 —
 * 실제 수령액·상환액은 우대금리·중도해지이율·세금우대 때문에 공식과 늘 어긋난다
 * (→ docs/accounts.md). 그래서 **이 파일의 값은 어디에도 저장되지 않는다.**
 */

/** 이자소득세(소득세 14% + 지방소득세 1.4%). 예상 수령액을 세후로 보여주려고만 쓴다. */
const INCOME_TAX = 0.154;

export const KIND_LABEL: Record<AccountKind, string> = {
  loan: '대출',
  deposit: '예금',
  installment: '적금',
};

export const REPAY_LABEL: Record<RepayMethod, string> = {
  equal_payment: '원리금균등',
  equal_principal: '원금균등',
  bullet: '만기일시',
};

export const STATUS_LABEL = {
  active: '진행중',
  matured: '만기',
  closed: '해지',
} as const;

/** 대출은 부채, 예적금은 자산이다. 화면이 두 구역으로 갈리는 기준. */
export const isDebt = (kind: AccountKind) => kind === 'loan';

/** 두 `YYYY-MM-DD` 사이의 개월 수. 만기 계산의 단위가 달이라 달로 센다. */
export function monthsBetween(from: string, to: string): number {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  if (!fy || !ty) return 0;
  const months = (ty - fy) * 12 + (tm - fm) - (td < fd ? 1 : 0);
  return Math.max(months, 0);
}

/** 오늘 기준 만기까지 남은 개월 수. 이미 지났으면 0. */
export function monthsLeft(matures: string): number {
  return monthsBetween(new Date().toISOString().slice(0, 10), matures);
}

/**
 * 예적금 만기 예상 수령액 (세후, 단리 기준).
 *
 * - **예금** — 목돈을 한 번 넣으므로 원금 × 이율 × 기간
 * - **적금** — 회차마다 예치 기간이 다르다. 첫 회차는 n개월, 마지막 회차는 1개월
 *   예치되므로 이자는 `월납입액 × 월이율 × n(n+1)/2` 이다
 *
 * 복리·우대금리는 넣지 않았다. 세후 확정액은 어차피 사람이 고쳐 넣기 때문에
 * 여기서 정교하게 맞출수록 "계산이 맞는다" 는 잘못된 믿음만 준다.
 */
export function expectedMaturity(account: Account): { principal: number; interest: number; total: number } {
  const months = monthsBetween(account.started_on, account.matures_on);
  const monthlyRate = account.rate / 100 / 12;

  const principal = account.kind === 'deposit' ? account.amount : account.amount * months;
  const gross =
    account.kind === 'deposit'
      ? account.amount * monthlyRate * months
      : account.amount * monthlyRate * ((months * (months + 1)) / 2);

  const interest = Math.round(gross * (1 - INCOME_TAX));
  return { principal, interest, total: principal + interest };
}

/**
 * 대출의 **이번 회차 예상 상환액**과 그 안의 이자분.
 *
 * 이자는 언제나 `남은 원금 × 월이율` 이다. 상환방식이 가르는 것은 원금을 얼마나 갚느냐다.
 *
 * - 원리금균등 — 매달 같은 금액을 낸다. 초반엔 이자가, 후반엔 원금이 많다
 * - 원금균등 — 원금을 회차 수로 나눠 갚는다. 상환액이 매달 조금씩 준다
 * - 만기일시 — 이자만 내다가 만기에 원금을 한 번에 갚는다
 */
export function expectedRepayment(account: Account): { total: number; interest: number; principal: number } {
  const monthlyRate = account.rate / 100 / 12;
  const interest = Math.round(account.balance * monthlyRate);
  const term = Math.max(monthsBetween(account.started_on, account.matures_on), 1);

  if (account.repay_method === 'bullet') {
    // 만기가 지났으면 원금까지 갚을 차례다.
    const principal = monthsLeft(account.matures_on) === 0 ? account.balance : 0;
    return { total: interest + principal, interest, principal };
  }

  if (account.repay_method === 'equal_principal') {
    const principal = Math.min(Math.round(account.amount / term), account.balance);
    return { total: principal + interest, interest, principal };
  }

  // 원리금균등. **월 상환액은 대출 시점에 정해진 상수**다 — 원금과 전체 기간으로 낸다.
  // 남은 잔액과 남은 개월로 다시 계산하면, 실제로 낸 금액이 스케줄과 조금만 달라져도
  // 예상액이 매달 튄다 (덜 갚으면 남은 기간에 몰려 상환액이 폭증한다).
  const scheduled =
    monthlyRate === 0
      ? Math.round(account.amount / term)
      : Math.round(
          (account.amount * monthlyRate * Math.pow(1 + monthlyRate, term)) /
            (Math.pow(1 + monthlyRate, term) - 1),
        );
  // 마지막 회차는 남은 원금까지만 갚는다.
  const principal = Math.min(Math.max(scheduled - interest, 0), account.balance);
  return { total: principal + interest, interest, principal };
}

/** 진행률 — 대출은 갚은 비율, 적금은 부은 비율. 예금은 시간이 지난 비율이다. */
export function progress(account: Account): number {
  if (account.status !== 'active') return 1;
  if (account.kind === 'loan') return clamp(account.paid_principal / account.amount);
  if (account.kind === 'installment') {
    const months = monthsBetween(account.started_on, account.matures_on);
    return clamp(account.paid_principal / Math.max(account.amount * months, 1));
  }
  const term = monthsBetween(account.started_on, account.matures_on);
  return clamp((term - monthsLeft(account.matures_on)) / Math.max(term, 1));
}

const clamp = (value: number) => Math.min(Math.max(Number.isFinite(value) ? value : 0, 0), 1);
