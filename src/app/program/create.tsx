import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Screen, Txt, Card, Button, Empty, ErrorState, Skeleton } from '@/components/ui';
import { InfoCard, OptionCard } from '@/components/Choice';
import { FlowHeader } from '@/features/training/FlowHeader';
import { trainingErrorLines } from '@/features/training/errors';
import { EXPERIENCE_LEVELS, GOALS, type ApiProgram } from '@/features/training/types';
import * as endpoints from '@/api/endpoints';

export default function CreateProgram() {
  const router = useRouter();
  const qc = useQueryClient();
  const [lines, setLines] = useState<string[]>([]);

  const templates = useQuery({
    queryKey: ['training', 'templates'],
    queryFn: () => endpoints.listTemplates(),
  });

  const useTemplate = useMutation({
    mutationFn: async (template: ApiProgram) => {
      const copy = await endpoints.copyTemplate(template.id);
      return endpoints.publishProgram(copy.id);
    },
    onSuccess: (program) => {
      qc.invalidateQueries({ queryKey: ['training'] });
      router.replace(`/program/${program.id}`);
    },
    onError: (error) => setLines(trainingErrorLines(error)),
  });

  const goalLabel = (goal?: string | null) =>
    GOALS.find((g) => g.key === goal)?.label ?? 'Balanced training';
  const levelLabel = (level?: string | null) =>
    EXPERIENCE_LEVELS.find((l) => l.key === level)?.label ?? 'All levels';

  return (
    <Screen>
      <FlowHeader
        title="Create a program"
        subtitle="Start with a guide, build it yourself, or copy a ready-made plan."
        onBack={() => router.back()}
      />

      <InfoCard lines={lines} />

      <OptionCard
        title="Guided setup"
        description="Answer four quick questions and we'll suggest a split you can edit."
        selected={false}
        onPress={() => router.push('/program/wizard')}
      />
      <OptionCard
        title="Build my own"
        description="Choose your own days and exercises, then set sets and reps."
        selected={false}
        onPress={() => router.push('/program/builder')}
      />

      <View style={{ gap: 8, marginTop: 8 }}>
        <Txt variant="label">Templates</Txt>
        <Txt variant="muted">Ready-made plans from the library. Copy one and make it yours.</Txt>
      </View>

      {templates.isLoading ? <Skeleton h={96} /> : null}

      {templates.isError ? (
        <ErrorState
          message={(templates.error as Error).message}
          onRetry={() => templates.refetch()}
        />
      ) : null}

      {templates.isSuccess && templates.data.length === 0 ? (
        <Empty
          title="No templates yet"
          hint="You can still build one with the guided setup or from scratch."
        />
      ) : null}

      {(templates.data ?? []).map((template) => {
        const pending = useTemplate.isPending && useTemplate.variables?.id === template.id;
        return (
          <Card key={template.id} style={{ gap: 8 }}>
            <Txt style={{ fontWeight: '700', fontSize: 17 }}>{template.name}</Txt>
            {template.description ? <Txt variant="muted">{template.description}</Txt> : null}
            <Txt variant="muted">
              {goalLabel(template.goal)} · {levelLabel(template.experience_level)} ·{' '}
              {template.days_count ?? template.days_per_week ?? '—'} days
            </Txt>
            <Button
              title="Use this template"
              variant="secondary"
              loading={pending}
              onPress={() => {
                setLines([]);
                useTemplate.mutate(template);
              }}
            />
          </Card>
        );
      })}
    </Screen>
  );
}
