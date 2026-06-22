import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { ArrowLeft, Copy, LogOut } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getLocalUser, logout } from '../src/lib/api';

export default function SettingsScreen() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: string; group_id: string; display_name: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getLocalUser().then(u => { setUser(u); setLoading(false); });
  }, []);

  const handleCopyCode = async () => {
    if (user?.invite_code) {
      await Clipboard.setStringAsync((user as any).invite_code);
      Alert.alert('복사됨', '초대 코드가 클립보드에 복사되었습니다.');
    }
  };

  const handleSignOut = async () => {
    await logout();
    router.replace('/login');
  };

  if (loading) {
    return <View style={styles.loading}><ActivityIndicator size="large" color="#6366f1" /></View>;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={24} color="#64748b" />
        </Pressable>
        <Text style={styles.headerTitle}>설정</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>내 프로필</Text>
          <View style={styles.card}>
            <Text style={styles.label}>이름</Text>
            <Text style={styles.value}>{user?.display_name ?? '-'}</Text>
            <Text style={styles.label}>그룹 ID</Text>
            <Text style={styles.value}>{user?.group_id ?? '-'}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>계정 관리</Text>
          <View style={[styles.card, { padding: 0, overflow: 'hidden' }]}>
            <Pressable onPress={handleSignOut} style={styles.menuItem}>
              <Text style={styles.menuText}>로그아웃</Text>
              <LogOut size={20} color="#94a3b8" />
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 60, paddingHorizontal: 10, paddingBottom: 20, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  backBtn: { padding: 10 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#0f172a' },
  scroll: { padding: 20, paddingBottom: 40 },
  section: { marginBottom: 32 },
  sectionTitle: { fontSize: 13, fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12, marginLeft: 4 },
  card: { backgroundColor: 'white', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#e2e8f0' },
  label: { fontSize: 11, fontWeight: 'bold', color: '#64748b', marginBottom: 4, marginTop: 12 },
  value: { fontSize: 16, color: '#0f172a', fontWeight: '500' },
  menuItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  menuText: { fontSize: 15, fontWeight: '500', color: '#334155' },
});
