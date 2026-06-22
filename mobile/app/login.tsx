import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { login } from '../src/lib/api';

export default function LoginScreen() {
  const router = useRouter();
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!inviteCode.trim()) {
      Alert.alert('알림', '초대 코드를 입력해주세요.');
      return;
    }
    setLoading(true);
    try {
      await login(inviteCode.trim());
      router.replace('/(tabs)/home');
    } catch (err: any) {
      Alert.alert('오류', err.message || '로그인에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>가계부</Text>
          <Text style={styles.subtitle}>초대 코드로 입장하세요.</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>초대 코드</Text>
            <TextInput
              style={styles.input}
              placeholder="초대 코드를 입력하세요"
              value={inviteCode}
              onChangeText={setInviteCode}
              autoCapitalize="none"
              autoCorrect={false}
              placeholderTextColor="#94a3b8"
            />
          </View>

          <Pressable style={[styles.button, loading && styles.buttonDisabled]} onPress={handleLogin} disabled={loading}>
            {loading ? <ActivityIndicator color="white" /> : <Text style={styles.buttonText}>입장하기</Text>}
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { flex: 1, justifyContent: 'center', padding: 24, maxWidth: 500, width: '100%', alignSelf: 'center' },
  header: { alignItems: 'center', marginBottom: 48 },
  title: { fontSize: 36, fontWeight: 'bold', color: '#0f172a', marginBottom: 12 },
  subtitle: { fontSize: 16, color: '#64748b' },
  form: { gap: 24 },
  inputGroup: { gap: 8 },
  label: { fontSize: 14, fontWeight: '600', color: '#0f172a', marginLeft: 4 },
  input: { height: 56, backgroundColor: '#f8fafc', borderRadius: 16, paddingHorizontal: 16, fontSize: 16, borderWidth: 1, borderColor: '#e2e8f0', color: '#0f172a' },
  button: { height: 56, backgroundColor: '#6366f1', borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { fontSize: 18, fontWeight: 'bold', color: 'white' },
});
