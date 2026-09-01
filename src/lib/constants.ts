import { TransactionType } from '@/types';

// 색은 backend/app/seed.py 와 같아야 한다 — 서버가 색을 안 내려줬을 때의 폴백이다.
// 눈으로 고른 값이 아니라 검증기를 통과시킨 값이다 → docs/stats-rules.md
// 백엔드 기본 카테고리(backend/app/seed.py)와 name/type이 일치해야 함 —
// 거래 저장 시 name+type으로 서버 카테고리를 조회하기 때문 (MainView.handleSaveEntry)
export const DEFAULT_CATEGORIES = [
  { id: 'food', type: 'expense', name: '식비', icon: 'restaurant', color: '#3987e5' },
  { id: 'transport', type: 'expense', name: '교통', icon: 'directions_car', color: '#d95926' },
  { id: 'shopping', type: 'expense', name: '쇼핑', icon: 'shopping_cart', color: '#199e70' },
  { id: 'housing', type: 'expense', name: '주거/통신', icon: 'home', color: '#c98500' },
  { id: 'medical', type: 'expense', name: '의료/건강', icon: 'medical_services', color: '#d55181' },
  { id: 'etc', type: 'expense', name: '기타', icon: 'more_horiz', color: '#008300' },
  { id: 'salary', type: 'income', name: '급여', icon: 'payments', color: '#9085e9' },
  { id: 'allowance', type: 'income', name: '용돈', icon: 'savings', color: '#e66767' },
  { id: 'finance', type: 'income', name: '금융수입', icon: 'trending_up', color: '#3987e5' },
  { id: 'etc-income', type: 'income', name: '기타', icon: 'more_horiz', color: '#d95926' },
] satisfies Array<{ id: string; type: TransactionType; name: string; icon: string; color: string }>;

// 달력을 그리는 곳이 둘(통계 달력, 날짜 선택기)이다. 요일 표기가 갈리지 않게 한곳에 둔다.
export const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'] as const;

/** 일요일은 붉게, 토요일은 푸르게. 달력에서 눈이 먼저 찾는 두 열이다. */
export const weekdayTone = (index: number) =>
  index === 0 ? 'text-rose-400' : index === 6 ? 'text-sky-400' : 'text-slate-400';

/**
 * 차트가 조각에 입히는 색. 값은 `backend/app/palette.py` 의 `CATEGORICAL_COLORS` 와
 * **같아야 한다** — 그쪽이 원본이고, 검증기(명도·채도·색맹 구분·대비)를 통과한 값이다.
 *
 * 도넛은 이 목록을 **순위 순서로** 가져다 쓴다. 카테고리에 저장된 색을 그대로 쓰면
 * 카테고리가 여덟 개를 넘는 순간 한 차트 안에서 같은 색이 두 번 나온다
 * (→ docs/stats-rules.md).
 */
export const CHART_COLORS = [
  '#3987e5', '#d95926', '#199e70', '#c98500',
  '#d55181', '#008300', '#9085e9', '#e66767',
] as const;

/** 묶음("그 외 N개")의 색. 범주형 색을 재사용하지 않는다. */
export const CHART_REST_COLOR = '#cbd5e1';
