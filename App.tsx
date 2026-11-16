
import React, { useEffect, useRef, useState } from 'react';
import { initRideDatabase } from './src/database/rideDatabase';
import * as Location from 'expo-location';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Alert,
  ScrollView,
} from 'react-native';

export default function App() {
  const handleStart = () => {
    Alert.alert(
      'TrackMate',
      'GPS tracking will be implemented in our next milestone!'
    );
  };
  const [isTracking, setIsTracking] = useState(false);
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [currentSpeed, setCurrentSpeed] = useState(0);

  const locationSubscription =
    useRef<Location.LocationSubscription | null>(null);

  const startTracking = async () => {
    try {
      const permission =
        await Location.requestForegroundPermissionsAsync();

      if (permission.status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please allow location access to track your ride.'
        );
        return;
      }

      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 2000,
          distanceInterval: 2,
        },
        (location) => {
          setLatitude(location.coords.latitude);
          setLongitude(location.coords.longitude);
          setAccuracy(location.coords.accuracy);

          const speed = location.coords.speed ?? 0;
          setCurrentSpeed(Math.max(0, speed * 3.6));
        }
      );

      locationSubscription.current = subscription;
      setIsTracking(true);

    } catch (error) {
      Alert.alert('GPS Error', String(error));
    }
  };

  const stopTracking = () => {
    locationSubscription.current?.remove();
    locationSubscription.current = null;
    setIsTracking(false);
  };

  useEffect(() => {
    return () => {
      locationSubscription.current?.remove();
    };
  }, []);

  useEffect(() => {
  initRideDatabase()
    .then(() => console.log('TrackMate database ready'))
    .catch((error) => console.log('Database error:', error));
}, []);

  return (
    <>
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#101827" />

        <ScrollView contentContainerStyle={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.logo}>TRACKMATE</Text>
              <Text style={styles.subtitle}>Your journey, your pace.</Text>
            </View>
            <Text style={styles.profile}>🚴</Text>
          </View>

          {/* Welcome */}
          <Text style={styles.welcome}>Ready to ride?</Text>
          <Text style={styles.description}>
            Every kilometre is a new achievement.
          </Text>

          {/* Main Distance Card */}
          <View style={styles.distanceCard}>
            <Text style={styles.cardLabel}>TOTAL DISTANCE</Text>
            <View style={styles.distanceRow}>
              <Text style={styles.distance}>0.00</Text>
              <Text style={styles.unit}> km</Text>
            </View>
            <Text style={styles.muted}>Your next adventure starts here</Text>
          </View>

          {/* Statistics */}
          <Text style={styles.sectionTitle}>Ride statistics</Text>

          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statIcon}>⚡</Text>
              <Text style={styles.statValue}>0.0 km/h</Text>
              <Text style={styles.statLabel}>Current speed</Text>
            </View>

            <View style={styles.statCard}>
              <Text style={styles.statIcon}>🏁</Text>
              <Text style={styles.statValue}>0.0 km/h</Text>
              <Text style={styles.statLabel}>Maximum speed</Text>
            </View>

            <View style={styles.statCard}>
              <Text style={styles.statIcon}>📊</Text>
              <Text style={styles.statValue}>0.0 km/h</Text>
              <Text style={styles.statLabel}>Average speed</Text>
            </View>

            <View style={styles.statCard}>
              <Text style={styles.statIcon}>⏱️</Text>
              <Text style={styles.statValue}>00:00:00</Text>
              <Text style={styles.statLabel}>Duration</Text>
            </View>
          </View>

          {/* Start Button */}
          <TouchableOpacity
            style={styles.startButton}
            onPress={isTracking ? stopTracking : startTracking}
            activeOpacity={0.8}
          >
            <Text style={styles.startButtonText}>
              {isTracking ? '■ STOP TRACKING' : '▶ START RECORDING'}
            </Text>
          </TouchableOpacity>

          <Text style={styles.footer}>
            TRACKMATE • EXPLORE MORE
          </Text>
        </ScrollView>
      </View>
      <View style={styles.distanceCard}>
        <Text style={styles.cardLabel}>LIVE GPS INFORMATION</Text>

        <Text style={styles.statLabel}>Latitude</Text>
        <Text style={styles.statValue}>
          {latitude !== null ? latitude.toFixed(6) : 'Waiting for GPS'}
        </Text>

        <Text style={styles.statLabel}>Longitude</Text>
        <Text style={styles.statValue}>
          {longitude !== null ? longitude.toFixed(6) : 'Waiting for GPS'}
        </Text>

        <Text style={styles.statLabel}>GPS Accuracy</Text>
        <Text style={styles.statValue}>
          {accuracy !== null ? `${accuracy.toFixed(1)} metres` : '--'}
        </Text>

        <Text style={styles.statLabel}>Current GPS Speed</Text>
        <Text style={styles.statValue}>
          {currentSpeed.toFixed(1)} km/h
        </Text>
      </View>
    </>

  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#101827',
  },
  content: {
    padding: 22,
    paddingTop: 55,
    paddingBottom: 35,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 42,
  },
  logo: {
    color: '#4ADE80',
    fontSize: 23,
    fontWeight: '900',
    letterSpacing: 2,
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 5,
  },
  profile: {
    fontSize: 30,
  },
  welcome: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: 'bold',
  },
  description: {
    color: '#94A3B8',
    fontSize: 14,
    marginTop: 8,
    marginBottom: 25,
  },
  distanceCard: {
    backgroundColor: '#1E293B',
    borderRadius: 20,
    padding: 25,
    marginBottom: 30,
  },
  cardLabel: {
    color: '#94A3B8',
    fontSize: 12,
    letterSpacing: 2,
  },
  distanceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 15,
  },
  distance: {
    color: '#FFFFFF',
    fontSize: 55,
    fontWeight: 'bold',
  },
  unit: {
    color: '#4ADE80',
    fontSize: 19,
  },
  muted: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 12,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 14,
  },
  statCard: {
    width: '48%',
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 17,
  },
  statIcon: {
    fontSize: 22,
    marginBottom: 12,
  },
  statValue: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  statLabel: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 7,
  },
  startButton: {
    backgroundColor: '#4ADE80',
    padding: 19,
    borderRadius: 15,
    alignItems: 'center',
    marginTop: 30,
  },
  startButtonText: {
    color: '#101827',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 1,
  },
  footer: {
    color: '#64748B',
    textAlign: 'center',
    fontSize: 10,
    letterSpacing: 2,
    marginTop: 25,
  },
});
