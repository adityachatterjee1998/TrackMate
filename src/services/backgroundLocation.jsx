
import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';

import {
  getActiveRecording,
  saveActiveRecording,
} from '../database/rideDatabase';

export const BACKGROUND_LOCATION_TASK =
  'TRACKMATE_BACKGROUND_LOCATION';

// GPS filtering configuration
const GPS_MAX_ACCURACY = 20;
const GPS_MIN_MOVEMENT = 3;
const GPS_MAX_SPEED = 40;

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

// Validate GPS coordinates
function isValidCoordinates(coords) {
  return (
    Number.isFinite(coords.latitude) &&
    Number.isFinite(coords.longitude) &&
    coords.latitude >= -90 &&
    coords.latitude <= 90 &&
    coords.longitude >= -180 &&
    coords.longitude <= 180
  );
}

// Define background GPS task at module level
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
      // Get active recording from SQLite
      const recording = await getActiveRecording();

      if (!recording || recording.is_active !== 1) {
        return;
      }

      let distance = recording.distance_km;
      let maxSpeed = recording.max_speed;

      let lastLatitude = recording.last_latitude;
      let lastLongitude = recording.last_longitude;
      let lastTimestamp = recording.last_location_timestamp;

      // Restore previously recorded route
      let routeCoordinates = [];

      try {
        routeCoordinates = JSON.parse(
          recording.route_coordinates || '[]'
        );

        if (!Array.isArray(routeCoordinates)) {
          routeCoordinates = [];
        }
      } catch {
        routeCoordinates = [];
      }

      // Process GPS locations
      for (const location of locations) {
        const coords = location.coords;

        // --------------------------------
        // STEP 1: Accuracy filtering
        // --------------------------------

        if (
          coords.accuracy === null ||
          !Number.isFinite(coords.accuracy) ||
          coords.accuracy > GPS_MAX_ACCURACY
        ) {
          continue;
        }

        // --------------------------------
        // STEP 2: Coordinate validation
        // --------------------------------

        if (!isValidCoordinates(coords)) {
          continue;
        }

        // --------------------------------
        // STEP 3: Timestamp validation
        // --------------------------------

        const currentTimestamp = location.timestamp;

        if (
          !Number.isFinite(currentTimestamp)
        ) {
          continue;
        }

        if (
          lastTimestamp !== null &&
          currentTimestamp <= lastTimestamp
        ) {
          continue;
        }

        // --------------------------------
        // STEP 4: First valid GPS point
        // --------------------------------

        if (
          lastLatitude === null ||
          lastLongitude === null
        ) {
          lastLatitude = coords.latitude;
          lastLongitude = coords.longitude;
          lastTimestamp = currentTimestamp;

          routeCoordinates.push({
            latitude: coords.latitude,
            longitude: coords.longitude,
          });

          continue;
        }

        // --------------------------------
        // STEP 5: Calculate movement
        // --------------------------------

        const segmentDistance = calculateDistance(
          lastLatitude,
          lastLongitude,
          coords.latitude,
          coords.longitude
        );

        const elapsedSeconds = Math.max(
          (currentTimestamp - lastTimestamp) / 1000,
          1
        );

        // --------------------------------
        // STEP 6: Reject unrealistic jumps
        // --------------------------------

        const previousAccuracy = 10;

        const allowedDistance = Math.max(
          20,
          elapsedSeconds * 12 +
            previousAccuracy * 0.5 +
            coords.accuracy * 0.5
        );

        if (segmentDistance > allowedDistance) {
          console.log(
            'Background GPS jump rejected:',
            segmentDistance.toFixed(2),
            'metres'
          );

          continue;
        }

        // --------------------------------
        // STEP 7: Ignore GPS drift
        // --------------------------------

        if (segmentDistance < GPS_MIN_MOVEMENT) {
          continue;
        }

        // --------------------------------
        // STEP 8: Accept valid movement
        // --------------------------------

        distance += segmentDistance / 1000;

        // Update maximum speed
        if (
          coords.accuracy <= 15 &&
          coords.speed !== null &&
          Number.isFinite(coords.speed)
        ) {
          const speed = coords.speed * 3.6;

          if (
            speed >= 1 &&
            speed <= GPS_MAX_SPEED
          ) {
            maxSpeed = Math.max(maxSpeed, speed);
          }
        }

        // Save accepted route coordinate
        routeCoordinates.push({
          latitude: coords.latitude,
          longitude: coords.longitude,
        });

        // Update last accepted location
        lastLatitude = coords.latitude;
        lastLongitude = coords.longitude;
        lastTimestamp = currentTimestamp;
      }

      // --------------------------------
      // STEP 9: Save recording to SQLite
      // --------------------------------

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
