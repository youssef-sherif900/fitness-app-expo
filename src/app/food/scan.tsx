import React, { useRef, useState } from 'react';
import { Alert, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Txt, Button, Card } from '@/components/ui';
import { Sheet } from '@/components/Sheet';
import * as endpoints from '@/api/endpoints';
import { ApiError } from '@/api/client';
import { Food, MEALS, Meal, toFood } from '@/api/types';
import { addFoodLog } from '@/db/repos';
import { requestSync } from '@/sync';
import { useQueryClient } from '@tanstack/react-query';
import { ServingSheet } from '@/features/nutrition/ServingSheet';

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** FOOD-2: scan, then confirm serving + meal before logging. */
export default function Scan() {
  const params = useLocalSearchParams<{ meal?: string | string[] }>();
  const mealParam = first(params.meal);
  const router = useRouter();
  const qc = useQueryClient();
  const [perm, requestPerm] = useCameraPermissions();
  const [asked, setAsked] = useState(false);
  const [notFound, setNotFound] = useState<string | null>(null);
  const [found, setFound] = useState<Food | null>(null);
  const [meal, setMeal] = useState<Meal>(MEALS.some((m) => m.key === mealParam) ? (mealParam as Meal) : 'snack');
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);

  // Rationale first, then the system prompt (PRD section 12).
  if (!perm?.granted && !asked) {
    return (
      <SafeAreaView style={{ flex: 1, padding: 16, gap: 12, justifyContent: 'center' }}>
        <Txt variant="title">Scan barcodes</Txt>
        <Txt variant="muted">We use the camera only to read food barcodes. Nothing is saved.</Txt>
        <Button title="Continue" onPress={async () => { setAsked(true); await requestPerm(); }} />
        <Button title="Search manually" variant="text" onPress={() => router.back()} />
      </SafeAreaView>
    );
  }
  if (!perm?.granted) {
    return (
      <SafeAreaView style={{ flex: 1, padding: 16, gap: 12, justifyContent: 'center' }}>
        <Txt variant="title">Camera is off</Txt>
        <Txt variant="muted">You can still search for foods by name.</Txt>
        <Button title="Search manually" onPress={() => router.back()} />
      </SafeAreaView>
    );
  }

  const onScan = async ({ data }: { data: string }) => {
    if (busy.current || found) return;
    busy.current = true;
    try {
      const food = toFood(await endpoints.getFoodByBarcode(data));
      setFound(food);
    } catch (e) {
      busy.current = false;
      if (e instanceof ApiError && e.status === 404) setNotFound(data);
    }
  };

  const add = async (qty: number, servingId?: string) => {
    if (!found || saving) return;
    setSaving(true);
    try {
      const serving = servingId ? found.servings?.find((s) => s.id === servingId) : undefined;
      await addFoodLog(found, meal, qty, undefined, serving);
      qc.invalidateQueries({ queryKey: ['local'] });
      requestSync();
      router.back();
    } catch (e) {
      Alert.alert('Could not add that food', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <CameraView
        style={{ flex: 1 }}
        barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
        onBarcodeScanned={notFound || found ? undefined : onScan}
      />
      <SafeAreaView style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, gap: 8 }}>
        {notFound ? (
          <Card>
            <Txt>We do not have this product yet.</Txt>
            <Button
              title="Create custom food"
              onPress={() => router.replace({ pathname: '/food/custom', params: { barcode: notFound, meal } })}
            />
            <Button title="Scan again" variant="text" onPress={() => { setNotFound(null); busy.current = false; }} />
          </Card>
        ) : null}
        <Button title="Close" variant="secondary" onPress={() => router.back()} />
      </SafeAreaView>

      <Sheet visible={!!found} onClose={() => { setFound(null); busy.current = false; }}>
        {found ? (
          <ServingSheet
            food={found}
            meal={meal}
            busy={saving}
            onMealChange={setMeal}
            onClose={() => { setFound(null); busy.current = false; }}
            onAdd={(qty, serving) => { void add(qty, serving?.id); }}
          />
        ) : null}
      </Sheet>
    </View>
  );
}
