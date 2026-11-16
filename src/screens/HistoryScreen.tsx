
import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    ActivityIndicator,
    TouchableOpacity,
} from 'react-native';

import {
    getSavedRides,
    Ride,
} from '../database/rideDatabase';

type Props = {
    onRidePress: (ride: Ride) => void;
};

export default function HistoryScreen({ onRidePress }: Props) {
    const [rides, setRides] = useState<Ride[]>([]);
    const [loading, setLoading] = useState(true);

    const loadHistory = async () => {
        try {
            setLoading(true);
            const savedRides = await getSavedRides();
            setRides(savedRides);
        } catch (error) {
            console.log('History loading error:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadHistory();
    }, []);

    const formatDuration = (seconds: number) => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const remainingSeconds = seconds % 60;

        return [hours, minutes, remainingSeconds]
            .map(value => String(value).padStart(2, '0'))
            .join(':');
    };

    const formatDate = (date: string) => {
        return new Date(date).toLocaleString();
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Running History</Text>

            <Text style={styles.subtitle}>
                Your running journey, one kilometre at a time.
            </Text>

            {loading ? (
                <ActivityIndicator
                    size="large"
                    color="#4ADE80"
                    style={{ marginTop: 40 }}
                />
            ) : rides.length === 0 ? (
                <View style={styles.emptyCard}>
                    <Text style={styles.icon}>🏃</Text>

                    <Text style={styles.emptyTitle}>
                        No runs found
                    </Text>

                    <Text style={styles.emptyDescription}>
                        Your completed sessions will appear here.
                    </Text>
                </View>
            ) : (
                <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: 25 }}
                >
                    <Text style={styles.count}>
                        Total Sessions: {rides.length}
                    </Text>

                    {rides.map((ride, index) => (
                        <TouchableOpacity
                            key={ride.id ?? `${ride.recorded_at}-${index}`}
                            style={styles.rideCard}
                            activeOpacity={0.75}
                            onPress={() => onRidePress(ride)}
                        >
                            <View style={styles.rideHeader}>
                                <View>
                                    <Text style={styles.rideTitle}>
                                        Ride #{rides.length - index}
                                    </Text>

                                    <Text style={styles.rideDate}>
                                        {formatDate(ride.recorded_at)}
                                    </Text>
                                </View>

                                <Text style={styles.arrow}>›</Text>
                            </View>

                            <View style={styles.distanceBox}>
                                <Text style={styles.distanceLabel}>
                                    DISTANCE
                                </Text>

                                <Text style={styles.distanceValue}>
                                    {ride.distance_km.toFixed(2)} km
                                </Text>
                            </View>

                            <View style={styles.statsRow}>
                                <View style={styles.statItem}>
                                    <Text style={styles.statLabel}>Duration</Text>
                                    <Text style={styles.statValue}>
                                        {formatDuration(ride.duration_seconds)}
                                    </Text>
                                </View>

                                <View style={styles.statItem}>
                                    <Text style={styles.statLabel}>Average Speed</Text>
                                    <Text style={styles.statValue}>
                                        {ride.average_speed.toFixed(1)} km/h
                                    </Text>
                                </View>

                                <View style={styles.statItem}>
                                    <Text style={styles.statLabel}>Max Speed</Text>
                                    <Text style={styles.statValue}>
                                        {ride.max_speed.toFixed(1)} km/h
                                    </Text>
                                </View>
                            </View>

                            <Text style={styles.tapText}>
                                Tap to view ride details →
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#101827',
        padding: 22,
        paddingTop: 55,
    },
    title: {
        color: '#FFFFFF',
        fontSize: 27,
        fontWeight: 'bold',
    },
    subtitle: {
        color: '#94A3B8',
        fontSize: 13,
        marginTop: 8,
        marginBottom: 25,
    },
    count: {
        color: '#4ADE80',
        fontSize: 15,
        fontWeight: 'bold',
        marginBottom: 15,
    },
    emptyCard: {
        backgroundColor: '#1E293B',
        borderRadius: 18,
        padding: 25,
        marginTop: 15,
        alignItems: 'center',
    },
    icon: {
        fontSize: 45,
        marginBottom: 18,
    },
    emptyTitle: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: 'bold',
    },
    emptyDescription: {
        color: '#94A3B8',
        fontSize: 13,
        textAlign: 'center',
        marginTop: 10,
    },
    rideCard: {
        backgroundColor: '#1E293B',
        borderRadius: 18,
        padding: 18,
        marginBottom: 16,
    },
    rideHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 18,
    },
    rideTitle: {
        color: '#4ADE80',
        fontSize: 18,
        fontWeight: 'bold',
    },
    rideDate: {
        color: '#94A3B8',
        fontSize: 11,
        marginTop: 6,
    },
    arrow: {
        color: '#4ADE80',
        fontSize: 30,
    },
    distanceBox: {
        backgroundColor: '#263449',
        padding: 15,
        borderRadius: 12,
        marginBottom: 16,
    },
    distanceLabel: {
        color: '#94A3B8',
        fontSize: 11,
    },
    distanceValue: {
        color: '#FFFFFF',
        fontSize: 27,
        fontWeight: 'bold',
        marginTop: 5,
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    statItem: {
        flex: 1,
    },
    statLabel: {
        color: '#94A3B8',
        fontSize: 10,
    },
    statValue: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: 'bold',
        marginTop: 6,
    },
    tapText: {
        color: '#4ADE80',
        fontSize: 11,
        marginTop: 18,
        textAlign: 'right',
    },
});
