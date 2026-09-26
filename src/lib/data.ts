import { defaultExercises } from "$lib/default-exercises";
import type { WorkoutExercise } from "$lib/types";

export const exerciseLibrary = defaultExercises;

export const starterWorkout: WorkoutExercise[] = exerciseLibrary
  .slice(0, 3)
  .map((exercise, index) => ({
    ...exercise,
    groups: [
      {
        id: `${exercise.id}-group-1`,
        sets: index === 0 ? 4 : 3,
        reps: index === 0 ? "6–8" : "10–12",
        load: index === 0 ? "52.5 kg" : "—",
        rest: index === 0 ? "2 min" : "90 sec",
      },
    ],
    note: index === 0 ? "Leave 1–2 reps in reserve." : "",
  }));
