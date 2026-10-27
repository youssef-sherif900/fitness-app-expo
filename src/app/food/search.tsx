import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Keyboard, Pressable, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Txt, Input, Button, Empty, Toast, ErrorState, Skeleton } from '@/components/ui';
import { Sheet } from '@/components/Sheet';
import { useToast } from '@/lib/useToast';
import { useTheme } from '@/theme/tokens';
import * as endpoints from '@/api/endpoints';
import { Food, MEALS, Meal, toFood } from '@/api/types';
import { addFoodLog, deleteFoodLog, frequentFoods, RecentFoodRow, recentFoods } from '@/db/repos';
import { requestSync } from '@/sync';
import { round } from '@/lib/util';
import { MealChips } from '@/features/nutrition/MealChips';
import { ServingSheet } from '@/features/nutrition/ServingSheet';

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

const asMeal = (value: string | undefined): Meal =>
  MEALS.some((m) => m.key === value) ? (value as Meal) : 'breakfast';

/** Rebuild a Food from a locally logged row so recents stay one-tap reloggable. */
function recentToFood(r: RecentFoodRow): Food {
  const qty = r.quantity > 0 ? r.quantity : 1;
  return {
    id: r.food_id,
    name: r.name,
    serving: r.serving_label ?? '1 serving',
    servingId: r.serving_id ?? undefined,
    kcal: r.kcal / qty,
    protein: r.protein / qty,
    carbs: r.carbs / qty,
    fat: r.fat / qty,
    verified: false,
  };
}

export default function FoodSearch() {
  const params = useLocalSearchParams<{ meal?: string | string[] }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { c } = useTheme();
  const { toast, show } = useToast();
  const [meal, setMeal] = useState<Meal>(asMeal(first(params.meal)));
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [sheet, setSheet] = useState<Food | null>(null);
  const [more, setMore] = useState<{ term: string; items: any[]; cursor: string | null; loaded: boolean }>({
    term: '', items: [], cursor: null, loaded: false,
  });
  const [loadingMore, setLoadingMore] = useState(false);
  const [adding, setAdding] = useState(false);
  const [lastAdded, setLastAdded] = useState<{ name: string; meal: Meal } | null>(null);
  const addingRef = useRef(false);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  const recents = useQuery({ queryKey: ['local', 'recents'], queryFn: () => recentFoods(12) });
  const frequent = useQuery({ queryKey: ['local', 'frequent'], queryFn: () => frequentFoods(6) });
  const searching = debounced.length >= 2;
  const results = useQuery({
    queryKey: ['foods', debounced],
    queryFn: () => endpoints.searchFoods(debounced),
    enabled: searching,
  });
  // FOOD-1: first-run users have no recents, so suggest popular foods instead of a dead end.
  const popular = useQuery({
    queryKey: ['foods', 'popular'],
    queryFn: () => endpoints.popularFoods(8),
    enabled: !searching,
    staleTime: 10 * 60_000,
  });

  const add = async (food: Food, quantity = 1, servingId?: string) => {
    if (addingRef.current) return false;
    addingRef.current = true;
    setAdding(true);
    try {
      const serving = servingId ? food.servings?.find((s) => s.id === servingId) : undefined;
      const id = await addFoodLog(food, meal, quantity, undefined, serving);
      setLastAdded({ name: food.name, meal });
      qc.invalidateQueries({ queryKey: ['local'] });
      requestSync();
      show(`Added ${food.name}`, async () => {
        await deleteFoodLog(id);
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

  const openSheet = (food: Food) => {
    Keyboard.dismiss();
    setSheet(food);
  };

  const openDetails = (food: Food) =>
    router.push({ pathname: '/food/details', params: { id: String(food.id), meal } });

  const recentsList = useMemo(() => (recents.data ?? []).map(recentToFood), [recents.data]);
  const popularList = useMemo(() => (popular.data ?? []).map(toFood), [popular.data]);
  const suggesting = !searching && recentsList.length === 0 && popularList.length > 0;

  const list: Food[] = useMemo(() => {
    if (searching) {
      const page = results.data?.items ?? [];
      const extra = more.term === debounced ? more.items : [];
      return [...page, ...extra].map(toFood);
    }
    return suggesting ? popularList : recentsList;
  }, [searching, results.data, more, debounced, suggesting, popularList, recentsList]);

  const nextCursor = more.term === debounced && more.loaded ? more.cursor : results.data?.nextCursor ?? null;

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await endpoints.searchFoods(debounced, nextCursor);
      setMore((prev) => ({
        term: debounced,
        items: [...(prev.term === debounced ? prev.items : []), ...page.items],
        cursor: page.nextCursor,
        loaded: true,
      }));
    } finally {
      setLoadingMore(false);
    }
  };

  const frequentRow = searching || suggesting ? null : (
    <View style={{ gap: 8, paddingBottom: 8 }}>
      <Txt variant="label">Frequent</Txt>
      {frequent.data?.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {(frequent.data ?? []).map((r) => {
            const food = recentToFood(r);
            return (
              <Pressable
                key={r.food_id}
                onPress={() => openSheet(food)}
                accessibilityRole="button"
                accessibilityLabel={`Add ${r.name}`}
                style={{ minHeight: 44, paddingHorizontal: 14, justifyContent: 'center', borderRadius: 22, backgroundColor: c.surface }}
              >
                <Txt style={{ fontSize: 14 }}>{r.name}</Txt>
                <Txt variant="muted" style={{ fontSize: 12 }}>{round(food.kcal)} kcal · {r.uses ?? 1}×</Txt>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : (
        <Txt variant="muted">Foods you log often will show up here.</Txt>
      )}
    </View>
  );

  const listLabel = searching ? 'Results' : suggesting ? 'Suggestions' : 'Recent';
  const addedMealLabel = lastAdded ? MEALS.find((m) => m.key === lastAdded.meal)?.label : null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ padding: 16, gap: 12, flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Close" style={{ width: 44, height: 44, justifyContent: 'center' }}>
            <Ionicons name="close" size={24} color={c.text} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Input value={q} onChangeText={setQ} placeholder="Search foods" autoFocus returnKeyType="search" />
          </View>
          <Pressable onPress={() => router.push({ pathname: '/food/scan', params: { meal } })} accessibilityRole="button" accessibilityLabel="Scan barcode" style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="barcode-outline" size={26} color={c.text} />
          </Pressable>
        </View>

        <MealChips value={meal} onChange={setMeal} />

        {lastAdded ? (
          <View
            accessibilityLiveRegion="polite"
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, paddingHorizontal: 12, borderRadius: 12, backgroundColor: c.surface }}
          >
            <Ionicons name="checkmark-circle" size={20} color={c.primary} />
            <Txt style={{ flex: 1 }}>Added {lastAdded.name} to {addedMealLabel}</Txt>
          </View>
        ) : null}

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Txt variant="label">{listLabel}</Txt>
          <View style={{ flexDirection: 'row', gap: 4 }}>
            <Pressable onPress={() => router.push({ pathname: '/food/saved', params: { meal } })} accessibilityRole="button" accessibilityLabel="Saved meals" style={{ minHeight: 44, paddingHorizontal: 8, justifyContent: 'center' }}>
              <Txt variant="muted">Saved meals</Txt>
            </Pressable>
          </View>
        </View>

        {searching && results.isLoading ? <><Skeleton h={56} /><Skeleton h={56} /></> : null}
        {searching && results.isError ? (
          <ErrorState message={(results.error as Error).message} onRetry={() => results.refetch()} />
        ) : null}
        {!searching && recents.isError ? (
          <ErrorState
            message="Your local food history could not be read. Reset local data in Settings if this keeps happening."
            onRetry={() => recents.refetch()}
          />
        ) : null}
        {!searching && recents.isSuccess && recentsList.length === 0 && popular.isLoading ? (
          <><Skeleton h={56} /><Skeleton h={56} /></>
        ) : null}

        <FlatList
          data={list}
          keyExtractor={(f, i) => `${f.id}-${f.servingId ?? ''}-${i}`}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={frequentRow ?? undefined}
          ListEmptyComponent={
            results.isLoading ? undefined : searching ? (
              <Empty
                title="No results"
                hint="Try another spelling, scan the barcode, or create it yourself."
                action={
                  <View style={{ gap: 8, width: '100%', marginTop: 8 }}>
                    <Button title="Create custom food" variant="secondary" onPress={() => router.push({ pathname: '/food/custom', params: { meal } })} />
                    <Button title="Scan barcode" variant="text" onPress={() => router.push({ pathname: '/food/scan', params: { meal } })} />
                  </View>
                }
              />
            ) : recents.isError ? undefined : (
              <Empty title="No recent foods yet" hint="Search above to add your first food." />
            )
          }
          ListFooterComponent={
            searching && nextCursor ? (
              <View style={{ paddingVertical: 12 }}>
                {loadingMore ? <ActivityIndicator /> : <Button title="Load more" variant="secondary" onPress={loadMore} />}
              </View>
            ) : (
              <View style={{ paddingVertical: 12 }}>
                <Button title="Create a custom food" variant="text" onPress={() => router.push({ pathname: '/food/custom', params: { meal } })} />
              </View>
            )
          }
          renderItem={({ item }) => (
            <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 56 }}>
              <Pressable
                style={{ flex: 1, paddingVertical: 8 }}
                onPress={() => openSheet(item)}
                accessibilityRole="button"
                accessibilityLabel={`${item.name}, ${round(item.kcal)} calories`}
              >
                <Txt>{item.name}{item.verified ? '  ✓' : ''}</Txt>
                <Txt variant="muted">
                  {item.brand ? `${item.brand} · ` : ''}{item.serving} · {round(item.kcal)} kcal
                </Txt>
              </Pressable>
              {searching ? (
                <Pressable onPress={() => openDetails(item)} accessibilityRole="button" accessibilityLabel={`About ${item.name}`} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="information-circle-outline" size={22} color={c.muted} />
                </Pressable>
              ) : null}
              <Pressable onPress={() => openSheet(item)} accessibilityRole="button" accessibilityLabel={`Add ${item.name}`} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="add-circle-outline" size={28} color={c.text} />
              </Pressable>
            </View>
          )}
        />
      </View>

      <Sheet visible={!!sheet} onClose={() => setSheet(null)}>
        {sheet ? (
          <ServingSheet
            food={sheet}
            meal={meal}
            busy={adding}
            onMealChange={setMeal}
            onClose={() => setSheet(null)}
            onAdd={async (qty, serving) => {
              const food = sheet;
              const ok = await add(food, qty, serving?.id);
              if (ok) setSheet(null);
            }}
          />
        ) : null}
      </Sheet>

      {toast ? <Toast message={toast.message} onUndo={toast.onUndo} /> : null}
    </SafeAreaView>
  );
}
