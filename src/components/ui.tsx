import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle, TextProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/tokens';

export function Screen({ children, scroll = true, style }: { children: React.ReactNode; scroll?: boolean; style?: ViewStyle }) {
  const { c, spacing } = useTheme();
  const inner = { padding: spacing.lg, gap: spacing.md, ...style };
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['top']}>
      {scroll ? (
        <ScrollView contentContainerStyle={inner} keyboardShouldPersistTaps="handled">{children}</ScrollView>
      ) : (
        <View style={[{ flex: 1 }, inner]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export function Txt({ variant = 'body', style, ...p }: TextProps & { variant?: 'title' | 'big' | 'body' | 'muted' | 'label' }) {
  const { c } = useTheme();
  const v = {
    title: { fontSize: 24, fontWeight: '700' as const, color: c.text },
    big: { fontSize: 40, fontWeight: '700' as const, color: c.text },
    body: { fontSize: 16, color: c.text },
    muted: { fontSize: 14, color: c.muted },
    label: { fontSize: 13, fontWeight: '600' as const, color: c.muted },
  }[variant];
  return <Text {...p} style={[v, style]} />;
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const { c, spacing, radius } = useTheme();
  return <View style={[{ backgroundColor: c.surface, borderRadius: radius.md, padding: spacing.lg, gap: spacing.sm }, style]}>{children}</View>;
}

export function Button({ title, onPress, variant = 'primary', loading, disabled, style }: {
  title: string; onPress: () => void; variant?: 'primary' | 'secondary' | 'text'; loading?: boolean; disabled?: boolean; style?: ViewStyle;
}) {
  const { c, radius } = useTheme();
  const bg = variant === 'primary' ? c.primary : variant === 'secondary' ? c.surface : 'transparent';
  const fg = variant === 'primary' ? c.onPrimary : c.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!(disabled || loading) }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [{ minHeight: 48, minWidth: 44, borderRadius: radius.md, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, opacity: disabled ? 0.4 : pressed ? 0.8 : 1 }, style]}
    >
      {loading ? <ActivityIndicator color={fg} /> : <Text style={{ color: fg, fontSize: 16, fontWeight: '600' }}>{title}</Text>}
    </Pressable>
  );
}

export function Input({ label, error, ...p }: TextInputProps & { label?: string; error?: string }) {
  const { c, radius } = useTheme();
  return (
    <View style={{ gap: 4 }}>
      {label ? <Txt variant="label">{label}</Txt> : null}
      <TextInput
        placeholderTextColor={c.muted}
        accessibilityLabel={label}
        {...p}
        style={[{ minHeight: 48, borderWidth: StyleSheet.hairlineWidth * 2, borderColor: error ? c.text : c.border, borderRadius: radius.md, paddingHorizontal: 12, color: c.text, backgroundColor: c.bg, fontSize: 16 }, p.style]}
      />
      {error ? <Txt variant="muted">{error}</Txt> : null}
    </View>
  );
}

export function Bar({ value, max, label }: { value: number; max: number | null; label: string }) {
  const { c } = useTheme();
  const pct = max && max > 0 ? Math.min(1, value / max) : 0;
  return (
    <View style={{ flex: 1, gap: 4 }}>
      <Txt variant="label">{label}</Txt>
      <View style={{ height: 8, borderRadius: 4, backgroundColor: c.track, overflow: 'hidden' }}>
        <View style={{ width: `${pct * 100}%`, height: 8, backgroundColor: c.primary }} />
      </View>
      <Txt variant="muted">{Math.round(value)}{max ? ` / ${Math.round(max)}` : ''} g</Txt>
    </View>
  );
}

export function Empty({ title, hint, action }: { title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <Card style={{ alignItems: 'center', paddingVertical: 24 }}>
      <Txt variant="body" style={{ fontWeight: '600' }}>{title}</Txt>
      {hint ? <Txt variant="muted" style={{ textAlign: 'center' }}>{hint}</Txt> : null}
      {action}
    </Card>
  );
}

export function Skeleton({ h = 20 }: { h?: number }) {
  const { c } = useTheme();
  return <View style={{ height: h, borderRadius: 8, backgroundColor: c.track }} />;
}

/** Calm, plain error card with retry. */
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Card>
      <Txt variant="muted">{message}</Txt>
      {onRetry ? <Button title="Try again" variant="secondary" onPress={onRetry} /> : null}
    </Card>
  );
}

/** Bottom toast with optional Undo. Shown ~5s as required by the wireframes. */
export function Toast({ message, onUndo }: { message: string; onUndo?: () => void }) {
  const { c, radius } = useTheme();
  return (
    <View style={{ position: 'absolute', left: 16, right: 16, bottom: 24, backgroundColor: c.primary, borderRadius: radius.md, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <Text style={{ color: c.onPrimary, flex: 1 }}>{message}</Text>
      {onUndo ? (
        <Pressable onPress={onUndo} accessibilityRole="button" style={{ minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'flex-end' }}>
          <Text style={{ color: c.onPrimary, fontWeight: '700' }}>Undo</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
