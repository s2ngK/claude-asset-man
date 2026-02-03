import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { StyleSheet, View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { supabase } from '../../src/lib/supabaseClient';
import { Transaction } from '../../src/types';
import { format, subMonths, startOfMonth } from 'date-fns';
import { BarChart3, PieChart as PieChartIcon, Users, User } from 'lucide-react-native';

export default function StatsScreen() {
  const [activeTab, setActiveTab] = useState<'my' | 'group'>('my');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const fetchStatsData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setCurrentUserId(user.id);

      const { data: profile } = await supabase.from('profiles').select('group_id').eq('id', user.id).single();
      if (!profile?.group_id) return;

      const sixMonthsAgo = startOfMonth(subMonths(new Date(), 5));
      const startDate = format(sixMonthsAgo, 'yyyy-MM-dd');

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

      if (error) throw error;
      setTransactions(data as any[]);
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatsData();
  }, [fetchStatsData]);

  const filteredByTab = useMemo(() => {
    if (activeTab === 'my') {
      return transactions.filter(t => t.user_id === currentUserId);
    }
    return transactions;
  }, [transactions, activeTab, currentUserId]);

  const categoryData = useMemo(() => {
    const currentMonthTxs = filteredByTab.filter(t => t.date.startsWith(currentMonth) && t.type === 'expense');
    const aggregation: { [key: string]: { amount: number, color: string, icon: string } } = {};
    
    currentMonthTxs.forEach(t => {
      const name = (t as any).categories?.name || '기타';
      if (!aggregation[name]) {
        aggregation[name] = { 
          amount: 0, 
          color: (t as any).categories?.color || '#94a3b8',
          icon: (t as any).categories?.icon || '💰'
        };
      }
      aggregation[name].amount += t.amount;
    });

    return Object.entries(aggregation)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.amount - a.amount);
  }, [filteredByTab, currentMonth]);

  const totalExpense = categoryData.reduce((acc, curr) => acc + curr.amount, 0);

  const memberRanking = useMemo(() => {
    if (activeTab !== 'group') return [];
    const currentMonthTxs = transactions.filter(t => t.date.startsWith(currentMonth) && t.type === 'expense');
    const aggregation: { [key: string]: { name: string, amount: number } } = {};

    currentMonthTxs.forEach(t => {
      const uid = t.user_id;
      const name = (t as any).profiles?.full_name || '알 수 없음';
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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>분석</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Tab Switcher */}
        <View style={styles.tabContainer}>
          <Pressable 
            onPress={() => setActiveTab('my')}
            style={[styles.tab, activeTab === 'my' && styles.activeTab]}
          >
            <User size={18} color={activeTab === 'my' ? '#10b981' : '#94a3b8'} />
            <Text style={[styles.tabText, activeTab === 'my' && styles.activeTabText]}>내 통계</Text>
          </Pressable>
          <Pressable 
            onPress={() => setActiveTab('group')}
            style={[styles.tab, activeTab === 'group' && styles.activeTab]}
          >
            <Users size={18} color={activeTab === 'group' ? '#10b981' : '#94a3b8'} />
            <Text style={[styles.tabText, activeTab === 'group' && styles.activeTabText]}>그룹 통계</Text>
          </Pressable>
        </View>

        {loading ? (
          <ActivityIndicator style={{ marginTop: 40 }} color="#10b981" />
        ) : (
          <View style={{ gap: 20 }}>
            {/* Expense Summary */}
            <View style={styles.card}>
              <Text style={styles.cardLabel}>{activeTab === 'my' ? '나의 ' : '그룹 '}총 지출</Text>
              <Text style={styles.totalAmount}>
                {new Intl.NumberFormat('ko-KR').format(totalExpense)}원
              </Text>
              
              <View style={styles.categoryList}>
                {categoryData.map((item, index) => (
                  <View key={item.name} style={styles.categoryItem}>
                    <View style={styles.categoryInfo}>
                      <View style={[styles.colorDot, { backgroundColor: item.color }]} />
                      <Text style={styles.categoryName}>{item.icon} {item.name}</Text>
                    </View>
                    <View style={styles.categoryValue}>
                      <Text style={styles.categoryAmount}>
                        {new Intl.NumberFormat('ko-KR').format(item.amount)}원
                      </Text>
                      <Text style={styles.categoryPercent}>
                        {totalExpense > 0 ? Math.round((item.amount / totalExpense) * 100) : 0}%
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>

            {/* Member Ranking */}
            {activeTab === 'group' && memberRanking.length > 0 && (
              <View style={{ gap: 12 }}>
                <Text style={styles.sectionTitle}>구성원별 지출</Text>
                {memberRanking.map(member => (
                  <View key={member.name} style={styles.rankingCard}>
                    <View style={styles.rankingHeader}>
                      <Text style={styles.memberName}>{member.name}</Text>
                      <Text style={styles.memberAmount}>{new Intl.NumberFormat('ko-KR').format(member.amount)}원</Text>
                    </View>
                    <View style={styles.progressBarBg}>
                      <View style={[styles.progressBarFill, { width: `${member.percent}%` }]} />
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: 'white',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#e2e8f0',
    padding: 4,
    borderRadius: 12,
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 6,
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: 'white',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  activeTabText: {
    color: '#10b981',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardLabel: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 4,
  },
  totalAmount: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 24,
  },
  categoryList: {
    gap: 16,
  },
  categoryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  colorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  categoryName: {
    fontSize: 14,
    color: '#334155',
  },
  categoryValue: {
    alignItems: 'flex-end',
  },
  categoryAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  categoryPercent: {
    fontSize: 11,
    color: '#94a3b8',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0f172a',
    marginTop: 10,
  },
  rankingCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  rankingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  memberName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  memberAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  progressBarBg: {
    height: 8,
    backgroundColor: '#f1f5f9',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#10b981',
    borderRadius: 4,
  }
});