import type {
  Exercise,
  TrainingDay,
  WeekSchedule,
  WorkoutExercise,
} from "$lib/types";

const databaseName = "pulse";
const databaseVersion = 1;
const storeName = "ledger";
const ledgerKey = "current";
const pendingBackupKey = "automatic-backup-pending";
const fallbackKey = "pulse-ledger-v2";
const legacyFallbackKey = "pulse-push-strength-v1";

export type StoredLedger = {
  workouts: Record<string, WorkoutExercise[]>;
  days: TrainingDay[];
  activeDayId: string;
  theme: string;
  accent: string;
  exercises: Exercise[];
  schedule: WeekSchedule;
};

let databasePromise: Promise<IDBDatabase> | undefined;
let writeQueue = Promise.resolve();
let pendingLedger: StoredLedger | null = null;
let ledgerWriterRunning = false;
let backupStorageQueue = Promise.resolve();

function openDatabase(): Promise<IDBDatabase> {
  if (databasePromise) return databasePromise;

  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, databaseVersion);

    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(storeName)) {
        request.result.createObjectStore(storeName);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Could not open offline storage."));
    request.onblocked = () =>
      reject(new Error("Offline storage upgrade was blocked."));
  });

  return databasePromise;
}

function readFromDatabase(): Promise<unknown | null> {
  return openDatabase().then(
    (database) =>
      new Promise((resolve, reject) => {
        const transaction = database.transaction(storeName, "readonly");
        const request = transaction.objectStore(storeName).get(ledgerKey);
        request.onsuccess = () => resolve(request.result ?? null);
        request.onerror = () =>
          reject(request.error ?? new Error("Could not read offline storage."));
      }),
  );
}

function writeToDatabase(ledger: StoredLedger): Promise<void> {
  return writeValueToDatabase(ledgerKey, ledger);
}

function writeValueToDatabase(key: string, value: unknown): Promise<void> {
  return openDatabase().then(
    (database) =>
      new Promise((resolve, reject) => {
        const transaction = database.transaction(storeName, "readwrite");
        transaction.objectStore(storeName).put(value, key);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () =>
          reject(
            transaction.error ?? new Error("Could not save offline data."),
          );
        transaction.onabort = () =>
          reject(transaction.error ?? new Error("Offline save was cancelled."));
      }),
  );
}

function deleteValueFromDatabase(key: string): Promise<void> {
  return openDatabase().then(
    (database) =>
      new Promise((resolve, reject) => {
        const transaction = database.transaction(storeName, "readwrite");
        transaction.objectStore(storeName).delete(key);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () =>
          reject(
            transaction.error ?? new Error("Could not clear offline data."),
          );
        transaction.onabort = () =>
          reject(
            transaction.error ?? new Error("Offline clear was cancelled."),
          );
      }),
  );
}

function readValueFromDatabase(key: string): Promise<unknown | null> {
  return openDatabase().then(
    (database) =>
      new Promise((resolve, reject) => {
        const transaction = database.transaction(storeName, "readonly");
        const request = transaction.objectStore(storeName).get(key);
        request.onsuccess = () => resolve(request.result ?? null);
        request.onerror = () =>
          reject(request.error ?? new Error("Could not read offline storage."));
      }),
  );
}

function readFallback(): unknown | null {
  const raw =
    localStorage.getItem(fallbackKey) ??
    localStorage.getItem(legacyFallbackKey);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

export async function loadLedgerData(): Promise<unknown | null> {
  try {
    const stored = await readFromDatabase();
    if (stored) return stored;

    const fallback = readFallback();
    if (fallback) {
      await writeToDatabase(fallback as StoredLedger);
      localStorage.removeItem(fallbackKey);
      localStorage.removeItem(legacyFallbackKey);
    }
    return fallback;
  } catch {
    return readFallback();
  }
}

export function saveLedgerData(ledger: StoredLedger): void {
  pendingLedger = structuredClone(ledger);
  if (ledgerWriterRunning) return;
  ledgerWriterRunning = true;
  writeQueue = drainLedgerWrites();
}

async function drainLedgerWrites(): Promise<void> {
  try {
    while (pendingLedger) {
      const snapshot = pendingLedger;
      pendingLedger = null;
      try {
        await writeToDatabase(snapshot);
        localStorage.removeItem(fallbackKey);
      } catch {
        try {
          localStorage.setItem(fallbackKey, JSON.stringify(snapshot));
        } catch {
          // IndexedDB and the emergency fallback both failed. A later change retries.
        }
      }
    }
  } finally {
    ledgerWriterRunning = false;
    if (pendingLedger) saveLedgerData(pendingLedger);
  }
}

export function flushLedgerWrites(): Promise<void> {
  return writeQueue;
}

export async function loadPendingBackupData(): Promise<unknown | null> {
  await backupStorageQueue.catch(() => undefined);
  return readValueFromDatabase(pendingBackupKey);
}

export function savePendingBackupData(value: unknown): Promise<void> {
  const snapshot = structuredClone(value);
  backupStorageQueue = backupStorageQueue
    .catch(() => undefined)
    .then(() => writeValueToDatabase(pendingBackupKey, snapshot));
  return backupStorageQueue;
}

export function clearPendingBackupData(): Promise<void> {
  backupStorageQueue = backupStorageQueue
    .catch(() => undefined)
    .then(() => deleteValueFromDatabase(pendingBackupKey));
  return backupStorageQueue;
}
