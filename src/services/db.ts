import { IDBPDatabase, openDB } from 'idb';

const DB_NAME = 'pocket_ai_db';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<any>>;

export function initDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('candles')) {
          db.createObjectStore('candles'); // key will be asset name
        }
        if (!db.objectStoreNames.contains('models')) {
          db.createObjectStore('models'); // key will be model identifier
        }
      },
    });
  }
  return dbPromise;
}

export async function saveCandlesLocal(asset: string, candles: any[]) {
  const db = await initDB();
  await db.put('candles', candles, asset);
}

export async function getCandlesLocal(asset: string): Promise<any[]> {
  const db = await initDB();
  const data = await db.get('candles', asset);
  return data || [];
}
