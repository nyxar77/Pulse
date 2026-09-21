import { expect, test } from "bun:test";
import "fake-indexeddb/auto";
import {
  clearPendingBackupData,
  flushLedgerWrites,
  loadLedgerData,
  loadPendingBackupData,
  saveLedgerData,
  savePendingBackupData,
  type StoredLedger,
} from "../src/lib/storage";

class MemoryStorage implements Storage {
  #values = new Map<string, string>();

  get length() {
    return this.#values.size;
  }

  clear() {
    this.#values.clear();
  }

  getItem(key: string) {
    return this.#values.get(key) ?? null;
  }

  key(index: number) {
    return [...this.#values.keys()][index] ?? null;
  }

  removeItem(key: string) {
    this.#values.delete(key);
  }

  setItem(key: string, value: string) {
    this.#values.set(key, value);
  }
}

Object.defineProperty(globalThis, "localStorage", {
  value: new MemoryStorage(),
  configurable: true,
});

test("migrates the old local backup once and persists subsequent ledgers in IndexedDB", async () => {
  const legacy = {
    days: ["Freeform day"],
    workouts: { "Freeform day": [] },
    activeDay: "Freeform day",
    theme: "mocha",
    accent: "mauve",
  };
  localStorage.setItem("pulse-push-strength-v1", JSON.stringify(legacy));

  expect(await loadLedgerData()).toEqual(legacy);
  expect(localStorage.getItem("pulse-push-strength-v1")).toBeNull();

  const current: StoredLedger = {
    days: [{ id: "day-1", name: "Unusual split" }],
    workouts: { "day-1": [] },
    activeDayId: "day-1",
    theme: "latte",
    accent: "red",
    exercises: [],
    schedule: ["day-1", null, null, null, null, null, null],
  };
  saveLedgerData(current);
  await flushLedgerWrites();

  expect(await loadLedgerData()).toEqual(current);
  expect(localStorage.getItem("pulse-ledger-v2")).toBeNull();
});

test("keeps only the latest queued ledger snapshot", async () => {
  const base: StoredLedger = {
    days: [{ id: "day-1", name: "Day" }],
    workouts: { "day-1": [] },
    activeDayId: "day-1",
    theme: "mocha",
    accent: "mauve",
    exercises: [],
    schedule: ["day-1", null, null, null, null, null, null],
  };

  saveLedgerData({ ...base, accent: "red" });
  saveLedgerData({ ...base, accent: "blue" });
  saveLedgerData({ ...base, accent: "green" });
  await flushLedgerWrites();

  expect(await loadLedgerData()).toEqual({ ...base, accent: "green" });
});

test("stores pending automatic backups outside localStorage", async () => {
  const pending = {
    contents: "{}",
    fingerprint: "latest",
    dueAt: "2026-09-22T10:00:00.000Z",
    revision: 8,
  };
  await savePendingBackupData(pending);
  expect(await loadPendingBackupData()).toEqual(pending);
  expect(localStorage.length).toBe(0);

  await clearPendingBackupData();
  expect(await loadPendingBackupData()).toBeNull();
});
