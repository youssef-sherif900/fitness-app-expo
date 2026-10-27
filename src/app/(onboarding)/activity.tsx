import React from 'react';
import { useRouter } from 'expo-router';
import { OnbShell } from '@/components/OnbShell';
import { OptionCard } from '@/components/Choice';
import { Activity, stepCount, useOnboarding } from '@/onboarding/store';

const LEVELS: { key: Activity; title: string; desc: string }[] = [
    { key: 'sedentary', title: 'Mostly sitting', desc: 'Desk job, little exercise.' },
    { key: 'light', title: 'Lightly active', desc: 'Light exercise or walks 1–3 days a week.' },
    { key: 'moderate', title: 'Moderately active', desc: 'Exercise 3–5 days a week.' },
    { key: 'active', title: 'Very active', desc: 'Hard exercise 6–7 days a week.' },
    { key: 'very_active', title: 'Extremely active', desc: 'Physical job plus daily training.' },
];

export default function ActivityStep() {
    const router = useRouter();
    const { goal, activity } = useOnboarding((s) => s.draft);
    const set = useOnboarding((s) => s.set);
    return (
        <OnbShell step={3} total={stepCount(goal)} title="How active are you?" subtitle="Think about a typical week, not your best one." onNext={() => router.push(goal === 'maintain' ? '/diet' : '/rate')} nextDisabled={!activity}>
            {LEVELS.map((l) => (
                <OptionCard key={l.key} title={l.title} description={l.desc} selected={activity === l.key} onPress={() => set({ activity: l.key })} />
            ))}
        </OnbShell>
    );
}