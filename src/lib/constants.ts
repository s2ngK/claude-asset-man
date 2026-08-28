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
