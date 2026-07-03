import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { format } from 'date-fns';
import { Users, User } from 'lucide-react-native';
import { getCategoryStats, getTrend, getMemberStats, type CategoryStat, type TrendItem, type MemberStat } from '../../src/lib/api';

export default function StatsScreen() {
  const [activeTab, setActiveTab] = useState<'my' | 'group'>('my');
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [categoryData, setCategoryData] = useState<CategoryStat[]>([]);
  const [trendData, setTrendData] = useState<TrendItem[]>([]);
  const [memberRanking, setMemberRanking] = useState<MemberStat[]>([]);

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
      setTrendData(trend);
      setMemberRanking(members);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [currentMonth, activeTab]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const totalExpense = categoryData.reduce((s, c) => s + c.total, 0);
  const maxTrend = Math.max(...trendData.map(d => Math.max(d.income, d.expense)), 1);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>분석</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.tabContainer}>
          <Pressable onPress={() => setActiveTab('my')} style={[styles.tab, activeTab === 'my' && styles.activeTab]}>
            <User size={18} color={activeTab === 'my' ? '#6366f1' : '#94a3b8'} />
            <Text style={[styles.tabText, activeTab === 'my' && styles.activeTabText]}>내 통계</Text>
          </Pressable>
          <Pressable onPress={() => setActiveTab('group')} style={[styles.tab, activeTab === 'group' && styles.activeTab]}>
            <Users size={18} color={activeTab === 'group' ? '#6366f1' : '#94a3b8'} />
            <Text style={[styles.tabText, activeTab === 'group' && styles.activeTabText]}>그룹 통계</Text>
          </Pressable>
        </View>

        {loading ? <ActivityIndicator style={{ marginTop: 40 }} color="#6366f1" /> : (
          <View style={{ gap: 20 }}>
            <View style={styles.card}>
              <Text style={styles.cardLabel}>{activeTab === 'my' ? '나의 ' : '그룹 '}총 지출</Text>
              <Text style={styles.totalAmount}>{new Intl.NumberFormat('ko-KR').format(totalExpense)}원</Text>
              <View style={styles.categoryList}>
                {categoryData.length === 0
                  ? <Text style={{ color: '#94a3b8', textAlign: 'center', marginVertical: 20 }}>지출 내역이 없습니다.</Text>
                  : categoryData.map((item, i) => (
                    <View key={i} style={styles.categoryItem}>
                      <View style={styles.categoryInfo}>
                        <View style={[styles.dot, { backgroundColor: item.color || '#94a3b8' }]} />
                        <Text style={styles.categoryName}>{item.icon} {item.category_name}</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={styles.categoryAmount}>{new Intl.NumberFormat('ko-KR').format(item.total)}원</Text>
                        <Text style={styles.categoryPct}>{item.percentage}%</Text>
                      </View>
                    </View>
                  ))}
              </View>
            </View>

            {trendData.length > 0 && (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>최근 6개월 추이</Text>
                <View style={styles.trendChart}>
                  {trendData.map((item, i) => (
                    <View key={i} style={styles.trendCol}>
                      <View style={styles.bars}>
                        <View style={[styles.bar, { height: `${(item.income / maxTrend) * 100}%`, backgroundColor: '#10b981', opacity: 0.5 }]} />
                        <View style={[styles.bar, { height: `${(item.expense / maxTrend) * 100}%`, backgroundColor: '#f43f5e' }]} />
                      </View>
                      <Text style={styles.trendLabel}>{item.month.slice(5)}월</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {activeTab === 'group' && memberRanking.length > 0 && (
              <View style={{ gap: 12 }}>
                <Text style={styles.sectionTitle}>구성원별 지출</Text>
                {memberRanking.map((m, i) => (
                  <View key={i} style={styles.rankCard}>
                    <View style={styles.rankHeader}>
                      <Text style={styles.memberName}>{m.display_name}</Text>
                      <Text style={styles.memberAmount}>{new Intl.NumberFormat('ko-KR').format(m.total)}원</Text>
                    </View>
                    <View style={styles.progressBg}>
                      <View style={[styles.progressFill, { width: `${m.percentage}%` }]} />
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
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 20, backgroundColor: 'white', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#0f172a' },
  scroll: { padding: 20, paddingBottom: 100 },
  tabContainer: { flexDirection: 'row', backgroundColor: '#e2e8f0', padding: 4, borderRadius: 12, marginBottom: 20 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, gap: 6, borderRadius: 8 },
  activeTab: { backgroundColor: 'white' },
  tabText: { fontSize: 14, fontWeight: '600', color: '#64748b' },
  activeTabText: { color: '#6366f1' },
  card: { backgroundColor: 'white', borderRadius: 20, padding: 24, borderWidth: 1, borderColor: '#e2e8f0' },
  cardLabel: { fontSize: 13, color: '#64748b', marginBottom: 4 },
  totalAmount: { fontSize: 28, fontWeight: 'bold', color: '#0f172a', marginBottom: 24 },
  categoryList: { gap: 16 },
  categoryItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  categoryInfo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  categoryName: { fontSize: 14, color: '#334155' },
  categoryAmount: { fontSize: 14, fontWeight: '600', color: '#0f172a' },
  categoryPct: { fontSize: 11, color: '#94a3b8' },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#0f172a', marginBottom: 12 },
  trendChart: { flexDirection: 'row', justifyContent: 'space-between', height: 150, alignItems: 'flex-end', marginTop: 10 },
  trendCol: { alignItems: 'center', flex: 1, height: '100%', justifyContent: 'flex-end' },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: '85%' },
  bar: { width: 8, borderTopLeftRadius: 4, borderTopRightRadius: 4, minHeight: 4 },
  trendLabel: { marginTop: 8, fontSize: 10, color: '#94a3b8' },
  rankCard: { backgroundColor: 'white', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#f1f5f9' },
  rankHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  memberName: { fontSize: 14, fontWeight: '600', color: '#0f172a' },
  memberAmount: { fontSize: 14, fontWeight: '600', color: '#0f172a' },
  progressBg: { height: 8, backgroundColor: '#f1f5f9', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#6366f1', borderRadius: 4 },
});
