
import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';

import {
  getActiveRecording,
  saveActiveRecording,
} from '../database/rideDatabase';

export const BACKGROUND_LOCATION_TASK =
  'TRACKMATE_BACKGROUND_LOCATION';

// Calculate distance between two GPS coordinates
function calculateDistance(lat1, lon1, lat2, lon2) {
  const earthRadius = 6371;

  const toRadians = value => (value * Math.PI) / 180;

  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) ** 2;

  return earthRadius * 2 *
    Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Define task at module level.
// Android can execute this task outside the visible app.
TaskManager.defineTask(
  BACKGROUND_LOCATION_TASK,
  async ({ data, error }) => {
    if (error) {
      console.error('Background GPS error:', error);
      return;
    }

    const locations = data?.locations ?? [];

    if (locations.length === 0) {
      return;
    }

    try {
      const recording = await getActiveRecording();

      if (!recording || recording.is_active !== 1) {
        return;
      }

      let distance = recording.distance_km;
      let maxSpeed = recording.max_speed;

      let lastLatitude = recording.last_latitude;
      let lastLongitude = recording.last_longitude;
      let lastTimestamp = recording.last_location_timestamp;

      let routeCoordinates = [];

      try {
        routeCoordinates = JSON.parse(
          recording.route_coordinates || '[]'
        );
      } catch {
        routeCoordinates = [];
      }

      for (const location of locations) {
        const coords = location.coords;

        // Reject inaccurate GPS readings
        if (
          coords.accuracy === null ||
          coords.accuracy > 20
        ) {
          continue;
        }

        // First valid GPS point
        if (
          lastLatitude === null ||
          lastLongitude === null
        ) {
          lastLatitude = coords.latitude;
          lastLongitude = coords.longitude;
          lastTimestamp = location.timestamp;

          routeCoordinates.push({
            latitude: coords.latitude,
            longitude: coords.longitude,
          });

          continue;
        }

        const segmentDistance = calculateDistance(
          lastLatitude,
          lastLongitude,
          coords.latitude,
          coords.longitude
        );

        // Ignore unusually large GPS jumps
        if (segmentDistance > 0.1) {
          continue;
        }

        // Ignore small GPS fluctuations
        // Keep the previous accepted point as the reference
        if (segmentDistance < 0.005) {
          continue;
        }

        distance += segmentDistance;

        const speed = Math.max(
          0,
          (coords.speed ?? 0) * 3.6
        );

        // Update maximum speed only on accepted movement
        if (speed >= 1 && speed <= 40) {
          maxSpeed = Math.max(maxSpeed, speed);
        }

        routeCoordinates.push({
          latitude: coords.latitude,
          longitude: coords.longitude,
        });

        lastLatitude = coords.latitude;
        lastLongitude = coords.longitude;
        lastTimestamp = location.timestamp;
      }

      // Persist progress after processing the GPS batch
      await saveActiveRecording({
        start_time_ms: recording.start_time_ms,
        distance_km: distance,
        max_speed: maxSpeed,
        route_coordinates: JSON.stringify(routeCoordinates),
        last_latitude: lastLatitude,
        last_longitude: lastLongitude,
        last_location_timestamp: lastTimestamp,
        is_active: 1,
      });

      console.log(
        'Background GPS saved:',
        distance.toFixed(3),
        'km'
      );

    } catch (error) {
      console.error(
        'Unable to save background GPS:',
        error
      );
    }
  }
);
