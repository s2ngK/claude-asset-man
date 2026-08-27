import { TransactionType } from '@/types';

// 백엔드 기본 카테고리(backend/app/seed.py)와 name/type이 일치해야 함 —
// 거래 저장 시 name+type으로 서버 카테고리를 조회하기 때문 (MainView.handleSaveEntry)
export const DEFAULT_CATEGORIES = [
  { id: 'food', type: 'expense', name: '식비', icon: 'restaurant', color: '#FF5733' },
  { id: 'transport', type: 'expense', name: '교통', icon: 'directions_car', color: '#33FF57' },
  { id: 'shopping', type: 'expense', name: '쇼핑', icon: 'shopping_cart', color: '#3357FF' },
  { id: 'housing', type: 'expense', name: '주거/통신', icon: 'home', color: '#FF33A1' },
  { id: 'medical', type: 'expense', name: '의료/건강', icon: 'medical_services', color: '#33FFF5' },
  { id: 'etc', type: 'expense', name: '기타', icon: 'more_horiz', color: '#808080' },
  { id: 'salary', type: 'income', name: '급여', icon: 'payments', color: '#FFBD33' },
  { id: 'allowance', type: 'income', name: '용돈', icon: 'savings', color: '#75FF33' },
  { id: 'finance', type: 'income', name: '금융수입', icon: 'trending_up', color: '#DB33FF' },
  { id: 'etc-income', type: 'income', name: '기타', icon: 'more_horiz', color: '#A0A0A0' },
] satisfies Array<{ id: string; type: TransactionType; name: string; icon: string; color: string }>;
