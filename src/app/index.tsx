
import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useSession } from '@/auth/session';

export default function HomeScreen() {
  const status = useSession((s) => s.status);

  if (status === 'loading') {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (status === 'out') {
    return <Redirect href="/(auth)/login" />;
  }

  return <Redirect href="/(client)" />;
}
