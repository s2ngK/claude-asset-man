import { supabase } from '@/src/lib/supabaseClient';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { ArrowLeft, Copy, LogOut, User as UserIcon, UserMinus } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

export default function SettingsScreen() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace('/login' as any);
        return;
      }
      setUser(user);

      const { data, error } = await supabase
        .from('profiles')
        .select('*, groups(*)')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      setProfile(data);
      setFullName(data.full_name || '');
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async () => {
    if (!fullName.trim()) return;
    setUpdating(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: fullName })
        .eq('id', user.id);

      if (error) throw error;
      Alert.alert('성공', '프로필이 업데이트되었습니다.');
    } catch (error: any) {
      Alert.alert('오류', '프로필 수정 실패: ' + error.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleCopyCode = async () => {
    if (profile?.groups?.invite_code) {
      await Clipboard.setStringAsync(profile.groups.invite_code);
      Alert.alert('복사됨', '초대 코드가 클립보드에 복사되었습니다.');
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    // In Expo Router, replacing with root or login
    router.replace('/login'); 
  };

  const handleDeleteAccount = async () => {
    Alert.alert(
      '회원 탈퇴',
      '정말 탈퇴하시겠습니까? 작성한 내역은 보존되지만 프로필은 삭제됩니다.',
      [
        { text: '취소', style: 'cancel' },
        { 
          text: '탈퇴', 
          style: 'destructive',
          onPress: async () => {
            setUpdating(true);
            const { error } = await supabase.from('profiles').delete().eq('id', user.id);
            if (error) {
              Alert.alert('오류', '탈퇴 처리 중 오류가 발생했습니다.');
              setUpdating(false);
            } else {
              await supabase.auth.signOut();
              router.replace('/login');
            }
          }
        }
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#64748b" />
        </Pressable>
        <Text style={styles.headerTitle}>설정</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Profile Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>내 프로필</Text>
          <View style={styles.card}>
            <View style={styles.avatarContainer}>
              <UserIcon size={40} color="#94a3b8" />
            </View>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>이름 (닉네임)</Text>
              <View style={styles.row}>
                <TextInput
                  style={styles.input}
                  value={fullName}
                  onChangeText={setFullName}
                  placeholder="이름을 입력하세요"
                />
                <Pressable 
                  onPress={handleUpdateProfile} 
                  disabled={updating}
                  style={[styles.saveButton, updating && styles.disabledButton]}
                >
                  <Text style={styles.saveButtonText}>{updating ? '...' : '저장'}</Text>
                </Pressable>
              </View>
            </View>
            <Text style={styles.emailText}>{user?.email}</Text>
          </View>
        </View>

        {/* Group Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>그룹 정보</Text>
          <View style={styles.card}>
            <View style={{ marginBottom: 16 }}>
              <Text style={styles.label}>그룹 이름</Text>
              <Text style={styles.groupName}>{profile?.groups?.name || '소속 없음'}</Text>
            </View>
            <View style={styles.inviteCodeContainer}>
              <View>
                <Text style={styles.label}>초대 코드</Text>
                <Text style={styles.inviteCode}>{profile?.groups?.invite_code || '-'}</Text>
              </View>
              <Pressable onPress={handleCopyCode} style={styles.copyButton}>
                <Copy size={20} color="#6366f1" />
              </Pressable>
            </View>
          </View>
        </View>

        {/* Account Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>계정 관리</Text>
          <View style={[styles.card, { padding: 0, overflow: 'hidden' }]}>
            <Pressable onPress={handleSignOut} style={styles.menuItem}>
              <Text style={styles.menuItemText}>로그아웃</Text>
              <LogOut size={20} color="#94a3b8" />
            </Pressable>
            <View style={styles.divider} />
            <Pressable onPress={handleDeleteAccount} style={styles.menuItem}>
              <Text style={[styles.menuItemText, { color: '#f43f5e' }]}>회원 탈퇴</Text>
              <UserMinus size={20} color="#fca5a5" />
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingHorizontal: 10,
    paddingBottom: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  backButton: {
    padding: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
    marginLeft: 4,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  avatarContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 20,
  },
  inputContainer: {
    width: '100%',
    marginBottom: 12,
  },
  label: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#64748b',
    marginBottom: 6,
    marginLeft: 2,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  input: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
  },
  saveButton: {
    backgroundColor: '#10b981',
    paddingHorizontal: 16,
    justifyContent: 'center',
    borderRadius: 10,
  },
  disabledButton: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  emailText: {
    textAlign: 'center',
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 8,
  },
  groupName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  inviteCodeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    padding: 16,
    borderRadius: 12,
  },
  inviteCode: {
    fontSize: 20,
    fontFamily: 'SpaceMono-Regular', // Available in default Expo template
    fontWeight: 'bold',
    color: '#4f46e5',
    letterSpacing: 2,
  },
  copyButton: {
    padding: 8,
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  menuItemText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#334155',
  },
  divider: {
    height: 1,
    backgroundColor: '#f1f5f9',
  },
});
