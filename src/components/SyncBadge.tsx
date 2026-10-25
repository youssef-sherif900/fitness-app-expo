import React from 'react';
import { Pressable } from 'react-native';
import { useSyncStatus, retryFailed, runSync } from '@/sync';
import { Txt } from './ui';

export function SyncBadge() {
  const { pending, failed, syncing, lastSyncAt } = useSyncStatus();
  const text = failed > 0 ? `${failed} couldn't sync · Retry` : syncing ? 'Syncing…' : pending > 0 ? `${pending} pending` : lastSyncAt ? 'Synced' : 'Local';
  return (
    <Pressable onPress={() => (failed > 0 ? retryFailed() : runSync())} accessibilityRole="button" accessibilityLabel={`Sync status: ${text}`} style={{ minHeight: 44, justifyContent: 'center' }}>
      <Txt variant="muted">● {text}</Txt>
    </Pressable>
  );
}
