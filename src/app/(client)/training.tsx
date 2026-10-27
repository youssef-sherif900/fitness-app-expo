import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Screen, Txt, Card, Button, Empty, ErrorState, Skeleton } from '@/components/ui';
import { ApiError } from '@/api/client';
import * as endpoints from '@/api/endpoints';
import { currentDays, currentProgram, dayItems, itemName, itemReps } from '@/features/training/payload';
import { EXPERIENCE_LEVELS, GOALS } from '@/features/training/types';

export default function Training() {
  const router = useRouter();
  const current = useQuery({
    queryKey: ['training', 'current'],
    queryFn: endpoints.getCurrentProgram,
  });

  const program = currentProgram(current.data);
  const days = currentDays(current.data, program);
  const missing = current.isSuccess && !program;
  const notFound = current.error instanceof ApiError && current.error.status === 404;

  const goal = GOALS.find((g) => g.key === program?.goal)?.label ?? 'Training';
  const level =
    EXPERIENCE_LEVELS.find((l) => l.key === program?.experience_level)?.label ?? 'All levels';

  return (
    <Screen>
      <View style={{ gap: 4 }}>
        <Txt variant="title">Training</Txt>
        <Txt variant="muted">Your plan, the week ahead, and what to do next.</Txt>
      </View>

      {current.isLoading ? <Skeleton h={120} /> : null}

      {current.isError && !notFound ? (
        <ErrorState
          message={(current.error as Error).message}
          onRetry={() => current.refetch()}
        />
      ) : null}

      {missing || notFound ? (
        <Empty
          title="No program yet"
          hint="Build a plan in a few steps, or copy a ready-made template."
          action={
            <View style={{ gap: 8, width: '100%', marginTop: 8 }}>
              <Button title="Create a program" onPress={() => router.push('/program/create')} />
              <Button
                title="Browse templates"
                variant="secondary"
                onPress={() => router.push('/program/create')}
              />
            </View>
          }
        />
      ) : null}

      {program ? (
        <>
          <Card style={{ gap: 8 }}>
            <Txt variant="label">Current program</Txt>
            <Txt variant="title">{program.name}</Txt>
            <Txt variant="muted">
              {goal} · {level} · {days.length} {days.length === 1 ? 'day' : 'days'}
            </Txt>
            <Button
              title="View program"
              variant="secondary"
              onPress={() => router.push(`/program/${program.id}`)}
            />
          </Card>

          {days.map((day, index) => {
            const items = dayItems(day);
            return (
              <Card key={day.id ?? `${day.name}-${index}`} style={{ gap: 8 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Txt style={{ fontWeight: '700', fontSize: 17 }}>
                    {day.name ?? `Day ${index + 1}`}
                  </Txt>
                  <Txt variant="muted">
                    {items.length} {items.length === 1 ? 'exercise' : 'exercises'}
                  </Txt>
                </View>
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

          <Button
            title="Create another program"
            variant="secondary"
            onPress={() => router.push('/program/create')}
          />
        </>
      ) : null}
    </Screen>
  );
}
