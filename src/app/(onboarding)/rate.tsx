import React from 'react';
import { useRouter } from 'expo-router';
import { OnbShell } from '@/components/OnbShell';
import { Chip, ChipRow, InfoCard } from '@/components/Choice';
import { Txt } from '@/components/ui';
import { stepCount, useOnboarding } from '@/onboarding/store';

const LOSE = [0.25, 0.5, 0.75, 1];
const GAIN = [0.1, 0.25, 0.5];

export default function RateStep() {
    const router = useRouter();
    const { goal, rateKg } = useOnboarding((s) => s.draft);
    const set = useOnboarding((s) => s.set);
    const options = goal === 'gain' ? GAIN : LOSE;
    const verb = goal === 'gain' ? 'gain' : 'lose';

    return (
        <OnbShell step={4} total={stepCount(goal)} title="How fast do you want to go?" subtitle={`Per week. A slower pace is usually easier to keep up.`} onNext={() => router.push('/diet')} nextDisabled={rateKg == null}>
            <ChipRow>
                {options.map((r) => (
                    <Chip key={r} label={`${r} kg / week`} selected={rateKg === r} onPress={() => set({ rateKg: r })} />
                ))}
            </ChipRow>
            {rateKg != null ? <Txt variant="muted">About {(rateKg * 4).toFixed(1)} kg {verb === 'lose' ? 'lost' : 'gained'} per month.</Txt> : null}
            <InfoCard lines={['If a pace is faster than is safe for your stats, we’ll tell you and suggest a steadier one on the last step.']} />
        </OnbShell>
    );
}