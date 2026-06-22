'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { getCategoryStats, getTrend, getMemberStats, getLocalUser, type CategoryStat, type TrendItem, type MemberStat } from '@/lib/api';

export default function StatsView() {
  const [activeTab, setActiveTab] = useState<'my' | 'group'>('my');
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date().toISOString().slice(0, 7));
  const [categoryData, setCategoryData] = useState<CategoryStat[]>([]);
  const [trendData, setTrendData] = useState<Array<TrendItem & { month_label: string; balance: number }>>([]);
  const [memberRanking, setMemberRanking] = useState<MemberStat[]>([]);

  const user = getLocalUser();

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const userOnly = activeTab === 'my';
      const [cats, trend, members] = await Promise.all([
        getCategoryStats(currentMonth, userOnly),
        getTrend(),
        activeTab === 'group' ? getMemberStats(currentMonth) : Promise.resolve([]),
      ]);
      setCategoryData(cats);
      setTrendData(trend.map(t => ({ ...t, month_label: `${t.month.slice(5)}월`, balance: t.income - t.expense })));
      setMemberRanking(members);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [currentMonth, activeTab]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const totalExpense = categoryData.reduce((s, c) => s + c.total, 0);
  const formatAmount = (amount: number) => new Intl.NumberFormat('ko-KR').format(amount) + '원';
  const chartData = categoryData.map(c => ({ name: c.category_name, value: c.total, color: c.color || '#808080' }));

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
                  data={chartData.length > 0 ? chartData : [{ name: '데이터 없음', value: 1, color: '#f1f5f9' }]}
                  innerRadius={65} outerRadius={80} paddingAngle={5} dataKey="value" stroke="none"
                >
                  {chartData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  {chartData.length === 0 && <Cell fill="#f1f5f9" />}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute flex flex-col items-center">
              <span className="text-slate-400 text-[10px] font-bold uppercase">최다 지출</span>
              <span className="text-lg font-bold">{chartData[0]?.name || '-'}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-8">
            {chartData.slice(0, 4).map(item => (
              <div key={item.name} className="flex items-center gap-2">
                <div className="size-3 rounded-full" style={{ backgroundColor: item.color }} />
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
                <XAxis dataKey="month_label" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
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
                <div key={member.user_id} className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-100 dark:border-slate-800">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-bold text-sm">{member.display_name}</span>
                    <span className="font-bold text-sm">{formatAmount(member.total)}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${member.percentage}%` }} />
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 w-8">{member.percentage}%</span>
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
