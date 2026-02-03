import { format } from 'date-fns';
import { useRouter } from 'expo-router';
import { Plus, Search, Settings } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { supabase } from '../../src/lib/supabaseClient';
import { Transaction } from '../../src/types';

export default function HomeScreen() {
  const router = useRouter();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [currentMonth, setCurrentMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [loading, setLoading] = useState(false);
  const [groupName, setGroupName] = useState('My Group');

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const startDate = `${currentMonth}-01`;
      const endDate = `${currentMonth}-31`;

      const { data, error } = await supabase
        .from('transactions')
        .select(`
          *,
          categories (id, name, icon, color),
          profiles (full_name, avatar_url)
        `)
        .eq('user_id', user.id)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTransactions(data as any[]);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoading(false);
    }
  }, [currentMonth]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const summary = useMemo(() => {
    const income = transactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
    const expense = transactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
    return { income, expense, balance: income - expense };
  }, [transactions]);

  const groupedTransactions = useMemo(() => {
    const groups: { [date: string]: Transaction[] } = {};
    transactions.forEach(t => {
      if (!groups[t.date]) groups[t.date] = [];
      groups[t.date].push(t);
    });
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [transactions]);

  const renderItem = ({ item }: { item: [string, Transaction[]] }) => (
    <View key={item[0]}>
      <View style={styles.dateHeader}>
        <Text style={styles.dateText}>{item[0]}</Text>
        <Text style={styles.countText}>{item[1].length}건</Text>
      </View>
      {item[1].map((tx) => (
        <View key={tx.id} style={styles.transactionItem}>
          <View style={styles.transactionIconBox}>
             <Text style={{fontSize: 20}}>{(tx as any).categories?.icon || '💰'}</Text>
          </View>
          <View style={styles.transactionInfo}>
            <Text style={styles.transactionDesc}>{tx.description}</Text>
            <Text style={styles.transactionCat}>{(tx as any).categories?.name}</Text>
          </View>
          <Text style={[
            styles.transactionAmount,
            { color: tx.type === 'expense' ? '#f43f5e' : '#10b981' }
          ]}>
            {tx.type === 'expense' ? '-' : '+'}{new Intl.NumberFormat('ko-KR').format(tx.amount)}원
          </Text>
        </View>
      ))}
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.monthText}>{currentMonth}</Text>
          <Text style={styles.groupText}>{groupName}</Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable style={styles.iconButton}>
            <Search size={24} color="#94a3b8" />
          </Pressable>
          <Pressable style={styles.iconButton} onPress={() => router.push('/settings')}>
            <Settings size={24} color="#94a3b8" />
          </Pressable>
        </View>
      </View>

      {/* Summary */}
      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>이번 달 잔액</Text>
        <Text style={styles.balanceText}>
          {new Intl.NumberFormat('ko-KR').format(summary.balance)}원
        </Text>
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

      {/* List */}
      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color="#10b981" />
      ) : (
        <FlatList
          data={groupedTransactions}
          renderItem={renderItem}
          keyExtractor={item => item[0]}
          contentContainerStyle={{ paddingBottom: 100 }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>아직 내역이 없습니다.</Text>
            </View>
          }
        />
      )}

      {/* FAB */}
      <Pressable 
        style={styles.fab}
        onPress={() => router.push('/add-entry')}
      >
        <Plus size={32} color="white" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: 'white',
  },
  monthText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  groupText: {
    fontSize: 12,
    color: '#64748b',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
    padding: 8,
  },
  summaryCard: {
    margin: 20,
    padding: 24,
    backgroundColor: 'white',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  balanceText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  divider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rowLabel: {
    fontSize: 10,
    color: '#64748b',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  incomeText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#10b981',
  },
  expenseText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f43f5e',
  },
  dateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  dateText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  countText: {
    fontSize: 10,
    color: '#94a3b8',
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  transactionIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionDesc: {
    fontSize: 16,
    fontWeight: '500',
    color: '#0f172a',
  },
  transactionCat: {
    fontSize: 12,
    color: '#94a3b8',
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: '#94a3b8',
  },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 40,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  }
});