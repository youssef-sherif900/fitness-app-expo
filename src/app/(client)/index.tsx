import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { Screen, Txt, Card, Button, Input, Bar, Empty, Toast, Skeleton, ErrorState } from '@/components/ui';
import { Sheet } from '@/components/Sheet';
import { SyncBadge } from '@/components/SyncBadge';
import { useToast } from '@/lib/useToast';
import { useTheme } from '@/theme/tokens';
import * as endpoints from '@/api/endpoints';
import { MEALS, Meal } from '@/api/types';
import {
  addWeight,
  copyLogs,
  deleteFoodLog,
  listLogs,
  listWeightRows,
  LogRow,
  updateFoodLog,
} from '@/db/repos';
import { pullDay, requestSync } from '@/sync';
import {
  addDays,
  isToday,
  isoDate,
  longDate,
  monthDay,
  num,
  round,
  weekdayShort,
} from '@/lib/util';
import { currentDays, currentProgram, dayItems, itemName } from '@/features/training/payload';
import { DateBar } from '@/features/nutrition/DateBar';
import { LogEditor } from '@/features/nutrition/LogEditor';

export default function Today() {
  const router = useRouter();
  const qc = useQueryClient();
  const { c } = useTheme();
  const { toast, show } = useToast();
  const [day, setDay] = useState(isoDate());
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [kg, setKg] = useState('');
  const [editing, setEditing] = useState<LogRow | null>(null);
  const [mealMenu, setMealMenu] = useState<Meal | null>(null);
  const [dayMenu, setDayMenu] = useState(false);
  const [savingMeal, setSavingMeal] = useState<Meal | null>(null);
  const [mealName, setMealName] = useState('');

  const target = useQuery({ queryKey: ['nutrition', 'current'], queryFn: endpoints.getCurrentTarget });
  const logs = useQuery({ queryKey: ['local', 'logs', day], queryFn: () => listLogs(day) });
  const weights = useQuery({ queryKey: ['local', 'weights'], queryFn: listWeightRows });
  const program = useQuery({ queryKey: ['training', 'current'], queryFn: endpoints.getCurrentProgram });

  // FOOD-5: dates outside the rolling sync window are fetched when opened.
  useEffect(() => {
    void pullDay(day).catch(() => {
      // Offline: keep showing the local diary; sync retries on the next trigger.
    });
  }, [day]);

  const rows = useMemo(
    () => (logs.data ?? []).filter((r) => !hidden.has(r.id)),
    [logs.data, hidden],
  );
  const eaten = rows.reduce((sum, r) => sum + r.kcal, 0);
  const macro = (k: 'protein' | 'carbs' | 'fat') => rows.reduce((sum, r) => sum + r[k], 0);

  const t = target.data;
  const kcalTarget = num(t, ['kcal', 'calories', 'daily_calories', 'calorie_target']);
  const remaining = kcalTarget != null ? Math.round(kcalTarget - eaten) : null;

  const latestWeight = weights.data?.[0];
  const weekAgo = latestWeight ? addDays(latestWeight.measured_on, -7) : null;
  const olderWeight = weekAgo
    ? (weights.data ?? []).find((w) => w.measured_on <= weekAgo)
    : (weights.data ?? [])[1];
  const weightDelta = latestWeight && olderWeight ? latestWeight.kg - olderWeight.kg : null;

  const current = currentProgram(program.data);
  const programDays = currentDays(program.data, current);
  const workoutDay = programDays[0];
  const workoutItems = dayItems(workoutDay);
  const weekday = weekdayShort(day);

  const saveMeal = useMutation({
    mutationFn: (body: { name: string; items: unknown[] }) => endpoints.createSavedMeal(body),
    onSuccess: () => {
      setSavingMeal(null);
      setMealName('');
      qc.invalidateQueries({ queryKey: ['saved-meals'] });
      show('Saved as a meal');
    },
  });

  // FOOD-5: delete with a 5s undo window.
  const removeWithUndo = (id: string, name: string) => {
    setHidden((h) => new Set(h).add(id));
    timers.current[id] = setTimeout(async () => {
      await deleteFoodLog(id);
      qc.invalidateQueries({ queryKey: ['local'] });
      requestSync();
    }, 5000);
    show(`Removed ${name}`, () => {
      clearTimeout(timers.current[id]);
      setHidden((h) => {
        const next = new Set(h);
        next.delete(id);
        return next;
      });
    });
  };

  const saveWeight = async () => {
    const value = parseFloat(kg.replace(',', '.'));
    if (!value || value < 20 || value > 500) return;
    await addWeight(value, day);
    setKg('');
    qc.invalidateQueries({ queryKey: ['local'] });
    requestSync();
    show('Weigh-in saved');
  };

  const copy = async (from: string, to: string, meal?: Meal) => {
    const count = await copyLogs(from, to, meal);
    qc.invalidateQueries({ queryKey: ['local'] });
    requestSync();
    show(count ? `Copied ${count} ${count === 1 ? 'item' : 'items'} to ${monthDay(to)}` : 'Nothing to copy');
  };

  const openSaveMeal = (meal: Meal) => {
    const label = MEALS.find((m) => m.key === meal)?.label ?? 'Meal';
    setMealMenu(null);
    setMealName(`${label} · ${monthDay(day)}`);
    setSavingMeal(meal);
  };

  const saveCurrentMeal = () => {
    if (!savingMeal) return;
    const items = rows
      .filter((r) => r.meal === savingMeal)
      .map((r) => ({
        food_id: r.food_id,
        serving_id: r.serving_id,
        name: r.name,
        qty: r.quantity,
        meal: r.meal,
        kcal: r.kcal,
        protein_g: r.protein,
        carbs_g: r.carbs,
        fat_g: r.fat,
      }));
    saveMeal.mutate({ name: mealName.trim() || 'Saved meal', items });
  };

  const saveEdit = async (patch: { quantity: number; meal: Meal }) => {
    if (!editing) return;
    await updateFoodLog(editing.id, patch);
    setEditing(null);
    qc.invalidateQueries({ queryKey: ['local'] });
    requestSync();
  };

  return (
    <View style={{ flex: 1 }}>
      <Screen>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ gap: 2 }}>
            <Txt variant="title">{isToday(day) ? 'Today' : `${weekday}, ${monthDay(day)}`}</Txt>
            <Txt variant="muted">{longDate(day)}</Txt>
            <SyncBadge />
          </View>
          <View style={{ flexDirection: 'row' }}>
            <Pressable
              onPress={() => setDayMenu(true)}
              accessibilityRole="button"
              accessibilityLabel="Day actions"
              style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="ellipsis-horizontal" size={24} color={c.text} />
            </Pressable>
            <Pressable
              onPress={() => router.push('/settings')}
              accessibilityRole="button"
              accessibilityLabel="Settings"
              style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="person-circle-outline" size={28} color={c.text} />
            </Pressable>
          </View>
        </View>

        <DateBar value={day} onChange={setDay} />

        <Card>
          {target.isLoading ? <Skeleton h={72} /> : target.isError ? (
            <ErrorState message="Your target is unavailable right now." onRetry={() => target.refetch()} />
          ) : remaining != null ? (
            <>
              <Txt variant="label">Remaining</Txt>
              <Txt variant="big">{remaining >= 0 ? remaining : `${Math.abs(remaining)} beyond`}</Txt>
              <Txt variant="muted">{round(eaten)} eaten · {kcalTarget} kcal target</Txt>
            </>
          ) : (
            <>
              <Txt variant="label">Eaten</Txt>
              <Txt variant="big">{round(eaten)} kcal</Txt>
              <Txt variant="muted">Your daily target will appear here once it is calculated.</Txt>
            </>
          )}
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
            <Bar label="Protein" value={macro('protein')} max={num(t, ['protein_g', 'protein'])} />
            <Bar label="Carbs" value={macro('carbs')} max={num(t, ['carbs_g', 'carbs'])} />
            <Bar label="Fat" value={macro('fat')} max={num(t, ['fat_g', 'fat'])} />
          </View>
        </Card>

        <Card>
          <Txt variant="label">{isToday(day) ? "Today's workout" : 'Workout'}</Txt>
          {program.isLoading ? <Skeleton h={40} /> : workoutDay ? (
            <>
              <Txt variant="title">{workoutDay.name ?? 'Scheduled session'}</Txt>
              <Txt variant="muted">
                {workoutItems.length} {workoutItems.length === 1 ? 'exercise' : 'exercises'}
                {workoutItems.length ? ` · ${workoutItems.slice(0, 2).map(itemName).join(', ')}` : ''}
              </Txt>
              <Button title="Open training" variant="secondary" onPress={() => router.push('/training')} />
            </>
          ) : (
            <>
              <Txt variant="body">No program yet</Txt>
              <Txt variant="muted">Build a plan and your next session will show up here.</Txt>
              <Button title="Build a plan" variant="secondary" onPress={() => router.push('/program/create')} />
            </>
          )}
        </Card>

        <Card>
          <Txt variant="label">Quick weigh-in (kg){isToday(day) ? '' : ` · ${monthDay(day)}`}</Txt>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Input
                value={kg}
                onChangeText={setKg}
                keyboardType="decimal-pad"
                placeholder={latestWeight ? String(latestWeight.kg) : '0.0'}
                accessibilityLabel="Weight in kilograms"
              />
            </View>
            <Button title="Save" onPress={saveWeight} disabled={!kg} />
          </View>
          {latestWeight ? (
            <Txt variant="muted">
              Last weigh-in {round(latestWeight.kg, 1)} kg · {monthDay(latestWeight.measured_on)}
              {weightDelta != null ? ` · ${weightDelta > 0 ? '+' : ''}${round(weightDelta, 1)} kg vs last week` : ''}
              {' '}· edit on Progress
            </Txt>
          ) : (
            <Txt variant="muted">Your first weigh-in starts the trend line.</Txt>
          )}
        </Card>

        {logs.isLoading ? <><Skeleton h={88} /><Skeleton h={88} /></> : null}
        {logs.isError ? <ErrorState message="Your diary could not be read." onRetry={() => logs.refetch()} /> : null}

        {logs.isSuccess && rows.length === 0 ? (
          <Empty
            title="Nothing logged yet"
            hint="Add your first meal to start the day."
            action={<Button title="Add food" onPress={() => router.push({ pathname: '/food/search', params: { meal: 'breakfast' } })} />}
          />
        ) : null}

        {MEALS.map((m) => {
          const items = rows.filter((r) => r.meal === m.key);
          const total = items.reduce((sum, r) => sum + r.kcal, 0);
          return (
            <Card key={m.key}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Txt style={{ fontWeight: '700' }}>{m.label} · {round(total)} kcal</Txt>
                <Pressable
                  onPress={() => setMealMenu(m.key)}
                  accessibilityRole="button"
                  accessibilityLabel={`Actions for ${m.label}`}
                  style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
                >
                  <Ionicons name="ellipsis-horizontal" size={20} color={c.muted} />
                </Pressable>
              </View>

              {items.length === 0 ? (
                <Pressable
                  onPress={() => router.push({ pathname: '/food/search', params: { meal: m.key } })}
                  accessibilityRole="button"
                  accessibilityLabel={`Add food to ${m.label}`}
                  style={{ minHeight: 44, justifyContent: 'center' }}
                >
                  <Txt variant="muted">Nothing yet · tap to add</Txt>
                </Pressable>
              ) : null}

              {items.map((r) => (
                <Pressable
                  key={r.id}
                  onPress={() => setEditing(r)}
                  accessibilityRole="button"
                  accessibilityLabel={`Edit ${r.name}`}
                  style={{ flexDirection: 'row', alignItems: 'center', minHeight: 48, gap: 8 }}
                >
                  <View style={{ flex: 1 }}>
                    <Txt>{r.name}</Txt>
                    <Txt variant="muted">
                      {r.quantity !== 1 ? `${round(r.quantity, 2)} × ` : ''}{r.serving_label ?? '1 serving'} · {round(r.kcal)} kcal{r.server_id ? '' : ' · pending'}
                    </Txt>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={c.muted} />
                </Pressable>
              ))}
            </Card>
          );
        })}
      </Screen>

      <Sheet visible={!!editing} onClose={() => setEditing(null)}>
        {editing ? (
          <LogEditor
            row={editing}
            onClose={() => setEditing(null)}
            onSave={saveEdit}
            onDelete={() => {
              const row = editing;
              setEditing(null);
              removeWithUndo(row.id, row.name);
            }}
          />
        ) : null}
      </Sheet>

      <Sheet visible={dayMenu} onClose={() => setDayMenu(false)}>
        <Txt variant="title">Day actions</Txt>
        <Button
          title="Copy previous day to this day"
          variant="secondary"
          onPress={() => { setDayMenu(false); void copy(addDays(day, -1), day); }}
        />
        <Button
          title="Copy this day to tomorrow"
          variant="secondary"
          onPress={() => { setDayMenu(false); void copy(day, addDays(day, 1)); }}
        />
        <Button title="Saved meals" variant="secondary" onPress={() => { setDayMenu(false); router.push('/food/saved'); }} />
        <Button title="Close" variant="text" onPress={() => setDayMenu(false)} />
      </Sheet>

      <Sheet visible={!!mealMenu} onClose={() => setMealMenu(null)}>
        {mealMenu ? (
          <>
            <Txt variant="title">{MEALS.find((m) => m.key === mealMenu)?.label}</Txt>
            <Button
              title="Add food"
              onPress={() => {
                const meal = mealMenu;
                setMealMenu(null);
                router.push({ pathname: '/food/search', params: { meal } });
              }}
            />
            <Button
              title="Save as a saved meal"
              variant="secondary"
              disabled={!rows.some((r) => r.meal === mealMenu)}
              onPress={() => openSaveMeal(mealMenu)}
            />
            <Button
              title="Copy to tomorrow"
              variant="secondary"
              onPress={() => {
                const meal = mealMenu;
                setMealMenu(null);
                void copy(day, addDays(day, 1), meal);
              }}
            />
            <Button title="Cancel" variant="text" onPress={() => setMealMenu(null)} />
          </>
        ) : null}
      </Sheet>

      <Sheet visible={!!savingMeal} onClose={() => setSavingMeal(null)}>
        {savingMeal ? (
          <>
            <Txt variant="title">Save meal</Txt>
            <Txt variant="muted">Reuse this meal in one tap later. You can find it under Saved meals.</Txt>
            <Input label="Meal name" value={mealName} onChangeText={setMealName} autoFocus />
            {saveMeal.isError ? <Txt variant="muted">{(saveMeal.error as Error).message}</Txt> : null}
            <Button title="Save meal" onPress={saveCurrentMeal} loading={saveMeal.isPending} />
            <Button title="Cancel" variant="text" onPress={() => setSavingMeal(null)} />
          </>
        ) : null}
      </Sheet>

      {toast ? <Toast message={toast.message} onUndo={toast.onUndo} /> : null}
    </View>
  );
}
