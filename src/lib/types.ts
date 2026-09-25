export type Exercise = {
  id: string;
  name: string;
  muscles: string[];
  tags?: string[];
  equipment: string;
  guideUrl: string;
  imageUrl?: string;
  description: string;
  custom?: boolean;
  archived?: boolean;
};

export type SetGroup = {
  id: string;
  sets: number;
  reps: string;
  load: string;
  rest: string;
};

export type WorkoutExercise = Exercise & {
  groups: SetGroup[];
  note: string;
};

export type LegacyWorkoutExercise = Exercise & {
  sets: number;
  reps: string;
  load: string;
  rest: string;
  note: string;
};

export type TrainingDay = {
  id: string;
  name: string;
};

export type WeekSchedule = Array<string | null>;
