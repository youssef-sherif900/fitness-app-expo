import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, Empty, ErrorState, Screen, Skeleton, Txt } from '@/components/ui';
import { Chip, ChipRow, InfoCard } from '@/components/Choice';
import { FlowHeader } from '@/features/training/FlowHeader';
import { ProgramEditor } from '@/features/training/ProgramEditor';
import { emptyProgram } from '@/features/training/generate';
import { toCreatePayload, validateProgram } from '@/features/training/payload';
import { trainingErrorLines } from '@/features/training/errors';
import {
  EXPERIENCE_LEVELS,
  GOALS,
  type DraftProgram,
  type ExperienceLevel,
  type TrainingGoal,
} from '@/features/training/types';
import * as endpoints from '@/api/endpoints';

export default function ProgramBuilder() {
  const router = useRouter();
  const qc = useQueryClient();
  const [draft, setDraft] = useState<DraftProgram>(() => emptyProgram());
  const [lines, setLines] = useState<string[]>([]);

  const exercises = useQuery({
    queryKey: ['exercises', 'all'],
    queryFn: () => endpoints.listExercises(),
    staleTime: 5 * 60 * 1000,
  });

  const save = useMutation({
    mutationFn: (program: DraftProgram) => endpoints.createProgram(toCreatePayload(program)),
    onSuccess: (program) => {
      qc.invalidateQueries({ queryKey: ['training'] });
      router.replace(`/program/${program.id}`);
    },
    onError: (error) => setLines(trainingErrorLines(error)),
  });

  const saveProgram = () => {
    const problems = validateProgram(draft);
    if (problems.length) {
      setLines(problems);
      return;
    }
    setLines([]);
    save.mutate(draft);
  };

  const change = (next: DraftProgram) => {
    setDraft(next);
    setLines([]);
  };

  return (
    <Screen>
      <FlowHeader
        title="Build my own"
        subtitle="Choose the days and exercises yourself. Tap any exercise to edit it."
        onBack={() => router.back()}
      />

      <InfoCard lines={lines} />

      <Card style={{ gap: 8 }}>
        <Txt variant="label">Goal</Txt>
        <ChipRow>
          {GOALS.map((goal) => (
            <Chip
              key={goal.key}
              label={goal.label}
              selected={draft.goal === goal.key}
              onPress={() => change({ ...draft, goal: goal.key as TrainingGoal })}
            />
          ))}
        </ChipRow>
      </Card>

      <Card style={{ gap: 8 }}>
        <Txt variant="label">Experience</Txt>
        <ChipRow>
          {EXPERIENCE_LEVELS.map((level) => (
            <Chip
              key={level.key}
              label={level.label}
              selected={draft.experienceLevel === level.key}
              onPress={() => change({ ...draft, experienceLevel: level.key as ExperienceLevel })}
            />
          ))}
        </ChipRow>
      </Card>

      {exercises.isLoading ? <Skeleton h={96} /> : null}
      {exercises.isError ? (
        <ErrorState
          message={(exercises.error as Error).message}
          onRetry={() => exercises.refetch()}
        />
      ) : null}
      {exercises.isSuccess && exercises.data.length === 0 ? (
        <Empty
          title="No exercises available"
          hint="The library is empty right now. Try again once exercises have been added."
        />
      ) : null}

      <ProgramEditor
        program={draft}
        exercises={exercises.data ?? []}
        onChange={change}
      />

      <View style={{ gap: 8 }}>
        <Button title="Save program" onPress={saveProgram} loading={save.isPending} />
        <Txt variant="muted" style={{ textAlign: 'center' }}>
          Saving creates a draft. You will choose when to start it.
        </Txt>
      </View>
    </Screen>
  );
}
