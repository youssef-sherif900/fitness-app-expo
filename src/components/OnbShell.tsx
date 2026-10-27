import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Txt } from './ui';
import { useTheme } from '@/theme/tokens';
import { useSession } from '@/auth/session';

type Props = {
    step: number;
    total: number;
    title: string;
    subtitle?: string;
    children: React.ReactNode;
    nextLabel?: string;
    onNext: () => void;
    nextDisabled?: boolean;
    loading?: boolean;
};

/** One question group per screen, progress indicator, back everywhere, primary action in the thumb zone. */
export function OnbShell({ step, total, title, subtitle, children, nextLabel = 'Continue', onNext, nextDisabled, loading }: Props) {
    const router = useRouter();
    const { c } = useTheme();
    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <View style={{ paddingHorizontal: 16, paddingTop: 8, gap: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        {router.canGoBack() ? (
                            <Button title="Back" variant="text" onPress={() => router.back()} />
                        ) : (
                            <Button title="Sign out" variant="text" onPress={() => useSession.getState().signOut()} />
                        )}
                        <Txt variant="muted">Step {step} of {total}</Txt>
                    </View>
                    <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: total, now: step }} style={{ height: 6, borderRadius: 3, backgroundColor: c.track }}>
                        <View style={{ height: 6, borderRadius: 3, width: `${(step / total) * 100}%`, backgroundColor: c.primary }} />
                    </View>
                </View>
                <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled">
                    <Txt variant="title">{title}</Txt>
                    {subtitle ? <Txt variant="muted">{subtitle}</Txt> : null}
                    {children}
                </ScrollView>
                <View style={{ padding: 16 }}>
                    <Button title={nextLabel} onPress={onNext} disabled={nextDisabled} loading={loading} />
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}