<script lang="ts">
	import { browser } from '$app/environment';
	import { exerciseLibrary, starterWorkout } from '$lib/data';
	import type { Exercise, MuscleGroup, TrainingDay, WorkoutExercise } from '$lib/types';
	import {
		Activity,
		ArrowDown,
		ArrowUp,
		Check,
		ChevronDown,
		Download,
		Ellipsis,
		ExternalLink,
		FileJson,
		GripVertical,
		LibraryBig,
		Palette,
		Pencil,
		Plus,
		Save,
		Search,
		Trash2,
		Upload,
		X
	} from 'lucide-svelte';
	import { onMount } from 'svelte';

	const storageKey = 'pulse-ledger-v2';
	const legacyStorageKey = 'pulse-push-strength-v1';
	const muscleGroups: Array<MuscleGroup | 'All'> = ['All', 'Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Core'];
	const themes = ['latte', 'frappe', 'macchiato', 'mocha'] as const;
	const accents = ['rosewater', 'flamingo', 'pink', 'mauve', 'red', 'maroon', 'peach', 'yellow', 'green', 'teal', 'sky', 'sapphire', 'blue', 'lavender'] as const;
	type Theme = (typeof themes)[number];
	type Accent = (typeof accents)[number];
	type LedgerExport = {
		app: 'pulse';
		version: 1;
		exportedAt: string;
		settings: { theme: Theme; accent: Accent };
		programme: { days: TrainingDay[]; workouts: Record<string, WorkoutExercise[]> };
	};

	let dayExercises: WorkoutExercise[] = starterWorkout;
	let activeDayId = 'day-1';
	let days: TrainingDay[] = [{ id: 'day-1', name: 'Day 01' }];
	let workouts: Record<string, WorkoutExercise[]> = { 'day-1': starterWorkout };
	let search = '';
	let selectedMuscle: MuscleGroup | 'All' = 'All';
	let reorderMode = false;
	let libraryOpen = false;
	let appearanceOpen = false;
	let dataMenuOpen = false;
	let theme: Theme = 'mocha';
	let accent: Accent = 'mauve';
	let expanded = new Set<string>();
	let hydrated = false;
	let draggedExerciseId: string | null = null;
	let editingDayId: string | null = null;
	let dayNameDraft = '';
	let deleteCandidateId: string | null = null;
	let importInput: HTMLInputElement;
	let pendingImport: LedgerExport | null = null;
	let transferMessage = '';

	$: visibleExercises = exerciseLibrary.filter((exercise) => {
		const query = search.trim().toLowerCase();
		const matchesSearch = !query || exercise.name.toLowerCase().includes(query);
		const matchesMuscle = selectedMuscle === 'All' || exercise.muscles.includes(selectedMuscle);
		return matchesSearch && matchesMuscle;
	});

	$: completedCount = dayExercises.filter((exercise) => exercise.completed).length;
	$: activeDayName = days.find((day) => day.id === activeDayId)?.name ?? 'Untitled day';
	$: savedWorkouts = { ...workouts, [activeDayId]: dayExercises };
	$: if (browser && hydrated) {
		localStorage.setItem(storageKey, JSON.stringify({ workouts: savedWorkouts, days, activeDayId, theme, accent }));
	}

	onMount(() => {
		const saved = localStorage.getItem(storageKey) ?? localStorage.getItem(legacyStorageKey);
		if (saved) {
			try {
				const parsed = JSON.parse(saved) as Partial<{
					dayExercises: WorkoutExercise[];
					workouts: Record<string, WorkoutExercise[]>;
					days: TrainingDay[] | string[];
					activeDayId: string;
					activeDay: string;
					theme: Theme;
					accent: Accent;
				}>;
				if (parsed.theme && themes.includes(parsed.theme)) theme = parsed.theme;
				if (parsed.accent && accents.includes(parsed.accent)) accent = parsed.accent;
				if (parsed.days?.length && typeof parsed.days[0] === 'object') {
					days = parsed.days as TrainingDay[];
					activeDayId = parsed.activeDayId ?? days[0].id;
					if (parsed.workouts) workouts = parsed.workouts;
				} else if (parsed.days?.length) {
					migrateLegacyProgramme(parsed.days as string[], parsed.workouts ?? {}, parsed.activeDay);
				} else if (parsed.dayExercises?.length) {
					workouts = { 'day-1': parsed.dayExercises };
				}
				dayExercises = [...(workouts[activeDayId] ?? [])];
			} catch {
				localStorage.removeItem(storageKey);
			}
		}
		hydrated = true;
	});

	function migrateLegacyProgramme(legacyDays: string[], legacyWorkouts: Record<string, WorkoutExercise[]>, legacyActive?: string) {
		const defaultNames: Record<string, string> = {
			'Push · Strength': 'Day 01',
			'Pull · Hypertrophy': 'Day 02',
			'Legs · Strength': 'Day 03'
		};
		days = legacyDays.map((name, index) => ({ id: `day-${index + 1}`, name: defaultNames[name] ?? name }));
		workouts = Object.fromEntries(days.map((day, index) => [day.id, legacyWorkouts[legacyDays[index]] ?? []]));
		const activeIndex = Math.max(0, legacyDays.indexOf(legacyActive ?? ''));
		activeDayId = days[activeIndex]?.id ?? days[0].id;
	}

	function touch() {
		dayExercises = [...dayExercises];
	}

	function addExercise(exercise: Exercise) {
		if (dayExercises.some((item) => item.id === exercise.id)) return;
		dayExercises = [
			...dayExercises,
			{ ...exercise, sets: 3, reps: '8–12', load: '—', rest: '90 sec', note: '', completed: false }
		];
	}

	function removeExercise(id: string) {
		dayExercises = dayExercises.filter((exercise) => exercise.id !== id);
		expanded.delete(id);
		expanded = new Set(expanded);
	}

	function toggleExpanded(id: string) {
		if (expanded.has(id)) expanded.delete(id);
		else expanded.add(id);
		expanded = new Set(expanded);
	}

	function moveExercise(index: number, direction: -1 | 1) {
		const destination = index + direction;
		if (destination < 0 || destination >= dayExercises.length) return;
		const reordered = [...dayExercises];
		const [exercise] = reordered.splice(index, 1);
		reordered.splice(destination, 0, exercise);
		dayExercises = reordered;
	}

	function handleDragStart(event: DragEvent, id: string) {
		draggedExerciseId = id;
		event.dataTransfer?.setData('text/plain', id);
		if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
	}

	function handleDrop(event: DragEvent, destinationIndex: number) {
		event.preventDefault();
		const id = event.dataTransfer?.getData('text/plain') || draggedExerciseId;
		const sourceIndex = dayExercises.findIndex((exercise) => exercise.id === id);
		if (sourceIndex < 0 || sourceIndex === destinationIndex) return;
		const reordered = [...dayExercises];
		const [exercise] = reordered.splice(sourceIndex, 1);
		reordered.splice(destinationIndex, 0, exercise);
		dayExercises = reordered;
		draggedExerciseId = null;
	}

	function createDay() {
		const id = `day-${Date.now()}`;
		const newDay = { id, name: `Day ${String(days.length + 1).padStart(2, '0')}` };
		workouts = { ...workouts, [activeDayId]: dayExercises, [id]: [] };
		days = [...days, newDay];
		activeDayId = id;
		dayExercises = [];
		startRename(newDay);
	}

	function selectDay(dayId: string) {
		if (dayId === activeDayId) return;
		workouts = { ...workouts, [activeDayId]: dayExercises };
		activeDayId = dayId;
		dayExercises = [...(workouts[dayId] ?? [])];
		deleteCandidateId = null;
	}

	function startRename(day: TrainingDay) {
		editingDayId = day.id;
		dayNameDraft = day.name;
		deleteCandidateId = null;
	}

	function saveDayName() {
		const name = dayNameDraft.trim();
		if (!editingDayId || !name) return;
		days = days.map((day) => (day.id === editingDayId ? { ...day, name } : day));
		editingDayId = null;
	}

	function deleteDay(dayId: string) {
		if (days.length === 1) return;
		const currentIndex = days.findIndex((day) => day.id === dayId);
		const nextDays = days.filter((day) => day.id !== dayId);
		const currentWorkouts = { ...workouts, [activeDayId]: dayExercises };
		delete currentWorkouts[dayId];
		workouts = currentWorkouts;
		days = nextDays;
		if (dayId === activeDayId) {
			activeDayId = nextDays[Math.min(currentIndex, nextDays.length - 1)].id;
			dayExercises = [...(workouts[activeDayId] ?? [])];
		}
		deleteCandidateId = null;
	}

	function exportLedger() {
		const payload: LedgerExport = {
			app: 'pulse',
			version: 1,
			exportedAt: new Date().toISOString(),
			settings: { theme, accent },
			programme: { days, workouts: savedWorkouts }
		};
		const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const anchor = document.createElement('a');
		anchor.href = url;
		anchor.download = `pulse-ledger-${new Date().toISOString().slice(0, 10)}.json`;
		anchor.click();
		URL.revokeObjectURL(url);
		transferMessage = 'Exported a complete copy.';
	}

	async function readImport(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		try {
			const candidate: unknown = JSON.parse(await file.text());
			if (!isLedgerExport(candidate)) throw new Error('This is not a valid Pulse ledger file.');
			pendingImport = candidate;
			transferMessage = '';
		} catch (error) {
			pendingImport = null;
			transferMessage = error instanceof Error ? error.message : 'Could not read that file.';
		} finally {
			input.value = '';
		}
	}

	function applyImport() {
		if (!pendingImport) return;
		const imported = pendingImport;
		days = imported.programme.days.map((day) => ({ ...day }));
		workouts = Object.fromEntries(Object.entries(imported.programme.workouts).map(([id, exercises]) => [id, exercises.map((exercise) => ({ ...exercise }))]));
		activeDayId = days[0].id;
		dayExercises = [...workouts[activeDayId]];
		theme = imported.settings.theme;
		accent = imported.settings.accent;
		pendingImport = null;
		transferMessage = `Imported ${days.length} training ${days.length === 1 ? 'day' : 'days'}.`;
	}

	function isLedgerExport(value: unknown): value is LedgerExport {
		if (!isRecord(value) || value.app !== 'pulse' || value.version !== 1 || !isRecord(value.settings) || !isRecord(value.programme)) return false;
		if (typeof value.settings.theme !== 'string' || !themes.includes(value.settings.theme as Theme)) return false;
		if (typeof value.settings.accent !== 'string' || !accents.includes(value.settings.accent as Accent)) return false;

		const days = value.programme.days;
		const workouts = value.programme.workouts;
		if (!Array.isArray(days) || !days.length || !isRecord(workouts)) return false;
		if (!days.every((day) => isRecord(day) && typeof day.id === 'string' && day.id.length > 0 && typeof day.name === 'string' && day.name.trim().length > 0)) return false;
		const ids = days.map((day) => (day as TrainingDay).id);
		if (new Set(ids).size !== ids.length) return false;
		return ids.every((id) => Array.isArray(workouts[id]) && workouts[id].every(isWorkoutExercise));
	}

	function isWorkoutExercise(value: unknown): value is WorkoutExercise {
		if (!isRecord(value)) return false;
		const stringFields = ['id', 'name', 'equipment', 'guideUrl', 'description', 'reps', 'load', 'rest', 'note'];
		if (!stringFields.every((field) => typeof value[field] === 'string')) return false;
		if (typeof value.sets !== 'number' || !Number.isFinite(value.sets) || value.sets < 1 || typeof value.completed !== 'boolean') return false;
		if (!Array.isArray(value.muscles) || !value.muscles.every((muscle) => muscleGroups.includes(muscle as MuscleGroup))) return false;
		try {
			const guide = new URL(value.guideUrl as string);
			return guide.protocol === 'https:' || guide.protocol === 'http:';
		} catch {
			return false;
		}
	}

	function isRecord(value: unknown): value is Record<string, unknown> {
		return typeof value === 'object' && value !== null && !Array.isArray(value);
	}
</script>

<svelte:head>
	<title>Pulse — Training ledger</title>
	<meta name="description" content="A training programme that follows your rules." />
</svelte:head>

<div class="app" data-theme={theme} data-accent={accent}>
	<header class="masthead">
		<a class="wordmark" href="/" aria-label="Pulse home">
			<span class="wordmark-icon"><Activity size={18} strokeWidth={2.4} /></span>
			<strong>Pulse</strong>
			<span class="wordmark-context">Training ledger</span>
		</a>

		<div class="masthead-actions">
			<p class="save-state"><span></span> Local autosave</p>
			<div class="appearance-anchor">
				<button class:active={appearanceOpen} class="appearance-trigger" onclick={() => { appearanceOpen = !appearanceOpen; dataMenuOpen = false; }} aria-expanded={appearanceOpen} aria-controls="appearance-panel" aria-label="Open appearance settings">
					<Palette size={17} />
				</button>

				{#if appearanceOpen}
					<section class="appearance-panel" id="appearance-panel" aria-label="Appearance settings">
						<header><div><p class="kicker">Personalise</p><h2>Appearance</h2></div><button class="icon-button" onclick={() => (appearanceOpen = false)} aria-label="Close appearance settings"><X size={16} /></button></header>

						<fieldset class="flavour-options">
							<legend>Flavour</legend>
							{#each themes as option}
								<button class:active={theme === option} onclick={() => (theme = option)} aria-pressed={theme === option}>
									<span class={`flavour-preview ${option}`}></span>{option}
								</button>
							{/each}
						</fieldset>

						<fieldset class="accent-options">
							<legend>Accent · {accent}</legend>
							<div>
								{#each accents as option}
									<button style={`--swatch: var(--${option})`} class:active={accent === option} onclick={() => (accent = option)} aria-label={`Use ${option} accent`} aria-pressed={accent === option} title={option}>
										{#if accent === option}<Check size={13} strokeWidth={3} />{/if}
									</button>
								{/each}
							</div>
						</fieldset>
					</section>
				{/if}
			</div>
			<div class="data-anchor">
				<button class:active={dataMenuOpen} class="data-trigger" onclick={() => { dataMenuOpen = !dataMenuOpen; appearanceOpen = false; }} aria-expanded={dataMenuOpen} aria-controls="data-panel" aria-label="Open ledger menu"><Ellipsis size={18} /></button>
				<input class="hidden-file-input" bind:this={importInput} type="file" accept="application/json,.json" onchange={readImport} />

				{#if dataMenuOpen}
					<section class="data-panel" id="data-panel" aria-label="Ledger data menu">
						<header><div><p class="kicker">Portable by default</p><h2>Ledger data</h2></div><FileJson size={20} /></header>
						<button class="data-action" onclick={exportLedger}><Download size={17} /><span><strong>Export ledger</strong><small>Download a complete JSON copy</small></span></button>
						<button class="data-action" onclick={() => importInput.click()}><Upload size={17} /><span><strong>Import ledger</strong><small>Restore from a Pulse export</small></span></button>

						{#if pendingImport}
							<div class="import-confirm">
								<p>Replace this ledger with <strong>{pendingImport.programme.days.length} {pendingImport.programme.days.length === 1 ? 'day' : 'days'}</strong> from the file?</p>
								<div><button onclick={() => (pendingImport = null)}>Cancel</button><button class="replace-data" onclick={applyImport}>Replace ledger</button></div>
							</div>
						{/if}
						{#if transferMessage}<p class:transfer-error={transferMessage.includes('not valid') || transferMessage.includes('Could not')} class="transfer-message">{transferMessage}</p>{/if}
					</section>
				{/if}
			</div>
			<button class="vault-trigger" onclick={() => { libraryOpen = true; appearanceOpen = false; dataMenuOpen = false; }}>
				<LibraryBig size={16} />
				Exercise vault
			</button>
		</div>
	</header>

	<main class="ledger">
		<aside class="programme-index" aria-label="Programme days">
			<div class="index-heading">
				<span>Programme</span>
				<strong>01</strong>
			</div>

			<div class="day-list">
				{#each days as day, index}
					<div class:active={day.id === activeDayId} class="day-entry">
						{#if editingDayId === day.id}
							<form class="day-name-form" onsubmit={(event) => { event.preventDefault(); saveDayName(); }}>
								<input bind:value={dayNameDraft} aria-label="Training day name" maxlength="36" />
								<button type="submit" aria-label="Save day name"><Save size={14} /></button>
							</form>
						{:else}
							<button class="day-select" onclick={() => selectDay(day.id)}>
								<span>{String(index + 1).padStart(2, '0')}</span>
								<strong>{day.name}</strong>
								<small>{day.id === activeDayId ? dayExercises.length : (workouts[day.id]?.length ?? 0)} movements</small>
							</button>
							{#if day.id === activeDayId}
								<div class="day-controls">
									{#if deleteCandidateId === day.id}
										<button class="keep-day" onclick={() => (deleteCandidateId = null)}>Keep</button>
										<button class="confirm-delete" onclick={() => deleteDay(day.id)}>Delete</button>
									{:else}
										<button onclick={() => startRename(day)} aria-label={`Rename ${day.name}`}><Pencil size={13} /></button>
										<button onclick={() => (deleteCandidateId = day.id)} disabled={days.length === 1} aria-label={`Delete ${day.name}`}><Trash2 size={13} /></button>
									{/if}
								</div>
							{/if}
						{/if}
					</div>
				{/each}
			</div>

			<button class="new-day" onclick={createDay}><Plus size={15} /> New training day</button>
		</aside>

		<section class="session-page" aria-labelledby="session-title">
			<header class="session-heading">
				<div>
					<p class="kicker">Sequence {String(Math.max(0, days.findIndex((day) => day.id === activeDayId)) + 1).padStart(2, '0')}</p>
					<h1 id="session-title">{activeDayName}</h1>
					<p class="session-summary">
						<span>{dayExercises.length} movements</span>
						<span>{completedCount} complete</span>
					</p>
				</div>
				<button class:active={reorderMode} class="reorder-toggle" onclick={() => (reorderMode = !reorderMode)} aria-pressed={reorderMode}>
					<GripVertical size={16} />
					{reorderMode ? 'Finish order' : 'Set order'}
				</button>
			</header>

			{#if dayExercises.length}
				<div class="movement-list">
					{#each dayExercises as exercise, index (exercise.id)}
						<article
							class:completed={exercise.completed}
							class:reordering={reorderMode}
							class="movement"
							draggable={reorderMode}
							ondragstart={(event) => handleDragStart(event, exercise.id)}
							ondragover={(event) => reorderMode && event.preventDefault()}
							ondrop={(event) => reorderMode && handleDrop(event, index)}
						>
							<div class="movement-main">
								<div class="sequence-number">
									{#if reorderMode}<GripVertical size={17} />{/if}
									<span>{String(index + 1).padStart(2, '0')}</span>
								</div>

								<label class="completion-control">
									<input type="checkbox" bind:checked={exercise.completed} oninput={touch} aria-label={`Mark ${exercise.name} complete`} />
									<span><Check size={13} strokeWidth={3} /></span>
								</label>

								<div class="movement-name">
									<h2>{exercise.name}</h2>
									<p>{exercise.muscles.join(' / ')} <span>—</span> {exercise.equipment}</p>
								</div>

								<button class="details-toggle" onclick={() => toggleExpanded(exercise.id)} aria-expanded={expanded.has(exercise.id)} aria-controls={`${exercise.id}-details`}>
									<span>Details</span>
									<ChevronDown class={expanded.has(exercise.id) ? 'turned' : ''} size={17} />
								</button>
							</div>

							<div class="prescription">
								<label><span>Sets</span><input type="number" min="1" max="20" bind:value={exercise.sets} oninput={touch} /></label>
								<label><span>Rep range</span><input bind:value={exercise.reps} oninput={touch} /></label>
								<label><span>Working load</span><input bind:value={exercise.load} oninput={touch} /></label>
								<label><span>Rest</span><input bind:value={exercise.rest} oninput={touch} /></label>
							</div>

							{#if expanded.has(exercise.id)}
								<div class="movement-details" id={`${exercise.id}-details`}>
									<p>{exercise.description}</p>
									<div class="details-toolbar">
										<a href={exercise.guideUrl} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Open form reference</a>
										<label class="movement-note"><span>Private cue</span><input placeholder="What should you remember?" bind:value={exercise.note} oninput={touch} /></label>
										{#if reorderMode}
											<div class="move-buttons">
												<button onclick={() => moveExercise(index, -1)} disabled={index === 0} aria-label={`Move ${exercise.name} up`}><ArrowUp size={15} /></button>
												<button onclick={() => moveExercise(index, 1)} disabled={index === dayExercises.length - 1} aria-label={`Move ${exercise.name} down`}><ArrowDown size={15} /></button>
											</div>
										{/if}
										<button class="delete-movement" onclick={() => removeExercise(exercise.id)} aria-label={`Remove ${exercise.name}`}><Trash2 size={15} /></button>
									</div>
								</div>
							{/if}
						</article>
					{/each}
				</div>
			{:else}
				<div class="blank-session">
					<p>Nothing prescribed.</p>
					<span>This day is yours to define.</span>
					<button onclick={() => (libraryOpen = true)}><Plus size={15} /> Add the first movement</button>
				</div>
			{/if}
		</section>
	</main>

	{#if libraryOpen}
		<button class="drawer-scrim" onclick={() => (libraryOpen = false)} aria-label="Close exercise vault"></button>
		<aside class="exercise-vault" aria-labelledby="vault-title">
			<header>
				<div><p class="kicker">Movement archive</p><h2 id="vault-title">Exercise vault</h2></div>
				<button class="icon-button" onclick={() => (libraryOpen = false)} aria-label="Close exercise vault"><X size={18} /></button>
			</header>

			<label class="vault-search"><Search size={16} /><input placeholder="Search your movements" bind:value={search} /></label>

			<div class="muscle-filters" aria-label="Filter exercises by muscle group">
				{#each muscleGroups as muscle}
					<button class:active={selectedMuscle === muscle} onclick={() => (selectedMuscle = muscle)}>{muscle}</button>
				{/each}
			</div>

			<div class="vault-list">
				{#each visibleExercises as exercise (exercise.id)}
					<article>
						<div><h3>{exercise.name}</h3><p>{exercise.muscles.join(' / ')} · {exercise.equipment}</p></div>
						<button class:added={dayExercises.some((item) => item.id === exercise.id)} onclick={() => addExercise(exercise)} disabled={dayExercises.some((item) => item.id === exercise.id)}>
							{#if dayExercises.some((item) => item.id === exercise.id)}<Check size={14} /> Added{:else}<Plus size={14} /> Add{/if}
						</button>
					</article>
				{:else}
					<p class="vault-empty">Nothing matches that search.</p>
				{/each}
			</div>
		</aside>
	{/if}
</div>
