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

export interface Transaction {
  id: string;
  group_id: string;
  user_id: string;
  category_id: string;
  type: TransactionType;
  amount: number;
  description: string; // DB column is description, UI uses memo often, stick to DB
  date: string;
  image_url?: string;
  created_at?: string;
  
  // Joins
  categories?: Category;
  profiles?: {
    full_name: string;
    avatar_url: string;
  };
}
