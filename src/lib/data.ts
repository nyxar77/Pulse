import type { Exercise, WorkoutExercise } from "$lib/types";

export const exerciseLibrary: Exercise[] = [
  {
    id: "barbell-bench-press",
    name: "Barbell bench press",
    muscles: ["Chest", "Arms"],
    equipment: "Barbell",
    guideUrl:
      "https://www.youtube.com/results?search_query=barbell+bench+press+form",
    description:
      "Press with your feet planted and shoulder blades held back against the bench.",
  },
  {
    id: "incline-dumbbell-press",
    name: "Incline dumbbell press",
    muscles: ["Chest", "Shoulders", "Arms"],
    equipment: "Dumbbells",
    guideUrl:
      "https://www.youtube.com/results?search_query=incline+dumbbell+press+form",
    description:
      "Use a shallow incline and lower with control until the dumbbells reach chest height.",
  },
  {
    id: "cable-fly",
    name: "Cable fly",
    muscles: ["Chest"],
    equipment: "Cable machine",
    guideUrl: "https://www.youtube.com/results?search_query=cable+fly+form",
    description:
      "Keep a soft bend in the elbows and bring the handles together in a wide arc.",
  },
  {
    id: "tricep-pushdown",
    name: "Rope tricep pushdown",
    muscles: ["Arms"],
    equipment: "Cable machine",
    guideUrl:
      "https://www.youtube.com/results?search_query=rope+tricep+pushdown+form",
    description:
      "Keep your elbows close to your body and separate the rope at the bottom.",
  },
  {
    id: "lateral-raise",
    name: "Dumbbell lateral raise",
    muscles: ["Shoulders"],
    equipment: "Dumbbells",
    guideUrl:
      "https://www.youtube.com/results?search_query=dumbbell+lateral+raise+form",
    description:
      "Raise only to shoulder height, leading with the elbows instead of the hands.",
  },
  {
    id: "assisted-pullup",
    name: "Assisted pull-up",
    muscles: ["Back", "Arms"],
    equipment: "Machine",
    guideUrl:
      "https://www.youtube.com/results?search_query=assisted+pull+up+form",
    description:
      "Start from a dead hang and drive elbows down toward your ribs.",
  },
];

export const starterWorkout: WorkoutExercise[] = exerciseLibrary
  .slice(0, 3)
  .map((exercise, index) => ({
    ...exercise,
    sets: index === 0 ? 4 : 3,
    reps: index === 0 ? "6–8" : "10–12",
    load: index === 0 ? "52.5 kg" : "—",
    rest: index === 0 ? "2 min" : "90 sec",
    note: index === 0 ? "Leave 1–2 reps in reserve." : "",
    completed: false,
  }));
