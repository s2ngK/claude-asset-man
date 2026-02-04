import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { supabase } from '../../src/lib/supabaseClient';
import { format, endOfMonth, parse } from 'date-fns';
import { Users, User } from 'lucide-react-native';

interface CategoryStat {
  category_name: string;
  category_color: string;
  category_icon: string;
  total_amount: number;
}

interface MemberStat {
  user_id: string;
  full_name: string;
  total_amount: number;
  percent?: number;
}

export default function StatsScreen() {
  const [activeTab, setActiveTab] = useState<'my' | 'group'>('my');
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(format(new Date(), 'yyyy-MM'));
  
  const [categoryData, setCategoryData] = useState<CategoryStat[]>([]);
  const [memberRanking, setMemberRanking] = useState<MemberStat[]>([]);
  const [totalExpense, setTotalExpense] = useState(0);

  const fetchStatsData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase.from('profiles').select('group_id').eq('id', user.id).single();
      if (!profile?.group_id) return;

      // Calculate dates for the selected month
      const monthDate = parse(currentMonth, 'yyyy-MM', new Date());
      const startDate = format(monthDate, 'yyyy-MM-dd');
      const endDate = format(endOfMonth(monthDate), 'yyyy-MM-dd');

      const userIdParam = activeTab === 'my' ? user.id : null;

      // 1. Fetch Category Stats
      const { data: catStats, error: catError } = await supabase.rpc('get_monthly_category_stats', {
        _group_id: profile.group_id,
        _month_start: startDate,
        _month_end: endDate,
        _user_id: userIdParam
      });

      if (catError) throw catError;
      setCategoryData(catStats || []);
      
      const total = (catStats || []).reduce((acc: number, curr: CategoryStat) => acc + curr.total_amount, 0);
      setTotalExpense(total);

      // 2. Fetch Member Stats (Only for Group tab)
      if (activeTab === 'group') {
        const { data: memStats, error: memError } = await supabase.rpc('get_monthly_member_stats', {
          _group_id: profile.group_id,
          _month_start: startDate,
          _month_end: endDate
        });

        if (memError) throw memError;
        
        // Calculate percentages
        const grandTotal = (memStats || []).reduce((acc: number, curr: MemberStat) => acc + curr.total_amount, 0);
        const rankingWithPercent = (memStats || []).map((m: MemberStat) => ({
          ...m,
          percent: grandTotal > 0 ? Math.round((m.total_amount / grandTotal) * 100) : 0
        }));
        
        setMemberRanking(rankingWithPercent);
      } else {
        setMemberRanking([]);
      }

    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  }, [currentMonth, activeTab]);

  useEffect(() => {
    fetchStatsData();
  }, [fetchStatsData]);

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
                {categoryData.length === 0 ? (
                  <Text style={{color: '#94a3b8', textAlign: 'center', marginVertical: 20}}>지출 내역이 없습니다.</Text>
                ) : (
                  categoryData.map((item, index) => (
                    <View key={index} style={styles.categoryItem}>
                      <View style={styles.categoryInfo}>
                        <View style={[styles.colorDot, { backgroundColor: item.category_color || '#94a3b8' }]} />
                        <Text style={styles.categoryName}>{item.category_icon} {item.category_name}</Text>
                      </View>
                      <View style={styles.categoryValue}>
                        <Text style={styles.categoryAmount}>
                          {new Intl.NumberFormat('ko-KR').format(item.total_amount)}원
                        </Text>
                        <Text style={styles.categoryPercent}>
                          {totalExpense > 0 ? Math.round((item.total_amount / totalExpense) * 100) : 0}%
                        </Text>
                      </View>
                    </View>
                  ))
                )}
              </View>
            </View>

            {/* Member Ranking */}
            {activeTab === 'group' && memberRanking.length > 0 && (
              <View style={{ gap: 12 }}>
                <Text style={styles.sectionTitle}>구성원별 지출</Text>
                {memberRanking.map((member, index) => (
                  <View key={index} style={styles.rankingCard}>
                    <View style={styles.rankingHeader}>
                      <Text style={styles.memberName}>{member.full_name || '알 수 없음'}</Text>
                      <Text style={styles.memberAmount}>{new Intl.NumberFormat('ko-KR').format(member.total_amount)}원</Text>
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
