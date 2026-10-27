import { Stack } from 'expo-router';

export const unstable_settings = { anchor: 'goal' };

export default function OnboardingLayout() {
    return <Stack screenOptions={{ headerShown: false, gestureEnabled: true }} />;
}