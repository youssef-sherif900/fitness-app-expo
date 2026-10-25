import React, { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Screen, Txt, Button } from '@/components/ui';
import { FormInput } from '@/components/FormInput';
import * as endpoints from '@/api/endpoints';
import { ApiError } from '@/api/client';
import { toFood } from '@/api/types';
import { addFoodLog } from '@/db/repos';
import { requestSync } from '@/sync';

const n = (label: string) => z.string().min(1, `Enter ${label}`).refine((v) => !Number.isNaN(parseFloat(v.replace(',', '.'))), 'Enter a number');
const schema = z.object({ name: z.string().min(1, 'Enter a name'), serving: z.string().min(1, 'Enter a serving size'), kcal: n('calories'), protein: n('protein'), carbs: n('carbs'), fat: n('fat') });
type Form = z.infer<typeof schema>;
const f = (v: string) => parseFloat(v.replace(',', '.'));

export default function CustomFood() {
  const { barcode } = useLocalSearchParams<{ barcode?: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [err, setErr] = useState('');
  const { control, handleSubmit, formState: { isSubmitting } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', serving: '100 g', kcal: '', protein: '', carbs: '', fat: '' },
  });

  const onSubmit = handleSubmit(async (v) => {
    setErr('');
    try {
      // Needs the backend to be reachable once; offline custom foods are a later batch.
      const created = await endpoints.createFood({
        name: v.name, serving_label: v.serving, calories: f(v.kcal), protein: f(v.protein), carbs: f(v.carbs), fat: f(v.fat), barcode,
      });
      await addFoodLog(toFood(created), 'snack', 1);
      qc.invalidateQueries({ queryKey: ['local'] });
      requestSync();
      router.dismissAll?.();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Something went wrong.');
    }
  });

  return (
    <Screen>
      <Txt variant="title">Custom food</Txt>
      {barcode ? <Txt variant="muted">Barcode {barcode}</Txt> : null}
      <FormInput control={control} name="name" label="Name" autoFocus />
      <FormInput control={control} name="serving" label="Serving size" />
      <FormInput control={control} name="kcal" label="Calories (kcal)" keyboardType="decimal-pad" />
      <FormInput control={control} name="protein" label="Protein (g)" keyboardType="decimal-pad" />
      <FormInput control={control} name="carbs" label="Carbs (g)" keyboardType="decimal-pad" />
      <FormInput control={control} name="fat" label="Fat (g)" keyboardType="decimal-pad" />
      {err ? <Txt variant="muted">{err}</Txt> : null}
      <Button title="Save and add" onPress={onSubmit} loading={isSubmitting} />
      <Button title="Cancel" variant="text" onPress={() => router.back()} />
    </Screen>
  );
}
