
import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';

import MapView, {
  Marker,
  Polyline,
  Region,
} from 'react-native-maps';

// Ride data structure
export interface Ride {
  id: number;
  recorded_at: string;
  distance_km: number;
  duration_seconds: number;
  average_speed: number;
  max_speed: number;
  route_coordinates: string | null;
}

interface RideDetailsScreenProps {
  ride: Ride;
  onBack: () => void;
}

interface Coordinate {
  latitude: number;
  longitude: number;
}

const RideDetailsScreen: React.FC<RideDetailsScreenProps> = ({
  ride,
  onBack,
}) => {
  // Convert saved JSON route into coordinates
  const routeCoordinates: Coordinate[] = useMemo(() => {
    try {
      if (!ride.route_coordinates) {
        return [];
      }

      const parsed = JSON.parse(ride.route_coordinates);

      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed.filter(
        (point: any) =>
          Number.isFinite(point.latitude) &&
          Number.isFinite(point.longitude)
      );
    } catch (error) {
      console.error('Unable to parse ride route:', error);
      return [];
    }
  }, [ride.route_coordinates]);

  // Calculate map region from route points
  const mapRegion: Region | undefined = useMemo(() => {
    if (routeCoordinates.length === 0) {
      return undefined;
    }

    const latitudes = routeCoordinates.map(
      point => point.latitude
    );

    const longitudes = routeCoordinates.map(
      point => point.longitude
    );

    const minLat = Math.min(...latitudes);
    const maxLat = Math.max(...latitudes);
    const minLng = Math.min(...longitudes);
    const maxLng = Math.max(...longitudes);

    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: Math.max((maxLat - minLat) * 1.5, 0.005),
      longitudeDelta: Math.max((maxLng - minLng) * 1.5, 0.005),
    };
  }, [routeCoordinates]);

  // Format duration
  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }

    return `${minutes}m ${remainingSeconds}s`;
  };

  // Format recorded date
  const formattedDate = new Date(
    ride.recorded_at
  ).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  // Reusable statistic card
  const StatCard = ({
    label,
    value,
    unit,
  }: {
    label: string;
    value: string;
    unit?: string;
  }) => (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>

      <View style={styles.statValueContainer}>
        <Text style={styles.statValue}>{value}</Text>
        {unit ? (
          <Text style={styles.statUnit}>{unit}</Text>
        ) : null}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={onBack}
          style={styles.backButton}
        >
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Ride Details</Text>

        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Ride date */}
        <View style={styles.dateContainer}>
          <Text style={styles.dateLabel}>RIDE RECORDED</Text>
          <Text style={styles.dateText}>{formattedDate}</Text>
        </View>

        {/* Route Map */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Your Route
          </Text>

          {routeCoordinates.length > 0 && mapRegion ? (
            <View style={styles.mapContainer}>
              <MapView
                style={styles.map}
                initialRegion={mapRegion}
                region={mapRegion}
                showsUserLocation={false}
                showsCompass
                showsScale
              >
                {/* Complete route */}
                <Polyline
                  coordinates={routeCoordinates}
                  strokeColor="#36D399"
                  strokeWidth={5}
                />

                {/* Starting point */}
                <Marker
                  coordinate={routeCoordinates[0]}
                  title="Start"
                  description="Ride starting point"
                  pinColor="green"
                />

                {/* Ending point */}
                <Marker
                  coordinate={
                    routeCoordinates[
                      routeCoordinates.length - 1
                    ]
                  }
                  title="Finish"
                  description="Ride ending point"
                  pinColor="red"
                />
              </MapView>
            </View>
          ) : (
            <View style={styles.noMapContainer}>
              <Text style={styles.noMapTitle}>
                Route unavailable
              </Text>
              <Text style={styles.noMapText}>
                GPS route coordinates were not saved
                for this ride.
              </Text>
            </View>
          )}
        </View>

        {/* Main distance card */}
        <View style={styles.distanceCard}>
          <Text style={styles.distanceLabel}>
            TOTAL DISTANCE
          </Text>

          <View style={styles.distanceValueContainer}>
            <Text style={styles.distanceValue}>
              {Number(ride.distance_km).toFixed(2)}
            </Text>

            <Text style={styles.distanceUnit}>km</Text>
          </View>
        </View>

        {/* Statistics */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Ride Statistics
          </Text>

          <View style={styles.statsGrid}>
            <StatCard
              label="Duration"
              value={formatDuration(
                ride.duration_seconds
              )}
            />

            <StatCard
              label="Average Speed"
              value={Number(
                ride.average_speed
              ).toFixed(2)}
              unit="km/h"
            />

            <StatCard
              label="Maximum Speed"
              value={Number(
                ride.max_speed
              ).toFixed(2)}
              unit="km/h"
            />

            <StatCard
              label="GPS Points"
              value={String(routeCoordinates.length)}
            />
          </View>
        </View>

        {/* Ride ID */}
        <View style={styles.rideInfo}>
          <Text style={styles.rideInfoLabel}>
            Ride ID
          </Text>

          <Text style={styles.rideInfoValue}>
            #{ride.id}
          </Text>
        </View>

      </ScrollView>
    </View>
  );
};

export default RideDetailsScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#101820',
  },

  header: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#263440',
  },

  backButton: {
    paddingVertical: 8,
    minWidth: 65,
  },

  backText: {
    color: '#36D399',
    fontSize: 16,
    fontWeight: '600',
  },

  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },

  headerSpacer: {
    width: 65,
  },

  scrollContent: {
    padding: 16,
    paddingBottom: 35,
  },

  dateContainer: {
    marginBottom: 20,
  },

  dateLabel: {
    color: '#82919D',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 1,
  },

  dateText: {
    color: '#FFFFFF',
    fontSize: 16,
    marginTop: 6,
  },

  section: {
    marginBottom: 22,
  },

  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 14,
  },

  mapContainer: {
    height: 250,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#263440',
  },

  map: {
    flex: 1,
  },

  noMapContainer: {
    height: 160,
    borderRadius: 16,
    backgroundColor: '#1B2933',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },

  noMapTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },

  noMapText: {
    color: '#82919D',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
  },

  distanceCard: {
    backgroundColor: '#1B2933',
    padding: 22,
    borderRadius: 18,
    marginBottom: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#263E49',
  },

  distanceLabel: {
    color: '#82919D',
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 1,
  },

  distanceValueContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 8,
  },

  distanceValue: {
    color: '#36D399',
    fontSize: 46,
    fontWeight: 'bold',
  },

  distanceUnit: {
    color: '#36D399',
    fontSize: 18,
    marginLeft: 8,
  },

  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },

  statCard: {
    width: '48%',
    backgroundColor: '#1B2933',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    minHeight: 95,
  },

  statLabel: {
    color: '#82919D',
    fontSize: 12,
    marginBottom: 12,
  },

  statValueContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
  },

  statValue: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
  },

  statUnit: {
    color: '#36D399',
    fontSize: 12,
    marginLeft: 5,
  },

  rideInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#263440',
    paddingTop: 18,
    marginTop: 5,
  },

  rideInfoLabel: {
    color: '#82919D',
    fontSize: 14,
  },

  rideInfoValue: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
});
