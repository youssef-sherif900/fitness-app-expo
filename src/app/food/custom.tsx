import React, { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Screen, Txt, Button, ErrorState, Skeleton } from '@/components/ui';
import { FormInput } from '@/components/FormInput';
import * as endpoints from '@/api/endpoints';
import { ApiError } from '@/api/client';
import { MEALS, Meal, toFood } from '@/api/types';
import { addFoodLog } from '@/db/repos';
import { requestSync } from '@/sync';

const n = (label: string) =>
  z.string().min(1, `Enter ${label}`).refine((v) => !Number.isNaN(parseFloat(v.replace(',', '.'))), 'Enter a number');

const schema = z.object({
  name: z.string().min(1, 'Enter a name'),
  serving: z.string().min(1, 'Enter a serving size'),
  kcal: n('calories'),
  protein: n('protein'),
  carbs: n('carbs'),
  fat: n('fat'),
});
type Form = z.infer<typeof schema>;
const f = (v: string) => parseFloat(v.replace(',', '.'));

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** FOOD-3: create or edit a custom food. The API stores nutrients per serving. */
export default function CustomFood() {
  const params = useLocalSearchParams<{ barcode?: string | string[]; id?: string | string[]; meal?: string | string[] }>();
  const barcode = first(params.barcode);
  const editingId = first(params.id);
  const mealParam = first(params.meal);
  const meal: Meal = MEALS.some((m) => m.key === mealParam) ? (mealParam as Meal) : 'breakfast';
  const router = useRouter();
  const qc = useQueryClient();
  const [err, setErr] = useState('');

  const existing = useQuery({
    queryKey: ['food', editingId],
    queryFn: () => endpoints.getFood(editingId!),
    enabled: !!editingId,
  });

  const { control, handleSubmit, reset, formState: { isSubmitting } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', serving: '100 g', kcal: '', protein: '', carbs: '', fat: '' },
  });

  useEffect(() => {
    if (!existing.data) return;
    const food = toFood(existing.data);
    const serving = food.servings?.[0];
    reset({
      name: food.name,
      serving: serving?.label ?? food.serving,
      kcal: String(serving?.kcal ?? food.kcal),
      protein: String(serving?.protein ?? food.protein),
      carbs: String(serving?.carbs ?? food.carbs),
      fat: String(serving?.fat ?? food.fat),
    });
  }, [existing.data, reset]);

  const onSubmit = handleSubmit(async (v) => {
    setErr('');
    const body = {
      name: v.name.trim(),
      barcode: barcode ?? undefined,
      servings: [{
        label: v.serving.trim(),
        kcal: f(v.kcal),
        protein_g: f(v.protein),
        carbs_g: f(v.carbs),
        fat_g: f(v.fat),
      }],
    };

    try {
      if (editingId) {
        await endpoints.updateFood(editingId, body);
        qc.invalidateQueries({ queryKey: ['food', editingId] });
        qc.invalidateQueries({ queryKey: ['foods'] });
        router.back();
        return;
      }

      const created = await endpoints.createFood(body);
      // FOOD-1: add it straight away so creating and logging stays quick.
      await addFoodLog(toFood(created), meal, 1);
      qc.invalidateQueries({ queryKey: ['local'] });
      qc.invalidateQueries({ queryKey: ['foods'] });
      requestSync();
      router.back();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Something went wrong.');
    }
  });

  if (editingId && existing.isLoading) {
    return <Screen><Skeleton h={240} /></Screen>;
  }

  if (editingId && existing.isError) {
    return (
      <Screen>
        <Txt variant="title">Edit food</Txt>
        <ErrorState message={(existing.error as Error).message} onRetry={() => existing.refetch()} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Txt variant="title">{editingId ? 'Edit food' : 'Custom food'}</Txt>
      {barcode ? <Txt variant="muted">Barcode {barcode}</Txt> : null}
      <Txt variant="muted">Nutrients are for one serving. You can change them later.</Txt>
      <FormInput control={control} name="name" label="Name" autoFocus />
      <FormInput control={control} name="serving" label="Serving size (for example 1 cup or 100 g)" />
      <FormInput control={control} name="kcal" label="Calories (kcal)" keyboardType="decimal-pad" />
      <FormInput control={control} name="protein" label="Protein (g)" keyboardType="decimal-pad" />
      <FormInput control={control} name="carbs" label="Carbs (g)" keyboardType="decimal-pad" />
      <FormInput control={control} name="fat" label="Fat (g)" keyboardType="decimal-pad" />
      {err ? <Txt variant="muted">{err}</Txt> : null}
      <Button
        title={editingId ? 'Save changes' : 'Save and add'}
        onPress={onSubmit}
        loading={isSubmitting}
      />
      <Button title="Cancel" variant="text" onPress={() => router.back()} />
    </Screen>
  );
}
