import { describe, expect, test } from "bun:test";
import {
  copyWorkout,
  createWeekSchedule,
  isLedgerExport,
  localDateKey,
  moveItem,
  normaliseWeekSchedule,
  normaliseWeight,
  orderExercisesByCompletion,
  parseWeight,
  reorderItems,
  stepWeight,
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
  groups: [
    {
      id: "press-group-1",
      sets: 3,
      reps: "8–10",
      load: "50",
      rest: "90 sec",
    },
  ],
  note: "",
};

const legacyExercise = {
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
};

function ledger(overrides: Record<string, unknown> = {}) {
  return {
    app: "pulse",
    version: 4,
    exportedAt: "2026-08-04T00:00:00.000Z",
    settings: { theme: "mocha", accent: "mauve", bodyMap: "female" },
    programme: {
      days: [{ id: "day-1", name: "Whatever day" }],
      workouts: { "day-1": [exercise] },
      schedule: ["day-1", null, null, null, null, null, null],
    },
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
    expect(createWeekSchedule(days, 6)).toEqual([
      "b",
      null,
      null,
      null,
      null,
      null,
      "a",
    ]);
    expect(
      normaliseWeekSchedule(
        ["missing", "a", null, null, null, null, null],
        ["a"],
      ),
    ).toEqual([null, "a", null, null, null, null, null]);
  });

  test("moves completed exercises to the end in completion order", () => {
    const plan = [
      { id: "press", name: "Press" },
      { id: "row", name: "Row" },
      { id: "curl", name: "Curl" },
    ];

    expect(
      orderExercisesByCompletion(plan, ["curl", "press"]).map(({ id }) => id),
    ).toEqual(["row", "curl", "press"]);

    expect(
      orderExercisesByCompletion(plan, ["curl"]).map(({ id }) => id),
    ).toEqual(["press", "row", "curl"]);
    expect(orderExercisesByCompletion(plan, []).map(({ id }) => id)).toEqual([
      "press",
      "row",
      "curl",
    ]);
    expect(plan.map(({ id }) => id)).toEqual(["press", "row", "curl"]);
  });
});

describe("programme ordering", () => {
  test("copies a workout without sharing exercise metadata", () => {
    const original = [
      { ...exercise, muscles: ["Chest"], tags: ["Push"], completed: true },
    ];
    const copied = copyWorkout(original);

    const { completed: _legacyCompletion, ...persistentExercise } = original[0];
    expect(copied).toEqual([persistentExercise]);
    expect(copied).not.toBe(original);
    expect(copied[0]).not.toBe(original[0]);
    expect(copied[0].muscles).not.toBe(original[0].muscles);
    expect(copied[0].tags).not.toBe(original[0].tags);
    expect(copied[0].groups).not.toBe(original[0].groups);
    expect(copied[0].groups[0]).not.toBe(original[0].groups[0]);
  });

  test("migrates a legacy prescription into one set group", () => {
    expect(copyWorkout([legacyExercise])).toEqual([
      {
        id: "press",
        name: "Press",
        muscles: ["Chest"],
        equipment: "Barbell",
        guideUrl: "https://example.com/press",
        description: "Controlled press.",
        note: "",
        groups: [
          {
            id: "press-group-1",
            sets: 3,
            reps: "8–10",
            load: "50",
            rest: "90 sec",
          },
        ],
      },
    ]);
  });

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

  test("accepts older backups without a body map and rejects unknown maps", () => {
    expect(
      isLedgerExport(ledger({ settings: { theme: "mocha", accent: "mauve" } })),
    ).toBeTrue();
    expect(
      isLedgerExport(
        ledger({
          settings: {
            theme: "mocha",
            accent: "mauve",
            bodyMap: "unknown",
          },
        }),
      ),
    ).toBeFalse();
  });

  test("accepts a v3 backup with a flat prescription", () => {
    expect(
      isLedgerExport({
        ...ledger(),
        version: 3,
        programme: {
          ...ledger().programme,
          workouts: { "day-1": [legacyExercise] },
        },
        library: [legacyExercise],
      }),
    ).toBeTrue();
  });

  test("rejects missing days, duplicate ids, and unsafe media links", () => {
    expect(
      isLedgerExport(ledger({ programme: { days: [], workouts: {} } })),
    ).toBeFalse();
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
    expect(
      isLedgerExport(
        ledger({ library: [{ ...exercise, guideUrl: "javascript:alert(1)" }] }),
      ),
    ).toBeFalse();
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
  });

  test("requires every current workout exercise to exist in the library", () => {
    expect(isLedgerExport(ledger({ library: [] }))).toBeFalse();
    expect(
      isLedgerExport(
        ledger({
          programme: {
            ...ledger().programme,
            workouts: {
              "day-1": [{ ...exercise, name: "Different definition" }],
            },
          },
        }),
      ),
    ).toBeFalse();
  });

  test("rejects malformed metadata and unknown workout plans", () => {
    expect(isLedgerExport(ledger({ exportedAt: "not-a-date" }))).toBeFalse();
    expect(
      isLedgerExport(
        ledger({
          programme: {
            ...ledger().programme,
            workouts: { "day-1": [], unknown: [] },
          },
        }),
      ),
    ).toBeFalse();
    expect(
      isLedgerExport(ledger({ library: [{ ...exercise, id: "   " }] })),
    ).toBeFalse();
    expect(
      isLedgerExport(
        ledger({
          programme: {
            ...ledger().programme,
            workouts: {
              "day-1": [
                {
                  ...exercise,
                  groups: [{ ...exercise.groups[0], sets: 2.5 }],
                },
              ],
            },
          },
        }),
      ),
    ).toBeFalse();
  });

  test("accepts ordered set groups and rejects duplicate group ids", () => {
    const secondGroup = {
      ...exercise.groups[0],
      id: "press-group-2",
      sets: 1,
      reps: "1",
      load: "70",
    };
    expect(
      isLedgerExport(
        ledger({
          programme: {
            ...ledger().programme,
            workouts: {
              "day-1": [
                { ...exercise, groups: [secondGroup, exercise.groups[0]] },
              ],
            },
          },
        }),
      ),
    ).toBeTrue();
    expect(
      isLedgerExport(
        ledger({
          programme: {
            ...ledger().programme,
            workouts: {
              "day-1": [
                {
                  ...exercise,
                  groups: [exercise.groups[0], exercise.groups[0]],
                },
              ],
            },
          },
        }),
      ),
    ).toBeFalse();
  });
});
