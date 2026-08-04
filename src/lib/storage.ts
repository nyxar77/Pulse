import type { Exercise, TrainingDay, WorkoutExercise } from '$lib/types';

const databaseName = 'pulse';
const databaseVersion = 1;
const storeName = 'ledger';
const ledgerKey = 'current';
const fallbackKey = 'pulse-ledger-v2';
const legacyFallbackKey = 'pulse-push-strength-v1';

export type StoredLedger = {
	workouts: Record<string, WorkoutExercise[]>;
	days: TrainingDay[];
	activeDayId: string;
	theme: string;
	accent: string;
	exercises: Exercise[];
};

let databasePromise: Promise<IDBDatabase> | undefined;
let writeQueue = Promise.resolve();

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
		request.onerror = () => reject(request.error ?? new Error('Could not open offline storage.'));
		request.onblocked = () => reject(new Error('Offline storage upgrade was blocked.'));
	});

	return databasePromise;
}

function readFromDatabase(): Promise<unknown | null> {
	return openDatabase().then(
		(database) =>
			new Promise((resolve, reject) => {
				const transaction = database.transaction(storeName, 'readonly');
				const request = transaction.objectStore(storeName).get(ledgerKey);
				request.onsuccess = () => resolve(request.result ?? null);
				request.onerror = () => reject(request.error ?? new Error('Could not read offline storage.'));
			})
	);
}

function writeToDatabase(ledger: StoredLedger): Promise<void> {
	return openDatabase().then(
		(database) =>
			new Promise((resolve, reject) => {
				const transaction = database.transaction(storeName, 'readwrite');
				transaction.objectStore(storeName).put(ledger, ledgerKey);
				transaction.oncomplete = () => resolve();
				transaction.onerror = () => reject(transaction.error ?? new Error('Could not save offline data.'));
				transaction.onabort = () => reject(transaction.error ?? new Error('Offline save was cancelled.'));
			})
	);
}

function readFallback(): unknown | null {
	const raw = localStorage.getItem(fallbackKey) ?? localStorage.getItem(legacyFallbackKey);
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
	const snapshot = structuredClone(ledger);
	writeQueue = writeQueue
		.catch(() => undefined)
		.then(async () => {
			try {
				await writeToDatabase(snapshot);
			} catch {
				localStorage.setItem(fallbackKey, JSON.stringify(snapshot));
			}
		});
}
