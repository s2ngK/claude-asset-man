export type TransactionType = 'income' | 'expense';

export interface Category {
  id: string;
  group_id: string | null;
  type: TransactionType;
  name: string;
  icon: string;
  color: string;
  is_default: boolean;
}

// 거래 목록 표시용 카테고리 조인 (API 응답으로 채울 수 있는 필드만)
export interface TransactionCategoryRef {
  id: string;
  name: string;
  icon: string;
  color: string;
}

export interface Transaction {
  id: string;
  group_id: string;
  user_id: string;
  category_id: string;
  type: TransactionType;
  amount: number;
  description: string; // DB column is description, UI uses memo often, stick to DB
  date: string;
  /** 이 거래가 움직이는 계좌. 대부분의 거래는 계좌와 무관하다 (→ docs/accounts.md). */
  account_id?: string | null;
  account_name?: string | null;
  /** amount 중 이자분. 나머지가 원금분이고 **잔액은 원금분만 움직인다.** */
  interest_amount?: number | null;
  image_url?: string;
  created_at?: string;
  
  // Joins
  categories?: TransactionCategoryRef | null;
  // 서버가 평평하게 내려주는 작성자 이름. 예전엔 Supabase 조인 모양(`profiles`)을
  // 그대로 들고 있었는데, 채워주는 코드가 없어 목록의 작성자가 전부 '나' 로 보였다.
  user_display_name?: string;
}
