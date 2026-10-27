import React, { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Txt, Card, Empty, ErrorState, Skeleton, Toast, Button, Input } from '@/components/ui';
import { Sheet } from '@/components/Sheet';
import { useToast } from '@/lib/useToast';
import { useTheme } from '@/theme/tokens';
import { addWeight, deleteWeightRow, listWeightRows, updateWeightRow } from '@/db/repos';
import { requestSync } from '@/sync';
import { monthDay, round } from '@/lib/util';
import { describeSlope, smoothedTrend, weeklySlope } from '@/features/body/trend';
import { TrendLine } from '@/features/body/TrendLine';

/** BODY-1: quick weigh-ins (added on Today) with a smoothed trend and editable history. */
export default function Progress() {
  const qc = useQueryClient();
  const { c } = useTheme();
  const { toast, show } = useToast();
  const [editing, setEditing] = useState<{ id: string; kg: number; day: string } | null>(null);
  const [draft, setDraft] = useState('');
  const weights = useQuery({ queryKey: ['local', 'weights'], queryFn: listWeightRows });

  const rows = useMemo(() => weights.data ?? [], [weights.data]);
  // Chronological order (same-day entries by insertion) so "latest wins" matches the API.
  const ordered = useMemo(
    () => [...rows].sort((a, b) => a.measured_on.localeCompare(b.measured_on) || a.row_id - b.row_id),
    [rows],
  );
  const series = useMemo(() => smoothedTrend(ordered), [ordered]);
  const slope = useMemo(() => weeklySlope(series), [series]);
  const latest = series[series.length - 1];
  const first = series[0];
  const totalChange = latest && first ? latest.trend - first.trend : null;

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['local'] });
    requestSync();
  };

  const remove = (id: string, kg: number, day: string) =>
    Alert.alert('Delete this weigh-in?', `${round(kg, 1)} kg on ${monthDay(day)} will be removed from your trend.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteWeightRow(id);
          refresh();
          show('Weigh-in deleted', async () => {
            // Undo restores the same value and day as a fresh entry.
            await addWeight(kg, day);
            refresh();
          });
        },
      },
    ]);

  const openEdit = (row: { id: string; kg: number; measured_on: string }) => {
    setEditing({ id: row.id, kg: row.kg, day: row.measured_on });
    setDraft(String(row.kg));
  };

  const draftValue = parseFloat(draft.replace(',', '.'));
  const valid = Number.isFinite(draftValue) && draftValue >= 20 && draftValue <= 500;

  const saveEdit = async () => {
    if (!editing || !valid) return;
    await updateWeightRow(editing.id, draftValue);
    setEditing(null);
    refresh();
    show('Weigh-in updated');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <Txt variant="title">Progress</Txt>
        <Txt variant="muted">Your weight trend, smoothed so daily noise does not hide the direction.</Txt>

        {weights.isLoading ? <Skeleton h={200} /> : null}
        {weights.isError ? (
          <ErrorState message="Your weigh-ins could not be read." onRetry={() => weights.refetch()} />
        ) : null}

        {weights.isSuccess && rows.length === 0 ? (
          <Empty
            title="No weigh-ins yet"
            hint="Log your weight on Today to start the trend line. One weigh-in a day is plenty."
          />
        ) : null}

        {latest ? (
          <Card style={{ gap: 8 }}>
            <Txt variant="label">Smoothed trend</Txt>
            <Txt variant="big">{round(latest.trend, 1)} kg</Txt>
            <Txt variant="muted">
              Latest weigh-in {round(latest.weight, 1)} kg · {monthDay(latest.date)}
            </Txt>

            <TrendLine points={series} />

            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Txt variant="muted" style={{ fontSize: 11 }}>{monthDay(first.date)}</Txt>
              <Txt variant="muted" style={{ fontSize: 11 }}>{monthDay(latest.date)}</Txt>
            </View>

            <Txt variant="body">{describeSlope(slope)}</Txt>
            {totalChange != null && series.length > 1 ? (
              <Txt variant="muted">
                {totalChange === 0 ? 'No change' : `${totalChange < 0 ? 'Down' : 'Up'} ${Math.abs(round(totalChange, 1))} kg`} since{' '}
                {monthDay(first.date)}. The line follows your trend, not a single weigh-in.
              </Txt>
            ) : (
              <Txt variant="muted">Log again on another day to see a direction.</Txt>
            )}
          </Card>
        ) : null}

        {rows.length > 0 ? <Txt variant="label">Weigh-ins</Txt> : null}

        {rows.map((r) => (
          <Card key={r.id}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Pressable
                onPress={() => openEdit(r)}
                accessibilityRole="button"
                accessibilityLabel={`Edit weigh-in from ${monthDay(r.measured_on)}`}
                style={{ flex: 1, minHeight: 44, justifyContent: 'center' }}
              >
                <Txt>{round(r.kg, 1)} kg</Txt>
                <Txt variant="muted">
                  {monthDay(r.measured_on)}
                  {r.server_id ? '' : ' · pending sync'}
                </Txt>
              </Pressable>
              <Pressable
                onPress={() => remove(r.id, r.kg, r.measured_on)}
                accessibilityRole="button"
                accessibilityLabel={`Delete weigh-in from ${monthDay(r.measured_on)}`}
                style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
              >
                <Ionicons name="trash-outline" size={20} color={c.muted} />
              </Pressable>
            </View>
          </Card>
        ))}
      </ScrollView>

      <Sheet visible={!!editing} onClose={() => setEditing(null)}>
        {editing ? (
          <>
            <Txt variant="title">Edit weigh-in</Txt>
            <Txt variant="muted">{monthDay(editing.day)}. Only the value changes, so the trend keeps its place.</Txt>
            <Input
              label="Weight (kg)"
              value={draft}
              onChangeText={setDraft}
              keyboardType="decimal-pad"
              autoFocus
            />
            {!valid && draft.length > 0 ? (
              <Txt variant="muted">Enter a weight between 20 and 500 kg.</Txt>
            ) : null}
            <Button title="Save changes" onPress={saveEdit} disabled={!valid || draftValue === editing.kg} />
            <Button
              title="Remove this weigh-in"
              variant="secondary"
              onPress={() => {
                const target = editing;
                setEditing(null);
                remove(target.id, target.kg, target.day);
              }}
            />
            <Button title="Cancel" variant="text" onPress={() => setEditing(null)} />
          </>
        ) : null}
      </Sheet>

      {toast ? <Toast message={toast.message} onUndo={toast.onUndo} /> : null}
    </SafeAreaView>
  );
}
