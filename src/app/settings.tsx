import React, { useState } from 'react';
import { useRouter } from 'expo-router';
import { Alert } from 'react-native';
import { Screen, Txt, Button, Card, Input } from '@/components/ui';
import { useSession } from '@/auth/session';
import * as endpoints from '@/api/endpoints';
import { SyncBadge } from '@/components/SyncBadge';

export default function Settings() {
  const router = useRouter();
  const user = useSession((s) => s.user);
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);

  const mode = useSession((s) => s.mode);

  const switchMode = async (nextMode: 'client' | 'trainer') => {
    try {
      await useSession.getState().setMode(nextMode);
      router.replace(nextMode === 'trainer' ? '/(trainer)' : '/(client)');
    } catch (e) {
      Alert.alert(
        'Could not switch mode',
        e instanceof Error ? e.message : 'Please try again.',
      );
    }
  };

  const del = async () => {
    setBusy(true);
    try {
      await endpoints.deleteAccount();
      await useSession.getState().signOut({ remote: false });
    } catch (e) {
      Alert.alert('Could not delete account', e instanceof Error ? e.message : 'Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Button title="Back" variant="text" onPress={() => router.back()} style={{ alignSelf: 'flex-start' }} />
      <Txt variant="title">Settings</Txt>
      <Card>
        <Txt style={{ fontWeight: '700' }}>{user?.name ?? 'Account'}</Txt>
        <Txt variant="muted">{user?.email}</Txt>
      </Card>
      {user?.is_client === true && user?.is_trainer === true ? (
        <Card>
          <Txt variant="label">App mode</Txt>
          <Txt variant="muted">
            Current mode: {mode === 'trainer' ? 'Trainer' : 'Client'}
          </Txt>

          <Button
            title={mode === 'trainer' ? 'Switch to Client' : 'Switch to Trainer'}
            onPress={() =>
              switchMode(mode === 'trainer' ? 'client' : 'trainer')
            }
          />
        </Card>
      ) : null}
      <Card><Txt variant="label">Sync</Txt><SyncBadge /></Card>
      <Button title="Sign out" variant="secondary" onPress={() => useSession.getState().signOut()} />
      <Card>
        <Txt variant="label">Delete account</Txt>
        <Txt variant="muted">This removes your account and clears data on this device. Type DELETE to confirm.</Txt>
        <Input value={confirm} onChangeText={setConfirm} autoCapitalize="characters" placeholder="DELETE" />
        <Button title="Delete my account" variant="secondary" onPress={del} disabled={confirm !== 'DELETE'} loading={busy} />
      </Card>
    </Screen>
  );
}
