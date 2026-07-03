import { format } from 'date-fns';
import { useRouter, useFocusEffect } from 'expo-router';
import { Plus, Settings } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { getTransactions, getSummary, getLocalUser, type Transaction } from '../../src/lib/api';

export default function HomeScreen() {
  const router = useRouter();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [currentMonth, setCurrentMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState({ income: 0, expense: 0, balance: 0 });
  const [displayName, setDisplayName] = useState('');

  useEffect(() => {
    getLocalUser().then(u => { if (u) setDisplayName(u.display_name); });
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [txList, sum] = await Promise.all([
        getTransactions(currentMonth),
        getSummary(currentMonth),
      ]);
      setTransactions(txList);
      setSummary(sum);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [currentMonth]);

  useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

  const grouped = useMemo(() => {
    const g: { [date: string]: Transaction[] } = {};
    transactions.forEach(t => { if (!g[t.date]) g[t.date] = []; g[t.date].push(t); });
    return Object.entries(g).sort((a, b) => b[0].localeCompare(a[0]));
  }, [transactions]);

  const renderItem = ({ item }: { item: [string, Transaction[]] }) => (
    <View>
      <View style={styles.dateHeader}>
        <Text style={styles.dateText}>{item[0]}</Text>
        <Text style={styles.countText}>{item[1].length}건</Text>
      </View>
      {item[1].map(tx => (
        <Pressable key={tx.id} style={styles.txItem}
          onPress={() => router.push({ pathname: '/add-entry', params: { id: tx.id, amount: tx.amount.toString(), description: tx.description ?? '', category: tx.category_name ?? '', category_id: tx.category_id, type: tx.type, date: tx.date } })}>
          <View style={styles.txIcon}>
            <Text style={{ fontSize: 20 }}>{tx.category_icon || '💰'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.txDesc}>{tx.description || '-'}</Text>
            <Text style={styles.txCat}>{tx.category_name}</Text>
          </View>
          <Text style={[styles.txAmount, { color: tx.type === 'expense' ? '#f43f5e' : '#10b981' }]}>
            {tx.type === 'expense' ? '-' : '+'}{new Intl.NumberFormat('ko-KR').format(tx.amount)}원
          </Text>
        </Pressable>
      ))}
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.monthText}>{currentMonth}</Text>
          <Text style={styles.nameText}>{displayName}</Text>
        </View>
        <Pressable onPress={() => router.push('/settings')} style={styles.iconBtn}>
          <Settings size={24} color="#94a3b8" />
        </Pressable>
      </View>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>이번 달 잔액</Text>
        <Text style={styles.balanceText}>{new Intl.NumberFormat('ko-KR').format(summary.balance)}원</Text>
        <View style={styles.divider} />
        <View style={styles.summaryRow}>
          <View>
            <Text style={styles.rowLabel}>수입</Text>
            <Text style={styles.incomeText}>{new Intl.NumberFormat('ko-KR').format(summary.income)}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.rowLabel}>지출</Text>
            <Text style={styles.expenseText}>{new Intl.NumberFormat('ko-KR').format(summary.expense)}</Text>
          </View>
        </View>
      </View>

      {loading && transactions.length === 0 ? (
        <ActivityIndicator style={{ marginTop: 40 }} color="#6366f1" />
      ) : (
        <FlatList
          data={grouped}
          renderItem={renderItem}
          keyExtractor={item => item[0]}
          contentContainerStyle={{ paddingBottom: 100 }}
          ListEmptyComponent={!loading ? <View style={styles.empty}><Text style={styles.emptyText}>아직 내역이 없습니다.</Text></View> : null}
        />
      )}

      <Pressable style={styles.fab} onPress={() => router.push('/add-entry')}>
        <Plus size={32} color="white" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 60, paddingHorizontal: 20, paddingBottom: 20, backgroundColor: 'white' },
  monthText: { fontSize: 20, fontWeight: 'bold', color: '#0f172a' },
  nameText: { fontSize: 12, color: '#64748b' },
  iconBtn: { padding: 8 },
  summaryCard: { margin: 20, padding: 24, backgroundColor: 'white', borderRadius: 20, borderWidth: 1, borderColor: '#e2e8f0' },
  summaryLabel: { fontSize: 12, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  balanceText: { fontSize: 32, fontWeight: 'bold', color: '#0f172a' },
  divider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 16 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  rowLabel: { fontSize: 10, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 },
  incomeText: { fontSize: 18, fontWeight: 'bold', color: '#10b981' },
  expenseText: { fontSize: 18, fontWeight: 'bold', color: '#f43f5e' },
  dateHeader: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 10, backgroundColor: '#f8fafc', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  dateText: { fontSize: 12, fontWeight: 'bold', color: '#0f172a' },
  countText: { fontSize: 10, color: '#94a3b8' },
  txItem: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  txIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  txDesc: { fontSize: 16, fontWeight: '500', color: '#0f172a' },
  txCat: { fontSize: 12, color: '#94a3b8' },
  txAmount: { fontSize: 16, fontWeight: 'bold' },
  empty: { padding: 40, alignItems: 'center' },
  emptyText: { color: '#94a3b8' },
  fab: { position: 'absolute', right: 24, bottom: 40, width: 56, height: 56, borderRadius: 28, backgroundColor: '#6366f1', alignItems: 'center', justifyContent: 'center', elevation: 4 },
});
