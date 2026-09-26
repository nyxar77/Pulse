import { describe, expect, test } from "bun:test";
import {
  defaultExerciseLibraryVersion,
  defaultExercises,
} from "../src/lib/default-exercises";
import {
  mergeDefaultExerciseLibrary,
  reconcileDefaultExerciseLibrary,
  refreshWorkoutExerciseDefinitions,
} from "../src/lib/exercise-library";
import type { Exercise, WorkoutExercise } from "../src/lib/types";

const customExercise: Exercise = {
  id: "exercise-custom",
  name: "My press",
  muscles: ["Chest"],
  equipment: "Dumbbells",
  guideUrl: "",
  description: "Personal cue",
  custom: true,
};

describe("default exercise library", () => {
  test("covers the major movement areas with stable unique ids", () => {
    expect(defaultExercises.length).toBeGreaterThanOrEqual(60);
    expect(new Set(defaultExercises.map(({ id }) => id)).size).toBe(
      defaultExercises.length,
    );
    for (const muscle of [
      "Chest",
      "Upper back",
      "Lats",
      "Front delts",
      "Biceps",
      "Triceps",
      "Core",
      "Glutes",
      "Quadriceps",
      "Hamstrings",
      "Calves",
    ]) {
      expect(
        defaultExercises.some((exercise) => exercise.muscles.includes(muscle)),
      ).toBeTrue();
    }
  });

  test("refreshes built-ins while preserving archive state and custom exercises", () => {
    const changedBench: Exercise = {
      ...defaultExercises[0],
      name: "Old saved name",
      muscles: ["Arms"],
      archived: true,
    };
    const merged = mergeDefaultExerciseLibrary([changedBench, customExercise]);

    expect(merged[0].name).toBe(defaultExercises[0].name);
    expect(merged[0].muscles).toEqual(defaultExercises[0].muscles);
    expect(merged[0].archived).toBeTrue();
    expect(merged.at(-1)).toEqual(customExercise);
  });

  test("does not overwrite edits again until the shipped catalogue changes", () => {
    const completeEditedLibrary = defaultExercises.map((exercise, index) =>
      index === 0 ? { ...exercise, name: "My preferred bench name" } : exercise,
    );

    expect(
      reconcileDefaultExerciseLibrary(
        [...completeEditedLibrary, customExercise],
        defaultExerciseLibraryVersion,
      ),
    ).toEqual([...completeEditedLibrary, customExercise]);
    expect(
      reconcileDefaultExerciseLibrary(completeEditedLibrary, undefined)[0].name,
    ).toBe(defaultExercises[0].name);
  });

  test("repairs a current-version library that is missing shipped exercises", () => {
    const incompleteLibrary = defaultExercises.slice(0, 6);
    expect(
      reconcileDefaultExerciseLibrary(
        incompleteLibrary,
        defaultExerciseLibraryVersion,
      ),
    ).toHaveLength(defaultExercises.length);
  });

  test("updates copied definitions without touching a prescription", () => {
    const workout: WorkoutExercise = {
      ...defaultExercises[0],
      name: "Old saved name",
      muscles: ["Arms"],
      groups: [
        { id: "group-1", sets: 5, reps: "5", load: "80 kg", rest: "3 min" },
      ],
      note: "Keep one rep in reserve.",
    };
    const [refreshed] = refreshWorkoutExerciseDefinitions(
      [workout],
      mergeDefaultExerciseLibrary([]),
    );

    expect(refreshed.name).toBe(defaultExercises[0].name);
    expect(refreshed.muscles).toEqual(defaultExercises[0].muscles);
    expect(refreshed.groups).toEqual(workout.groups);
    expect(refreshed.note).toBe(workout.note);
  });
});
