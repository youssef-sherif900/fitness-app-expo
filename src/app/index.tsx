import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useSession } from '@/auth/session';

export default function HomeScreen() {
  const status = useSession((s) => s.status);
  const onboarded = useSession((s) => s.onboarded);
  const user = useSession((s) => s.user);
  const mode = useSession((s) => s.mode);

  if (status === 'loading') {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <ActivityIndicator />
      </View>
    );
  }

  if (status === 'out') {
    return <Redirect href="/(auth)/sign-in" />;
  }

  if (!onboarded) {
    return <Redirect href="/(onboarding)/goal" />;
  }

  if (mode === 'trainer' && user?.is_trainer === true) {
    return <Redirect href="/(trainer)" />;
  }

  return <Redirect href="/(client)" />;
}