import { describe, expect, test } from "bun:test";
import {
  createWeekSchedule,
  isLedgerExport,
  localDateKey,
  moveItem,
  normaliseWeekSchedule,
  normaliseWeight,
  parseWeight,
  reorderItems,
  stepWeight,
  toggleHistoryExercise,
  weekIndex,
  weightInputValue,
  weightLabel,
} from "../src/lib/ledger";

const exercise = {
  id: "press",
  name: "Press",
  muscles: ["Chest"],
  equipment: "Barbell",
  guideUrl: "https://example.com/press",
  description: "Controlled press.",
  sets: 3,
  reps: "8–10",
  load: "50",
  rest: "90 sec",
  note: "",
  completed: false,
};

function ledger(overrides: Record<string, unknown> = {}) {
  return {
    app: "pulse",
    version: 3,
    exportedAt: "2026-08-04T00:00:00.000Z",
    settings: { theme: "mocha", accent: "mauve" },
    programme: {
      days: [{ id: "day-1", name: "Whatever day" }],
      workouts: { "day-1": [exercise] },
      schedule: ["day-1", null, null, null, null, null, null],
    },
    history: {},
    library: [exercise],
    ...overrides,
  };
}

describe("weight rules", () => {
  test("accepts gym-friendly decimal input and normalises it to half-kilogram steps", () => {
    expect(parseWeight("52,5 kg")).toBe(52.5);
    expect(normaliseWeight("52.256")).toBe("52.5");
    expect(normaliseWeight("51.74")).toBe("51.5");
  });

  test("uses a clear no-load state and 2.5 kg controls", () => {
    expect(parseWeight("—")).toBeNull();
    expect(weightInputValue("—")).toBe("");
    expect(weightLabel("—")).toBe("No load");
    expect(stepWeight("—", 2.5)).toBe("2.5");
    expect(stepWeight("2.5", -2.5)).toBe("—");
  });
});

describe("weekly schedule", () => {
  test("uses a Monday-first seven-day week and resolves local dates", () => {
    const tuesday = new Date(2026, 7, 4, 23, 30);
    expect(weekIndex(tuesday)).toBe(1);
    expect(localDateKey(tuesday)).toBe("2026-08-04");
  });

  test("assigns at most seven plans and wraps from Sunday", () => {
    const days = [
      { id: "a", name: "A" },
      { id: "b", name: "B" },
    ];
    expect(createWeekSchedule(days, 6)).toEqual(["b", null, null, null, null, null, "a"]);
    expect(normaliseWeekSchedule(["missing", "a", null, null, null, null, null], ["a"])).toEqual([null, "a", null, null, null, null, null]);
  });

  test("tracks completion by calendar date without mutating prior history", () => {
    const original = { "2026-08-03": ["press"] };
    const completed = toggleHistoryExercise(original, "2026-08-04", "row");
    expect(completed).toEqual({
      "2026-08-03": ["press"],
      "2026-08-04": ["row"],
    });
    expect(original).toEqual({ "2026-08-03": ["press"] });
    expect(toggleHistoryExercise(completed, "2026-08-04", "row")).toEqual(original);
  });
});

describe("programme ordering", () => {
  test("supports direct touch reordering without mutating the previous list", () => {
    const original = ["A", "B", "C"];
    expect(reorderItems(original, 0, 2)).toEqual(["B", "C", "A"]);
    expect(original).toEqual(["A", "B", "C"]);
  });

  test("keeps items inside the list when arrow controls reach an edge", () => {
    const original = ["A", "B"];
    expect(moveItem(original, 0, -1)).toBe(original);
    expect(moveItem(original, 1, 1)).toBe(original);
  });
});

describe("ledger imports", () => {
  test("accepts a complete Pulse backup", () => {
    expect(isLedgerExport(ledger())).toBeTrue();
  });

  test("rejects missing days, duplicate ids, and unsafe media links", () => {
    expect(isLedgerExport(ledger({ programme: { days: [], workouts: {} } }))).toBeFalse();
    expect(
      isLedgerExport(
        ledger({
          programme: {
            days: [
              { id: "same", name: "One" },
              { id: "same", name: "Two" },
            ],
            workouts: { same: [] },
          },
        }),
      ),
    ).toBeFalse();
    expect(isLedgerExport(ledger({ library: [{ ...exercise, guideUrl: "javascript:alert(1)" }] }))).toBeFalse();
    expect(
      isLedgerExport(
        ledger({
          programme: {
            days: Array.from({ length: 8 }, (_, index) => ({
              id: `day-${index}`,
              name: `Day ${index}`,
            })),
            workouts: {},
          },
        }),
      ),
    ).toBeFalse();
    expect(isLedgerExport(ledger({ history: { yesterday: ["press"] } }))).toBeFalse();
  });
});
