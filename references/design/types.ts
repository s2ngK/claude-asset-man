
export type TransactionType = 'income' | 'expense';

export interface Transaction {
  id: string;
  date: string;
  title: string;
  category: string;
  amount: number;
  type: TransactionType;
  memo?: string;
  user?: string;
}

export interface CategoryInfo {
  id: string;
  name: string;
  icon: string;
  color: string;
}

export interface GroupMember {
  id: string;
  name: string;
  avatar: string;
  joinedAt: string;
  role: 'admin' | 'member';
  status: 'active' | 'inactive';
}

export enum View {
  HOME = 'home',
  STATS = 'stats',
  SETTINGS = 'settings',
  ADD_ENTRY = 'add_entry'
}
