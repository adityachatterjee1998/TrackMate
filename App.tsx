
import React, { useEffect, useRef, useState } from 'react';

import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Alert,
  ScrollView,
} from 'react-native';

import * as Location from 'expo-location';

import {
  BACKGROUND_LOCATION_TASK,
} from './src/services/backgroundLocation';

import RunningHistoryScreen from './src/screens/HistoryScreen';

import RideDetailsScreen, {
  type Ride,
} from './src/screens/RideDetailsScreen';

import {
  initRideDatabase,
  saveRide,
  getSavedRides,
  saveActiveRecording,
  getActiveRecording,
  clearActiveRecording,
} from './src/database/rideDatabase';

export default function App() {
  // App navigation
  const [activeTab, setActiveTab] = useState<'home' | 'history'>('home');

  // Selected ride
  const [selectedRide, setSelectedRide] = useState<Ride | null>(null);

  // Tracking states
  const [isTracking, setIsTracking] = useState(false);

  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);

  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [distanceKm, setDistanceKm] = useState(0);
  const [totalDistance, setTotalDistance] = useState(0);
  const [maxSpeed, setMaxSpeed] = useState(0);
  const [durationSeconds, setDurationSeconds] = useState(0);

  // GPS references
  const routeCoordinatesRef = useRef<
    { latitude: number; longitude: number }[]
  >([]);

  const startTimeRef = useRef<number | null>(null);

  const lastLocationRef =
    useRef<Location.LocationObjectCoords | null>(null);

  const lastLocationTimestampRef = useRef<number | null>(null);

  const distanceRef = useRef(0);
  const maxSpeedRef = useRef(0);

  const smoothedSpeedRef = useRef(0);

  const locationSubscription =
    useRef<Location.LocationSubscription | null>(null);

  // GPS filtering configuration
  const GPS_MAX_ACCURACY = 20;
  const GPS_MIN_MOVEMENT = 3;
  const GPS_MAX_SPEED = 40;
  const SPEED_SMOOTHING_FACTOR = 0.25;

  // Start GPS tracking
  const startTracking = async () => {
    try {
      if (isTracking) return;

      const permission =
        await Location.requestForegroundPermissionsAsync();

      if (permission.status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please allow location access.'
        );
        return;
      }

      // Background permission
      const backgroundPermission =
        await Location.requestBackgroundPermissionsAsync();

      if (backgroundPermission.status !== 'granted') {
        Alert.alert(
          'Background Permission Required',
          'Please allow background location access to record your route when the screen is locked.'
        );
        return;
      }

      // Reset GPS references
      distanceRef.current = 0;
      maxSpeedRef.current = 0;
      smoothedSpeedRef.current = 0;

      lastLocationRef.current = null;
      lastLocationTimestampRef.current = null;

      routeCoordinatesRef.current = [];

      setDistanceKm(0);
      setMaxSpeed(0);
      setDurationSeconds(0);
      setCurrentSpeed(0);

      setLatitude(null);
      setLongitude(null);
      setAccuracy(null);

      startTimeRef.current = Date.now();

      // Initialize active recording
      await saveActiveRecording({
        start_time_ms: startTimeRef.current,
        distance_km: 0,
        max_speed: 0,
        route_coordinates: '[]',
        last_latitude: null,
        last_longitude: null,
        last_location_timestamp: null,
        is_active: 1,
      });

      // Start background GPS tracking
      const backgroundStarted =
        await Location.hasStartedLocationUpdatesAsync(
          BACKGROUND_LOCATION_TASK
        );

      if (!backgroundStarted) {
        await Location.startLocationUpdatesAsync(
          BACKGROUND_LOCATION_TASK,
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 2000,
            distanceInterval: 2,
            pausesUpdatesAutomatically: false,

            foregroundService: {
              notificationTitle: 'TrackMate is recording',
              notificationBody:
                'Your running or cycling route is being recorded.',
              notificationColor: '#2196F3',
            },
          }
        );
      }

      // Foreground GPS watcher
      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 2000,
          distanceInterval: 2,
        },
        (location) => {
          const coords = location.coords;

          // --------------------------------
          // STEP 1: Accuracy filtering
          // --------------------------------

          if (
            coords.accuracy === null ||
            coords.accuracy > GPS_MAX_ACCURACY
          ) {
            return;
          }

          if (
            !Number.isFinite(coords.latitude) ||
            !Number.isFinite(coords.longitude)
          ) {
            return;
          }

          // --------------------------------
          // STEP 2: Timestamp filtering
          // --------------------------------

          const currentTimestamp = location.timestamp;

          const previousTimestamp =
            lastLocationTimestampRef.current;

          if (
            previousTimestamp !== null &&
            currentTimestamp <= previousTimestamp
          ) {
            return;
          }

          // --------------------------------
          // STEP 3: Speed smoothing
          // --------------------------------

          const rawSpeed = coords.speed;

          if (
            coords.accuracy <= 15 &&
            rawSpeed !== null &&
            Number.isFinite(rawSpeed) &&
            rawSpeed >= 0
          ) {
            const speedKmh = rawSpeed * 3.6;

            if (speedKmh <= GPS_MAX_SPEED) {
              const smoothedSpeed =
                smoothedSpeedRef.current +
                SPEED_SMOOTHING_FACTOR *
                  (speedKmh - smoothedSpeedRef.current);

              smoothedSpeedRef.current =
                smoothedSpeed < 0.8 ? 0 : smoothedSpeed;

              setCurrentSpeed(smoothedSpeedRef.current);

              // Update maximum speed
              if (
                smoothedSpeedRef.current > maxSpeedRef.current
              ) {
                maxSpeedRef.current =
                  smoothedSpeedRef.current;

                setMaxSpeed(smoothedSpeedRef.current);
              }
            }
          }

          // --------------------------------
          // STEP 4: First valid GPS location
          // --------------------------------

          const previousLocation = lastLocationRef.current;

          if (!previousLocation) {
            lastLocationRef.current = coords;

            lastLocationTimestampRef.current =
              currentTimestamp;

            routeCoordinatesRef.current.push({
              latitude: coords.latitude,
              longitude: coords.longitude,
            });

            setLatitude(coords.latitude);
            setLongitude(coords.longitude);
            setAccuracy(coords.accuracy);

            return;
          }

          // --------------------------------
          // STEP 5: Calculate movement
          // --------------------------------

          const segmentDistanceKm = calculateDistance(
            previousLocation.latitude,
            previousLocation.longitude,
            coords.latitude,
            coords.longitude
          );

          // Convert kilometres to metres for GPS filtering
          const segmentDistanceMeters = segmentDistanceKm * 1000;

          const previousTimestampValue =
            lastLocationTimestampRef.current ?? currentTimestamp;

          const elapsedSeconds = Math.max(
            (currentTimestamp - previousTimestampValue) / 1000,
            1
          );

          // --------------------------------
          // STEP 6: Reject unrealistic jumps
          // --------------------------------

          const previousAccuracy =
            previousLocation.accuracy ?? 10;

          const allowedDistanceMeters = Math.max(
            20,
            elapsedSeconds * 12 +
              previousAccuracy * 0.5 +
              coords.accuracy * 0.5
          );

          if (segmentDistanceMeters > allowedDistanceMeters) {
            console.log(
              'GPS jump rejected:',
              segmentDistanceMeters.toFixed(2),
              'metres'
            );

            return;
          }

          // --------------------------------
          // STEP 7: Ignore GPS drift
          // --------------------------------

          if (segmentDistanceMeters < GPS_MIN_MOVEMENT) {
            return;
          }

          // --------------------------------
          // STEP 8: Accept valid GPS movement
          // --------------------------------

          // Distance is already in kilometres
          distanceRef.current += segmentDistanceKm;

          setDistanceKm(distanceRef.current);

          lastLocationRef.current = coords;

          lastLocationTimestampRef.current =
            currentTimestamp;

          // Add accepted location to route
          routeCoordinatesRef.current.push({
            latitude: coords.latitude,
            longitude: coords.longitude,
          });

          // Update displayed GPS information
          setLatitude(coords.latitude);
          setLongitude(coords.longitude);
          setAccuracy(coords.accuracy);
        }
      );

      locationSubscription.current = subscription;

      setIsTracking(true);

    } catch (error) {
      Alert.alert(
        'GPS Error',
        String(error)
      );
    }
  };

  // Stop GPS tracking and save ride
  const stopTracking = async () => {
    try {
      // Stop foreground GPS
      locationSubscription.current?.remove();
      locationSubscription.current = null;

      // Stop background GPS
      const backgroundStarted =
        await Location.hasStartedLocationUpdatesAsync(
          BACKGROUND_LOCATION_TASK
        );

      if (backgroundStarted) {
        await Location.stopLocationUpdatesAsync(
          BACKGROUND_LOCATION_TASK
        );
      }

      setIsTracking(false);
      setCurrentSpeed(0);

      // Retrieve SQLite recording
      const recording = await getActiveRecording();

      if (!recording && startTimeRef.current === null) {
        return;
      }

      const startTime =
        recording?.start_time_ms ?? startTimeRef.current;

      if (startTime === null) {
        return;
      }

      const duration = Math.floor(
        (Date.now() - startTime) / 1000
      );

      // Prefer background recording data
      const distance =
        recording?.distance_km ?? distanceRef.current;

      const maximumSpeed =
        recording?.max_speed ?? maxSpeedRef.current;

      const routeCoordinates = recording
        ? recording.route_coordinates
        : JSON.stringify(routeCoordinatesRef.current);

      const averageSpeed =
        duration > 0
          ? (distance / duration) * 3600
          : 0;

      // Save completed ride
      await saveRide({
        recorded_at: new Date(startTime).toISOString(),
        distance_km: distance,
        duration_seconds: duration,
        average_speed: averageSpeed,
        max_speed: maximumSpeed,
        route_coordinates: routeCoordinates,
      });

      // Clear unfinished recording
      await clearActiveRecording();

      // Refresh lifetime distance
      const rides = await getSavedRides();

      const total = rides.reduce(
        (sum, ride) => sum + ride.distance_km,
        0
      );

      setTotalDistance(total);
      setDistanceKm(distance);
      setMaxSpeed(maximumSpeed);
      setDurationSeconds(duration);

      Alert.alert(
        'Run Saved Successfully!',
        `Distance: ${distance.toFixed(2)} km\nDuration: ${duration} seconds\nAverage Speed: ${averageSpeed.toFixed(2)} km/h`
      );

      startTimeRef.current = null;

    } catch (error) {
      Alert.alert(
        'Recording Error',
        'Could not stop or save your recording: ' +
          String(error)
      );
    }
  };

  // Live average speed
  const liveAverageSpeed =
    durationSeconds > 0
      ? (distanceKm / durationSeconds) * 3600
      : 0;

  // Cleanup GPS subscription
  useEffect(() => {
    return () => {
      locationSubscription.current?.remove();
    };
  }, []);

  // Update running duration every second
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

  // Initialize database and load saved rides
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

      {/* Ride Details Screen */}
      {selectedRide ? (
        <RideDetailsScreen
          ride={selectedRide}
          onBack={() => setSelectedRide(null)}
        />
      ) : activeTab === 'home' ? (

        /* HOME SCREEN */
        <>
          <View style={styles.container}>
            <StatusBar
              barStyle="light-content"
            />

            <ScrollView contentContainerStyle={styles.content}>

              {/* Header */}
              <View style={styles.header}>
                <View>
                  <Text style={styles.logo}>TRACKMATE</Text>
                  <Text style={styles.subtitle}>
                    Your journey, your pace.
                  </Text>
                </View>

                <Text style={styles.profile}>🚴</Text>
              </View>

              {/* Welcome */}
              <Text style={styles.welcome}>
                Ready to ride?
              </Text>

              <Text style={styles.description}>
                Every kilometre is a new achievement.
              </Text>

              {/* Main Distance Card */}
              <View style={styles.distanceCard}>
                <Text style={styles.cardLabel}>
                  TOTAL DISTANCE
                </Text>

                <View style={styles.distanceRow}>
                  <Text style={styles.distance}>
                    {totalDistance.toFixed(2)}
                  </Text>

                  <Text style={styles.unit}> km</Text>
                </View>

                <Text style={styles.muted}>
                  Your next adventure starts here
                </Text>
              </View>

              {/* Statistics */}
              <Text style={styles.sectionTitle}>
                Ride statistics
              </Text>

              <View style={styles.statsGrid}>

                <View style={styles.statCard}>
                  <Text style={styles.statIcon}>⚡</Text>

                  <Text style={styles.statValue}>
                    {currentSpeed.toFixed(1)} km/h
                  </Text>

                  <Text style={styles.statLabel}>
                    Current speed
                  </Text>
                </View>

                <View style={styles.statCard}>
                  <Text style={styles.statIcon}>🏁</Text>

                  <Text style={styles.statValue}>
                    {maxSpeed.toFixed(1)} km/h
                  </Text>

                  <Text style={styles.statLabel}>
                    Maximum speed
                  </Text>
                </View>

                <View style={styles.statCard}>
                  <Text style={styles.statIcon}>📊</Text>

                  <Text style={styles.statValue}>
                    {liveAverageSpeed.toFixed(1)} km/h
                  </Text>

                  <Text style={styles.statLabel}>
                    Average speed
                  </Text>
                </View>

                <View style={styles.statCard}>
                  <Text style={styles.statIcon}>⏱️</Text>

                  <Text style={styles.statValue}>
                    {formatDuration(durationSeconds)}
                  </Text>

                  <Text style={styles.statLabel}>
                    Duration
                  </Text>
                </View>

              </View>

              {/* Current Run Distance */}
              <View style={styles.statCard}>
                <Text style={styles.statIcon}>📍</Text>

                <Text style={styles.statValue}>
                  {distanceKm.toFixed(2)} km
                </Text>

                <Text style={styles.statLabel}>
                  Current run distance
                </Text>
              </View>

              {/* Start / Stop Button */}
              <TouchableOpacity
                style={styles.startButton}
                onPress={
                  isTracking ? stopTracking : startTracking
                }
                activeOpacity={0.8}
              >
                <Text style={styles.startButtonText}>
                  {isTracking
                    ? '■ STOP TRACKING'
                    : '▶ START RECORDING'}
                </Text>
              </TouchableOpacity>

              <Text style={styles.footer}>
                TRACKMATE • EXPLORE MORE
              </Text>

              {/* Live GPS Information */}
              <View style={styles.distanceCard}>
                <Text style={styles.cardLabel}>
                  LIVE GPS INFORMATION
                </Text>

                <Text style={styles.statLabel}>
                  Latitude
                </Text>

                <Text style={styles.statValue}>
                  {latitude !== null
                    ? latitude.toFixed(6)
                    : 'Waiting for GPS'}
                </Text>

                <Text style={styles.statLabel}>
                  Longitude
                </Text>

                <Text style={styles.statValue}>
                  {longitude !== null
                    ? longitude.toFixed(6)
                    : 'Waiting for GPS'}
                </Text>

                <Text style={styles.statLabel}>
                  GPS Accuracy
                </Text>

                <Text style={styles.statValue}>
                  {accuracy !== null
                    ? `${accuracy.toFixed(1)} metres`
                    : '--'}
                </Text>

                <Text style={styles.statLabel}>
                  Current GPS Speed
                </Text>

                <Text style={styles.statValue}>
                  {currentSpeed.toFixed(1)} km/h
                </Text>
              </View>

            </ScrollView>
          </View>
        </>

      ) : (

        /* HISTORY SCREEN */
        <RunningHistoryScreen
          onRidePress={(ride) => {
            setSelectedRide(ride);
          }}
        />

      )}

      {/* Bottom Navigation */}
      {!selectedRide && (
        <View style={styles.bottomNav}>

          <TouchableOpacity
            style={styles.navButton}
            onPress={() => setActiveTab('home')}
          >
            <Text
              style={
                activeTab === 'home'
                  ? styles.activeNavText
                  : styles.navText
              }
            >
              🏠 Home
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navButton}
            onPress={() => setActiveTab('history')}
          >
            <Text
              style={
                activeTab === 'history'
                  ? styles.activeNavText
                  : styles.navText
              }
            >
              📋 History
            </Text>
          </TouchableOpacity>

        </View>
      )}

    </View>
  );
}

// Calculate distance between two GPS coordinates
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

  const c =
    2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadius * c;
}

// Format duration into HH:MM:SS
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

// Styles
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
