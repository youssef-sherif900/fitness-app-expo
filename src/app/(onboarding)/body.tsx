import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { OnbShell } from '@/components/OnbShell';
import { FormInput } from '@/components/FormInput';
import { Chip, ChipRow } from '@/components/Choice';
import { Txt } from '@/components/ui';
import { stepCount, useOnboarding } from '@/onboarding/store';

const numStr = (label: string, min: number, max: number) =>
    z.string().refine((v) => {
        const n = parseFloat(v.replace(',', '.'));
        return !Number.isNaN(n) && n >= min && n <= max;
    }, `Enter ${label} between ${min} and ${max}`);

const schema = z.object({
    birthDate: z.string().refine((v) => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
        const d = new Date(v);
        const age = (Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000);
        return !Number.isNaN(age) && age >= 16 && age <= 100;
    }, 'Use the format YYYY-MM-DD (you must be 16 or older)'),
    heightCm: numStr('your height in cm', 100, 250),
    weightKg: numStr('your weight in kg', 30, 300),
    targetWeightKg: z.string().refine((v) => v === '' || (!Number.isNaN(parseFloat(v.replace(',', '.'))) && parseFloat(v.replace(',', '.')) >= 30 && parseFloat(v.replace(',', '.')) <= 300), 'Enter a weight between 30 and 300'),
});
type Form = z.infer<typeof schema>;

export default function BodyStep() {
    const router = useRouter();
    const draft = useOnboarding((s) => s.draft);
    const set = useOnboarding((s) => s.set);
    const { control, handleSubmit } = useForm<Form>({
        resolver: zodResolver(schema),
        defaultValues: { birthDate: draft.birthDate, heightCm: draft.heightCm, weightKg: draft.weightKg, targetWeightKg: draft.targetWeightKg },
    });

    const next = handleSubmit((v) => {
        if (!draft.sex) return;
        set({ ...v });
        router.push('/activity');
    });

    return (
        <OnbShell step={2} total={stepCount(draft.goal)} title="About you" subtitle="We use this to estimate how much energy your body uses each day." onNext={next} nextDisabled={!draft.sex}>
            <View style={{ gap: 6 }}>
                <Txt variant="label">Sex (used for the calorie estimate)</Txt>
                <ChipRow>
                    <Chip label="Female" selected={draft.sex === 'female'} onPress={() => set({ sex: 'female' })} />
                    <Chip label="Male" selected={draft.sex === 'male'} onPress={() => set({ sex: 'male' })} />
                </ChipRow>
            </View>
            <FormInput control={control} name="birthDate" label="Date of birth (YYYY-MM-DD)" keyboardType="numbers-and-punctuation" placeholder="1995-04-23" />
            <FormInput control={control} name="heightCm" label="Height (cm)" keyboardType="decimal-pad" />
            <FormInput control={control} name="weightKg" label="Current weight (kg)" keyboardType="decimal-pad" />
            {draft.goal !== 'maintain' ? (
                <FormInput control={control} name="targetWeightKg" label="Target weight (kg), optional" keyboardType="decimal-pad" />
            ) : null}
        </OnbShell>
    );
}