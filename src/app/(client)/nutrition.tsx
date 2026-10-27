import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { View } from 'react-native';
import { Screen, Txt, Card, Button, ErrorState, Skeleton, Empty } from '@/components/ui';
import { useTheme } from '@/theme/tokens';
import * as endpoints from '@/api/endpoints';
import { addDays, isoDate, monthDay, num, round, weekdayShort } from '@/lib/util';

/** NUT-1: target with its source, the weekly deficit chart, and plain-language changes. */
export default function Nutrition() {
  const qc = useQueryClient();
  const { c } = useTheme();
  const today = isoDate();
  const from = addDays(today, -6);

  const current = useQuery({ queryKey: ['nutrition', 'current'], queryFn: endpoints.getCurrentTarget });
  const history = useQuery({ queryKey: ['nutrition', 'history'], queryFn: endpoints.getTargetHistory });
  const summary = useQuery({
    queryKey: ['nutrition', 'summary', from, today],
    queryFn: () => endpoints.logsSummary(from, today),
  });
  const recalc = useMutation({
    mutationFn: endpoints.recalculateTargets,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['nutrition'] }),
  });

  const t = current.data;
  const kcalTarget = num(t, ['kcal', 'calories', 'daily_calories', 'calorie_target']);
  const source = String(t?.source ?? 'auto');
  const trainerManaged = source === 'trainer';
  const historyRows = history.data ?? [];

  const days = summary.data?.days ?? [];
  const logged = days.filter((d: any) => (d?.intake?.kcal ?? 0) > 0);
  const max = Math.max(kcalTarget ?? 0, ...days.map((d: any) => d?.intake?.kcal ?? 0), 1);
  const avgIntake = logged.length
    ? logged.reduce((sum: number, d: any) => sum + (d.intake.kcal ?? 0), 0) / logged.length
    : null;
  const avgDeficit = kcalTarget != null && avgIntake != null ? kcalTarget - avgIntake : null;

  const latestReason = historyRows[0]?.reason;

  return (
    <Screen>
      <Txt variant="title">Nutrition</Txt>
      <Txt variant="muted">Your daily target, where it came from, and the week in context.</Txt>

      {current.isLoading ? <Skeleton h={120} /> : null}
      {current.isError ? (
        <ErrorState message={(current.error as Error).message} onRetry={() => current.refetch()} />
      ) : null}

      {t ? (
        <Card style={{ gap: 6 }}>
          <Txt variant="label">Daily target</Txt>
          <Txt variant="big">{kcalTarget ?? '—'} kcal</Txt>
          <Txt variant="muted">
            P {num(t, ['protein_g', 'protein']) ?? '—'} · C {num(t, ['carbs_g', 'carbs']) ?? '—'} · F {num(t, ['fat_g', 'fat']) ?? '—'} g
          </Txt>
          <Txt variant="muted">
            {trainerManaged ? 'Set by your coach.' : 'Calculated automatically from your profile and goal.'}
          </Txt>
          {latestReason ? <Txt variant="muted">Last change: {latestReason}</Txt> : null}
          {trainerManaged ? (
            <Txt variant="muted">Your coach manages this target. Ask them if you would like a change.</Txt>
          ) : (
            <>
              <Txt variant="muted">Automatic changes follow your weight trend and how consistently you log, and always show a reason.</Txt>
              {recalc.isError ? <Txt variant="muted">{(recalc.error as Error).message}</Txt> : null}
              <Button
                title="Recalculate now"
                variant="secondary"
                onPress={() => recalc.mutate()}
                loading={recalc.isPending}
              />
            </>
          )}
        </Card>
      ) : null}

      <Card style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <Txt variant="label">Weekly deficit</Txt>
          <Txt variant="muted">{monthDay(from)} – {monthDay(today)}</Txt>
        </View>

        {summary.isLoading ? <Skeleton h={140} /> : null}
        {summary.isError ? (
          <ErrorState message={(summary.error as Error).message} onRetry={() => summary.refetch()} />
        ) : null}

        {summary.isSuccess ? (
          <>
            <Txt variant="big">
              {avgDeficit == null ? '—' : `${round(avgDeficit) > 0 ? '' : '+'}${Math.abs(round(avgDeficit))} kcal`}
            </Txt>
            <Txt variant="muted">
              {avgDeficit == null
                ? 'Log a few days of food to see your average deficit.'
                : avgDeficit >= 0
                  ? 'Average daily deficit across days you logged.'
                  : 'Average daily surplus across days you logged.'}
            </Txt>

            <View style={{ height: 120, justifyContent: 'flex-end' }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 100, gap: 6 }}>
                {days.map((d: any) => {
                  const kcal = d?.intake?.kcal ?? 0;
                  const height = kcal > 0 ? Math.max(2, Math.min(1, kcal / max) * 100) : 0;
                  return (
                    <View key={d.date} style={{ flex: 1, height: '100%', justifyContent: 'flex-end' }}>
                      <View
                        style={{
                          height: `${height}%`,
                          borderRadius: 4,
                          backgroundColor: kcal > 0 ? c.primary : c.track,
                        }}
                      />
                    </View>
                  );
                })}
                {kcalTarget != null ? (
                  <View
                    pointerEvents="none"
                    style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      bottom: `${Math.min(1, kcalTarget / max) * 100}%`,
                      borderTopWidth: 1,
                      borderStyle: 'dashed',
                      borderColor: c.muted,
                    }}
                  />
                ) : null}
              </View>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {days.map((d: any) => (
                  <Txt key={d.date} variant="muted" style={{ flex: 1, textAlign: 'center', fontSize: 11 }}>
                    {weekdayShort(d.date).slice(0, 2)}
                  </Txt>
                ))}
              </View>
            </View>

            <Txt variant="muted">
              {logged.length} of {days.length} days logged. The dashed line is your target. Workout calories are not counted yet.
            </Txt>
          </>
        ) : null}
      </Card>

      <Txt variant="label">Target history</Txt>
      {history.isLoading ? <Skeleton h={64} /> : null}
      {history.isError ? (
        <ErrorState message={(history.error as Error).message} onRetry={() => history.refetch()} />
      ) : null}
      {history.isSuccess && historyRows.length === 0 ? <Empty title="No changes yet" /> : null}

      {historyRows.map((h: any, i: number) => {
        const previous = historyRows[i + 1];
        const kcal = num(h, ['kcal', 'calories', 'daily_calories']);
        const prev = previous ? num(previous, ['kcal', 'calories', 'daily_calories']) : null;
        const delta = kcal != null && prev != null ? kcal - prev : null;
        return (
          <Card key={h.id ?? i} style={{ gap: 2 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Txt>{kcal ?? '—'} kcal</Txt>
              {delta != null && delta !== 0 ? (
                <Txt variant="muted">{delta > 0 ? '+' : ''}{round(delta)} kcal</Txt>
              ) : null}
            </View>
            <Txt variant="muted">
              {String(h.effective_from ?? h.created_at ?? '').slice(0, 10)} · {h.source === 'trainer' ? 'Coach-set' : 'Automatic'}
            </Txt>
            {h.reason ? <Txt variant="muted">{h.reason}</Txt> : null}
          </Card>
        );
      })}
    </Screen>
  );
}
