
import * as SQLite from 'expo-sqlite';

const database = SQLite.openDatabaseAsync('trackmate.db');

export type RouteCoordinate = {
  latitude: number;
  longitude: number;
};

export type Ride = {
  id: number;
  recorded_at: string;
  distance_km: number;
  duration_seconds: number;
  average_speed: number;
  max_speed: number;
  route_coordinates: string | null;
};

export type ActiveRecording = {
  id: number;
  start_time_ms: number;
  distance_km: number;
  max_speed: number;
  route_coordinates: string;
  last_latitude: number | null;
  last_longitude: number | null;
  last_location_timestamp: number | null;
  is_active: number;
};

export async function initRideDatabase() {
  const db = await database;

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS rides (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recorded_at TEXT NOT NULL,
      distance_km REAL NOT NULL,
      duration_seconds INTEGER NOT NULL,
      average_speed REAL NOT NULL,
      max_speed REAL NOT NULL,
      route_coordinates TEXT
    );

    CREATE TABLE IF NOT EXISTS active_recording (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      start_time_ms INTEGER NOT NULL,
      distance_km REAL NOT NULL DEFAULT 0,
      max_speed REAL NOT NULL DEFAULT 0,
      route_coordinates TEXT NOT NULL DEFAULT '[]',
      last_latitude REAL,
      last_longitude REAL,
      last_location_timestamp INTEGER,
      is_active INTEGER NOT NULL DEFAULT 1
    );
  `);

  // Safely upgrade existing rides databases
  const columns = await db.getAllAsync<{ name: string }>(
    'PRAGMA table_info(rides)'
  );

  const hasRouteColumn = columns.some(
    column => column.name === 'route_coordinates'
  );

  if (!hasRouteColumn) {
    await db.execAsync(`
      ALTER TABLE rides ADD COLUMN route_coordinates TEXT;
    `);
  }
}

// Save completed ride
export async function saveRide(
  ride: Omit<Ride, 'id' | 'route_coordinates'> & {
    route_coordinates?: string | null;
  }
) {
  const db = await database;

  await db.runAsync(
    `INSERT INTO rides
    (
      recorded_at,
      distance_km,
      duration_seconds,
      average_speed,
      max_speed,
      route_coordinates
    )
    VALUES (?, ?, ?, ?, ?, ?)`,
    ride.recorded_at,
    ride.distance_km,
    ride.duration_seconds,
    ride.average_speed,
    ride.max_speed,
    ride.route_coordinates ?? null
  );
}

// Retrieve completed rides
export async function getSavedRides(): Promise<Ride[]> {
  const db = await database;

  return db.getAllAsync<Ride>(
    'SELECT * FROM rides ORDER BY id DESC'
  );
}

// Save or update active recording
export async function saveActiveRecording(
  recording: Omit<ActiveRecording, 'id'>
) {
  const db = await database;

  await db.runAsync(
    `INSERT INTO active_recording (
      id,
      start_time_ms,
      distance_km,
      max_speed,
      route_coordinates,
      last_latitude,
      last_longitude,
      last_location_timestamp,
      is_active
    )
    VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      start_time_ms = excluded.start_time_ms,
      distance_km = excluded.distance_km,
      max_speed = excluded.max_speed,
      route_coordinates = excluded.route_coordinates,
      last_latitude = excluded.last_latitude,
      last_longitude = excluded.last_longitude,
      last_location_timestamp = excluded.last_location_timestamp,
      is_active = excluded.is_active`,
    recording.start_time_ms,
    recording.distance_km,
    recording.max_speed,
    recording.route_coordinates,
    recording.last_latitude,
    recording.last_longitude,
    recording.last_location_timestamp,
    recording.is_active
  );
}

// Retrieve unfinished recording
export async function getActiveRecording():
  Promise<ActiveRecording | null> {
  const db = await database;

  return db.getFirstAsync<ActiveRecording>(
    'SELECT * FROM active_recording WHERE id = 1 AND is_active = 1'
  );
}

// Clear active recording after successful completion
export async function clearActiveRecording() {
  const db = await database;

  await db.runAsync(
    'DELETE FROM active_recording WHERE id = 1'
  );
}
