import type { Exercise, TrainingDay, TrainingHistory, WeekSchedule, WorkoutExercise } from "$lib/types";

export const themes = ["latte", "frappe", "macchiato", "mocha"] as const;
export const accents = [
  "rosewater",
  "flamingo",
  "pink",
  "mauve",
  "red",
  "maroon",
  "peach",
  "yellow",
  "green",
  "teal",
  "sky",
  "sapphire",
  "blue",
  "lavender",
] as const;
export const weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

export type Theme = (typeof themes)[number];
export type Accent = (typeof accents)[number];
export type LedgerExport = {
  app: "pulse";
  version: 1 | 2 | 3;
  exportedAt: string;
  settings: { theme: Theme; accent: Accent };
  programme: {
    days: TrainingDay[];
    workouts: Record<string, WorkoutExercise[]>;
    schedule?: WeekSchedule;
  };
  library?: Exercise[];
  history?: TrainingHistory;
};

export function weekIndex(date: Date): number {
  return (date.getDay() + 6) % 7;
}

export function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function createWeekSchedule(days: TrainingDay[], startIndex = 0): WeekSchedule {
  const schedule: WeekSchedule = Array.from({ length: 7 }, () => null);
  days.slice(0, 7).forEach((day, offset) => {
    schedule[(startIndex + offset) % 7] = day.id;
  });
  return schedule;
}

export function normaliseWeekSchedule(value: unknown, dayIds: string[], fallbackStartIndex = 0): WeekSchedule {
  if (!Array.isArray(value) || value.length !== 7) {
    return createWeekSchedule(
      dayIds.slice(0, 7).map((id) => ({ id, name: id })),
      fallbackStartIndex,
    );
  }
  const validIds = new Set(dayIds);
  return value.map((dayId) => (typeof dayId === "string" && validIds.has(dayId) ? dayId : null));
}

export function toggleHistoryExercise(history: TrainingHistory, dateKey: string, exerciseId: string): TrainingHistory {
  const completed = new Set(history[dateKey] ?? []);
  if (completed.has(exerciseId)) completed.delete(exerciseId);
  else completed.add(exerciseId);
  const next = { ...history };
  if (completed.size) next[dateKey] = [...completed];
  else delete next[dateKey];
  return next;
}

export function orderExercisesByCompletion<T extends { id: string }>(exercises: readonly T[], completedIds: readonly string[]): T[] {
  const byId = new Map(exercises.map((exercise) => [exercise.id, exercise]));
  const completedSet = new Set(completedIds);
  const pending = exercises.filter((exercise) => !completedSet.has(exercise.id));
  const completed: T[] = [];
  const added = new Set<string>();

  for (const id of completedIds) {
    const exercise = byId.get(id);
    if (exercise && !added.has(id)) {
      completed.push(exercise);
      added.add(id);
    }
  }

  return [...pending, ...completed];
}

export function normaliseTrainingHistory(value: unknown): TrainingHistory {
  if (!isTrainingHistory(value)) return {};
  return Object.fromEntries(Object.entries(value).map(([date, exerciseIds]) => [date, [...new Set(exerciseIds)]]));
}

export function parseWeight(load: string): number | null {
  const value = Number.parseFloat(load.replace(",", "."));
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function formatWeight(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function weightInputValue(load: string): string {
  const value = parseWeight(load);
  return value === null ? "" : formatWeight(value);
}

export function weightLabel(load: string): string {
  const value = parseWeight(load);
  return value === null ? "No load" : formatWeight(value);
}

export function stepWeight(load: string, delta: number): string {
  const current = parseWeight(load) ?? 0;
  const next = Math.max(0, Math.round((current + delta) * 2) / 2);
  return next === 0 ? "—" : formatWeight(next);
}

export function normaliseWeight(load: string): string {
  const value = parseWeight(load);
  return value === null ? "—" : formatWeight(Math.round(value * 2) / 2);
}

export function reorderItems<T>(items: T[], sourceIndex: number, destinationIndex: number): T[] {
  if (sourceIndex < 0 || destinationIndex < 0 || sourceIndex >= items.length || destinationIndex >= items.length || sourceIndex === destinationIndex)
    return items;
  const reordered = [...items];
  const [item] = reordered.splice(sourceIndex, 1);
  reordered.splice(destinationIndex, 0, item);
  return reordered;
}

export function moveItem<T>(items: T[], index: number, direction: -1 | 1): T[] {
  return reorderItems(items, index, index + direction);
}

export function isOptionalWebUrl(value: string): boolean {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export function isLedgerExport(value: unknown): value is LedgerExport {
  if (
    !isRecord(value) ||
    value.app !== "pulse" ||
    (value.version !== 1 && value.version !== 2 && value.version !== 3) ||
    !isRecord(value.settings) ||
    !isRecord(value.programme)
  )
    return false;
  if (typeof value.settings.theme !== "string" || !themes.includes(value.settings.theme as Theme)) return false;
  if (typeof value.settings.accent !== "string" || !accents.includes(value.settings.accent as Accent)) return false;

  const days = value.programme.days;
  const workouts = value.programme.workouts;
  if (!Array.isArray(days) || !days.length || days.length > 7 || !isRecord(workouts)) return false;
  if (!days.every((day) => isRecord(day) && typeof day.id === "string" && day.id.length > 0 && typeof day.name === "string" && day.name.trim().length > 0))
    return false;
  const ids = days.map((day) => (day as TrainingDay).id);
  if (new Set(ids).size !== ids.length) return false;
  if (!ids.every((id) => Array.isArray(workouts[id]) && workouts[id].every(isWorkoutExercise))) return false;
  if (value.version === 3) {
    if (!isWeekSchedule(value.programme.schedule, ids) || !isTrainingHistory(value.history)) return false;
    if (!Array.isArray(value.library) || !isExerciseLibrary(value.library)) return false;
    const libraryById = new Map(value.library.map((exercise) => [exercise.id, exercise]));
    if (!ids.every((dayId) => (workouts[dayId] as WorkoutExercise[]).every((workoutExercise) => {
      const definition = libraryById.get(workoutExercise.id);
      return definition !== undefined && sameExerciseDefinition(definition, workoutExercise);
    }))) return false;
  }
  return value.library === undefined || (Array.isArray(value.library) && isExerciseLibrary(value.library));
}

function isExerciseLibrary(value: unknown[]): value is Exercise[] {
  const exercises = value;
  return exercises.every(isExercise) && new Set(exercises.map((exercise) => exercise.id)).size === exercises.length;
}

function sameExerciseDefinition(left: Exercise, right: Exercise): boolean {
  return left.id === right.id &&
    left.name === right.name &&
    JSON.stringify(left.muscles) === JSON.stringify(right.muscles) &&
    JSON.stringify(left.tags ?? []) === JSON.stringify(right.tags ?? []) &&
    left.equipment === right.equipment &&
    left.guideUrl === right.guideUrl &&
    left.imageUrl === right.imageUrl &&
    left.description === right.description &&
    left.custom === right.custom &&
    left.archived === right.archived;
}

function isWeekSchedule(value: unknown, dayIds: string[]): value is WeekSchedule {
  if (!Array.isArray(value) || value.length !== 7) return false;
  const validIds = new Set(dayIds);
  return value.every((dayId) => dayId === null || (typeof dayId === "string" && validIds.has(dayId)));
}

function isTrainingHistory(value: unknown): value is TrainingHistory {
  if (!isRecord(value)) return false;
  return Object.entries(value).every(
    ([date, exerciseIds]) => /^\d{4}-\d{2}-\d{2}$/.test(date) && Array.isArray(exerciseIds) && exerciseIds.every((id) => typeof id === "string"),
  );
}

export function isWorkoutExercise(value: unknown): value is WorkoutExercise {
  if (!isExercise(value)) return false;
  const record = value as unknown as Record<string, unknown>;
  const stringFields = ["reps", "load", "rest", "note"];
  if (!stringFields.every((field) => typeof record[field] === "string")) return false;
  return typeof record.sets === "number" && Number.isFinite(record.sets) && record.sets >= 1 && typeof record.completed === "boolean";
}

export function isExercise(value: unknown): value is Exercise {
  if (!isRecord(value)) return false;
  const stringFields = ["id", "name", "equipment", "guideUrl", "description"];
  if (!stringFields.every((field) => typeof value[field] === "string")) return false;
  if (!Array.isArray(value.muscles) || !value.muscles.every((muscle) => typeof muscle === "string")) return false;
  if (value.tags !== undefined && (!Array.isArray(value.tags) || !value.tags.every((tag) => typeof tag === "string"))) return false;
  if (value.imageUrl !== undefined && typeof value.imageUrl !== "string") return false;
  return isOptionalWebUrl(value.guideUrl as string) && isOptionalWebUrl((value.imageUrl as string | undefined) ?? "");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
