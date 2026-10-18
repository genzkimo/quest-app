/**
 * Safe local persistence adapter for Quests using IndexedDB + Pruned LocalStorage Fallback.
 * Solves QuotaExceededError by offloading unbounded collections to IndexedDB and enforcing
 * aggressive pruning & try/catch safety on localStorage.
 */

import { Quest } from '../types';

const DB_NAME = 'QuestAppLocalDB';
const DB_VERSION = 1;
const STORE_NAME = 'quests_store';
const LS_QUESTS_KEY = 'quest_app_quests';
const MAX_PRUNED_LS_COUNT = 35; // Maximum quests kept in synchronous localStorage

// --- IndexedDB Lightweight Engine ---
let dbPromise: Promise<IDBDatabase> | null = null;

function getIndexedDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB not supported in this environment'));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: any) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = (event: any) => {
      resolve(event.target.result);
    };

    request.onerror = (event: any) => {
      console.warn('[questStorage] IndexedDB open error, falling back to safe LS:', event.target.error);
      reject(event.target.error);
    };
  });

  return dbPromise;
}

/**
 * Prunes a quest object to keep only critical display fields for synchronous localStorage caching.
 * Removes heavy data like large base64 proof images, oversized logs, and unnecessary nested buffers.
 */
function pruneQuestForLocalStorage(quest: Quest): Partial<Quest> {
  return {
    id: quest.id,
    title: quest.title,
    description: quest.description ? quest.description.slice(0, 500) : '',
    category: quest.category,
    status: quest.status,
    cashReward: quest.cashReward,
    pointsReward: quest.pointsReward,
    location: quest.location,
    lat: quest.lat,
    lng: quest.lng,
    createdAt: quest.createdAt,
    assignedAt: quest.assignedAt,
    creatorId: quest.creatorId,
    creatorName: quest.creatorName,
    creatorAvatar: quest.creatorAvatar,
    helperId: quest.helperId,
    assignedRunnerId: quest.assignedRunnerId,
    assignedRunnerIds: quest.assignedRunnerIds,
    applicants: (quest.applicants || []).slice(0, 10),
    jobApplicants: (quest.jobApplicants || []).slice(0, 10),
    archived: quest.archived,
    flagsCount: quest.flagsCount,
    questType: quest.questType,
    durationType: quest.durationType,
    salaryPeriod: quest.salaryPeriod,
    employmentType: quest.employmentType,
    // Note: proofImageUrl is intentionally excluded from localStorage to save megabytes
  };
}

/**
 * Safely writes to localStorage with automatic emergency cleanup if QuotaExceededError is encountered.
 */
export function safeLocalStorageSet(key: string, value: any): boolean {
  try {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    localStorage.setItem(key, serialized);
    return true;
  } catch (err: any) {
    const isQuotaError = 
      err?.name === 'QuotaExceededError' || 
      err?.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      err?.code === 22 ||
      err?.code === 1014 ||
      (err?.message && err.message.toLowerCase().includes('quota'));

    if (isQuotaError) {
      console.warn(`[questStorage] LocalStorage quota exceeded on key "${key}". Running emergency storage purge...`);
      try {
        // Remove high-volume legacy or transient cache keys
        localStorage.removeItem('quest_app_quests');
        localStorage.removeItem('quests_feed_refresh');
        localStorage.removeItem('quests_map_refresh');
        localStorage.removeItem('cached_geo_location');

        // If storing quests, attempt writing a highly-pruned minimal slice
        if (Array.isArray(value)) {
          const minimalList = value.slice(0, 15).map(pruneQuestForLocalStorage);
          localStorage.setItem(key, JSON.stringify(minimalList));
          return true;
        }
      } catch (recoveryErr) {
        console.error('[questStorage] Emergency storage recovery failed. Operating in-memory/IndexedDB only:', recoveryErr);
      }
    }
    return false;
  }
}

/**
 * Asynchronously saves the full, unpruned quests array to IndexedDB,
 * and safely caches a lightweight pruned slice in localStorage for instant synchronous boots.
 */
export async function saveQuestsLocally(quests: Quest[]): Promise<void> {
  if (!quests) return;

  // 1. Always attempt full persistence into IndexedDB
  try {
    const idb = await getIndexedDB();
    const tx = idb.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    
    // Clear old records and save current dataset
    store.clear();
    quests.forEach((q) => {
      if (q && q.id) {
        store.put(q);
      }
    });

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (idbErr) {
    console.warn('[questStorage] IndexedDB batch save warning:', idbErr);
  }

  // 2. Safely sync a pruned slice into localStorage without triggering QuotaExceededError
  try {
    const activeRecentQuests = quests
      .filter((q) => !q.archived && q.status !== 'cancelled_by_timeout' && q.status !== 'stale_cleared')
      .slice(0, MAX_PRUNED_LS_COUNT)
      .map(pruneQuestForLocalStorage);

    safeLocalStorageSet(LS_QUESTS_KEY, activeRecentQuests);
  } catch (lsErr) {
    console.warn('[questStorage] Pruned localStorage write failed gracefully:', lsErr);
  }
}

/**
 * Loads quests synchronously from localStorage (fast boot for initial render).
 */
export function loadQuestsLocallySync(): Quest[] {
  try {
    const raw = localStorage.getItem(LS_QUESTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('[questStorage] Could not parse sync quests from localStorage:', err);
    return [];
  }
}

/**
 * Asynchronously loads the complete dataset from IndexedDB with fallback to localStorage.
 */
export async function loadQuestsLocally(): Promise<Quest[]> {
  try {
    const idb = await getIndexedDB();
    const tx = idb.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();

    return await new Promise<Quest[]>((resolve) => {
      request.onsuccess = () => {
        const result = request.result || [];
        if (result.length > 0) {
          resolve(result as Quest[]);
        } else {
          // If IndexedDB was empty, fallback to localStorage
          resolve(loadQuestsLocallySync());
        }
      };
      request.onerror = () => {
        resolve(loadQuestsLocallySync());
      };
    });
  } catch (err) {
    return loadQuestsLocallySync();
  }
}
