import React, { useRef, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Txt, Button, Card } from '@/components/ui';
import * as endpoints from '@/api/endpoints';
import { ApiError } from '@/api/client';
import { toFood } from '@/api/types';
import { addFoodLog } from '@/db/repos';
import { requestSync } from '@/sync';
import { useQueryClient } from '@tanstack/react-query';

export default function Scan() {
  const router = useRouter();
  const qc = useQueryClient();
  const [perm, requestPerm] = useCameraPermissions();
  const [asked, setAsked] = useState(false);
  const [notFound, setNotFound] = useState<string | null>(null);
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
    if (busy.current) return;
    busy.current = true;
    try {
      const food = toFood(await endpoints.getFoodByBarcode(data));
      await addFoodLog(food, 'snack', 1);
      qc.invalidateQueries({ queryKey: ['local'] });
      requestSync();
      router.back();
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) setNotFound(data);
      else busy.current = false;
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <CameraView style={{ flex: 1 }} barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }} onBarcodeScanned={notFound ? undefined : onScan} />
      <SafeAreaView style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, gap: 8 }}>
        {notFound ? (
          <Card>
            <Txt>We don't have this product yet.</Txt>
            <Button title="Create custom food" onPress={() => router.replace({ pathname: '/food/custom', params: { barcode: notFound } })} />
            <Button title="Scan again" variant="text" onPress={() => { setNotFound(null); busy.current = false; }} />
          </Card>
        ) : null}
        <Button title="Close" variant="secondary" onPress={() => router.back()} />
      </SafeAreaView>
    </View>
  );
}
