import React, { useEffect, useState } from 'react';
import { FlatList, Modal, Pressable, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Txt, Input, Button, Card, Empty, Toast, ErrorState, Skeleton } from '@/components/ui';
import { useToast } from '@/lib/useToast';
import { useTheme } from '@/theme/tokens';
import * as endpoints from '@/api/endpoints';
import { Food, MEALS, Meal, toFood } from '@/api/types';
import { addFoodLog, deleteFoodLog, recentFoods } from '@/db/repos';
import { requestSync } from '@/sync';
import { round } from '@/lib/util';

export default function FoodSearch() {
  const { meal: mealParam } = useLocalSearchParams<{ meal?: Meal }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { c } = useTheme();
  const { toast, show } = useToast();
  const [meal, setMeal] = useState<Meal>(mealParam ?? 'breakfast');
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [sheet, setSheet] = useState<Food | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  const recents = useQuery({ queryKey: ['local', 'recents'], queryFn: () => recentFoods() });
  const results = useQuery({
    queryKey: ['foods', debounced],
    queryFn: async () => (await endpoints.searchFoods(debounced)).map(toFood),
    enabled: debounced.length >= 2,
  });

  const add = async (food: Food, quantity = 1) => {
    const id = await addFoodLog(food, meal, quantity);
    qc.invalidateQueries({ queryKey: ['local'] });
    requestSync();
    show(`Added ${food.name}`, async () => {
      await deleteFoodLog(id);
      qc.invalidateQueries({ queryKey: ['local'] });
      requestSync();
    });
  };

  // recents are shown first (local), then server results while searching
  const recentAsFoods: Food[] = (recents.data ?? []).map((r) => ({
    id: r.food_id, name: r.name, serving: '1 serving',
    kcal: r.kcal / (r.quantity || 1), protein: r.protein / (r.quantity || 1), carbs: r.carbs / (r.quantity || 1), fat: r.fat / (r.quantity || 1), verified: false,
  }));
  const searching = debounced.length >= 2;
  const data = searching ? results.data ?? [] : recentAsFoods;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ padding: 16, gap: 12, flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Close" style={{ width: 44, height: 44, justifyContent: 'center' }}>
            <Ionicons name="close" size={24} color={c.text} />
          </Pressable>
          <View style={{ flex: 1 }}><Input value={q} onChangeText={setQ} placeholder="Search foods" autoFocus returnKeyType="search" /></View>
          <Pressable onPress={() => router.push('/food/scan')} accessibilityRole="button" accessibilityLabel="Scan barcode" style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="barcode-outline" size={26} color={c.text} />
          </Pressable>
        </View>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          {MEALS.map((m) => (
            <Pressable key={m.key} onPress={() => setMeal(m.key)} accessibilityRole="button" accessibilityState={{ selected: meal === m.key }}
              style={{ minHeight: 44, paddingHorizontal: 12, justifyContent: 'center', borderRadius: 22, backgroundColor: meal === m.key ? c.primary : c.surface }}>
              <Txt style={{ color: meal === m.key ? c.onPrimary : c.text, fontSize: 14 }}>{m.label}</Txt>
            </Pressable>
          ))}
        </View>

        <Txt variant="label">{searching ? 'Results' : 'Recent'}</Txt>
        {searching && results.isLoading ? <><Skeleton h={56} /><Skeleton h={56} /></> : null}
        {searching && results.isError ? (
          <ErrorState message={(results.error as Error).message} onRetry={() => results.refetch()} />
        ) : null}

        <FlatList
          data={data}
          keyExtractor={(f, i) => `${f.id}-${i}`}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            results.isLoading ? null : searching ? (
              <Empty title="No results" hint="Try another spelling, or create it yourself." action={<Button title="Create custom food" variant="secondary" onPress={() => router.push('/food/custom')} />} />
            ) : (
              <Empty title="No recent foods yet" hint="Search above to add your first food." />
            )
          }
          renderItem={({ item }) => (
            <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 56 }}>
              <Pressable style={{ flex: 1, paddingVertical: 8 }} onPress={() => setSheet(item)} accessibilityRole="button">
                <Txt>{item.name}{item.verified ? '  ✓' : ''}</Txt>
                <Txt variant="muted">{item.brand ? `${item.brand} · ` : ''}{item.serving} · {round(item.kcal)} kcal</Txt>
              </Pressable>
              <Pressable onPress={() => add(item)} accessibilityRole="button" accessibilityLabel={`Add ${item.name}`} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="add-circle-outline" size={28} color={c.text} />
              </Pressable>
            </View>
          )}
        />
      </View>

      <Modal visible={!!sheet} transparent animationType="slide" onRequestClose={() => setSheet(null)}>
        {sheet ? <ServingSheet food={sheet} onClose={() => setSheet(null)} onAdd={async (qty) => { setSheet(null); await add(sheet, qty); }} /> : null}
      </Modal>
      {toast ? <Toast message={toast.message} onUndo={toast.onUndo} /> : null}
    </SafeAreaView>
  );
}

function ServingSheet({ food, onAdd, onClose }: { food: Food; onAdd: (q: number) => void; onClose: () => void }) {
  const { c } = useTheme();
  const [qty, setQty] = useState(1);
  const step = (d: number) => setQty((q) => Math.max(0.25, Math.round((q + d) * 4) / 4));
  return (
    <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' }}>
      <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="Close" />
      <Card style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0, backgroundColor: c.bg, paddingBottom: 32 }}>
        <Txt variant="title">{food.name}</Txt>
        <Txt variant="muted">{food.serving}</Txt>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24, marginVertical: 8 }}>
          <Button title="−" variant="secondary" onPress={() => step(-0.25)} style={{ width: 56 }} />
          <Txt variant="title">{qty}</Txt>
          <Button title="+" variant="secondary" onPress={() => step(0.25)} style={{ width: 56 }} />
        </View>
        <Txt style={{ textAlign: 'center' }}>{round(food.kcal * qty)} kcal · P {round(food.protein * qty)} · C {round(food.carbs * qty)} · F {round(food.fat * qty)}</Txt>
        <Button title="Add" onPress={() => onAdd(qty)} />
      </Card>
    </View>
  );
}
