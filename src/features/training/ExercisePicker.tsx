import React, { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Input, Txt } from '@/components/ui';
import { Chip, ChipRow } from '@/components/Choice';
import { useTheme } from '@/theme/tokens';
import { EQUIPMENT_LABELS, MUSCLE_LABELS, type Exercise } from './types';

export function ExercisePicker({
  visible,
  exercises,
  title = 'Add an exercise',
  initialMuscles = [],
  onClose,
  onSelect,
}: {
  visible: boolean;
  exercises: Exercise[];
  title?: string;
  initialMuscles?: string[];
  onClose: () => void;
  onSelect: (exercise: Exercise) => void;
}) {
  const { c, spacing } = useTheme();
  const [search, setSearch] = useState('');
  const [muscle, setMuscle] = useState<string | null>(null);

  const muscleOptions = useMemo(() => {
    const all = new Set<string>(initialMuscles);
    for (const exercise of exercises) {
      for (const m of exercise.primary_muscles ?? []) all.add(m);
    }
    return [...all].sort((a, b) => (MUSCLE_LABELS[a] ?? a).localeCompare(MUSCLE_LABELS[b] ?? b));
  }, [exercises, initialMuscles]);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return exercises.filter((exercise) => {
      const matchesTerm =
        !term ||
        exercise.name.toLowerCase().includes(term) ||
        (exercise.primary_muscles ?? []).some((m) => (MUSCLE_LABELS[m] ?? m).toLowerCase().includes(term));
      const matchesMuscle =
        !muscle ||
        exercise.primary_muscles?.includes(muscle) ||
        exercise.secondary_muscles?.includes(muscle);
      return matchesTerm && matchesMuscle;
    });
  }, [exercises, muscle, search]);

  const close = () => {
    setSearch('');
    setMuscle(null);
    onClose();
  };

  const choose = (exercise: Exercise) => {
    onSelect(exercise);
    close();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
      <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['top', 'bottom']}>
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Txt variant="title">{title}</Txt>
            <Pressable
              onPress={close}
              accessibilityRole="button"
              accessibilityLabel="Close exercise picker"
              style={{ minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="close" size={24} color={c.text} />
            </Pressable>
          </View>
          <Input
            value={search}
            onChangeText={setSearch}
            placeholder="Search exercises"
            autoCorrect={false}
            returnKeyType="search"
          />
          <ChipRow>
            <Chip label="All" selected={!muscle} onPress={() => setMuscle(null)} />
            {muscleOptions.map((m) => (
              <Chip
                key={m}
                label={MUSCLE_LABELS[m] ?? m.replace(/_/g, ' ')}
                selected={muscle === m}
                onPress={() => setMuscle(muscle === m ? null : m)}
              />
            ))}
          </ChipRow>
        </View>

        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, gap: spacing.sm }}
          ListEmptyComponent={
            <View style={{ paddingVertical: 32, alignItems: 'center', gap: 8 }}>
              <Txt style={{ fontWeight: '600' }}>No exercises found</Txt>
              <Txt variant="muted" style={{ textAlign: 'center' }}>
                Try another search or muscle group.
              </Txt>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => choose(item)}
              accessibilityRole="button"
              accessibilityLabel={`Add ${item.name}`}
              style={({ pressed }) => ({
                padding: spacing.lg,
                borderRadius: 12,
                backgroundColor: c.surface,
                opacity: pressed ? 0.75 : 1,
                gap: 4,
              })}
            >
              <Txt style={{ fontWeight: '700' }}>{item.name}</Txt>
              <Txt variant="muted">
                {(item.primary_muscles ?? []).map((m) => MUSCLE_LABELS[m] ?? m).join(' · ')}
                {item.equipment?.length ? ` · ${item.equipment.map((e) => EQUIPMENT_LABELS[e] ?? e).join(', ')}` : ''}
              </Txt>
            </Pressable>
          )}
        />
      </SafeAreaView>
    </Modal>
  );
}
