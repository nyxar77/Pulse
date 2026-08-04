import type { Exercise, TrainingDay, WorkoutExercise } from '$lib/types';

export const themes = ['latte', 'frappe', 'macchiato', 'mocha'] as const;
export const accents = ['rosewater', 'flamingo', 'pink', 'mauve', 'red', 'maroon', 'peach', 'yellow', 'green', 'teal', 'sky', 'sapphire', 'blue', 'lavender'] as const;

export type Theme = (typeof themes)[number];
export type Accent = (typeof accents)[number];
export type LedgerExport = {
	app: 'pulse';
	version: 1 | 2;
	exportedAt: string;
	settings: { theme: Theme; accent: Accent };
	programme: { days: TrainingDay[]; workouts: Record<string, WorkoutExercise[]> };
	library?: Exercise[];
};

export function parseWeight(load: string): number | null {
	const value = Number.parseFloat(load.replace(',', '.'));
	return Number.isFinite(value) && value > 0 ? value : null;
}

export function formatWeight(value: number): string {
	return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function weightInputValue(load: string): string {
	const value = parseWeight(load);
	return value === null ? '' : formatWeight(value);
}

export function weightLabel(load: string): string {
	const value = parseWeight(load);
	return value === null ? 'No load' : formatWeight(value);
}

export function stepWeight(load: string, delta: number): string {
	const current = parseWeight(load) ?? 0;
	const next = Math.max(0, Math.round((current + delta) * 2) / 2);
	return next === 0 ? '—' : formatWeight(next);
}

export function normaliseWeight(load: string): string {
	const value = parseWeight(load);
	return value === null ? '—' : formatWeight(Math.round(value * 2) / 2);
}

export function reorderItems<T>(items: T[], sourceIndex: number, destinationIndex: number): T[] {
	if (sourceIndex < 0 || destinationIndex < 0 || sourceIndex >= items.length || destinationIndex >= items.length || sourceIndex === destinationIndex) return items;
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
		return url.protocol === 'https:' || url.protocol === 'http:';
	} catch {
		return false;
	}
}

export function isLedgerExport(value: unknown): value is LedgerExport {
	if (!isRecord(value) || value.app !== 'pulse' || (value.version !== 1 && value.version !== 2) || !isRecord(value.settings) || !isRecord(value.programme)) return false;
	if (typeof value.settings.theme !== 'string' || !themes.includes(value.settings.theme as Theme)) return false;
	if (typeof value.settings.accent !== 'string' || !accents.includes(value.settings.accent as Accent)) return false;

	const days = value.programme.days;
	const workouts = value.programme.workouts;
	if (!Array.isArray(days) || !days.length || !isRecord(workouts)) return false;
	if (!days.every((day) => isRecord(day) && typeof day.id === 'string' && day.id.length > 0 && typeof day.name === 'string' && day.name.trim().length > 0)) return false;
	const ids = days.map((day) => (day as TrainingDay).id);
	if (new Set(ids).size !== ids.length) return false;
	if (!ids.every((id) => Array.isArray(workouts[id]) && workouts[id].every(isWorkoutExercise))) return false;
	return value.library === undefined || (Array.isArray(value.library) && value.library.every(isExercise));
}

export function isWorkoutExercise(value: unknown): value is WorkoutExercise {
	if (!isExercise(value)) return false;
	const record = value as unknown as Record<string, unknown>;
	const stringFields = ['reps', 'load', 'rest', 'note'];
	if (!stringFields.every((field) => typeof record[field] === 'string')) return false;
	return typeof record.sets === 'number' && Number.isFinite(record.sets) && record.sets >= 1 && typeof record.completed === 'boolean';
}

export function isExercise(value: unknown): value is Exercise {
	if (!isRecord(value)) return false;
	const stringFields = ['id', 'name', 'equipment', 'guideUrl', 'description'];
	if (!stringFields.every((field) => typeof value[field] === 'string')) return false;
	if (!Array.isArray(value.muscles) || !value.muscles.every((muscle) => typeof muscle === 'string')) return false;
	if (value.tags !== undefined && (!Array.isArray(value.tags) || !value.tags.every((tag) => typeof tag === 'string'))) return false;
	if (value.imageUrl !== undefined && typeof value.imageUrl !== 'string') return false;
	return isOptionalWebUrl(value.guideUrl as string) && isOptionalWebUrl((value.imageUrl as string | undefined) ?? '');
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}
