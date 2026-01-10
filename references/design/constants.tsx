
import { CategoryInfo, Transaction, GroupMember } from './types';

export const CATEGORIES: CategoryInfo[] = [
  { id: 'food', name: '식비', icon: 'restaurant', color: 'bg-orange-500' },
  { id: 'transport', name: '교통', icon: 'directions_car', color: 'bg-yellow-500' },
  { id: 'shopping', name: '쇼핑', icon: 'shopping_cart', color: 'bg-blue-500' },
  { id: 'housing', name: '주거', icon: 'home', color: 'bg-purple-500' },
  { id: 'medical', name: '의료', icon: 'medical_services', color: 'bg-rose-500' },
  { id: 'telecom', name: '통신', icon: 'phone_iphone', color: 'bg-indigo-500' },
  { id: 'hobby', name: '취미', icon: 'palette', color: 'bg-pink-500' },
  { id: 'salary', name: '수입', icon: 'payments', color: 'bg-primary' },
  { id: 'etc', name: '기타', icon: 'more_horiz', color: 'bg-slate-500' },
];

export const SAMPLE_MEMBERS: GroupMember[] = [
  { id: '1', name: '김철수', avatar: 'https://picsum.photos/seed/alex/100', joinedAt: '2023-10-01', role: 'admin', status: 'active' },
  { id: '2', name: '이영희', avatar: 'https://picsum.photos/seed/jordan/100', joinedAt: '2024-03-10', role: 'member', status: 'active' },
  { id: '3', name: '박지민', avatar: 'https://picsum.photos/seed/taylor/100', joinedAt: '2024-03-12', role: 'member', status: 'active' },
];

export const SAMPLE_TRANSACTIONS: Transaction[] = [
  { id: 't1', date: '2023-10-27', title: '블루보틀', category: 'food', amount: 12500, type: 'expense', memo: '공용' },
  { id: 't2', date: '2023-10-27', title: '급여 입금', category: 'salary', amount: 3500000, type: 'income', memo: '10월 월급' },
  { id: 't3', date: '2023-10-26', title: '이마트', category: 'shopping', amount: 142200, type: 'expense', memo: '장보기' },
  { id: 't4', date: '2023-10-26', title: '월세 납부', category: 'housing', amount: 1800000, type: 'expense', memo: '주거비' },
  { id: 't5', date: '2023-10-26', title: 'GS칼텍스', category: 'transport', amount: 45000, type: 'expense', memo: '교통비' },
];
