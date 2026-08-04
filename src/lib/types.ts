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

export type WorkoutExercise = Exercise & {
  sets: number;
  reps: string;
  load: string;
  rest: string;
  note: string;
  completed: boolean;
};

export type TrainingDay = {
  id: string;
  name: string;
};
