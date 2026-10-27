import React, { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, ErrorState, Screen, Skeleton, Txt } from '@/components/ui';
import { InfoCard } from '@/components/Choice';
import { FlowHeader } from '@/features/training/FlowHeader';
import { trainingErrorLines } from '@/features/training/errors';
import { dayItems, itemName, itemReps } from '@/features/training/payload';
import { EXPERIENCE_LEVELS, GOALS, type ApiProgram } from '@/features/training/types';
import * as endpoints from '@/api/endpoints';

export default function ProgramDetail() {
  const router = useRouter();
  const qc = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [lines, setLines] = useState<string[]>([]);

  const query = useQuery({
    queryKey: ['training', 'program', id],
    queryFn: () => endpoints.getProgram(id),
    enabled: Boolean(id),
  });

  const publish = useMutation({
    mutationFn: () => endpoints.publishProgram(id),
    onSuccess: (program: ApiProgram) => {
      setLines([]);
      qc.setQueryData(['training', 'program', id], program);
      qc.invalidateQueries({ queryKey: ['training', 'current'] });
      qc.invalidateQueries({ queryKey: ['training', 'programs'] });
    },
    onError: (error) => setLines(trainingErrorLines(error)),
  });

  const program: ApiProgram | undefined = query.data;
  const days = program?.days ?? [];
  const itemCount = days.reduce((total, day) => total + dayItems(day).length, 0);
  const active = program?.status === 'active';

  return (
    <Screen>
      <FlowHeader
        title={program?.name ?? 'Program'}
        subtitle={
          program
            ? `${GOALS.find((g) => g.key === program.goal)?.label ?? 'Training'} · ${
                EXPERIENCE_LEVELS.find((l) => l.key === program.experience_level)?.label ?? 'All levels'
              } · ${days.length} ${days.length === 1 ? 'day' : 'days'}`
            : undefined
        }
        onBack={() => router.back()}
      />

      <InfoCard lines={lines} />

      {query.isLoading ? <Skeleton h={120} /> : null}

      {query.isError ? (
        <ErrorState
          message={(query.error as Error).message}
          onRetry={() => query.refetch()}
        />
      ) : null}

      {program ? (
        <>
          <Card style={{ gap: 8 }}>
            <Txt variant="label">{active ? 'Active program' : 'Saved as a draft'}</Txt>
            <Txt variant="muted">
              {active
                ? 'This program is ready on your Training tab.'
                : 'Start it when you are ready. You can still change it later.'}
            </Txt>
            {active ? (
              <Button title="Go to Training" onPress={() => router.replace('/training')} />
            ) : (
              <Button
                title="Start this program"
                onPress={() => {
                  setLines([]);
                  publish.mutate();
                }}
                loading={publish.isPending}
                disabled={itemCount === 0}
              />
            )}
            {!active && itemCount === 0 ? (
              <Txt variant="muted">Add at least one exercise before starting this program.</Txt>
            ) : null}
          </Card>

          {days.map((day, index) => {
            const items = dayItems(day);
            return (
              <Card key={day.id ?? `${day.name}-${index}`} style={{ gap: 8 }}>
                <Txt style={{ fontWeight: '700', fontSize: 17 }}>
                  {day.name ?? `Day ${index + 1}`}
                </Txt>
                {items.length === 0 ? <Txt variant="muted">No exercises yet.</Txt> : null}
                {items.map((item, itemIndex) => (
                  <View
                    key={item.id ?? `${item.exercise_id}-${itemIndex}`}
                    style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}
                  >
                    <Txt variant="label" style={{ width: 20 }}>{itemIndex + 1}</Txt>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Txt style={{ fontWeight: '600' }}>{itemName(item)}</Txt>
                      <Txt variant="muted">
                        {item.sets ?? '—'} sets · {itemReps(item)} reps
                        {item.rest_seconds ? ` · ${item.rest_seconds}s rest` : ''}
                      </Txt>
                    </View>
                  </View>
                ))}
              </Card>
            );
          })}
        </>
      ) : null}
    </Screen>
  );
}
