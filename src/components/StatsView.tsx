'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { cn } from '@/lib/utils';
import AppNav, { SIDEBAR_WIDTH } from '@/components/AppNav';
import { getCategoryStats, getTrend, getMemberStats, getDailyTotals, type CategoryStat, type TrendItem, type MemberStat, type DailyTotal } from '@/lib/api';
import MonthCalendar from '@/components/MonthCalendar';
import MonthPicker from '@/components/MonthPicker';
import { CHART_COLORS, CHART_REST_COLOR } from '@/lib/constants';

const formatAmount = (amount: number) => new Intl.NumberFormat('ko-KR').format(amount) + '원';

type Slice = { name: string; value: number; color: string; percentage: number };

/** 조각을 짚으면 이름·금액·점유율을 함께 보여준다.
 *
 *  카테고리 색 중에는 흰 카드 위에서 대비가 3:1 에 못 미치는 것이 있어(연한 초록·하늘색),
 *  색만으로는 어느 조각인지 못 읽는다. 범례와 이 툴팁이 그걸 글자로 받쳐준다. */
const SliceTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: Slice }> }) => {
  if (!active || !payload?.length) return null;
  const slice = payload[0].payload;
  return (
    <div className="rounded-xl bg-white dark:bg-slate-800 px-3 py-2 shadow-lg border border-slate-100 dark:border-slate-700">
      <p className="text-xs font-bold text-slate-900 dark:text-white">{slice.name}</p>
      <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
        {formatAmount(slice.value)} · {slice.percentage}%
      </p>
    </div>
  );
};

export default function StatsView() {
  const [activeTab, setActiveTab] = useState<'my' | 'group'>('my');
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date().toISOString().slice(0, 7));
  const [categoryData, setCategoryData] = useState<CategoryStat[]>([]);
  const [trendData, setTrendData] = useState<Array<TrendItem & { month_label: string; balance: number }>>([]);
  const [memberRanking, setMemberRanking] = useState<MemberStat[]>([]);
  const [dailyTotals, setDailyTotals] = useState<DailyTotal[]>([]);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const userOnly = activeTab === 'my';
      const [cats, trend, members, daily] = await Promise.all([
        getCategoryStats(currentMonth, userOnly),
        getTrend(),
        activeTab === 'group' ? getMemberStats(currentMonth) : Promise.resolve([]),
        getDailyTotals(currentMonth, userOnly),
      ]);
      setCategoryData(cats);
      setDailyTotals(daily);
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
  // percentage 는 서버가 이미 계산해서 내려준다 (GET /api/stats/categories).
  // 범례에 적을 상위 몇 개. 다섯을 넘으면 나머지는 한 줄로 묶는다.
  const LEGEND_LIMIT = 5;

  const chartData: Slice[] = categoryData.map(c => ({
    name: c.category_name,
    value: c.total,
    color: c.color || '#808080',
    percentage: c.percentage,
  }));

  const topSlices = chartData.slice(0, LEGEND_LIMIT);
  const restSlices = chartData.slice(LEGEND_LIMIT);
  const restTotal = restSlices.reduce((sum, s) => sum + s.value, 0);
  // 각 조각의 반올림값을 더하지 않는다 — 합계에서 바로 내면 100% 를 넘거나 모자라지 않는다.
  const restPercentage = totalExpense > 0 ? Math.round((restTotal / totalExpense) * 1000) / 10 : 0;

  // 조각 색은 **순위 순서로** 팔레트에서 가져온다. 카테고리에 저장된 색을 그대로 쓰면
  // 카테고리가 여덟 개를 넘는 순간 한 차트 안에서 같은 색이 두 번 나온다 — 실제로
  // 지출 카테고리 12개에서 상위 5개 중 두 쌍이 겹쳤다.
  //
  // 색이 "그 카테고리의 색" 이 아니라 "이 차트에서 몇 번째" 를 뜻하게 되지만, 도넛에서
  // 색이 하는 일은 **조각과 범례를 잇는 것**이고 둘은 늘 나란히 붙어 있다.
  // 목록 행의 아이콘 배경은 그대로 카테고리 색을 쓴다 (→ docs/stats-rules.md).
  const paint = (slices: Slice[]) => slices.map((s, i) => ({ ...s, color: CHART_COLORS[i % CHART_COLORS.length] }));
  const paintedTop = paint(topSlices);
  const pieData: Slice[] = restSlices.length > 0
    ? [...paintedTop, { name: `그 외 ${restSlices.length}개`, value: restTotal, color: CHART_REST_COLOR, percentage: restPercentage }]
    : paintedTop;

  return (
    <div className={cn('min-h-screen pb-24 lg:pb-8 bg-slate-50 dark:bg-slate-950', SIDEBAR_WIDTH)}>
      <header className="sticky top-0 z-30 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 p-4 text-center">
        <h2 className="text-lg font-bold">분석</h2>
      </header>

      <div className="p-4 max-w-md lg:max-w-5xl mx-auto space-y-6">
        {/* 넓은 화면에서는 탭 전환기와 월 선택기를 한 줄에 둔다 */}
        <div className="lg:flex lg:gap-4 lg:items-center space-y-6 lg:space-y-0">
        <div className="flex h-11 items-center justify-center rounded-xl bg-slate-200 dark:bg-slate-800 p-1 lg:flex-1">
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

        <div className="flex items-center justify-center bg-white dark:bg-slate-900 rounded-xl p-2 border border-slate-200 dark:border-slate-800 shadow-sm lg:w-64">
          <MonthPicker value={currentMonth} onChange={setCurrentMonth} />
        </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-400">로딩 중...</div>
        ) : (
          <>
          {/* 넓은 화면에서는 도넛과 추이를 나란히 — 세로로만 길어지면 둘을 비교할 수 없다 */}
          <div className="space-y-6 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-6">
          <div className="flex h-full flex-col bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-800">
            <p className="text-slate-500 text-sm font-medium mb-1">
              {activeTab === 'my' ? '나의 ' : '그룹 '}총 지출
            </p>
            <h3 className="text-3xl font-bold tracking-tight mb-6">{formatAmount(totalExpense)}</h3>

            <div className="relative h-48 w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  {/* 가운데 "최다 지출" 라벨이 차트 위에 절대 위치로 얹혀 있다. 툴팁에
                      z-index 를 주지 않으면 그 라벨 뒤로 깔려 두 글자가 겹쳐 읽힌다. */}
                  {chartData.length > 0 && <Tooltip content={<SliceTooltip />} wrapperStyle={{ zIndex: 30 }} />}
                  <Pie
                    data={pieData.length > 0 ? pieData : [{ name: '데이터 없음', value: 1, color: '#f1f5f9', percentage: 0 }]}
                    innerRadius={65} outerRadius={80} paddingAngle={5} dataKey="value" stroke="none"
                  >
                    {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    {pieData.length === 0 && <Cell fill="#f1f5f9" />}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute z-0 flex flex-col items-center pointer-events-none">
                <span className="text-slate-400 text-[10px] font-bold uppercase">최다 지출</span>
                <span className="text-lg font-bold">{chartData[0]?.name || '-'}</span>
                {chartData[0] && (
                  <span className="text-slate-500 dark:text-slate-400 text-xs font-bold">{chartData[0].percentage}%</span>
                )}
              </div>
            </div>

            {/* 상위 다섯 개만 적는다. 전부 나열하면 카테고리 수에 따라 카드 높이가 널뛰어
                옆의 추이 카드와 어긋난다. 대신 나머지를 **묶어서 한 줄로** 남긴다 —
                잘라내기만 하면 남은 것이 합쳐서 몇 %인지 알 수 없다. */}
            <div className="grid grid-cols-2 gap-4 mt-8">
              {paintedTop.map(item => (
                <div key={item.name} className="flex items-center gap-2">
                  <div className="size-3 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                  <div className="min-w-0">
                    <p className="text-[10px] text-slate-500 truncate">{item.name}</p>
                    <p className="text-xs font-bold truncate">
                      {formatAmount(item.value)}
                      <span className="ml-1 font-medium text-slate-400">{item.percentage}%</span>
                    </p>
                  </div>
                </div>
              ))}

              {restSlices.length > 0 && (
                <div className="flex items-center gap-2">
                  <div className="size-3 shrink-0 rounded-full" style={{ backgroundColor: CHART_REST_COLOR }} />
                  <div className="min-w-0">
                    <p className="text-[10px] text-slate-500 truncate">그 외 {restSlices.length}개</p>
                    <p className="text-xs font-bold truncate">
                      {formatAmount(restTotal)}
                      <span className="ml-1 font-medium text-slate-400">{restPercentage}%</span>
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Trend Chart */}
          <div className="flex h-full flex-col bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-800">
            <h2 className="text-base font-bold mb-4">최근 6개월 추이</h2>
            <div className="h-64 w-full flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="month_label" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <YAxis hide />
                  <Tooltip
                    wrapperStyle={{ zIndex: 30 }}
                    // 기본 표기는 1550000 처럼 붙어 나와 자릿수를 셀 수 없다.
                    formatter={(value) => formatAmount(Number(value))}
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

          </div>

          <MonthCalendar month={currentMonth} totals={dailyTotals} />

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
          </>
        )}
      </div>

      <AppNav />
    </div>
  );
}
