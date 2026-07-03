import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { checkSession } from '../src/lib/api';

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    checkSession().then((hasSession) => {
      if (hasSession) {
        router.replace('/(tabs)/home');
      } else {
        router.replace('/login');
      }
    });
  }, []);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" color="#6366f1" />
    </View>
  );
}
