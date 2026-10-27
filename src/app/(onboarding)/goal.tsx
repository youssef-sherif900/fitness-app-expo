import React from 'react';
import { useRouter } from 'expo-router';
import { OnbShell } from '@/components/OnbShell';
import { OptionCard } from '@/components/Choice';
import { Goal, stepCount, useOnboarding } from '@/onboarding/store';

const GOALS: { key: Goal; title: string; desc: string }[] = [
    { key: 'lose', title: 'Lose weight', desc: 'A steady calorie deficit at a pace that suits you.' },
    { key: 'maintain', title: 'Maintain weight', desc: 'Keep things steady and build healthy habits.' },
    { key: 'gain', title: 'Gain muscle', desc: 'A small surplus with training to support growth.' },
];

export default function GoalStep() {
    const router = useRouter();
    const { goal } = useOnboarding((s) => s.draft);
    const set = useOnboarding((s) => s.set);
    return (
        <OnbShell step={1} total={stepCount(goal)} title="What's your goal?" subtitle="You can change this any time." onNext={() => router.push('/body')} nextDisabled={!goal}>
            {GOALS.map((g) => (
                <OptionCard
                    key={g.key}
                    title={g.title}
                    description={g.desc}
                    selected={goal === g.key}
                    onPress={() => set({ goal: g.key, rateKg: g.key === 'lose' ? 0.5 : g.key === 'gain' ? 0.25 : null })}
                />
            ))}
        </OnbShell>
    );
}