
import React, { useEffect, useRef, useState } from 'react';
import RunningHistoryScreen from './src/screens/HistoryScreen';
import {
  initRideDatabase,
  saveRide,
  getSavedRides,
} from './src/database/rideDatabase';

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
  const [activeTab, setActiveTab] = useState<'home' | 'history'>('home');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [currentSpeed, setCurrentSpeed] = useState(0);

  const [distanceKm, setDistanceKm] = useState(0);
  const [totalDistance, setTotalDistance] = useState(0);
  const [maxSpeed, setMaxSpeed] = useState(0);
  const [durationSeconds, setDurationSeconds] = useState(0);

  const startTimeRef = useRef<number | null>(null);
  const lastLocationRef =
    useRef<Location.LocationObjectCoords | null>(null);

  const distanceRef = useRef(0);
  const maxSpeedRef = useRef(0);

  const locationSubscription =
    useRef<Location.LocationSubscription | null>(null);

  const startTracking = async () => {
    try {
      const permission =
        await Location.requestForegroundPermissionsAsync();

      if (permission.status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please allow location access.'
        );
        return;
      }

      // Reset current running session
      distanceRef.current = 0;
      maxSpeedRef.current = 0;
      lastLocationRef.current = null;

      setDistanceKm(0);
      setMaxSpeed(0);
      setDurationSeconds(0);

      startTimeRef.current = Date.now();

      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 2000,
          distanceInterval: 2,
        },
        (location) => {
          const coords = location.coords;

          // Ignore inaccurate GPS readings
          if (
            coords.accuracy !== null &&
            coords.accuracy > 30
          ) {
            return;
          }

          setLatitude(coords.latitude);
          setLongitude(coords.longitude);
          setAccuracy(coords.accuracy);

          // Calculate distance from previous GPS location
          const previousLocation = lastLocationRef.current;

          if (previousLocation) {
            const segmentDistance = calculateDistance(
              previousLocation.latitude,
              previousLocation.longitude,
              coords.latitude,
              coords.longitude
            );

            // Ignore unusually large GPS jumps
            if (segmentDistance <= 0.1) {
              distanceRef.current += segmentDistance;
              setDistanceKm(distanceRef.current);
            }
          }

          lastLocationRef.current = coords;

          // Calculate speed
          const speed = Math.max(
            0,
            (coords.speed ?? 0) * 3.6
          );

          setCurrentSpeed(speed);

          // Calculate maximum speed
          if (speed > maxSpeedRef.current) {
            maxSpeedRef.current = speed;
            setMaxSpeed(speed);
          }
        }
      );

      locationSubscription.current = subscription;
      setIsTracking(true);

    } catch (error) {
      Alert.alert('GPS Error', String(error));
    }
  };

  const stopTracking = async () => {
    locationSubscription.current?.remove();
    locationSubscription.current = null;

    setIsTracking(false);

    if (startTimeRef.current === null) {
      return;
    }

    const duration = Math.floor(
      (Date.now() - startTimeRef.current) / 1000
    );

    const distance = distanceRef.current;

    const averageSpeed =
      duration > 0
        ? (distance / duration) * 3600
        : 0;

    try {
      await saveRide({
        recorded_at: new Date(
          startTimeRef.current
        ).toISOString(),

        distance_km: distance,

        duration_seconds: duration,

        average_speed: averageSpeed,

        max_speed: maxSpeedRef.current,
      });

      // Refresh lifetime distance from database
      const rides = await getSavedRides();

      const total = rides.reduce(
        (sum, ride) => sum + ride.distance_km,
        0
      );

      setTotalDistance(total);

      Alert.alert(
        'Run Saved Successfully!',
        `Distance: ${distance.toFixed(2)} km\nDuration: ${duration} seconds\nAverage Speed: ${averageSpeed.toFixed(2)} km/h`
      );

    } catch (error) {
      Alert.alert(
        'Database Error',
        'Could not save your running session: ' + String(error)
      );
    }

    startTimeRef.current = null;
  };

  const liveAverageSpeed =
    durationSeconds > 0
      ? (distanceKm / durationSeconds) * 3600
      : 0;

  useEffect(() => {
    return () => {
      locationSubscription.current?.remove();
    };
  }, []);

  useEffect(() => {
    if (!isTracking) return;

    const timer = setInterval(() => {
      if (startTimeRef.current !== null) {
        const elapsed = Math.floor(
          (Date.now() - startTimeRef.current) / 1000
        );

        setDurationSeconds(elapsed);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [isTracking]);

  // useEffect(() => {
  //   initRideDatabase()
  //     .then(() => console.log('TrackMate database ready'))
  //     .catch((error) => console.log('Database error:', error));
  // }, []);
  useEffect(() => {
    const loadDatabase = async () => {
      try {
        await initRideDatabase();

        const rides = await getSavedRides();

        console.log('Saved rides:', rides);

        const total = rides.reduce(
          (sum, ride) => sum + ride.distance_km,
          0
        );

        setTotalDistance(total);

        console.log('Total distance:', total);

      } catch (error) {
        console.log('Database error:', error);
      }
    };

    loadDatabase();
  }, []);

  return (
    <View style={styles.appContainer}>
      {activeTab === 'home' ? (
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
                  <Text style={styles.distance}>{totalDistance.toFixed(2)}</Text>
                  <Text style={styles.unit}> km</Text>
                </View>
                <Text style={styles.muted}>Your next adventure starts here</Text>
              </View>

              {/* Statistics */}
              <Text style={styles.sectionTitle}>Ride statistics</Text>

              <View style={styles.statsGrid}>
                <View style={styles.statCard}>
                  <Text style={styles.statIcon}>⚡</Text>
                  <Text style={styles.statValue}>{currentSpeed.toFixed(1)} km/h </Text>
                  <Text style={styles.statLabel}>Current speed</Text>
                </View>

                <View style={styles.statCard}>
                  <Text style={styles.statIcon}>🏁</Text>
                  <Text style={styles.statValue}> {maxSpeed.toFixed(1)} km/h</Text>
                  <Text style={styles.statLabel}>Maximum speed</Text>
                </View>

                <View style={styles.statCard}>
                  <Text style={styles.statIcon}>📊</Text>
                  <Text style={styles.statValue}>{liveAverageSpeed.toFixed(1)} km/h</Text>
                  <Text style={styles.statLabel}>Average speed</Text>
                </View>

                <View style={styles.statCard}>
                  <Text style={styles.statIcon}>⏱️</Text>
                  <Text style={styles.statValue}>{formatDuration(durationSeconds)}</Text>
                  <Text style={styles.statLabel}>Duration</Text>
                </View>
              </View>

              <View style={styles.statCard}>
                <Text style={styles.statIcon}>📍</Text>
                <Text style={styles.statValue}>
                  {distanceKm.toFixed(2)} km
                </Text>
                <Text style={styles.statLabel}>Current run distance</Text>
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
      ) : (
        <RunningHistoryScreen />
      )}

      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={styles.navButton}
          onPress={() => setActiveTab('home')}
        >
          <Text style={activeTab === 'home' ? styles.activeNavText : styles.navText}>
            🏠 Home
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navButton}
          onPress={() => setActiveTab('history')}
        >
          <Text style={activeTab === 'history' ? styles.activeNavText : styles.navText}>
            📋 History
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
) {
  const earthRadius = 6371;

  const toRadians = (value: number) =>
    (value * Math.PI) / 180;

  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
    Math.cos(toRadians(lat2)) *
    Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadius * c;
}

function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  return [
    hours,
    minutes,
    remainingSeconds,
  ]
    .map((value) => String(value).padStart(2, '0'))
    .join(':');
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
  appContainer: {
  flex: 1,
  backgroundColor: '#101827',
},

bottomNav: {
  flexDirection: 'row',
  backgroundColor: '#1E293B',
  paddingVertical: 15,
  paddingBottom: 25,
  justifyContent: 'space-around',
  borderTopWidth: 1,
  borderTopColor: '#334155',
},

navButton: {
  flex: 1,
  alignItems: 'center',
},

navText: {
  color: '#94A3B8',
  fontSize: 14,
  fontWeight: '600',
},

activeNavText: {
  color: '#4ADE80',
  fontSize: 14,
  fontWeight: 'bold',
},
});
