import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Screen, Txt, Card, ErrorState, Skeleton, Empty } from '@/components/ui';
import * as endpoints from '@/api/endpoints';
import { ApiError } from '@/api/client';

export default function Training() {
  const program = useQuery({ queryKey: ['training', 'current'], queryFn: endpoints.getCurrentProgram });
  const templates = useQuery({ queryKey: ['training', 'templates'], queryFn: endpoints.listTemplates });
  const none = program.error instanceof ApiError && program.error.status === 404;
  const days: any[] = program.data?.days ?? [];

  return (
    <Screen>
      <Txt variant="title">Training</Txt>
      {program.isLoading ? <Skeleton h={96} /> : none || (!program.data && !program.isError) ? (
        <Empty title="No program yet" hint="Pick a template below to get started." />
      ) : program.isError ? (
        <ErrorState message={(program.error as Error).message} onRetry={() => program.refetch()} />
      ) : (
        <>
          <Card><Txt variant="label">Current program</Txt><Txt variant="title">{program.data?.name ?? 'Program'}</Txt></Card>
          {days.map((d, i) => (
            <Card key={d.id ?? i}>
              <Txt style={{ fontWeight: '700' }}>{d.name ?? `Day ${i + 1}`}</Txt>
              <Txt variant="muted">{(d.exercises ?? []).length} exercises</Txt>
            </Card>
          ))}
        </>
      )}
      <Txt variant="label">Templates</Txt>
      {(templates.data ?? []).map((t: any) => (
        <Card key={t.id}><Txt>{t.name}</Txt></Card>
      ))}
    </Screen>
  );
}
