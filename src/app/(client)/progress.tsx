import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Screen, Txt, Card, Empty } from '@/components/ui';
import { listWeightRows } from '@/db/repos';
import { round } from '@/lib/util';

export default function Progress() {
  const weights = useQuery({ queryKey: ['local', 'weights'], queryFn: listWeightRows });
  const rows = weights.data ?? [];
  // 7-entry moving average as a simple smoothed trend (chart library is still an open decision)
  const latest = rows.slice(0, 7);
  const avg = latest.length ? latest.reduce((a, r) => a + r.kg, 0) / latest.length : null;
  const oldest = rows[rows.length - 1];

  return (
    <Screen>
      <Txt variant="title">Progress</Txt>
      {rows.length < 3 ? (
        <Empty title="Not enough data yet" hint="Log a few weigh-ins and your trend will show up here." />
      ) : (
        <Card>
          <Txt variant="label">Weight trend</Txt>
          <Txt variant="big">{round(avg!, 1)} kg</Txt>
          <Txt variant="muted">{rows[0].kg - oldest.kg <= 0 ? 'Down' : 'Up'} {Math.abs(round(rows[0].kg - oldest.kg, 1))} kg since {oldest.measured_on}</Txt>
        </Card>
      )}
      {rows.map((r) => (
        <Card key={r.id}><Txt>{r.kg} kg</Txt><Txt variant="muted">{r.measured_on}{r.server_id ? '' : ' · pending'}</Txt></Card>
      ))}
    </Screen>
  );
}
