import React, { useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { Screen, Txt, Card, Button, Input, Bar, Empty, Toast, Skeleton } from '@/components/ui';
import { SyncBadge } from '@/components/SyncBadge';
import { useToast } from '@/lib/useToast';
import { useTheme } from '@/theme/tokens';
import * as endpoints from '@/api/endpoints';
import { MEALS } from '@/api/types';
import { addWeight, deleteFoodLog, listLogs, listWeightRows } from '@/db/repos';
import { requestSync } from '@/sync';
import { isoDate, num, round } from '@/lib/util';

export default function Today() {
  const router = useRouter();
  const qc = useQueryClient();
  const { c } = useTheme();
  const today = isoDate();
  const { toast, show } = useToast();
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [kg, setKg] = useState('');

  const target = useQuery({ queryKey: ['nutrition', 'current'], queryFn: endpoints.getCurrentTarget });
  const logs = useQuery({ queryKey: ['local', 'logs', today], queryFn: () => listLogs(today) });
  const weights = useQuery({ queryKey: ['local', 'weights'], queryFn: listWeightRows });

  const rows = (logs.data ?? []).filter((r) => !hidden.has(r.id));
  const eaten = rows.reduce((a, r) => a + r.kcal, 0);
  const sum = (k: 'protein' | 'carbs' | 'fat') => rows.reduce((a, r) => a + r[k], 0);
  const t = target.data;
  const kcalTarget = num(t, ['calories', 'daily_calories', 'calorie_target', 'kcal']);
  const remaining = kcalTarget != null ? Math.round(kcalTarget - eaten) : null;

  // delete with 5s undo: hide now, commit after the toast expires unless undone
  const removeWithUndo = (id: string, name: string) => {
    setHidden((h) => new Set(h).add(id));
    timers.current[id] = setTimeout(async () => {
      await deleteFoodLog(id);
      qc.invalidateQueries({ queryKey: ['local'] });
      requestSync();
    }, 5000);
    show(`Removed ${name}`, () => {
      clearTimeout(timers.current[id]);
      setHidden((h) => { const n = new Set(h); n.delete(id); return n; });
    });
  };

  const saveWeight = async () => {
    const v = parseFloat(kg.replace(',', '.'));
    if (!v || v < 20 || v > 500) return;
    await addWeight(v);
    setKg('');
    qc.invalidateQueries({ queryKey: ['local'] });
    requestSync();
  };

  return (
    <View style={{ flex: 1 }}>
      <Screen>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <Txt variant="title">Today</Txt>
            <SyncBadge />
          </View>
          <Pressable onPress={() => router.push('/settings')} accessibilityRole="button" accessibilityLabel="Settings" style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="person-circle-outline" size={28} color={c.text} />
          </Pressable>
        </View>

        <Card>
          {target.isLoading ? <Skeleton h={48} /> : remaining != null ? (
            <>
              <Txt variant="label">Remaining</Txt>
              <Txt variant="big">{remaining >= 0 ? remaining : `${Math.abs(remaining)} beyond`}</Txt>
              <Txt variant="muted">{round(eaten)} eaten · {kcalTarget} kcal target</Txt>
            </>
          ) : (
            <>
              <Txt variant="label">Eaten</Txt>
              <Txt variant="big">{round(eaten)} kcal</Txt>
              <Txt variant="muted">Your daily target will appear here once it's calculated.</Txt>
            </>
          )}
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
            <Bar label="Protein" value={sum('protein')} max={num(t, ['protein', 'protein_g'])} />
            <Bar label="Carbs" value={sum('carbs')} max={num(t, ['carbs', 'carbs_g'])} />
            <Bar label="Fat" value={sum('fat')} max={num(t, ['fat', 'fat_g'])} />
          </View>
        </Card>

        <Card>
          <Txt variant="label">Quick weigh-in (kg)</Txt>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <View style={{ flex: 1 }}><Input value={kg} onChangeText={setKg} keyboardType="decimal-pad" placeholder={weights.data?.[0] ? String(weights.data[0].kg) : '0.0'} /></View>
            <Button title="Save" onPress={saveWeight} disabled={!kg} />
          </View>
        </Card>

        {logs.isSuccess && rows.length === 0 ? (
          <Empty title="Nothing logged yet" hint="Add your first meal to start your day." action={<Button title="Log your first meal" onPress={() => router.push({ pathname: '/food/search', params: { meal: 'breakfast' } })} />} />
        ) : null}

        {MEALS.map((m) => {
          const items = rows.filter((r) => r.meal === m.key);
          return (
            <Card key={m.key}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Txt style={{ fontWeight: '700' }}>{m.label} · {round(items.reduce((a, r) => a + r.kcal, 0))} kcal</Txt>
                <Pressable onPress={() => router.push({ pathname: '/food/search', params: { meal: m.key } })} accessibilityRole="button" accessibilityLabel={`Add food to ${m.label}`} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="add-circle-outline" size={28} color={c.text} />
                </Pressable>
              </View>
              {items.map((r) => (
                <View key={r.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flex: 1 }}>
                    <Txt>{r.name}</Txt>
                    <Txt variant="muted">{round(r.kcal)} kcal{r.server_id ? '' : ' · pending'}</Txt>
                  </View>
                  <Pressable onPress={() => removeWithUndo(r.id, r.name)} accessibilityRole="button" accessibilityLabel={`Remove ${r.name}`} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="close" size={20} color={c.muted} />
                  </Pressable>
                </View>
              ))}
            </Card>
          );
        })}
      </Screen>
      {toast ? <Toast message={toast.message} onUndo={toast.onUndo} /> : null}
    </View>
  );
}
