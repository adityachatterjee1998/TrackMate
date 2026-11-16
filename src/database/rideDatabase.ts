import * as SQLite from 'expo-sqlite';

const database = SQLite.openDatabaseAsync('trackmate.db');

export type Ride = {
  id: number;
  recorded_at: string;
  distance_km: number;
  duration_seconds: number;
  average_speed: number;
  max_speed: number;
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
      max_speed REAL NOT NULL
    );
  `);
}

export async function saveRide(ride: Omit<Ride, 'id'>) {
  const db = await database;

  await db.runAsync(
    `INSERT INTO rides
    (recorded_at, distance_km, duration_seconds, average_speed, max_speed)
    VALUES (?, ?, ?, ?, ?)`,
    ride.recorded_at,
    ride.distance_km,
    ride.duration_seconds,
    ride.average_speed,
    ride.max_speed
  );
}

export async function getSavedRides(): Promise<Ride[]> {
  const db = await database;

  return db.getAllAsync<Ride>(
    'SELECT * FROM rides ORDER BY id DESC'
  );
}