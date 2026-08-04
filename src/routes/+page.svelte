<script lang="ts">
	import { browser } from '$app/environment';
	import { exerciseLibrary, starterWorkout } from '$lib/data';
	import type { Exercise, MuscleGroup, WorkoutExercise } from '$lib/types';
	import { onMount } from 'svelte';

	const storageKey = 'pulse-push-strength-v1';
	const muscleGroups: Array<MuscleGroup | 'All'> = ['All', 'Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Core'];
	const themes = ['mocha', 'macchiato', 'frappe', 'latte'] as const;

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
	let priorityMode = false;
	let expanded = new Set<string>();
	let theme: (typeof themes)[number] = 'mocha';
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
		localStorage.setItem(storageKey, JSON.stringify({ workouts: savedWorkouts, days, activeDay, theme }));
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
					theme: (typeof themes)[number];
				}>;
				if (parsed.days?.length) days = parsed.days;
				if (parsed.activeDay) activeDay = parsed.activeDay;
				if (parsed.theme && themes.includes(parsed.theme)) theme = parsed.theme;
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
	<title>Pulse — Workout planner</title>
	<meta
		name="description"
		content="Build focused training days and keep your exercise library close at hand."
	/>
</svelte:head>

<main data-theme={theme}>
	<section class="app-shell" aria-label="Pulse workout planner">
		<aside class="sidebar">
			<a class="brand" href="/" aria-label="Pulse home">
				<span class="brand-mark" aria-hidden="true">P</span>
				<span>pulse</span>
			</a>

			<nav aria-label="Main navigation">
				<a class="nav-link active" href="#today"><span aria-hidden="true">◈</span> Programme</a>
				<a class="nav-link" href="#library"><span aria-hidden="true">⌕</span> Exercises</a>
				<a class="nav-link" href="#progress"><span aria-hidden="true">↗</span> Progress</a>
			</nav>

			<div class="sidebar-bottom">
				<div class="theme-picker">
					<label for="theme">Flavour</label>
					<select id="theme" bind:value={theme} aria-label="Catppuccin flavour">
						{#each themes as flavour}
							<option value={flavour}>{flavour}</option>
						{/each}
					</select>
				</div>
				<p class="small-muted">Your programme is saved on this device.</p>
			</div>
		</aside>

		<div class="content">
			<header class="topbar">
				<div>
					<p class="eyebrow">Monday · week 32</p>
					<h1>Build with intent.</h1>
				</div>
				<div class="topbar-actions">
					<button class="icon-button" aria-label="Notifications">◌</button>
					<button class="avatar" aria-label="Open profile">N</button>
				</div>
			</header>

			<div class="page-grid">
				<section class="workout-column" id="today" aria-labelledby="day-heading">
					<div class="day-tabs" aria-label="Programme days">
						{#each days as day}
							<button class:current={activeDay === day} onclick={() => selectDay(day)}>{day}</button>
						{/each}
						<button class="add-day" onclick={createDay} aria-label="Create a training day">+</button>
					</div>

					<div class="workout-heading">
						<div>
							<p class="eyebrow">Current day</p>
							<h2 id="day-heading">{activeDay}</h2>
							<p class="subtle">{dayExercises.length} exercises · {completedCount}/{dayExercises.length} complete</p>
						</div>
						<button class:enabled={priorityMode} class="priority-toggle" onclick={() => (priorityMode = !priorityMode)} aria-pressed={priorityMode}>
							<span aria-hidden="true">↕</span> {priorityMode ? 'Done ordering' : 'Set priority'}
						</button>
					</div>

					<div class="exercise-list" aria-label="Exercises in this workout">
						{#each dayExercises as exercise, index (exercise.id)}
							<article
								class:priority-mode={priorityMode}
								class:complete={exercise.completed}
								class="workout-card"
								draggable={priorityMode}
								ondragstart={(event) => handleDragStart(event, exercise.id)}
								ondragover={(event) => priorityMode && event.preventDefault()}
								ondrop={(event) => priorityMode && handleDrop(event, index)}
							>
								<div class="card-topline">
									{#if priorityMode}
										<span class="drag-handle" aria-label={`Priority ${index + 1}`} title="Drag to reorder">⠿</span>
									{/if}
									<label class="completion" title="Mark exercise complete">
										<input type="checkbox" bind:checked={exercise.completed} oninput={touch} aria-label={`Mark ${exercise.name} complete`} />
										<span aria-hidden="true">✓</span>
									</label>
									<div class="exercise-title">
										<div class="title-line"><span class="priority-number">{index + 1}</span><h3>{exercise.name}</h3></div>
										<p>{exercise.muscles.join(' · ')} <span>·</span> {exercise.equipment}</p>
									</div>
									<button class="expand-button" onclick={() => toggleExpanded(exercise.id)} aria-expanded={expanded.has(exercise.id)} aria-controls={`${exercise.id}-details`}>
										<span class:rotated={expanded.has(exercise.id)} aria-hidden="true">⌄</span><span class="sr-only">Toggle details for {exercise.name}</span>
									</button>
								</div>

								<div class="training-fields">
									<label><span>Sets</span><input type="number" min="1" max="20" bind:value={exercise.sets} oninput={touch} /></label>
									<label><span>Reps</span><input bind:value={exercise.reps} oninput={touch} /></label>
									<label><span>Load</span><input bind:value={exercise.load} oninput={touch} /></label>
									<label><span>Rest</span><input bind:value={exercise.rest} oninput={touch} /></label>
								</div>

								{#if expanded.has(exercise.id)}
									<div class="exercise-details" id={`${exercise.id}-details`}>
										<p>{exercise.description}</p>
										<div class="detail-actions">
											<a href={exercise.guideUrl} target="_blank" rel="noreferrer">Watch form guide <span aria-hidden="true">↗</span></a>
											<label class="note"><span>Note</span><input placeholder="Add a cue or target" bind:value={exercise.note} oninput={touch} /></label>
											{#if priorityMode}
												<div class="move-controls" aria-label={`Move ${exercise.name}`}>
													<button onclick={() => moveExercise(index, -1)} disabled={index === 0}>↑</button>
													<button onclick={() => moveExercise(index, 1)} disabled={index === dayExercises.length - 1}>↓</button>
												</div>
											{/if}
											<button class="remove" onclick={() => removeExercise(exercise.id)}>Remove</button>
										</div>
									</div>
								{/if}
							</article>
						{/each}
					</div>
				</section>

				<aside class="library-panel" id="library" aria-labelledby="library-heading">
					<div class="library-heading">
						<div>
							<p class="eyebrow">Your library</p>
							<h2 id="library-heading">Add an exercise</h2>
						</div>
						<span class="library-count">{exerciseLibrary.length}</span>
					</div>

					<label class="search"><span aria-hidden="true">⌕</span><input placeholder="Search exercises" bind:value={search} /></label>
					<div class="filters" aria-label="Filter by muscle group">
						{#each muscleGroups as muscle}
							<button class:chosen={selectedMuscle === muscle} onclick={() => (selectedMuscle = muscle)}>{muscle}</button>
						{/each}
					</div>

					<div class="library-list">
						{#each visibleExercises as exercise (exercise.id)}
							<div class="library-item">
								<div><h3>{exercise.name}</h3><p>{exercise.muscles.join(' · ')}</p></div>
								<button class:added={dayExercises.some((item) => item.id === exercise.id)} onclick={() => addExercise(exercise)} disabled={dayExercises.some((item) => item.id === exercise.id)}>
									{dayExercises.some((item) => item.id === exercise.id) ? 'Added' : 'Add'}
								</button>
							</div>
						{:else}
							<p class="empty">No exercises match that filter.</p>
						{/each}
					</div>

					<div class="tip-card">
						<span aria-hidden="true">✦</span>
						<div><strong>Keep it intentional</strong><p>Set priority when exercise order matters. The first movement gets your freshest effort.</p></div>
					</div>
				</aside>
			</div>
		</div>
	</section>
</main>
