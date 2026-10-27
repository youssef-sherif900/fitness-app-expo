import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { OnbShell } from '@/components/OnbShell';
import { InfoCard } from '@/components/Choice';
import { Button, Card, ErrorState, Skeleton, Txt } from '@/components/ui';
import * as endpoints from '@/api/endpoints';
import { useSession } from '@/auth/session';
import { collectNotices, stepCount, useOnboarding } from '@/onboarding/store';
import { num } from '@/lib/util';

export default function TargetsStep() {
    const router = useRouter();
    const goal = useOnboarding((s) => s.draft.goal);
    const stored = useOnboarding((s) => s.result);
    const [finishing, setFinishing] = useState(false);

    // Normally set by the previous step; fall back to the server if the user lands here directly.
    const fetched = useQuery({ queryKey: ['nutrition', 'current'], queryFn: endpoints.getCurrentTarget, enabled: !stored });
    const t = stored ?? fetched.data;
    const notices = collectNotices(t);
    const calories = num(t, ['calories', 'daily_calories', 'calorie_target', 'kcal']);

    const finish = async () => {
        setFinishing(true);
        await useSession.getState().completeOnboarding();
        useOnboarding.getState().reset();
    };

    return (
        <OnbShell step={stepCount(goal)} total={stepCount(goal)} title="Your daily targets" subtitle="Here's where we'll start. We'll adjust as we learn how your body responds." onNext={finish} nextLabel="Start tracking" nextDisabled={calories == null} loading={finishing}>
            {!t && fetched.isLoading ? <Skeleton h={120} /> : null}
            {fetched.isError && !stored ? <ErrorState message={(fetched.error as Error).message} onRetry={() => fetched.refetch()} /> : null}

            {t && calories != null ? (
                <>
                    <Card>
                        <Txt variant="label">Calories per day</Txt>
                        <Txt variant="big">{Math.round(calories)}</Txt>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                            <Macro label="Protein" v={num(t, ['protein', 'protein_g'])} />
                            <Macro label="Carbs" v={num(t, ['carbs', 'carbs_g'])} />
                            <Macro label="Fat" v={num(t, ['fat', 'fat_g'])} />
                        </View>
                    </Card>

                    <InfoCard lines={notices} />

                    <Card>
                        <Txt variant="label">How we calculated this</Txt>
                        <Txt>
                            {t.explanation ?? t.summary ??
                                'We estimated how much energy your body uses in a day from your age, height, weight and activity, then adjusted it for your goal and weekly pace.'}
                        </Txt>
                    </Card>

                    <Button title="Adjust my answers" variant="secondary" onPress={() => router.replace('/goal')} />
                </>
            ) : null}
        </OnbShell>
    );
}

function Macro({ label, v }: { label: string; v: number | null }) {
    return (
        <View style={{ alignItems: 'center', flex: 1 }}>
            <Txt variant="title">{v != null ? Math.round(v) : '—'}</Txt>
            <Txt variant="muted">{label} (g)</Txt>
        </View>
    );
}