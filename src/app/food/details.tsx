import React, { useRef, useState } from 'react';
import { Alert, Keyboard, Pressable, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Txt, Card, Button, Input, ErrorState, Skeleton, Toast } from '@/components/ui';
import { Sheet } from '@/components/Sheet';
import { useToast } from '@/lib/useToast';
import { useTheme } from '@/theme/tokens';
import * as endpoints from '@/api/endpoints';
import { MEALS, Meal, toFood } from '@/api/types';
import { addFoodLog, deleteFoodLog } from '@/db/repos';
import { requestSync } from '@/sync';
import { round } from '@/lib/util';
import { ServingSheet } from '@/features/nutrition/ServingSheet';

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** FOOD-1 detail + FOOD-6 report a wrong entry. */
export default function FoodDetails() {
  const params = useLocalSearchParams<{ id?: string | string[]; meal?: string | string[] }>();
  const id = first(params.id) ?? '';
  const initialMeal = (first(params.meal) ?? 'breakfast') as Meal;
  const router = useRouter();
  const qc = useQueryClient();
  const { c } = useTheme();
  const { toast, show } = useToast();
  const [meal, setMeal] = useState<Meal>(MEALS.some((m) => m.key === initialMeal) ? initialMeal : 'breakfast');
  const [sheet, setSheet] = useState(false);
  const [adding, setAdding] = useState(false);
  const addingRef = useRef(false);
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState('');

  const food = useQuery({ queryKey: ['food', id], queryFn: () => endpoints.getFood(id), enabled: !!id });
  const data = food.data ? toFood(food.data) : null;

  const report = useMutation({
    mutationFn: () => endpoints.reportFood(id, reason.trim()),
    onSuccess: () => {
      setReporting(false);
      setReason('');
      show('Thanks — we will review this entry.');
    },
  });

  const add = async (qty: number, servingId?: string) => {
    if (!data || addingRef.current) return false;
    addingRef.current = true;
    setAdding(true);
    try {
      const serving = servingId ? data.servings?.find((s) => s.id === servingId) : undefined;
      const logId = await addFoodLog(data, meal, qty, undefined, serving);
      qc.invalidateQueries({ queryKey: ['local'] });
      requestSync();
      show(`Added ${data.name}`, async () => {
        await deleteFoodLog(logId);
        qc.invalidateQueries({ queryKey: ['local'] });
        requestSync();
      });
      return true;
    } catch (e) {
      Alert.alert('Could not add that food', e instanceof Error ? e.message : 'Please try again.');
      return false;
    } finally {
      addingRef.current = false;
      setAdding(false);
    }
  };

  const openSheet = () => {
    Keyboard.dismiss();
    setSheet(true);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back" style={{ width: 44, height: 44, justifyContent: 'center' }}>
            <Ionicons name="chevron-back" size={26} color={c.text} />
          </Pressable>
          <Txt variant="title" style={{ flex: 1 }}>Food</Txt>
        </View>

        {food.isLoading ? <Skeleton h={160} /> : null}
        {food.isError ? <ErrorState message={(food.error as Error).message} onRetry={() => food.refetch()} /> : null}

        {data ? (
          <>
            <Card style={{ gap: 4 }}>
              <Txt variant="title">{data.name}</Txt>
              {data.brand ? <Txt variant="muted">{data.brand}</Txt> : null}
              <Txt variant="muted">
                {data.verified ? 'Verified food · trusted source' : data.isCustom ? 'Your custom food' : 'Community food · not verified'}
              </Txt>
              {data.barcode ? <Txt variant="muted">Barcode {data.barcode}</Txt> : null}
              <Txt variant="muted">{data.serving} · {round(data.kcal)} kcal</Txt>
              <Button title={`Add to ${MEALS.find((m) => m.key === meal)?.label ?? 'meal'}`} onPress={openSheet} />
            </Card>

            {data.servings?.length ? (
              <Card style={{ gap: 8 }}>
                <Txt variant="label">Servings</Txt>
                {data.servings.map((s) => (
                  <View key={s.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flex: 1 }}>
                      <Txt>{s.label}</Txt>
                      <Txt variant="muted">{round(s.kcal)} kcal · P {round(s.protein, 1)} · C {round(s.carbs, 1)} · F {round(s.fat, 1)} g</Txt>
                    </View>
                    <Pressable
                      onPress={() => { void add(1, s.id); }}
                      accessibilityRole="button"
                      accessibilityLabel={`Add ${s.label} of ${data.name}`}
                      style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Ionicons name="add-circle-outline" size={26} color={c.text} />
                    </Pressable>
                  </View>
                ))}
              </Card>
            ) : null}

            <Card style={{ gap: 8 }}>
              <Txt variant="label">Something wrong?</Txt>
              <Txt variant="muted">Flag incorrect calories, serving size or barcode. The entry stays usable while we review it.</Txt>
              <Button title="Report this food" variant="secondary" onPress={() => setReporting(true)} />
            </Card>

            {data.isCustom ? (
              <Button
                title="Edit custom food"
                variant="secondary"
                onPress={() => router.push({ pathname: '/food/custom', params: { id: String(data.id), meal } })}
              />
            ) : null}
          </>
        ) : null}
      </ScrollView>

      <Sheet visible={sheet} onClose={() => setSheet(false)}>
        {data ? (
          <ServingSheet
            food={data}
            meal={meal}
            busy={adding}
            onMealChange={setMeal}
            onClose={() => setSheet(false)}
            onAdd={async (qty, serving) => {
              const ok = await add(qty, serving?.id);
              if (ok) setSheet(false);
            }}
          />
        ) : null}
      </Sheet>

      <Sheet visible={reporting} onClose={() => setReporting(false)}>
        <Txt variant="title">Report wrong data</Txt>
        <Txt variant="muted">Tell us what is incorrect. We review reports regularly.</Txt>
        <Input
          label="What is wrong?"
          value={reason}
          onChangeText={setReason}
          multiline
          placeholder="For example: the calories per serving are wrong"
          style={{ minHeight: 96, textAlignVertical: 'top' }}
        />
        {report.isError ? <Txt variant="muted">{(report.error as Error).message}</Txt> : null}
        <Button
          title="Send report"
          onPress={() => report.mutate()}
          loading={report.isPending}
          disabled={reason.trim().length < 3}
        />
        <Button title="Cancel" variant="text" onPress={() => setReporting(false)} />
      </Sheet>

      {toast ? <Toast message={toast.message} onUndo={toast.onUndo} /> : null}
    </SafeAreaView>
  );
}
