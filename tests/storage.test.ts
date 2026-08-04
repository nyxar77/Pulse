import { expect, test } from "bun:test";
import "fake-indexeddb/auto";
import { flushLedgerWrites, loadLedgerData, saveLedgerData, type StoredLedger } from "../src/lib/storage";

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
    history: {},
  };
  saveLedgerData(current);
  await flushLedgerWrites();

  expect(await loadLedgerData()).toEqual(current);
  expect(localStorage.getItem("pulse-ledger-v2")).toBeNull();
});
