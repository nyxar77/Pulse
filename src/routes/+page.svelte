<script lang="ts">
	import { browser } from '$app/environment';
	import { exerciseLibrary, starterWorkout } from '$lib/data';
	import type { Exercise, MuscleGroup, WorkoutExercise } from '$lib/types';
	import {
		Activity,
		ArrowDown,
		ArrowUp,
		Check,
		ChevronDown,
		ExternalLink,
		GripVertical,
		LibraryBig,
		Plus,
		Search,
		Trash2,
		X
	} from 'lucide-svelte';
	import { onMount } from 'svelte';

	const storageKey = 'pulse-push-strength-v1';
	const muscleGroups: Array<MuscleGroup | 'All'> = ['All', 'Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Core'];

	let dayExercises: WorkoutExercise[] = starterWorkout;
	let activeDay = 'Push · Strength';
	let days = ['Push · Strength', 'Pull · Hypertrophy', 'Legs · Strength'];
	let workouts: Record<string, WorkoutExercise[]> = {
		'Push · Strength': starterWorkout,
		'Pull · Hypertrophy': [],
		'Legs · Strength': []
	};
	let search = '';
	let selectedMuscle: MuscleGroup | 'All' = 'All';
	let reorderMode = false;
	let libraryOpen = false;
	let expanded = new Set<string>();
	let hydrated = false;
	let draggedExerciseId: string | null = null;

	$: visibleExercises = exerciseLibrary.filter((exercise) => {
		const query = search.trim().toLowerCase();
		const matchesSearch = !query || exercise.name.toLowerCase().includes(query);
		const matchesMuscle = selectedMuscle === 'All' || exercise.muscles.includes(selectedMuscle);
		return matchesSearch && matchesMuscle;
	});

	$: completedCount = dayExercises.filter((exercise) => exercise.completed).length;
	$: savedWorkouts = { ...workouts, [activeDay]: dayExercises };
	$: if (browser && hydrated) {
		localStorage.setItem(storageKey, JSON.stringify({ workouts: savedWorkouts, days, activeDay }));
	}

	onMount(() => {
		const saved = localStorage.getItem(storageKey);
		if (saved) {
			try {
				const parsed = JSON.parse(saved) as Partial<{
					dayExercises: WorkoutExercise[];
					workouts: Record<string, WorkoutExercise[]>;
					days: string[];
					activeDay: string;
				}>;
				if (parsed.days?.length) days = parsed.days;
				if (parsed.activeDay) activeDay = parsed.activeDay;
				if (parsed.workouts) workouts = parsed.workouts;
				else if (parsed.dayExercises?.length) workouts = { ...workouts, [activeDay]: parsed.dayExercises };
				dayExercises = [...(workouts[activeDay] ?? [])];
			} catch {
				localStorage.removeItem(storageKey);
			}
		}
		hydrated = true;
	});

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
		const newDay = `New day ${days.length - 2}`;
		workouts = { ...workouts, [activeDay]: dayExercises, [newDay]: [] };
		days = [...days, newDay];
		activeDay = newDay;
		dayExercises = [];
	}

	function selectDay(day: string) {
		if (day === activeDay) return;
		workouts = { ...workouts, [activeDay]: dayExercises };
		activeDay = day;
		dayExercises = [...(workouts[day] ?? [])];
	}
</script>

<svelte:head>
	<title>Pulse — Training ledger</title>
	<meta name="description" content="A training programme that follows your rules." />
</svelte:head>

<div class="app" data-theme="mocha">
	<header class="masthead">
		<a class="wordmark" href="/" aria-label="Pulse home">
			<span class="wordmark-icon"><Activity size={18} strokeWidth={2.4} /></span>
			<strong>Pulse</strong>
			<span class="wordmark-context">Training ledger</span>
		</a>

		<div class="masthead-actions">
			<p class="save-state"><span></span> Local autosave</p>
			<button class="vault-trigger" onclick={() => (libraryOpen = true)}>
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

			<nav class="day-list">
				{#each days as day, index}
					<button class:active={day === activeDay} onclick={() => selectDay(day)}>
						<span>{String(index + 1).padStart(2, '0')}</span>
						<strong>{day}</strong>
						<small>{workouts[day]?.length ?? 0} movements</small>
					</button>
				{/each}
			</nav>

			<button class="new-day" onclick={createDay}><Plus size={15} /> New training day</button>
		</aside>

		<section class="session-page" aria-labelledby="session-title">
			<header class="session-heading">
				<div>
					<p class="kicker">Sequence {String(days.indexOf(activeDay) + 1).padStart(2, '0')}</p>
					<h1 id="session-title">{activeDay}</h1>
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
