
import { useCallback } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Pressable,
    RefreshControl,
    SafeAreaView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';

import { getTrainerClients, type TrainerClient } from '@/api/endpoints';

const scopeLabels: Record<string, string> = {
    nutrition: 'Nutrition',
    workouts: 'Workouts',
    body: 'Body metrics',
    photos: 'Progress photos',
    plan_editing: 'Plan editing',
};

function ClientCard({ client }: { client: TrainerClient }) {
    const scopes = client.scopes ?? [];

    return (
        <View style={styles.clientCard}>
            <View style={styles.clientHeader}>
                <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                        {client.name?.trim()?.charAt(0)?.toUpperCase() ?? '?'}
                    </Text>
                </View>

                <View style={styles.clientInfo}>
                    <Text style={styles.clientName}>{client.name}</Text>
                    <Text style={styles.clientEmail}>{client.email}</Text>
                </View>

                <View style={styles.statusBadge}>
                    <View style={styles.statusDot} />
                    <Text style={styles.statusText}>Active</Text>
                </View>
            </View>

            <View style={styles.scopesSection}>
                <Text style={styles.scopesTitle}>Access permissions</Text>

                <View style={styles.scopeList}>
                    {scopes.length > 0 ? (
                        scopes.map((scope) => (
                            <View key={scope} style={styles.scopeChip}>
                                <Text style={styles.scopeText}>
                                    {scopeLabels[scope] ?? scope}
                                </Text>
                            </View>
                        ))
                    ) : (
                        <Text style={styles.noScopesText}>No permissions granted</Text>
                    )}
                </View>
            </View>
        </View>
    );
}

export default function TrainerDashboardScreen() {
    const {
        data: clients = [],
        isLoading,
        isError,
        error,
        refetch,
        isRefetching,
    } = useQuery({
        queryKey: ['trainer', 'clients'],
        queryFn: getTrainerClients,
    });

    const handleRefresh = useCallback(() => {
        void refetch();
    }, [refetch]);

    if (isLoading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.centerContent}>
                    <ActivityIndicator size="large" color="#CA98EB" />
                    <Text style={styles.loadingText}>Loading your clients...</Text>
                </View>
            </SafeAreaView>
        );
    }

    if (isError) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.centerContent}>
                    <Ionicons name="cloud-offline-outline" size={44} color="#CA98EB" />
                    <Text style={styles.errorTitle}>Couldn't load clients</Text>
                    <Text style={styles.errorMessage}>
                        {error instanceof Error
                            ? error.message
                            : 'Something went wrong. Please try again.'}
                    </Text>

                    <Pressable style={styles.retryButton} onPress={handleRefresh}>
                        <Text style={styles.retryButtonText}>Try again</Text>
                    </Pressable>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <FlatList
                data={clients}
                keyExtractor={(item) => item.relationship_id}
                renderItem={({ item }) => <ClientCard client={item} />}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={isRefetching}
                        onRefresh={handleRefresh}
                        tintColor="#CA98EB"
                    />
                }
                ListHeaderComponent={
                    <View style={styles.header}>
                        <View>
                            <Text style={styles.eyebrow}>TRAINER SPACE</Text>
                            <Text style={styles.title}>Your clients</Text>
                            <Text style={styles.subtitle}>
                                Manage your clients and their progress.
                            </Text>
                        </View>

                        <View style={styles.summaryCard}>
                            <View style={styles.summaryIcon}>
                                <Ionicons name="people-outline" size={24} color="#CA98EB" />
                            </View>

                            <View>
                                <Text style={styles.summaryNumber}>{clients.length}</Text>
                                <Text style={styles.summaryLabel}>
                                    {clients.length === 1 ? 'Active client' : 'Active clients'}
                                </Text>
                            </View>
                        </View>

                        <Text style={styles.sectionTitle}>Client roster</Text>
                    </View>
                }
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <Ionicons name="people-outline" size={44} color="#77717F" />
                        <Text style={styles.emptyTitle}>No clients yet</Text>
                        <Text style={styles.emptyMessage}>
                            When clients connect with you, they'll appear here.
                        </Text>
                    </View>
                }
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#110E17',
    },
    listContent: {
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 32,
        flexGrow: 1,
    },
    header: {
        marginBottom: 20,
    },
    eyebrow: {
        color: '#CA98EB',
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 1.8,
        marginBottom: 8,
    },
    title: {
        color: '#FFFFFF',
        fontSize: 30,
        fontWeight: '800',
    },
    subtitle: {
        color: '#A49EAE',
        fontSize: 14,
        marginTop: 8,
    },
    summaryCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1D1926',
        borderWidth: 1,
        borderColor: '#30283B',
        borderRadius: 18,
        padding: 18,
        marginTop: 24,
        marginBottom: 28,
    },
    summaryIcon: {
        width: 48,
        height: 48,
        borderRadius: 14,
        backgroundColor: '#30243D',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 14,
    },
    summaryNumber: {
        color: '#FFFFFF',
        fontSize: 25,
        fontWeight: '800',
    },
    summaryLabel: {
        color: '#A49EAE',
        fontSize: 13,
        marginTop: 2,
    },
    sectionTitle: {
        color: '#FFFFFF',
        fontSize: 19,
        fontWeight: '700',
    },
    clientCard: {
        backgroundColor: '#1D1926',
        borderWidth: 1,
        borderColor: '#30283B',
        borderRadius: 18,
        padding: 16,
        marginBottom: 14,
    },
    clientHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatar: {
        width: 48,
        height: 48,
        borderRadius: 16,
        backgroundColor: '#30243D',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    avatarText: {
        color: '#CA98EB',
        fontSize: 20,
        fontWeight: '800',
    },
    clientInfo: {
        flex: 1,
    },
    clientName: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '700',
    },
    clientEmail: {
        color: '#A49EAE',
        fontSize: 12,
        marginTop: 4,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#20372E',
        borderRadius: 20,
        paddingHorizontal: 9,
        paddingVertical: 6,
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#72D6A2',
        marginRight: 6,
    },
    statusText: {
        color: '#72D6A2',
        fontSize: 11,
        fontWeight: '600',
    },
    scopesSection: {
        borderTopWidth: 1,
        borderTopColor: '#30283B',
        marginTop: 16,
        paddingTop: 14,
    },
    scopesTitle: {
        color: '#A49EAE',
        fontSize: 12,
        marginBottom: 10,
    },
    scopeList: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    scopeChip: {
        backgroundColor: '#30243D',
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    scopeText: {
        color: '#D8B8F0',
        fontSize: 11,
        fontWeight: '600',
    },
    noScopesText: {
        color: '#77717F',
        fontSize: 12,
    },
    centerContent: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 28,
    },
    loadingText: {
        color: '#A49EAE',
        marginTop: 14,
        fontSize: 14,
    },
    errorTitle: {
        color: '#FFFFFF',
        fontSize: 20,
        fontWeight: '700',
        marginTop: 16,
    },
    errorMessage: {
        color: '#A49EAE',
        fontSize: 14,
        textAlign: 'center',
        marginTop: 8,
        lineHeight: 21,
    },
    retryButton: {
        backgroundColor: '#CA98EB',
        borderRadius: 12,
        paddingHorizontal: 24,
        paddingVertical: 12,
        marginTop: 20,
    },
    retryButtonText: {
        color: '#110E17',
        fontSize: 14,
        fontWeight: '700',
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 56,
        paddingHorizontal: 20,
    },
    emptyTitle: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '700',
        marginTop: 16,
    },
    emptyMessage: {
        color: '#A49EAE',
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 21,
        marginTop: 8,
    },
});
