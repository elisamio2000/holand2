// ============================================
// MongoDB Client â€” Singleton connection manager
// Connects to photo_tagger database for geo-location plugin
// ============================================

import { MongoClient, Db } from 'mongodb';


/**
 * MongoDB connection configuration.
 *
 * WHY separate file: Ensures a single shared connection pool
 * across all API routes, avoiding connection leaks in serverless.
 */

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = process.env.MONGODB_DB || 'photo_tagger';

// WHY global type: In dev, Next.js hot-reloads modules, which would
// create a new connection on every reload. Using global preserves it.
const globalWithMongo = global as typeof globalThis & {
  _mongoClientPromise?: Promise<MongoClient>;
};

/**
 * Get or create the MongoDB client connection promise (lazy).
 *
 * WHY lazy: Avoids connecting at module import time, which would
 * fail during Next.js static build when no DB is reachable.
 *
 * @returns Promise resolving to the connected MongoClient
 */
function getClientPromise(): Promise<MongoClient> {
  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI is not configured. Set it in apps/holand-web-app/.env.local');
  }

  if (globalWithMongo._mongoClientPromise) {
    return globalWithMongo._mongoClientPromise;
  }

  const client = new MongoClient(MONGODB_URI, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
  });

  const promise = client.connect();

  // WHY: If the connection fails (e.g. wrong password, server unreachable),
  // we must clear the cache so the next request retries a fresh connection
  // instead of returning the same rejected promise forever.
  promise.catch(() => {
    delete globalWithMongo._mongoClientPromise;
  });

  globalWithMongo._mongoClientPromise = promise;
  return globalWithMongo._mongoClientPromise;
}

/**
 * Get the MongoDB database instance.
 *
 * @returns The photo_tagger database
 */
export async function getDatabase(): Promise<Db> {
  const mongoClient = await getClientPromise();
  return mongoClient.db(MONGODB_DB);
}

export default getClientPromise;

