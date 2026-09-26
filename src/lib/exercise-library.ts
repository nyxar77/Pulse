import {
  defaultExerciseIds,
  defaultExerciseLibraryVersion,
  defaultExercises,
} from "$lib/default-exercises";
import type { Exercise, WorkoutExercise } from "$lib/types";

function cloneExercise(exercise: Exercise): Exercise {
  return {
    ...exercise,
    muscles: [...exercise.muscles],
    tags: exercise.tags ? [...exercise.tags] : undefined,
  };
}

export function mergeDefaultExerciseLibrary(
  existing: readonly Exercise[],
): Exercise[] {
  const existingById = new Map(
    existing.map((exercise) => [exercise.id, exercise]),
  );
  const defaults = defaultExercises.map((exercise) => {
    const saved = existingById.get(exercise.id);
    return {
      ...cloneExercise(exercise),
      archived: saved?.archived ?? false,
    };
  });
  const userExercises = existing
    .filter((exercise) => !defaultExerciseIds.has(exercise.id))
    .map(cloneExercise);
  return [...defaults, ...userExercises];
}

export function reconcileDefaultExerciseLibrary(
  existing: readonly Exercise[],
  installedVersion: number | undefined,
): Exercise[] {
  const existingIds = new Set(existing.map((exercise) => exercise.id));
  const hasCompleteDefaultLibrary = defaultExercises.every((exercise) =>
    existingIds.has(exercise.id),
  );
  return installedVersion === defaultExerciseLibraryVersion &&
    hasCompleteDefaultLibrary
    ? existing.map(cloneExercise)
    : mergeDefaultExerciseLibrary(existing);
}

export function refreshWorkoutExerciseDefinitions(
  workouts: readonly WorkoutExercise[],
  library: readonly Exercise[],
): WorkoutExercise[] {
  const definitions = new Map(
    library.map((exercise) => [exercise.id, exercise]),
  );
  return workouts.map((exercise) => {
    const definition = definitions.get(exercise.id);
    if (!definition) return exercise;
    return {
      ...exercise,
      ...cloneExercise(definition),
      groups: exercise.groups.map((group) => ({ ...group })),
      note: exercise.note,
    };
  });
}
