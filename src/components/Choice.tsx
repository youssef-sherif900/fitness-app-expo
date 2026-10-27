import React from 'react';
import { Pressable, View } from 'react-native';
import { Txt } from './ui';
import { useTheme } from '@/theme/tokens';

/** Large single-choice card (goal, activity). */
export function OptionCard({ title, description, selected, onPress }: { title: string; description?: string; selected: boolean; onPress: () => void }) {
    const { c, radius } = useTheme();
    return (
        <Pressable
            onPress={onPress}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={description ? `${title}. ${description}` : title}
            style={{ minHeight: 56, padding: 16, borderRadius: radius.md, backgroundColor: c.surface, borderWidth: 2, borderColor: selected ? c.primary : 'transparent', gap: 2 }}
        >
            <Txt style={{ fontWeight: '700' }}>{title}</Txt>
            {description ? <Txt variant="muted">{description}</Txt> : null}
        </Pressable>
    );
}

/** Selectable pill (diet, allergies, sex). */
export function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
    const { c } = useTheme();
    return (
        <Pressable
            onPress={onPress}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            style={{ minHeight: 44, paddingHorizontal: 16, justifyContent: 'center', borderRadius: 22, backgroundColor: selected ? c.primary : c.surface }}
        >
            <Txt style={{ color: selected ? c.onPrimary : c.text, fontSize: 15 }}>{label}</Txt>
        </Pressable>
    );
}

export const ChipRow = ({ children }: { children: React.ReactNode }) => (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{children}</View>
);

/** Informational card for server guardrail messages: calm, never error-styled. */
export function InfoCard({ lines, children }: { lines: string[]; children?: React.ReactNode }) {
    const { c, radius } = useTheme();
    if (!lines.length) return null;
    return (
        <View accessibilityRole="summary" style={{ padding: 16, borderRadius: radius.md, backgroundColor: c.surface, borderLeftWidth: 4, borderLeftColor: c.primary, gap: 8 }}>
            <Txt variant="label">Good to know</Txt>
            {lines.map((l, i) => <Txt key={i}>{l}</Txt>)}
            {children}
        </View>
    );
}