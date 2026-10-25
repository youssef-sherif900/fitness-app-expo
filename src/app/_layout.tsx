import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Stack } from 'expo-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/api/queryClient';
import { useSession } from '@/auth/session';
import { useSyncTriggers } from '@/sync';

function Gate() {
  const status = useSession((s) => s.status);
  useSyncTriggers(status === 'in');

  if (status === 'loading') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={status === 'in'}>
        <Stack.Screen name="(client)" />
        <Stack.Screen name="food/search" options={{ presentation: 'modal' }} />
        <Stack.Screen name="food/scan" options={{ presentation: 'modal' }} />
        <Stack.Screen name="food/custom" options={{ presentation: 'modal' }} />
        <Stack.Screen name="settings" />
      </Stack.Protected>
      <Stack.Protected guard={status === 'out'}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}

export default function Root() {
  useEffect(() => {
    void useSession.getState().bootstrap();
  }, []);
  return (
    <QueryClientProvider client={queryClient}>
      <Gate />
    </QueryClientProvider>
  );
}
