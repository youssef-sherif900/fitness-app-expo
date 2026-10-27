import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Txt, Card, Button, Empty, ErrorState, Skeleton, Toast } from '@/components/ui';
import { useToast } from '@/lib/useToast';
import { useTheme } from '@/theme/tokens';
import * as endpoints from '@/api/endpoints';
import { MEALS, Meal } from '@/api/types';
import { addSavedItems, deleteFoodLog } from '@/db/repos';
import { requestSync } from '@/sync';
import { round } from '@/lib/util';
import { MealChips } from '@/features/nutrition/MealChips';

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** FOOD-3: saved meals and recipes with one-tap relog. */
export default function SavedMeals() {
  const params = useLocalSearchParams<{ meal?: string | string[] }>();
  const initial = first(params.meal);
  const router = useRouter();
  const qc = useQueryClient();
  const { c } = useTheme();
  const { toast, show } = useToast();
  const [meal, setMeal] = useState<Meal>(MEALS.some((m) => m.key === initial) ? (initial as Meal) : 'breakfast');

  const meals = useQuery({ queryKey: ['saved-meals'], queryFn: endpoints.listSavedMeals });

  const remove = useMutation({
    mutationFn: (id: string) => endpoints.deleteSavedMeal(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['saved-meals'] }),
    onError: (e) => Alert.alert('Could not delete', (e as Error).message),
  });

  const log = async (saved: endpoints.SavedMeal) => {
    const ids = await addSavedItems(saved.items, meal);
    qc.invalidateQueries({ queryKey: ['local'] });
    requestSync();
    show(`Logged ${saved.name}`, async () => {
      for (const id of ids) await deleteFoodLog(id);
      qc.invalidateQueries({ queryKey: ['local'] });
      requestSync();
    });
  };

  const confirmDelete = (saved: endpoints.SavedMeal) =>
    Alert.alert('Delete saved meal?', `“${saved.name}” will be removed. Logged foods stay in your diary.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => remove.mutate(saved.id) },
    ]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back" style={{ width: 44, height: 44, justifyContent: 'center' }}>
            <Ionicons name="chevron-back" size={26} color={c.text} />
          </Pressable>
          <Txt variant="title" style={{ flex: 1 }}>Saved meals</Txt>
        </View>

        <Txt variant="muted">Log a saved meal in one tap. It is added to the meal you pick below.</Txt>
        <MealChips value={meal} onChange={setMeal} />

        {meals.isLoading ? <><Skeleton h={88} /><Skeleton h={88} /></> : null}
        {meals.isError ? (
          <ErrorState message={(meals.error as Error).message} onRetry={() => meals.refetch()} />
        ) : null}

        {meals.isSuccess && (meals.data ?? []).length === 0 ? (
          <Empty
            title="No saved meals yet"
            hint="Open a meal on Today and tap the bookmark to save it as a recipe."
          />
        ) : null}

        {(meals.data ?? []).map((saved) => {
          const kcal = saved.items.reduce((sum, item) => sum + (Number(item.kcal) || 0), 0);
          return (
            <Card key={saved.id} style={{ gap: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Txt style={{ fontWeight: '700', fontSize: 17 }}>{saved.name}</Txt>
                  <Txt variant="muted">
                    {saved.items.length} {saved.items.length === 1 ? 'item' : 'items'} · {round(kcal)} kcal
                  </Txt>
                </View>
                <Pressable
                  onPress={() => confirmDelete(saved)}
                  accessibilityRole="button"
                  accessibilityLabel={`Delete ${saved.name}`}
                  style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
                >
                  <Ionicons name="trash-outline" size={20} color={c.muted} />
                </Pressable>
              </View>
              <Button title={`Log to ${MEALS.find((m) => m.key === meal)?.label}`} onPress={() => log(saved)} />
            </Card>
          );
        })}
      </ScrollView>
      {toast ? <Toast message={toast.message} onUndo={toast.onUndo} /> : null}
    </SafeAreaView>
  );
}
