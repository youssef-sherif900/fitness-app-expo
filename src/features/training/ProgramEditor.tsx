import React, { useMemo, useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, Input, Txt } from '@/components/ui';
import { useTheme } from '@/theme/tokens';
import { uuid } from '@/lib/util';
import { ExercisePicker } from './ExercisePicker';
import { prescriptionForExercise } from './generate';
import type { DraftDay, DraftItem, DraftProgram, Exercise } from './types';

type Target = { dayKey: string; itemKey?: string };

export function ProgramEditor({
  program,
  exercises,
  onChange,
  showName = true,
}: {
  program: DraftProgram;
  exercises: Exercise[];
  onChange: (next: DraftProgram) => void;
  showName?: boolean;
}) {
  const { c, spacing, radius } = useTheme();
  const [picker, setPicker] = useState<Target | null>(null);
  const [editing, setEditing] = useState<Target | null>(null);

  const editingItem = useMemo(() => {
    if (!editing) return null;
    const day = program.days.find((d) => d.key === editing.dayKey);
    return day?.items.find((i) => i.key === editing.itemKey) ?? null;
  }, [editing, program.days]);

  const pickerDay = picker ? program.days.find((d) => d.key === picker.dayKey) : null;

  const updateDay = (dayKey: string, patch: Partial<DraftDay>) => {
    onChange({
      ...program,
      days: program.days.map((day) => (day.key === dayKey ? { ...day, ...patch } : day)),
    });
  };

  const updateItem = (dayKey: string, itemKey: string, patch: Partial<DraftItem>) => {
    onChange({
      ...program,
      days: program.days.map((day) =>
        day.key === dayKey
          ? {
              ...day,
              items: day.items.map((item) => (item.key === itemKey ? { ...item, ...patch } : item)),
            }
          : day,
      ),
    });
  };

  const removeItem = (dayKey: string, itemKey: string) => {
    const day = program.days.find((d) => d.key === dayKey);
    if (!day) return;
    updateDay(dayKey, { items: day.items.filter((item) => item.key !== itemKey) });
  };

  const addDay = () => {
    if (program.days.length >= 7) return;
    const nextNumber = program.days.length + 1;
    onChange({
      ...program,
      days: [
        ...program.days,
        {
          key: uuid(),
          name: `Day ${nextNumber}`,
          items: [],
        },
      ],
    });
  };

  const removeDay = (dayKey: string) => {
    if (program.days.length <= 1) return;
    onChange({ ...program, days: program.days.filter((day) => day.key !== dayKey) });
  };

  const chooseExercise = (exercise: Exercise) => {
    if (!picker) return;
    const day = program.days.find((d) => d.key === picker.dayKey);
    if (!day) return;

    if (picker.itemKey) {
      updateItem(picker.dayKey, picker.itemKey, { exercise });
    } else {
      const prescription = prescriptionForExercise(program.goal, program.experienceLevel, exercise);
      updateDay(picker.dayKey, {
        items: [...day.items, { key: uuid(), exercise, ...prescription }],
      });
    }
    setPicker(null);
  };

  const totalItems = program.days.reduce((total, day) => total + day.items.length, 0);

  return (
    <View style={{ gap: spacing.md }}>
      {showName ? (
        <Input
          label="Program name"
          value={program.name}
          onChangeText={(name) => onChange({ ...program, name })}
          placeholder="My program"
          maxLength={150}
        />
      ) : null}

      <Txt variant="muted">
        {program.days.length} {program.days.length === 1 ? 'day' : 'days'} · {totalItems}{' '}
        {totalItems === 1 ? 'exercise' : 'exercises'}
      </Txt>

      {program.days.map((day, dayIndex) => (
        <Card key={day.key} style={{ gap: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Input
                label={`Day ${dayIndex + 1}`}
                value={day.name}
                onChangeText={(name) => updateDay(day.key, { name })}
                placeholder={`Day ${dayIndex + 1}`}
                maxLength={100}
              />
            </View>
            {program.days.length > 1 ? (
              <Pressable
                onPress={() => removeDay(day.key)}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${day.name || `day ${dayIndex + 1}`}`}
                style={{ width: 44, height: 48, alignItems: 'center', justifyContent: 'center' }}
              >
                <Ionicons name="trash-outline" size={20} color={c.muted} />
              </Pressable>
            ) : null}
          </View>

          {day.items.length === 0 ? (
            <View style={{ paddingVertical: 12, gap: 4 }}>
              <Txt style={{ fontWeight: '600' }}>No exercises yet</Txt>
              <Txt variant="muted">Add the first movement for this day.</Txt>
            </View>
          ) : (
            day.items.map((item, itemIndex) => (
              <Pressable
                key={item.key}
                onPress={() => setEditing({ dayKey: day.key, itemKey: item.key })}
                accessibilityRole="button"
                accessibilityLabel={`Edit ${item.exercise.name}`}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  padding: 12,
                  borderRadius: radius.sm,
                  backgroundColor: c.bg,
                  borderWidth: 1,
                  borderColor: c.border,
                  opacity: pressed ? 0.75 : 1,
                })}
              >
                <View
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    backgroundColor: c.surface,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Txt variant="label">{itemIndex + 1}</Txt>
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Txt style={{ fontWeight: '600' }}>{item.exercise.name}</Txt>
                  <Txt variant="muted">
                    {item.sets} sets · {item.repMin}–{item.repMax} reps · {item.restSeconds}s rest
                  </Txt>
                </View>
                <Ionicons name="chevron-forward" size={18} color={c.muted} />
              </Pressable>
            ))
          )}

          <Button
            title="Add exercise"
            variant="secondary"
            onPress={() => setPicker({ dayKey: day.key })}
          />
        </Card>
      ))}

      {program.days.length < 7 ? (
        <Button title="Add another day" variant="secondary" onPress={addDay} />
      ) : (
        <Txt variant="muted" style={{ textAlign: 'center' }}>
          Seven days is the maximum for one program.
        </Txt>
      )}

      <ExercisePicker
        visible={Boolean(picker)}
        exercises={exercises}
        title={picker?.itemKey ? 'Swap exercise' : 'Add an exercise'}
        initialMuscles={pickerDay?.name ? dayMuscles(pickerDay.name) : []}
        onClose={() => setPicker(null)}
        onSelect={chooseExercise}
      />

      <Modal
        visible={Boolean(editing && editingItem)}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setEditing(null)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['top', 'bottom']}>
          <View style={{ padding: spacing.lg, gap: spacing.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Txt variant="title">Edit exercise</Txt>
              <Pressable
                onPress={() => setEditing(null)}
                accessibilityRole="button"
                accessibilityLabel="Close exercise editor"
                style={{ minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' }}
              >
                <Ionicons name="close" size={24} color={c.text} />
              </Pressable>
            </View>

            {editingItem ? (
              <ItemEditor
                key={editingItem.key}
                item={editingItem}
                onSave={(patch) => {
                  if (editing) updateItem(editing.dayKey, editingItem.key, patch);
                  setEditing(null);
                }}
                onRemove={() => {
                  if (editing) removeItem(editing.dayKey, editingItem.key);
                  setEditing(null);
                }}
                onSwap={() => {
                  if (editing) setPicker({ dayKey: editing.dayKey, itemKey: editingItem.key });
                  setEditing(null);
                }}
              />
            ) : null}
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

function dayMuscles(name: string): string[] {
  const key = name.toLowerCase();
  if (key.includes('push')) return ['chest', 'front_deltoids', 'side_deltoids', 'triceps'];
  if (key.includes('pull')) return ['back', 'lats', 'rear_deltoids', 'biceps'];
  if (key.includes('upper')) return ['chest', 'back', 'lats', 'front_deltoids', 'biceps', 'triceps'];
  if (key.includes('lower') || key.includes('leg')) return ['quadriceps', 'hamstrings', 'glutes', 'calves'];
  return [];
}

function ItemEditor({
  item,
  onSave,
  onRemove,
  onSwap,
}: {
  item: DraftItem;
  onSave: (patch: Partial<DraftItem>) => void;
  onRemove: () => void;
  onSwap: () => void;
}) {
  const { spacing } = useTheme();
  const [sets, setSets] = useState(String(item.sets));
  const [min, setMin] = useState(String(item.repMin));
  const [max, setMax] = useState(String(item.repMax));
  const [rest, setRest] = useState(String(item.restSeconds));
  const [problem, setProblem] = useState<string | null>(null);

  const save = () => {
    const setsValue = Number(sets);
    const minValue = Number(min);
    const maxValue = Number(max);
    const restValue = Number(rest);

    if (![setsValue, minValue, maxValue, restValue].every(Number.isFinite)) {
      setProblem('Use whole numbers for sets, reps and rest.');
      return;
    }
    if (setsValue < 1 || setsValue > 30) {
      setProblem('Sets need to be between 1 and 30.');
      return;
    }
    if (minValue < 1 || maxValue < minValue || maxValue > 200) {
      setProblem('Reps need a low value, a high value, and the high value cannot be lower.');
      return;
    }
    if (restValue < 0 || restValue > 600) {
      setProblem('Rest needs to be between 0 and 600 seconds.');
      return;
    }

    onSave({
      sets: Math.round(setsValue),
      repMin: Math.round(minValue),
      repMax: Math.round(maxValue),
      restSeconds: Math.round(restValue),
    });
  };

  return (
    <View style={{ gap: spacing.md }}>
      <Card style={{ gap: 4 }}>
        <Txt style={{ fontWeight: '700' }}>{item.exercise.name}</Txt>
        <Txt variant="muted">
          {(item.exercise.primary_muscles ?? []).map((m) => m.replace(/_/g, ' ')).join(' · ')}
        </Txt>
      </Card>

      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <View style={{ flex: 1 }}>
          <Input label="Sets" value={sets} onChangeText={setSets} keyboardType="number-pad" />
        </View>
        <View style={{ flex: 1 }}>
          <Input label="Rest (sec)" value={rest} onChangeText={setRest} keyboardType="number-pad" />
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <View style={{ flex: 1 }}>
          <Input label="Reps low" value={min} onChangeText={setMin} keyboardType="number-pad" />
        </View>
        <View style={{ flex: 1 }}>
          <Input label="Reps high" value={max} onChangeText={setMax} keyboardType="number-pad" />
        </View>
      </View>

      {problem ? <Txt variant="muted">{problem}</Txt> : null}

      <Button title="Save changes" onPress={save} />
      <Button title="Swap exercise" variant="secondary" onPress={onSwap} />
      <Button title="Remove exercise" variant="text" onPress={onRemove} />
    </View>
  );
}
