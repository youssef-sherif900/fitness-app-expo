import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, Empty, ErrorState, Screen, Skeleton, Txt } from '@/components/ui';
import { Chip, ChipRow, InfoCard, OptionCard } from '@/components/Choice';
import { FlowHeader } from '@/features/training/FlowHeader';
import { ProgramEditor } from '@/features/training/ProgramEditor';
import { generateDays, splitForDays, splitTitle } from '@/features/training/generate';
import { toCreatePayload, validateProgram } from '@/features/training/payload';
import { trainingErrorLines } from '@/features/training/errors';
import {
  EQUIPMENT,
  EXPERIENCE_LEVELS,
  GOALS,
  type DraftProgram,
  type Equipment,
  type ExperienceLevel,
  type TrainingGoal,
} from '@/features/training/types';
import * as endpoints from '@/api/endpoints';

const TOTAL_STEPS = 5;

export default function ProgramWizard() {
  const router = useRouter();
  const qc = useQueryClient();

  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState<TrainingGoal>('hypertrophy');
  const [experience, setExperience] = useState<ExperienceLevel>('intermediate');
  const [days, setDays] = useState(3);
  const [equipment, setEquipment] = useState<Equipment[]>([
    'barbell',
    'dumbbell',
    'cable_machine',
    'machine',
    'pullup_bar',
    'bodyweight',
  ]);
  const [draft, setDraft] = useState<DraftProgram | null>(null);
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

  const toggleEquipment = (key: Equipment) => {
    setEquipment((current) =>
      current.includes(key) ? current.filter((e) => e !== key) : [...current, key],
    );
  };

  const buildPreview = () => {
    if (!exercises.data?.length) {
      setLines(['We could not load the exercise library. Check your connection and try again.']);
      return;
    }

    setDraft({
      name: splitTitle(days),
      goal,
      experienceLevel: experience,
      equipment,
      days: generateDays(exercises.data, { days, goal, experience, equipment }),
    });
    setLines([]);
    setStep(4);
  };

  const onNext = () => {
    if (step === 3) {
      if (!equipment.length) {
        setLines(['Choose at least one piece of equipment.']);
        return;
      }
      buildPreview();
      return;
    }
    setLines([]);
    setStep((current) => Math.min(TOTAL_STEPS - 1, current + 1));
  };

  const onBack = () => {
    if (step === 0) {
      router.back();
      return;
    }
    setLines([]);
    setStep((current) => Math.max(0, current - 1));
  };

  const saveProgram = () => {
    if (!draft) return;
    const problems = validateProgram(draft);
    if (problems.length) {
      setLines(problems);
      return;
    }
    setLines([]);
    save.mutate(draft);
  };

  const split = splitForDays(days);

  return (
    <Screen>
      <FlowHeader
        title={
          step === 0
            ? 'What are you working toward?'
            : step === 1
              ? 'How much training experience do you have?'
              : step === 2
                ? 'How many days can you train?'
                : step === 3
                  ? 'What equipment can you use?'
                  : 'Your suggested program'
        }
        subtitle={
          step === 0
            ? 'This sets the rep ranges and volume in your plan.'
            : step === 1
              ? 'We use this to keep the starting volume sensible.'
              : step === 2
                ? 'Pick a number you can repeat most weeks.'
                : step === 3
                  ? 'Choose everything you have access to. Bodyweight is always available.'
                  : 'Swap or edit anything, then save. You can start it on the next screen.'
        }
        onBack={onBack}
        step={Math.min(TOTAL_STEPS, step + 1)}
        total={TOTAL_STEPS}
      />

      <InfoCard lines={lines} />

      {step === 0
        ? GOALS.map((option) => (
            <OptionCard
              key={option.key}
              title={option.label}
              description={option.help}
              selected={goal === option.key}
              onPress={() => setGoal(option.key)}
            />
          ))
        : null}

      {step === 1
        ? EXPERIENCE_LEVELS.map((option) => (
            <OptionCard
              key={option.key}
              title={option.label}
              description={option.help}
              selected={experience === option.key}
              onPress={() => setExperience(option.key)}
            />
          ))
        : null}

      {step === 2 ? (
        <>
          <Card style={{ gap: 8 }}>
            <Txt variant="label">Days per week</Txt>
            <ChipRow>
              {[1, 2, 3, 4, 5, 6, 7].map((value) => (
                <Chip
                  key={value}
                  label={String(value)}
                  selected={days === value}
                  onPress={() => setDays(value)}
                />
              ))}
            </ChipRow>
          </Card>
          <Card style={{ gap: 6 }}>
            <Txt variant="label">Suggested split</Txt>
            <Txt style={{ fontWeight: '600' }}>{splitTitle(days)}</Txt>
            <Txt variant="muted">{split.map((day) => day.name).join(' · ')}</Txt>
            <Txt variant="muted">
              {days <= 2
                ? 'Full-body sessions are a good fit when training time is limited.'
                : 'You can change the split after we build it.'}
            </Txt>
          </Card>
        </>
      ) : null}

      {step === 3 ? (
        <>
          <Card style={{ gap: 8 }}>
            <Txt variant="label">Available equipment</Txt>
            <ChipRow>
              {EQUIPMENT.map((option) => (
                <Chip
                  key={option.key}
                  label={option.label}
                  selected={equipment.includes(option.key)}
                  onPress={() => toggleEquipment(option.key)}
                />
              ))}
            </ChipRow>
          </Card>
          {exercises.isLoading ? <Skeleton h={72} /> : null}
          {exercises.isError ? (
            <ErrorState
              message={(exercises.error as Error).message}
              onRetry={() => exercises.refetch()}
            />
          ) : null}
          {exercises.isSuccess && exercises.data.length === 0 ? (
            <Empty
              title="No exercises available"
              hint="The library is empty right now. You can still build a program manually once exercises are added."
            />
          ) : null}
        </>
      ) : null}

      {step === 4 && draft ? (
        <>
          <Card style={{ gap: 4 }}>
            <Txt variant="label">Built from your answers</Txt>
            <Txt style={{ fontWeight: '600' }}>
              {GOALS.find((g) => g.key === draft.goal)?.label} ·{' '}
              {EXPERIENCE_LEVELS.find((l) => l.key === draft.experienceLevel)?.label}
            </Txt>
            <Txt variant="muted">{draft.days.map((day) => day.name).join(' · ')}</Txt>
          </Card>

          <ProgramEditor
            program={draft}
            exercises={exercises.data ?? []}
            onChange={(next) => {
              setDraft(next);
              setLines([]);
            }}
          />
        </>
      ) : null}

      {step < 4 ? (
        <Button
          title={step === 3 ? 'Build my split' : 'Continue'}
          onPress={onNext}
          disabled={step === 3 && !equipment.length}
          loading={step === 3 && exercises.isLoading}
        />
      ) : (
        <View style={{ gap: 8 }}>
          <Button title="Save program" onPress={saveProgram} loading={save.isPending} />
          <Txt variant="muted" style={{ textAlign: 'center' }}>
            Saving creates a draft. You will choose when to start it.
          </Txt>
        </View>
      )}
    </Screen>
  );
}
