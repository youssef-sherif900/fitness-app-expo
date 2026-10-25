import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Screen, Txt, Card, Button, ErrorState, Skeleton, Empty } from '@/components/ui';
import * as endpoints from '@/api/endpoints';
import { num } from '@/lib/util';

export default function Nutrition() {
  const qc = useQueryClient();
  const current = useQuery({ queryKey: ['nutrition', 'current'], queryFn: endpoints.getCurrentTarget });
  const history = useQuery({ queryKey: ['nutrition', 'history'], queryFn: endpoints.getTargetHistory });
  const recalc = useMutation({ mutationFn: endpoints.recalculateTargets, onSuccess: () => qc.invalidateQueries({ queryKey: ['nutrition'] }) });
  const t = current.data;

  return (
    <Screen>
      <Txt variant="title">Nutrition</Txt>
      {current.isLoading ? <Skeleton h={96} /> : current.isError ? (
        <ErrorState message={(current.error as Error).message} onRetry={() => current.refetch()} />
      ) : (
        <Card>
          <Txt variant="label">Daily target</Txt>
          <Txt variant="big">{num(t, ['calories', 'daily_calories', 'kcal']) ?? '—'} kcal</Txt>
          <Txt variant="muted">P {num(t, ['protein', 'protein_g']) ?? '—'} · C {num(t, ['carbs', 'carbs_g']) ?? '—'} · F {num(t, ['fat', 'fat_g']) ?? '—'}</Txt>
          {t?.source ? <Txt variant="muted">Source: {String(t.source)}</Txt> : null}
          {recalc.isError ? <Txt variant="muted">{(recalc.error as Error).message}</Txt> : null}
          <Button title="Recalculate" variant="secondary" onPress={() => recalc.mutate()} loading={recalc.isPending} />
        </Card>
      )}
      <Txt variant="label">History</Txt>
      {(history.data ?? []).length === 0 && !history.isLoading ? <Empty title="No changes yet" /> : null}
      {(history.data ?? []).map((h: any, i: number) => (
        <Card key={h.id ?? i}>
          <Txt>{num(h, ['calories', 'daily_calories', 'kcal']) ?? '—'} kcal</Txt>
          <Txt variant="muted">{String(h.created_at ?? h.effective_from ?? '').slice(0, 10)}{h.reason ? ` · ${h.reason}` : ''}</Txt>
        </Card>
      ))}
    </Screen>
  );
}
