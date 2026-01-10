'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { createClient } from '@/lib/supabaseClient';
import { Transaction } from '@/types';
import { DEFAULT_CATEGORIES } from '@/lib/constants';
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface StatsViewProps {
  groupName: string;
}

export default function StatsView({ groupName }: StatsViewProps) {
  const [activeTab, setActiveTab] = useState<'my' | 'group'>('my');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date().toISOString().slice(0, 7));
  const supabase = createClient();

  const fetchStatsData = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Get group_id
    const { data: profile } = await supabase.from('profiles').select('group_id').eq('id', user.id).single();
    if (!profile?.group_id) return;

    // Fetch last 6 months of data for trend
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    const startDate = sixMonthsAgo.toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('transactions')
      .select(`
        *,
        categories (name, icon, color),
        profiles (full_name)
      `)
      .eq('group_id', profile.group_id)
      .gte('date', startDate)
      .order('date', { ascending: true });

    if (error) {
      console.error('Error fetching stats:', error);
    } else {
      setTransactions(data as Transaction[]);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchStatsData();
  }, [fetchStatsData]);

  // Current User ID for 'my' stats
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id || null));
  }, [supabase]);

  // Filtered transactions based on Tab (My vs Group)
  const filteredByTab = useMemo(() => {
    if (activeTab === 'my') {
      return transactions.filter(t => t.user_id === currentUserId);
    }
    return transactions;
  }, [transactions, activeTab, currentUserId]);

  // 1. Category Data (Current Month)
  const categoryData = useMemo(() => {
    const currentMonthTxs = filteredByTab.filter(t => t.date.startsWith(currentMonth) && t.type === 'expense');
    const aggregation: { [key: string]: number } = {};
    
    currentMonthTxs.forEach(t => {
      const name = t.categories?.name || '기타';
      aggregation[name] = (aggregation[name] || 0) + t.amount;
    });

    return Object.entries(aggregation).map(([name, value]) => {
      const catInfo = DEFAULT_CATEGORIES.find(c => c.name === name);
      return {
        name,
        value,
        color: catInfo?.color || '#808080'
      };
    }).sort((a, b) => b.value - a.value);
  }, [filteredByTab, currentMonth]);

  // 2. Trend Data (Last 6 Months)
  const trendData = useMemo(() => {
    const months: { [key: string]: { month: string, income: number, expense: number, balance: number } } = {};
    
    // Initialize last 6 months
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const m = d.toISOString().slice(0, 7);
      months[m] = { month: `${d.getMonth() + 1}월`, income: 0, expense: 0, balance: 0 };
    }

    filteredByTab.forEach(t => {
      const m = t.date.slice(0, 7);
      if (months[m]) {
        if (t.type === 'income') months[m].income += t.amount;
        else months[m].expense += t.amount;
      }
    });

    Object.values(months).forEach(m => {
      m.balance = m.income - m.expense;
    });

    return Object.values(months);
  }, [filteredByTab]);

  // 3. Member Ranking (Group Tab only)
  const memberRanking = useMemo(() => {
    if (activeTab !== 'group') return [];
    const currentMonthTxs = transactions.filter(t => t.date.startsWith(currentMonth) && t.type === 'expense');
    const aggregation: { [key: string]: { name: string, amount: number } } = {};

    currentMonthTxs.forEach(t => {
      const uid = t.user_id;
      const name = t.profiles?.full_name || '알 수 없음';
      if (!aggregation[uid]) aggregation[uid] = { name, amount: 0 };
      aggregation[uid].amount += t.amount;
    });

    const total = Object.values(aggregation).reduce((acc, curr) => acc + curr.amount, 0);

    return Object.values(aggregation)
      .map(m => ({
        ...m,
        percent: total > 0 ? Math.round((m.amount / total) * 100) : 0
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [transactions, currentMonth, activeTab]);

  const totalExpense = categoryData.reduce((acc, curr) => acc + curr.value, 0);
  const formatAmount = (amount: number) => new Intl.NumberFormat('ko-KR').format(amount) + '원';

  return (
    <div className="min-h-screen pb-24 bg-slate-50 dark:bg-slate-950">
      <header className="sticky top-0 z-30 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 p-4 text-center">
        <h2 className="text-lg font-bold">분석</h2>
      </header>

      <div className="p-4 max-w-md mx-auto space-y-6">
        {/* Tab Switcher */}
        <div className="flex h-11 items-center justify-center rounded-xl bg-slate-200 dark:bg-slate-800 p-1">
          <button 
            onClick={() => setActiveTab('my')}
            className={cn(
              "flex flex-1 items-center justify-center h-full rounded-lg transition-all text-sm font-semibold",
              activeTab === 'my' ? "bg-white dark:bg-slate-900 shadow-sm text-emerald-500" : "text-slate-500"
            )}
          >
            내 통계
          </button>
          <button 
            onClick={() => setActiveTab('group')}
            className={cn(
              "flex flex-1 items-center justify-center h-full rounded-lg transition-all text-sm font-semibold",
              activeTab === 'group' ? "bg-white dark:bg-slate-900 shadow-sm text-emerald-500" : "text-slate-500"
            )}
          >
            그룹 통계
          </button>
        </div>

        {/* Month Selector */}
        <div className="flex items-center justify-between bg-white dark:bg-slate-900 rounded-xl p-3 border border-slate-200 dark:border-slate-800 shadow-sm">
           <input 
            type="month" 
            value={currentMonth}
            onChange={(e) => setCurrentMonth(e.target.value)}
            className="bg-transparent font-bold outline-none cursor-pointer w-full text-center"
           />
        </div>

        {/* Summary & Pie Chart */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-800">
          <p className="text-slate-500 text-sm font-medium mb-1">
            {activeTab === 'my' ? '나의 ' : '그룹 '}총 지출
          </p>
          <h3 className="text-3xl font-bold tracking-tight mb-6">{formatAmount(totalExpense)}</h3>

          <div className="relative h-48 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData.length > 0 ? categoryData : [{ name: '데이터 없음', value: 1, color: '#f1f5f9' }]}
                  innerRadius={65}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                  {categoryData.length === 0 && <Cell fill="#f1f5f9" />}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute flex flex-col items-center">
              <span className="text-slate-400 text-[10px] font-bold uppercase">최다 지출</span>
              <span className="text-lg font-bold">{categoryData[0]?.name || '-'}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-8">
            {categoryData.slice(0, 4).map(item => (
              <div key={item.name} className="flex items-center gap-2">
                <div className="size-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                <div className="min-w-0">
                  <p className="text-[10px] text-slate-500 truncate">{item.name}</p>
                  <p className="text-xs font-bold truncate">{formatAmount(item.value)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Trend Chart */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-800">
          <h2 className="text-base font-bold mb-4">최근 6개월 추이</h2>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <YAxis hide />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: '12px' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                <Bar dataKey="income" name="수입" fill="#10b981" radius={[4, 4, 0, 0]} barSize={12} />
                <Bar dataKey="expense" name="지출" fill="#f43f5e" radius={[4, 4, 0, 0]} barSize={12} />
                <Line type="monotone" dataKey="balance" name="잔액" stroke="#0ea5e9" strokeWidth={2} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Member Ranking (Group only) */}
        {activeTab === 'group' && memberRanking.length > 0 && (
          <div className="space-y-4">
             <h2 className="text-lg font-bold px-1">구성원별 지출</h2>
             <div className="space-y-3">
               {memberRanking.map(member => (
                 <div key={member.name} className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-100 dark:border-slate-800">
                    <div className="flex justify-between items-center mb-2">
                       <span className="font-bold text-sm">{member.name}</span>
                       <span className="font-bold text-sm">{formatAmount(member.amount)}</span>
                    </div>
                    <div className="flex items-center gap-3">
                       <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-emerald-500 rounded-full transition-all duration-500" 
                            style={{ width: `${member.percent}%` }}
                          />
                       </div>
                       <span className="text-[10px] font-bold text-slate-400 w-8">{member.percent}%</span>
                    </div>
                 </div>
               ))}
             </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800 z-40 pb-safe">
        <div className="flex justify-around items-center h-16 max-w-md mx-auto px-6">
          <Link href="/" className="flex flex-col items-center gap-1 text-slate-400">
            <span className="material-symbols-outlined text-[24px]">home</span>
            <span className="text-[10px] font-medium">홈</span>
          </Link>
          <Link href="/stats" className="flex flex-col items-center gap-1 text-emerald-500">
            <span className="material-symbols-outlined text-[24px]">insights</span>
            <span className="text-[10px] font-bold">통계</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}
