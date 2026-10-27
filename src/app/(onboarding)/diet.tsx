import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { OnbShell } from '@/components/OnbShell';
import { Chip, ChipRow, InfoCard } from '@/components/Choice';
import { Button, Input, Txt } from '@/components/ui';
import * as endpoints from '@/api/endpoints';
import { ApiError } from '@/api/client';
import { buildProfilePayload, screenForField, stepCount, useOnboarding } from '@/onboarding/store';

const DIETS = ['Vegetarian', 'Vegan', 'Pescatarian', 'Halal', 'Kosher', 'Low-carb'];
const ALLERGIES = ['Peanuts', 'Tree nuts', 'Dairy', 'Eggs', 'Gluten', 'Soy', 'Shellfish', 'Fish', 'Sesame'];

const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

export default function DietStep() {
    const router = useRouter();
    const draft = useOnboarding((s) => s.draft);
    const set = useOnboarding((s) => s.set);
    const setResult = useOnboarding((s) => s.setResult);
    const [custom, setCustom] = useState('');
    const [loading, setLoading] = useState(false);
    const [notice, setNotice] = useState<{ lines: string[]; fix?: { path: string; label: string } } | null>(null);
    const total = stepCount(draft.goal);

    const addCustom = () => {
        const v = custom.trim();
        if (v && !draft.allergies.includes(v)) set({ allergies: [...draft.allergies, v] });
        setCustom('');
    };

    const submit = async () => {
        setNotice(null);
        setLoading(true);
        try {
            await endpoints.updateProfile(buildProfilePayload(draft));
            const res = await endpoints.recalculateTargets();
            setResult(res);
            router.push('/targets');
        } catch (e) {
            if (e instanceof ApiError && e.isOffline) {
                setNotice({ lines: ['We need a connection to calculate your targets. Your answers are saved here, so you can try again in a moment.'] });
            } else if (e instanceof ApiError && Object.keys(e.fields).length) {
                // Guardrail or validation messages from the server, shown calmly and in plain language.
                const first = Object.keys(e.fields)[0];
                setNotice({ lines: Object.values(e.fields).flat(), fix: screenForField(first) });
            } else if (e instanceof ApiError && e.status === 422) {
                setNotice({ lines: [e.message], fix: { path: '/goal', label: 'Adjust my answers' } });
            } else {
                setNotice({ lines: [e instanceof Error ? e.message : 'Something went wrong. Please try again.'] });
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <OnbShell step={total - 1} total={total} title="Food preferences" subtitle="Optional. We use this to tailor suggestions and flag foods to avoid." onNext={submit} nextLabel="Calculate my targets" loading={loading}>
            <Txt variant="label">Diet</Txt>
            <ChipRow>
                {DIETS.map((d) => <Chip key={d} label={d} selected={draft.diet.includes(d)} onPress={() => set({ diet: toggle(draft.diet, d) })} />)}
            </ChipRow>
            <Txt variant="label" style={{ marginTop: 8 }}>Allergies</Txt>
            <ChipRow>
                {ALLERGIES.map((a) => <Chip key={a} label={a} selected={draft.allergies.includes(a)} onPress={() => set({ allergies: toggle(draft.allergies, a) })} />)}
                {draft.allergies.filter((a) => !ALLERGIES.includes(a)).map((a) => <Chip key={a} label={`${a} ✕`} selected onPress={() => set({ allergies: toggle(draft.allergies, a) })} />)}
            </ChipRow>
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                <View style={{ flex: 1 }}><Input value={custom} onChangeText={setCustom} placeholder="Something else?" onSubmitEditing={addCustom} returnKeyType="done" /></View>
                <Button title="Add" variant="secondary" onPress={addCustom} disabled={!custom.trim()} />
            </View>
            {notice ? (
                <InfoCard lines={notice.lines}>
                    {notice.fix ? <Button title={notice.fix.label} variant="secondary" onPress={() => router.push(notice.fix!.path as any)} /> : null}
                </InfoCard>
            ) : null}
        </OnbShell>
    );
}