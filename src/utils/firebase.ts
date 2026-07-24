import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

let dbInstance: any;
try {
  dbInstance = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager(),
    }),
    experimentalForceLongPolling: true,
  }, firebaseConfig.firestoreDatabaseId || '(default)');
} catch (cacheErr) {
  console.warn("Firestore persistent cache failed on this device/browser (often due to iframe sandbox or private mode). Falling back to standard non-cached initialization:", cacheErr);
  try {
    dbInstance = getFirestore(app);
  } catch (fallbackErr) {
    console.error("Firestore initialization failed completely:", fallbackErr);
    // Absolute fallback
    dbInstance = getFirestore();
  }
}

export const db = dbInstance;
export const auth = getAuth(app);
export const storage = getStorage(app);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export function cleanData<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(item => cleanData(item)) as unknown as T;
  }
  if (typeof obj === 'object') {
    const cleaned: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const value = obj[key];
        if (value !== undefined) {
          cleaned[key] = cleanData(value);
        }
      }
    }
    return cleaned as T;
  }
  return obj;
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errCode = error && typeof error === 'object' && 'code' in error ? (error as any).code : null;
  const errMsg = error instanceof Error ? error.message : String(error);

  const errInfo: FirestoreErrorInfo = {
    error: errMsg,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };

  const isPermissionOrAuthError = 
    errCode === 'permission-denied' || 
    errCode === 'unauthenticated' || 
    errMsg.toLowerCase().includes('permission') ||
    errMsg.toLowerCase().includes('insufficient');

  // Let's print detailed information in the console
  if (isPermissionOrAuthError) {
    console.error('Firestore Security Rule Violation: ', JSON.stringify(errInfo));
    throw new Error(JSON.stringify(errInfo));
  } else {
    // Normal connection failures or transient offline states are handled via Firestore's local cache
    console.warn(`[Firestore Status] Cache Sync status or transient connection error: ${errMsg} (code: ${errCode})`);
  }
}

// VALIDATE CONNECTION TO FIRESTORE ON BOOT
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.log(`[Firestore Boot Check] Network state on boot: ${errMsg} (this is normal if starting up or initially offline)`);
  }
}
testConnection();
