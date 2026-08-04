export type MuscleGroup =
  "Chest" | "Back" | "Shoulders" | "Arms" | "Legs" | "Core";

export type Exercise = {
  id: string;
  name: string;
  muscles: MuscleGroup[];
  equipment: string;
  guideUrl: string;
  description: string;
};

export type WorkoutExercise = Exercise & {
  sets: number;
  reps: string;
  load: string;
  rest: string;
  note: string;
  completed: boolean;
};
