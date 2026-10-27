import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/tokens';


const icon = (name: React.ComponentProps<typeof Ionicons>['name']) =>
    ({ color, size }: { color: string; size: number }) => (
        <Ionicons name={name} color={color} size={size} />
    );

export default function TrainerTabs() {
    const { c } = useTheme();

    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarActiveTintColor: c.text,
                tabBarInactiveTintColor: c.muted,
                tabBarStyle: {
                    backgroundColor: c.bg,
                    borderTopColor: c.border,
                },
            }}
        >
            <Tabs.Screen
                name="index"
                options={{ title: 'Clients', tabBarIcon: icon('people-outline') }}
            />
            <Tabs.Screen
                name="inbox"
                options={{ title: 'Inbox', tabBarIcon: icon('chatbubbles-outline') }}
            />
            <Tabs.Screen
                name="templates"
                options={{ title: 'Templates', tabBarIcon: icon('library-outline') }}
            />
            <Tabs.Screen
                name="alerts"
                options={{ title: 'Alerts', tabBarIcon: icon('notifications-outline') }}
            />
            <Tabs.Screen
                name="profile"
                options={{ title: 'Profile', tabBarIcon: icon('person-outline') }}
            />
        </Tabs>
    );
}