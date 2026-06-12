/**
 * idb.ts — Client-side IndexedDB wrapper (uses `idb`).
 *
 * The offline-first contract: the grocery list lives in IndexedDB so the user
 * can read it, check items off, and edit quantities inside a grocery store with
 * zero connectivity. A `mutations` queue records every offline change so the
 * sync layer can replay them against MongoDB once back online.
 */
'use client';

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

export interface GroceryItemRecord {
  id: string; // stable client id (name+source)
  name: string;
  amount: number;
  unit: string;
  display: string;
  source: string;
  pantryCategory: string;
  checked: boolean;
  booleanItem: boolean;
  updatedAt: number;
}

export interface QueuedMutation {
  id?: number; // auto-increment
  type: 'CHECK_ITEM' | 'UPDATE_AMOUNT' | 'ADD_MANUAL' | 'TOGGLE_SPICE';
  payload: Record<string, unknown>;
  createdAt: number;
  synced: boolean;
}

interface KitchenDB extends DBSchema {
  grocery: {
    key: string;
    value: GroceryItemRecord;
    indexes: { 'by-category': string };
  };
  mutations: {
    key: number;
    value: QueuedMutation;
    indexes: { 'by-synced': string };
  };
  meta: {
    key: string;
    value: { key: string; value: unknown };
  };
}

const DB_NAME = 'smart-kitchen';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<KitchenDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<KitchenDB>> {
  if (typeof window === 'undefined') {
    throw new Error('IndexedDB is only available in the browser.');
  }
  if (!dbPromise) {
    dbPromise = openDB<KitchenDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('grocery')) {
          const store = db.createObjectStore('grocery', { keyPath: 'id' });
          store.createIndex('by-category', 'pantryCategory');
        }
        if (!db.objectStoreNames.contains('mutations')) {
          const store = db.createObjectStore('mutations', {
            keyPath: 'id',
            autoIncrement: true,
          });
          // store synced as a string ("0"/"1") so it is a valid index key
          store.createIndex('by-synced', 'synced' as never);
        }
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta', { keyPath: 'key' });
        }
      },
    });
  }
  return dbPromise;
}

/** Replace the cached grocery list (e.g. after a fresh fetch online). */
export async function cacheGroceryList(items: GroceryItemRecord[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('grocery', 'readwrite');
  await tx.store.clear();
  for (const item of items) await tx.store.put(item);
  await tx.done;
}

export async function getGroceryList(): Promise<GroceryItemRecord[]> {
  const db = await getDB();
  return db.getAll('grocery');
}

/** Apply a local change and enqueue it for later sync. */
export async function applyLocalMutation(
  item: GroceryItemRecord,
  mutation: Omit<QueuedMutation, 'id' | 'createdAt' | 'synced'>
): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['grocery', 'mutations'], 'readwrite');
  await tx.objectStore('grocery').put({ ...item, updatedAt: Date.now() });
  await tx.objectStore('mutations').add({
    ...mutation,
    createdAt: Date.now(),
    synced: false,
  });
  await tx.done;
}

export async function getPendingMutations(): Promise<QueuedMutation[]> {
  const db = await getDB();
  const all = await db.getAll('mutations');
  return all.filter((m) => !m.synced);
}

export async function markMutationsSynced(ids: number[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('mutations', 'readwrite');
  for (const id of ids) {
    const m = await tx.store.get(id);
    if (m) await tx.store.put({ ...m, synced: true });
  }
  await tx.done;
}
