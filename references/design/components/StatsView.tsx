
import React, { useState, useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { Transaction } from '../types';

interface StatsViewProps {
  transactions: Transaction[];
}

const StatsView: React.FC<StatsViewProps> = ({ transactions }) => {
  const [activeTab, setActiveTab] = useState<'my' | 'group'>('my');
  const expenses = transactions.filter(t => t.type === 'expense');
  const totalExpense = expenses.reduce((acc, t) => acc + t.amount, 0);

  const categoryData = useMemo(() => {
    const data: { [key: string]: { name: string; value: number; color: string } } = {
      food: { name: '식비', value: 0, color: '#13eca4' },
      housing: { name: '주거', value: 0, color: '#0ea5e9' },
      transport: { name: '교통', value: 0, color: '#8b5cf6' },
      etc: { name: '기타', value: 0, color: '#64748b' },
    };

    expenses.forEach(e => {
      if (data[e.category]) {
        data[e.category].value += e.amount;
      } else {
        data['etc'].value += e.amount;
      }
    });

    return Object.values(data).filter(d => d.value > 0);
  }, [expenses]);

  // Mocked trend data for "My Stats"
  const myTrendData = useMemo(() => [
    { month: '5월', income: 2100000, expense: 1200000, balance: 900000 },
    { month: '6월', income: 2500000, expense: 1100000, balance: 1400000 },
    { month: '7월', income: 2400000, expense: 1500000, balance: 900000 },
    { month: '8월', income: 2500000, expense: 1300000, balance: 1200000 },
    { month: '9월', income: 2800000, expense: 1400000, balance: 1400000 },
    { month: '10월', income: 2500000, expense: 1049700, balance: 1450300 },
  ], []);

  // Mocked trend data for "Group Stats" (Sum of members)
  const groupTrendData = useMemo(() => [
    { month: '5월', income: 5200000, expense: 3100000, balance: 2100000 },
    { month: '6월', income: 5500000, expense: 2800000, balance: 2700000 },
    { month: '7월', income: 5400000, expense: 3500000, balance: 1900000 },
    { month: '8월', income: 5500000, expense: 3000000, balance: 2500000 },
    { month: '9월', income: 5800000, expense: 3200000, balance: 2600000 },
    { month: '10월', income: 5500000, expense: 4049700, balance: 1450300 },
  ], []);

  const currentTrendData = activeTab === 'my' ? myTrendData : groupTrendData;

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(amount);
  };

  return (
    <div className="animate-in slide-in-from-right duration-300">
      <div className="sticky top-0 z-50 bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center p-4 justify-between max-w-md mx-auto">
          <span className="material-symbols-outlined text-2xl">account_balance_wallet</span>
          <h2 className="text-lg font-bold flex-1 text-center font-display">분석</h2>
          <button className="size-10 flex items-center justify-end">
            <span className="material-symbols-outlined text-2xl">notifications</span>
          </button>
        </div>
      </div>

      <div className="px-4">
        <div className="flex py-4">
          <div className="flex h-11 flex-1 items-center justify-center rounded-xl bg-slate-200 dark:bg-slate-800 p-1">
            <button 
              onClick={() => setActiveTab('my')}
              className={`flex flex-1 items-center justify-center h-full rounded-lg transition-all text-sm font-semibold ${activeTab === 'my' ? 'bg-white dark:bg-slate-900 shadow-sm text-primary' : 'text-slate-500 dark:text-slate-400'}`}
            >
              내 통계
            </button>
            <button 
              onClick={() => setActiveTab('group')}
              className={`flex flex-1 items-center justify-center h-full rounded-lg transition-all text-sm font-semibold ${activeTab === 'group' ? 'bg-white dark:bg-slate-900 shadow-sm text-primary' : 'text-slate-500 dark:text-slate-400'}`}
            >
              그룹 통계
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between bg-slate-100 dark:bg-slate-800/40 rounded-xl p-2 mb-6 border border-slate-200 dark:border-slate-800">
          <button className="p-2 text-slate-400 hover:text-primary"><span className="material-symbols-outlined">chevron_left</span></button>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-sm">calendar_today</span>
            <p className="text-sm font-bold tracking-tight">2024년 10월</p>
          </div>
          <button className="p-2 text-slate-400 hover:text-primary"><span className="material-symbols-outlined">chevron_right</span></button>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl p-6 shadow-sm border border-slate-100 dark:border-slate-800 mb-6">
          <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-1">
            {activeTab === 'my' ? '나의 총 지출' : '그룹 총 지출'}
          </p>
          <div className="flex items-baseline gap-2 mb-6">
            <h3 className="text-3xl font-bold tracking-tight">{formatAmount(totalExpense)}</h3>
            <span className="text-emerald-500 text-sm font-semibold flex items-center">
              <span className="material-symbols-outlined text-sm">trending_up</span> 12%
            </span>
          </div>

          <div className="relative h-48 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData}
                  innerRadius={65}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute flex flex-col items-center">
              <span className="text-slate-400 text-xs font-bold uppercase tracking-widest">최다</span>
              <span className="text-xl font-bold">식비</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-8">
            {categoryData.map(item => (
              <div key={item.name} className="flex items-center gap-2">
                <div className="size-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{item.name}</p>
                  <p className="text-sm font-bold">{formatAmount(item.value)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Trend Chart - Visible in BOTH tabs as per latest request */}
        <div className="animate-in fade-in slide-in-from-bottom duration-500 space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-xl p-6 shadow-sm border border-slate-100 dark:border-slate-800 mb-6">
            <h2 className="text-slate-900 dark:text-white text-base font-bold mb-4">
              {activeTab === 'my' ? '나의 ' : '그룹 '}최근 6개월 추이
            </h2>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={currentTrendData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <YAxis hide />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    formatter={(value: number) => [formatAmount(value), '']}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                  {/* Bar for Income and Expense */}
                  <Bar dataKey="income" name="수입" fill="#13eca4" radius={[4, 4, 0, 0]} barSize={16} />
                  <Bar dataKey="expense" name="지출" fill="#f43f5e" radius={[4, 4, 0, 0]} barSize={16} />
                  {/* Line for Balance */}
                  <Line type="monotone" dataKey="balance" name="잔액" stroke="#0ea5e9" strokeWidth={3} dot={{ r: 4, fill: '#0ea5e9' }} activeDot={{ r: 6 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Member Expenditure section - ONLY visible in Group Stats tab */}
          {activeTab === 'group' && (
            <div className="pb-8">
              <h2 className="text-slate-900 dark:text-white text-lg font-bold px-1 pb-4">구성원별 지출</h2>
              <div className="space-y-4">
                {[
                  { name: '김철수 (나)', percent: 42, amount: 1785000, color: 'bg-primary' },
                  { name: '이영희', percent: 38, amount: 1615000, color: 'bg-sky-500' },
                  { name: '박지민', percent: 20, amount: 850000, color: 'bg-violet-500' }
                ].map(member => (
                  <div key={member.name} className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`size-10 rounded-full ${member.color}/20 flex items-center justify-center text-${member.color.split('-')[1]}-500 border border-${member.color.split('-')[1]}-500/30`}>
                          <span className="material-symbols-outlined">person</span>
                        </div>
                        <div>
                          <p className="font-bold text-sm">{member.name}</p>
                          <p className="text-xs text-slate-500">전체의 {member.percent}%</p>
                        </div>
                      </div>
                      <p className="font-bold text-sm">{formatAmount(member.amount)}</p>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div className={`${member.color} h-full rounded-full transition-all duration-700`} style={{ width: `${member.percent}%` }}></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StatsView;
