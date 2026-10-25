import React from 'react';
import { Screen, Txt, Empty } from '@/components/ui';

export default function Coach() {
  return (
    <Screen>
      <Txt variant="title">Coach</Txt>
      <Empty title="Trainer linking is coming" hint="Invites, consent scopes and chat need backend routes that aren't in the API yet." />
    </Screen>
  );
}
