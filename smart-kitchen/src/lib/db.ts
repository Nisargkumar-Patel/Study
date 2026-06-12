/**
 * db.ts — Cached Mongoose connection for the Next.js serverless runtime.
 *
 * In a serverless / hot-reload environment a new module evaluation can happen on
 * every request, which would open a new DB connection each time and exhaust the
 * MongoDB connection pool. We cache the connection promise on the Node global so
 * it survives across invocations within the same warm container.
 */
import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/smart_kitchen';

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const globalForMongoose = global as unknown as { _mongoose?: MongooseCache };

const cached: MongooseCache = globalForMongoose._mongoose || { conn: null, promise: null };
globalForMongoose._mongoose = cached;

export async function connectDB(): Promise<typeof mongoose> {
  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI, {
      bufferCommands: false,
      maxPoolSize: 10,
    });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}

export default connectDB;
