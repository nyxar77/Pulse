<script lang="ts">
  import { browser } from "$app/environment";
  import AutocompleteInput from "$lib/components/AutocompleteInput.svelte";
  import TagCombobox from "$lib/components/TagCombobox.svelte";
  import { exerciseLibrary, starterWorkout } from "$lib/data";
  import {
    accents,
    isExercise,
    isLedgerExport,
    isOptionalWebUrl,
    localDateKey,
    moveItem,
    normaliseTrainingHistory,
    normaliseWeight,
    parseWeight,
    reorderItems,
    stepWeight,
    themes,
    toggleHistoryExercise,
    weekIndex,
    weightInputValue,
    weightLabel,
    weekdays,
    type Accent,
    type LedgerExport,
    type Theme,
  } from "$lib/ledger";
  import { applyNativeTheme, isNativeApp, shareLedgerFile } from "$lib/native";
  import { equipmentOptions, muscleOptions } from "$lib/options";
  import { sheetDragProgress, shouldDismissSheet } from "$lib/sheet";
  import { loadLedgerData, saveLedgerData } from "$lib/storage";
  import type { Exercise, TrainingDay, TrainingHistory, WeekSchedule, WorkoutExercise } from "$lib/types";
  import Activity from "lucide-svelte/icons/activity";
  import Archive from "lucide-svelte/icons/archive";
  import ArchiveRestore from "lucide-svelte/icons/archive-restore";
  import ArrowDown from "lucide-svelte/icons/arrow-down";
  import ArrowUp from "lucide-svelte/icons/arrow-up";
  import CalendarDays from "lucide-svelte/icons/calendar-days";
  import Check from "lucide-svelte/icons/check";
  import Circle from "lucide-svelte/icons/circle";
  import CircleCheck from "lucide-svelte/icons/circle-check";
  import ChevronDown from "lucide-svelte/icons/chevron-down";
  import Copy from "lucide-svelte/icons/copy";
  import Download from "lucide-svelte/icons/download";
  import Dumbbell from "lucide-svelte/icons/dumbbell";
  import EllipsisVertical from "lucide-svelte/icons/ellipsis-vertical";
  import ExternalLink from "lucide-svelte/icons/external-link";
  import FileJson from "lucide-svelte/icons/file-json";
  import GripVertical from "lucide-svelte/icons/grip-vertical";
  import LibraryBig from "lucide-svelte/icons/library-big";
  import ListFilter from "lucide-svelte/icons/list-filter";
  import Minus from "lucide-svelte/icons/minus";
  import Pencil from "lucide-svelte/icons/pencil";
  import Plus from "lucide-svelte/icons/plus";
  import Save from "lucide-svelte/icons/save";
  import Search from "lucide-svelte/icons/search";
  import Settings from "lucide-svelte/icons/settings";
  import Trash2 from "lucide-svelte/icons/trash-2";
  import Upload from "lucide-svelte/icons/upload";
  import X from "lucide-svelte/icons/x";
  import { onMount, tick } from "svelte";

  const suggestedGroups = ["Chest", "Back", "Shoulders", "Arms", "Legs", "Core"];
  type ExerciseDraft = {
    name: string;
    muscles: string[];
    tags: string;
    equipment: string;
    description: string;
    guideUrl: string;
    imageUrl: string;
  };
  type AppView = "today" | "programme" | "settings";
  type ViewTransitionDocument = Document & {
    startViewTransition?: (update: () => void | Promise<void>) => void;
  };
  const mobileVaultQuery = "(max-width: 600px), (max-width: 900px) and (max-height: 520px) and (orientation: landscape)";
  const initialDate = new Date();
  const initialWeekday = weekIndex(initialDate);
  let days: TrainingDay[] = createFixedWeekDays();
  let activeDayId = days[initialWeekday].id;
  let workouts: Record<string, WorkoutExercise[]> = emptyWeekWorkouts(days);
  workouts[activeDayId] = starterWorkout;
  let dayExercises: WorkoutExercise[] = starterWorkout;
  let schedule: WeekSchedule = days.map((day) => day.id);
  let history: TrainingHistory = {};
  let currentDate: Date | null = initialDate;
  let activeView: AppView = "today";
  let selectedWeekday = initialWeekday;
  let weekPickerOpen = false;
  let savedExercises: Exercise[] = exerciseLibrary.map((exercise) => ({
    ...exercise,
  }));
  let search = "";
  let selectedMuscle = "All";
  let editMode = false;
  let showArchived = false;
  let exerciseEditorOpen = false;
  let editingExerciseId: string | null = null;
  let exerciseDraft: ExerciseDraft = blankExerciseDraft();
  let exerciseFormError = "";
  let deleteExerciseCandidateId: string | null = null;
  let exerciseActionsId: string | null = null;
  let reorderMode = false;
  let libraryOpen = false;
  let theme: Theme = "mocha";
  let accent: Accent = "mauve";
  let expanded = new Set<string>();
  let hydrated = false;
  let draggedExerciseId: string | null = null;
  let importInput: HTMLInputElement;
  let pendingImport: LedgerExport | null = null;
  let transferMessage = "";
  let addMovementButton: HTMLElement | undefined;
  let vaultCloseButton: HTMLButtonElement | undefined;
  let vaultElement: HTMLDivElement | undefined;
  let vaultScrim: HTMLButtonElement | undefined;
  let dragPointerId: number | null = null;
  let libraryClosing = false;
  let libraryReturnFocus: HTMLElement | null = null;
  let vaultFiltersOpen = false;
  let vaultDragY = 0;
  let vaultDragPointerId: number | null = null;
  let vaultDragStartY = 0;
  let vaultDragLastY = 0;
  let vaultDragLastAt = 0;
  let vaultDragVelocity = 0;
  let vaultDragSheetHeight = 0;
  let vaultDragMoved = false;
  let vaultRenderFrame: number | null = null;

  $: availableGroups = ["All", ...new Set([...suggestedGroups, ...savedExercises.flatMap((exercise) => [...exercise.muscles, ...(exercise.tags ?? [])])])];
  $: archivedCount = savedExercises.filter((exercise) => exercise.archived).length;
  $: visibleExercises = savedExercises.filter((exercise) => {
    const query = search.trim().toLowerCase();
    const searchable = [exercise.name, exercise.equipment, ...exercise.muscles, ...(exercise.tags ?? [])].join(" ").toLowerCase();
    const matchesSearch = !query || searchable.includes(query);
    const matchesMuscle = selectedMuscle === "All" || exercise.muscles.includes(selectedMuscle) || exercise.tags?.includes(selectedMuscle);
    return matchesSearch && matchesMuscle && Boolean(exercise.archived) === showArchived;
  });
  $: activeDayName = days.find((day) => day.id === activeDayId)?.name ?? "Untitled day";
  $: savedWorkouts = { ...workouts, [activeDayId]: dayExercises };
  $: todayIndex = currentDate ? weekIndex(currentDate) : 0;
  $: todayKey = currentDate ? localDateKey(currentDate) : "";
  $: todayPlanId = schedule[todayIndex] ?? null;
  $: todayPlan = todayPlanId ? (days.find((day) => day.id === todayPlanId) ?? null) : null;
  $: todayExercises = todayPlanId ? (todayPlanId === activeDayId ? dayExercises : (workouts[todayPlanId] ?? [])) : [];
  $: todayCompleted = new Set(todayKey ? (history[todayKey] ?? []) : []);
  $: completedTodayCount = todayExercises.filter((exercise) => todayCompleted.has(exercise.id)).length;
  $: if (browser) void applyNativeTheme(theme);
  $: if (browser && hydrated) {
    saveLedgerData({
      workouts: savedWorkouts,
      days,
      activeDayId,
      theme,
      accent,
      exercises: savedExercises,
      schedule,
      history,
    });
  }
  $: if (browser) document.body.classList.toggle("has-overlay", libraryOpen);

  onMount(() => {
    void Promise.all([import("@material/web/button/filled-tonal-button.js"), import("@material/web/button/text-button.js")]);
    currentDate = new Date();
    selectedWeekday = weekIndex(currentDate);
    void hydrateLedger();
    const refreshDate = () => {
      const nextDate = new Date();
      if (!currentDate || localDateKey(nextDate) !== localDateKey(currentDate)) currentDate = nextDate;
    };
    const dateRefreshTimer = window.setInterval(refreshDate, 60_000);
    document.addEventListener("visibilitychange", refreshDate);
    return () => {
      window.clearInterval(dateRefreshTimer);
      document.removeEventListener("visibilitychange", refreshDate);
      document.body.classList.remove("is-reordering", "has-overlay");
    };
  });

  onMount(() => {
    if (!isNativeApp()) return;

    let removeBackListener: (() => Promise<void>) | undefined;
    void import("@capacitor/app").then(async ({ App }) => {
      const listener = await App.addListener("backButton", () => {
        if (exerciseEditorOpen) exerciseEditorOpen = false;
        else if (exerciseActionsId) exerciseActionsId = null;
        else if (vaultFiltersOpen) vaultFiltersOpen = false;
        else if (libraryOpen) closeLibrary(false);
        else if (editMode) toggleEditMode();
        else void App.minimizeApp();
      });
      removeBackListener = () => listener.remove();
    });

    return () => void removeBackListener?.();
  });

  async function hydrateLedger() {
    const saved = await loadLedgerData();
    if (saved) {
      try {
        const parsed = saved as Partial<{
          dayExercises: WorkoutExercise[];
          workouts: Record<string, WorkoutExercise[]>;
          days: TrainingDay[] | string[];
          activeDayId: string;
          activeDay: string;
          theme: Theme;
          accent: Accent;
          exercises: Exercise[];
          schedule: WeekSchedule;
          history: TrainingHistory;
        }>;
        if (parsed.theme && themes.includes(parsed.theme)) theme = parsed.theme;
        if (parsed.accent && accents.includes(parsed.accent)) accent = parsed.accent;
        if (parsed.exercises?.length) savedExercises = parsed.exercises.filter(isExercise);
        const sourceDays = parsed.days?.length
          ? typeof parsed.days[0] === "object"
            ? (parsed.days as TrainingDay[])
            : (parsed.days as string[]).map((name, index) => ({ id: `legacy-${index}`, name }))
          : [{ id: "legacy-0", name: "Workout" }];
        const sourceWorkouts =
          parsed.days?.length && typeof parsed.days[0] === "string"
            ? Object.fromEntries((parsed.days as string[]).map((name, index) => [`legacy-${index}`, parsed.workouts?.[name] ?? []]))
            : (parsed.workouts ?? { "legacy-0": parsed.dayExercises ?? [] });
        installWeeklyProgramme(sourceDays, sourceWorkouts);
        history = normaliseTrainingHistory(parsed.history);
      } catch {}
    }
    hydrated = true;
  }

  function createFixedWeekDays(): TrainingDay[] {
    return weekdays.map((name, index) => ({ id: `weekday-${index}`, name }));
  }

  function emptyWeekWorkouts(weekDays: TrainingDay[]): Record<string, WorkoutExercise[]> {
    return Object.fromEntries(weekDays.map((day) => [day.id, []]));
  }

  function installWeeklyProgramme(sourceDays: TrainingDay[], sourceWorkouts: Record<string, WorkoutExercise[]>) {
    const fixedDays = createFixedWeekDays();
    const nextWorkouts = emptyWeekWorkouts(fixedDays);
    const alreadyFixed = fixedDays.every((day) => sourceDays.some((sourceDay) => sourceDay.id === day.id));

    if (alreadyFixed) {
      for (const day of fixedDays) nextWorkouts[day.id] = [...(sourceWorkouts[day.id] ?? [])];
    } else {
      sourceDays.slice(0, 7).forEach((sourceDay, offset) => {
        const namedWeekday = weekdays.findIndex((weekday) => weekday.toLowerCase() === sourceDay.name.trim().toLowerCase());
        const targetIndex = namedWeekday >= 0 ? namedWeekday : (initialWeekday + offset) % 7;
        nextWorkouts[fixedDays[targetIndex].id] = [...(sourceWorkouts[sourceDay.id] ?? [])];
      });
    }

    days = fixedDays;
    workouts = nextWorkouts;
    schedule = fixedDays.map((day) => day.id);
    selectedWeekday = currentDate ? weekIndex(currentDate) : initialWeekday;
    activeDayId = fixedDays[selectedWeekday].id;
    dayExercises = [...nextWorkouts[activeDayId]];
  }

  function blankExerciseDraft(): ExerciseDraft {
    return {
      name: "",
      muscles: [],
      tags: "",
      equipment: "",
      description: "",
      guideUrl: "",
      imageUrl: "",
    };
  }

  function openExerciseCreator() {
    editingExerciseId = null;
    exerciseDraft = blankExerciseDraft();
    exerciseFormError = "";
    exerciseEditorOpen = true;
    deleteExerciseCandidateId = null;
    exerciseActionsId = null;
  }

  function openExerciseEditor(exercise: Exercise) {
    editingExerciseId = exercise.id;
    exerciseDraft = {
      name: exercise.name,
      muscles: [...exercise.muscles],
      tags: (exercise.tags ?? []).join(", "),
      equipment: exercise.equipment,
      description: exercise.description,
      guideUrl: exercise.guideUrl,
      imageUrl: exercise.imageUrl ?? "",
    };
    exerciseFormError = "";
    exerciseEditorOpen = true;
    deleteExerciseCandidateId = null;
    exerciseActionsId = null;
  }

  function duplicateExercise(exercise: Exercise) {
    openExerciseEditor(exercise);
    editingExerciseId = null;
    exerciseDraft = { ...exerciseDraft, name: `${exercise.name} variation` };
  }

  function saveExerciseDefinition() {
    const name = exerciseDraft.name.trim();
    const muscles = exerciseDraft.muscles;
    const tags = parseLabels(exerciseDraft.tags);
    const guideUrl = exerciseDraft.guideUrl.trim();
    const imageUrl = exerciseDraft.imageUrl.trim();
    if (!name) {
      exerciseFormError = "Give the exercise a name.";
      return;
    }
    if (!muscles.length && !tags.length) {
      exerciseFormError = "Add at least one muscle or personal tag.";
      return;
    }
    if (!isOptionalWebUrl(guideUrl) || !isOptionalWebUrl(imageUrl)) {
      exerciseFormError = "Media links must start with http:// or https://.";
      return;
    }

    const existing = editingExerciseId ? savedExercises.find((exercise) => exercise.id === editingExerciseId) : undefined;
    const updated: Exercise = {
      id: existing?.id ?? `exercise-${Date.now()}`,
      name,
      muscles,
      tags,
      equipment: exerciseDraft.equipment.trim() || "No equipment",
      description: exerciseDraft.description.trim(),
      guideUrl,
      imageUrl: imageUrl || undefined,
      custom: true,
      archived: existing?.archived ?? false,
    };

    if (existing) {
      savedExercises = savedExercises.map((exercise) => (exercise.id === existing.id ? updated : exercise));
      updateExerciseReferences(updated);
    } else {
      savedExercises = [...savedExercises, updated];
    }
    exerciseEditorOpen = false;
    editingExerciseId = null;
    exerciseFormError = "";
    showArchived = false;
  }

  function updateExerciseReferences(updated: Exercise) {
    const merge = (exercise: WorkoutExercise): WorkoutExercise =>
      exercise.id === updated.id
        ? {
            ...exercise,
            name: updated.name,
            muscles: updated.muscles,
            tags: updated.tags,
            equipment: updated.equipment,
            description: updated.description,
            guideUrl: updated.guideUrl,
            imageUrl: updated.imageUrl,
          }
        : exercise;
    dayExercises = dayExercises.map(merge);
    workouts = Object.fromEntries(Object.entries(workouts).map(([id, exercises]) => [id, exercises.map(merge)]));
  }

  function toggleExerciseArchive(exercise: Exercise) {
    savedExercises = savedExercises.map((item) => (item.id === exercise.id ? { ...item, archived: !item.archived } : item));
    deleteExerciseCandidateId = null;
    exerciseActionsId = null;
  }

  function deleteExerciseDefinition(id: string) {
    savedExercises = savedExercises.filter((exercise) => exercise.id !== id);
    deleteExerciseCandidateId = null;
    exerciseActionsId = null;
  }

  function parseLabels(value: string): string[] {
    return [
      ...new Set(
        value
          .split(",")
          .map((label) => label.trim())
          .filter(Boolean),
      ),
    ];
  }

  function touch() {
    dayExercises = [...dayExercises];
  }

  function toggleEditMode() {
    editMode = !editMode;
    if (!editMode) {
      reorderMode = false;
    }
  }

  function adjustSets(exercise: WorkoutExercise, delta: number) {
    exercise.sets = Math.min(20, Math.max(1, Math.round(exercise.sets + delta)));
    touch();
  }

  function adjustWeight(exercise: WorkoutExercise, delta: number) {
    exercise.load = stepWeight(exercise.load, delta);
    touch();
  }

  function updateWeightInput(exercise: WorkoutExercise, event: Event) {
    exercise.load = (event.currentTarget as HTMLInputElement).value;
    touch();
  }

  function settleWeight(exercise: WorkoutExercise) {
    exercise.load = normaliseWeight(exercise.load);
    touch();
  }

  function addExercise(exercise: Exercise) {
    exerciseActionsId = null;
    if (dayExercises.some((item) => item.id === exercise.id)) return;
    dayExercises = [
      ...dayExercises,
      {
        ...exercise,
        sets: 3,
        reps: "8–12",
        load: "—",
        rest: "90 sec",
        note: "",
        completed: false,
      },
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
    dayExercises = moveItem(dayExercises, index, direction);
  }

  function startPointerReorder(event: PointerEvent, id: string) {
    if (!reorderMode || event.button !== 0) return;
    event.preventDefault();
    draggedExerciseId = id;
    dragPointerId = event.pointerId;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    document.body.classList.add("is-reordering");
  }

  function handlePointerReorder(event: PointerEvent) {
    if (dragPointerId !== event.pointerId || !draggedExerciseId) return;
    event.preventDefault();
    const destination = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-exercise-id]");
    const destinationId = destination?.dataset.exerciseId;
    const sourceIndex = dayExercises.findIndex((exercise) => exercise.id === draggedExerciseId);
    const destinationIndex = dayExercises.findIndex((exercise) => exercise.id === destinationId);
    if (sourceIndex < 0 || destinationIndex < 0 || sourceIndex === destinationIndex) return;
    dayExercises = reorderItems(dayExercises, sourceIndex, destinationIndex);
  }

  function stopPointerReorder(event: PointerEvent) {
    if (dragPointerId !== event.pointerId) return;
    draggedExerciseId = null;
    dragPointerId = null;
    document.body.classList.remove("is-reordering");
  }

  async function showView(nextView: AppView) {
    if (nextView === activeView) return;
    const renderView = async () => {
      activeView = nextView;
      window.scrollTo({ top: 0, behavior: "auto" });
      await tick();
    };
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      await renderView();
      return;
    }
    const transitionDocument = document as ViewTransitionDocument;
    if (transitionDocument.startViewTransition) transitionDocument.startViewTransition(renderView);
    else await renderView();
  }

  function openProgramme(dayId?: string) {
    if (dayId && days.some((day) => day.id === dayId)) selectDay(dayId);
    editMode = false;
    void showView("programme");
  }

  function toggleTodayExercise(exerciseId: string) {
    if (!todayKey) return;
    history = toggleHistoryExercise(history, todayKey, exerciseId);
  }

  function dateLabel(date: Date | null): string {
    if (!date) return "";
    return new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }).format(date);
  }

  function weekDateNumber(index: number): string {
    if (!currentDate) return "";
    const date = new Date(currentDate);
    date.setDate(date.getDate() - weekIndex(date) + index);
    return String(date.getDate());
  }

  function exerciseCountForDay(dayId: string | null): number {
    if (!dayId) return 0;
    return dayId === activeDayId ? dayExercises.length : (workouts[dayId]?.length ?? 0);
  }

  function selectDay(dayId: string) {
    const weekday = days.findIndex((day) => day.id === dayId);
    if (weekday >= 0) selectedWeekday = weekday;
    weekPickerOpen = false;
    if (dayId === activeDayId) return;
    workouts = { ...workouts, [activeDayId]: dayExercises };
    activeDayId = dayId;
    dayExercises = [...(workouts[dayId] ?? [])];
  }

  async function exportLedger() {
    const payload: LedgerExport = {
      app: "pulse",
      version: 3,
      exportedAt: new Date().toISOString(),
      settings: { theme, accent },
      programme: { days, workouts: savedWorkouts, schedule },
      library: savedExercises,
      history,
    };
    const contents = JSON.stringify(payload, null, 2);
    const filename = `pulse-ledger-${new Date().toISOString().slice(0, 10)}.json`;
    try {
      if (await shareLedgerFile(filename, contents)) {
        transferMessage = "Opened your device share sheet.";
        return;
      }
    } catch {
      transferMessage = "The export was cancelled.";
      return;
    }

    const blob = new Blob([contents], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    transferMessage = "Exported a complete copy.";
  }

  async function readImport(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
      const candidate: unknown = JSON.parse(await file.text());
      if (!isLedgerExport(candidate)) throw new Error("This is not a valid Pulse ledger file.");
      pendingImport = candidate;
      transferMessage = "";
    } catch (error) {
      pendingImport = null;
      transferMessage = error instanceof Error ? error.message : "Could not read that file.";
    } finally {
      input.value = "";
    }
  }

  function applyImport() {
    if (!pendingImport) return;
    const imported = pendingImport;
    installWeeklyProgramme(
      imported.programme.days.map((day) => ({ ...day })),
      Object.fromEntries(Object.entries(imported.programme.workouts).map(([id, exercises]) => [id, exercises.map((exercise) => ({ ...exercise }))])),
    );
    theme = imported.settings.theme;
    accent = imported.settings.accent;
    if (imported.library) savedExercises = imported.library.map((exercise) => ({ ...exercise }));
    history = normaliseTrainingHistory(imported.history);
    pendingImport = null;
    transferMessage = "Imported your weekly programme.";
  }

  async function openLibrary() {
    if (libraryOpen) return;
    libraryReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    libraryClosing = false;
    resetVaultDrag();
    libraryOpen = true;
    await tick();
    vaultCloseButton?.focus();
  }

  async function closeLibrary(returnFocus = true) {
    if (!libraryOpen || libraryClosing) return;
    const animate = browser && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (animate) {
      libraryClosing = true;
      stopVaultDragRendering();
      vaultElement?.classList.remove("dragging");
      await new Promise((resolve) => window.setTimeout(resolve, 220));
    }
    libraryOpen = false;
    libraryClosing = false;
    resetVaultDrag();
    exerciseEditorOpen = false;
    exerciseActionsId = null;
    deleteExerciseCandidateId = null;
    vaultFiltersOpen = false;
    if (!returnFocus) {
      libraryReturnFocus = null;
      return;
    }
    await tick();
    const returnTarget = libraryReturnFocus?.isConnected ? libraryReturnFocus : addMovementButton;
    returnTarget?.focus();
    libraryReturnFocus = null;
  }

  function resetVaultDrag() {
    stopVaultDragRendering();
    vaultElement?.classList.remove("dragging");
    vaultElement?.style.removeProperty("--sheet-drag-y");
    vaultScrim?.style.removeProperty("--sheet-scrim-opacity");
    vaultDragY = 0;
    vaultDragPointerId = null;
    vaultDragStartY = 0;
    vaultDragLastY = 0;
    vaultDragLastAt = 0;
    vaultDragVelocity = 0;
    vaultDragSheetHeight = 0;
    vaultDragMoved = false;
  }

  function stopVaultDragRendering() {
    if (vaultRenderFrame === null) return;
    window.cancelAnimationFrame(vaultRenderFrame);
    vaultRenderFrame = null;
  }

  function renderVaultDrag() {
    vaultRenderFrame = null;
    const progress = sheetDragProgress(vaultDragY, vaultDragSheetHeight);
    vaultElement?.style.setProperty("--sheet-drag-y", `${vaultDragY}px`);
    vaultScrim?.style.setProperty("--sheet-scrim-opacity", String(Math.max(0.18, 1 - progress * 1.15)));
  }

  function scheduleVaultDragRender() {
    if (vaultRenderFrame !== null) return;
    vaultRenderFrame = window.requestAnimationFrame(renderVaultDrag);
  }

  function updateVaultDrag(event: PointerEvent) {
    const now = performance.now();
    const deltaTime = now - vaultDragLastAt;
    const deltaY = event.clientY - vaultDragLastY;
    if (deltaTime > 0 && Math.abs(deltaY) > 0.5) {
      const instantVelocity = deltaY / deltaTime;
      vaultDragVelocity = vaultDragVelocity === 0 ? instantVelocity : instantVelocity * 0.72 + vaultDragVelocity * 0.28;
      vaultDragLastY = event.clientY;
      vaultDragLastAt = now;
    }
    vaultDragY = Math.max(0, event.clientY - vaultDragStartY);
    if (vaultDragY > 5) vaultDragMoved = true;
    scheduleVaultDragRender();
  }

  function startVaultDrag(event: PointerEvent) {
    if (!window.matchMedia(mobileVaultQuery).matches || event.button !== 0 || libraryClosing) return;
    event.preventDefault();
    stopVaultDragRendering();
    vaultElement?.classList.add("dragging");
    vaultDragY = 0;
    vaultDragMoved = false;
    vaultDragPointerId = event.pointerId;
    vaultDragStartY = event.clientY;
    vaultDragLastY = event.clientY;
    vaultDragLastAt = performance.now();
    vaultDragVelocity = 0;
    vaultDragSheetHeight = vaultElement?.clientHeight ?? 0;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }

  function moveVaultDrag(event: PointerEvent) {
    if (vaultDragPointerId !== event.pointerId) return;
    event.preventDefault();
    updateVaultDrag(event);
  }

  function finishVaultDrag(event: PointerEvent, cancelled = false) {
    if (vaultDragPointerId !== event.pointerId) return;
    const handle = event.currentTarget as HTMLElement;
    if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
    if (Math.abs(event.clientY - vaultDragLastY) > 0.5) updateVaultDrag(event);
    stopVaultDragRendering();
    renderVaultDrag();
    const releaseVelocity = performance.now() - vaultDragLastAt <= 90 ? vaultDragVelocity : 0;
    const dismiss =
      !cancelled &&
      shouldDismissSheet({
        distance: vaultDragY,
        velocity: releaseVelocity,
        sheetHeight: vaultDragSheetHeight,
      });
    vaultDragPointerId = null;
    vaultElement?.classList.remove("dragging");
    if (dismiss) void closeLibrary();
    else {
      vaultDragY = 0;
      window.requestAnimationFrame(renderVaultDrag);
    }
  }

  function activateVaultHandle(event: MouseEvent) {
    if (event.detail > 0 && vaultDragMoved) {
      event.preventDefault();
      vaultDragMoved = false;
      return;
    }
    vaultDragMoved = false;
    void closeLibrary();
  }

  function clearVaultFilters() {
    selectedMuscle = "All";
    showArchived = false;
  }

  function trapVaultFocus(event: KeyboardEvent) {
    if (!vaultElement) return;
    const focusable = [
      ...vaultElement.querySelectorAll<HTMLElement>(
        "button:not(:disabled), input:not(:disabled), textarea:not(:disabled), a[href], [tabindex]:not([tabindex='-1'])",
      ),
    ].filter((element) => element.getClientRects().length > 0);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable.at(-1) ?? first;
    if (event.shiftKey && (document.activeElement === first || !vaultElement.contains(document.activeElement))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function handlePopoverKeydown(event: KeyboardEvent) {
    if (event.key === "Tab" && libraryOpen) {
      trapVaultFocus(event);
      return;
    }
    if (event.key !== "Escape") return;
    if (exerciseEditorOpen) {
      exerciseEditorOpen = false;
    } else if (exerciseActionsId) {
      exerciseActionsId = null;
    } else if (vaultFiltersOpen) {
      vaultFiltersOpen = false;
    } else if (libraryOpen) {
      void closeLibrary();
    }
  }

  function handleGlobalPointerDown(event: PointerEvent) {
    if (!(event.target instanceof Element)) return;
    if (vaultFiltersOpen && !event.target.closest(".vault-filter-button, .vault-filter-panel")) vaultFiltersOpen = false;
    if (exerciseActionsId && !event.target.closest(".vault-more, .vault-item-menu")) {
      exerciseActionsId = null;
      deleteExerciseCandidateId = null;
    }
  }
</script>

<svelte:window
  onpointerdown={handleGlobalPointerDown}
  onpointermove={handlePointerReorder}
  onpointerup={stopPointerReorder}
  onpointercancel={stopPointerReorder}
  onkeydown={handlePopoverKeydown}
/>

<svelte:head>
  <title>Pulse — Workout planner</title>
  <meta name="description" content="Your weekly training programme, available offline." />
</svelte:head>

<div class="app" data-theme={theme} data-accent={accent}>
  <header class="masthead" inert={libraryOpen}>
    <a class="wordmark" href="/" aria-label="Pulse home">
      <span class="wordmark-icon"><Activity size={18} strokeWidth={2.4} /></span>
      <strong>Pulse</strong>
    </a>

    <div class="masthead-actions">
      <p class="save-state"><span></span> Offline</p>
    </div>
  </header>

  <nav class="app-navigation" aria-label="Main navigation" inert={libraryOpen}>
    <button class:active={activeView === "today"} onclick={() => showView("today")} aria-current={activeView === "today" ? "page" : undefined}>
      <CalendarDays size={21} />
      <span>Today</span>
    </button>
    <button class:active={activeView === "programme"} onclick={() => openProgramme(activeDayId)} aria-current={activeView === "programme" ? "page" : undefined}>
      <Dumbbell size={21} />
      <span>Programme</span>
    </button>
    <button class:active={libraryOpen} onclick={() => openLibrary()} aria-expanded={libraryOpen} aria-haspopup="dialog">
      <LibraryBig size={21} />
      <span>Exercises</span>
    </button>
    <button class:active={activeView === "settings"} onclick={() => showView("settings")} aria-current={activeView === "settings" ? "page" : undefined}>
      <Settings size={21} />
      <span>Settings</span>
    </button>
  </nav>

  <main class="app-content" inert={libraryOpen}>
    {#if activeView === "today"}
      <section class="screen today-screen" aria-labelledby="today-title">
        <header class="screen-heading">
          <div>
            <p>{dateLabel(currentDate)}</p>
            <h1 id="today-title">Today</h1>
          </div>
          {#if todayPlan}
            <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
            <md-text-button onclick={() => openProgramme(todayPlan.id)}>Edit plan</md-text-button>
          {/if}
        </header>

        <div class="week-strip" aria-label="This week's schedule">
          {#each weekdays as weekday, index}
            <button
              class:today={index === todayIndex}
              class:assigned={exerciseCountForDay(schedule[index]) > 0}
              onclick={() => {
                selectedWeekday = index;
                openProgramme(schedule[index] ?? undefined);
              }}
              aria-label={`${weekday}: ${exerciseCountForDay(schedule[index]) ? `${exerciseCountForDay(schedule[index])} exercises` : "Rest day"}`}
            >
              <span>{weekday.slice(0, 2)}</span>
              <strong>{weekDateNumber(index)}</strong>
            </button>
          {/each}
        </div>

        {#if todayPlan}
          <section class="today-summary" aria-label="Today's workout summary">
            <div>
              <span>Scheduled workout</span>
              <h2>{todayPlan.name}</h2>
              <p>{todayExercises.length} {todayExercises.length === 1 ? "exercise" : "exercises"}</p>
            </div>
            <div class="progress-count" aria-label={`${completedTodayCount} of ${todayExercises.length} exercises done`}>
              <strong>{completedTodayCount}<small>/{todayExercises.length}</small></strong>
              <span>done</span>
            </div>
            <div class="progress-track"><span style={`width: ${todayExercises.length ? (completedTodayCount / todayExercises.length) * 100 : 0}%`}></span></div>
          </section>

          {#if todayExercises.length}
            <div class="exercise-list today-exercise-list">
              {#each todayExercises as exercise, index (exercise.id)}
                <article class:completed={todayCompleted.has(exercise.id)} class:expanded={expanded.has(exercise.id)} class="exercise-row">
                  <div class="exercise-row-main">
                    <button
                      class="completion-toggle"
                      onclick={() => toggleTodayExercise(exercise.id)}
                      aria-pressed={todayCompleted.has(exercise.id)}
                      aria-label={`${todayCompleted.has(exercise.id) ? "Mark" : "Mark"} ${exercise.name} ${todayCompleted.has(exercise.id) ? "not done" : "done"}`}
                    >
                      {#if todayCompleted.has(exercise.id)}<CircleCheck size={24} />{:else}<Circle size={24} />{/if}
                    </button>
                    <div class="exercise-copy">
                      <h3>{exercise.name}</h3>
                      <p>{exercise.muscles.join(" · ")} · {exercise.equipment}</p>
                    </div>
                    <div class="exercise-dose">
                      <strong
                        >{exercise.sets} × {weightLabel(exercise.load)}{#if parseWeight(exercise.load) !== null}
                          kg{/if}</strong
                      >
                      <span
                        >{exercise.reps || "Open"} reps{#if exercise.rest && exercise.rest !== "—"}
                          · {exercise.rest}{/if}</span
                      >
                    </div>
                    <button
                      class="row-action"
                      onclick={() => toggleExpanded(exercise.id)}
                      aria-expanded={expanded.has(exercise.id)}
                      aria-label={`${expanded.has(exercise.id) ? "Hide" : "Show"} details for ${exercise.name}`}
                      ><ChevronDown class={expanded.has(exercise.id) ? "turned" : ""} size={20} /></button
                    >
                  </div>
                  {#if expanded.has(exercise.id)}
                    <div class="exercise-details">
                      {#if exercise.imageUrl}<img src={exercise.imageUrl} alt={`Reference for ${exercise.name}`} loading="lazy" />{/if}
                      {#if exercise.description}<p>{exercise.description}</p>{/if}
                      {#if exercise.note}<p class="exercise-cue">{exercise.note}</p>{/if}
                      {#if exercise.guideUrl}<a href={exercise.guideUrl} target="_blank" rel="noreferrer"><ExternalLink size={16} /> Open form guide</a>{/if}
                    </div>
                  {/if}
                </article>
              {/each}
            </div>
          {:else}
            <div class="empty-state">
              <Dumbbell size={28} />
              <h2>This plan is empty</h2>
              <p>Add exercises from your library in Programme.</p>
              <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
              <md-filled-tonal-button onclick={() => openProgramme(todayPlan?.id)}>Open programme</md-filled-tonal-button>
            </div>
          {/if}
        {:else if hydrated}
          <div class="empty-state rest-state">
            <CalendarDays size={30} />
            <h2>Nothing scheduled today</h2>
            <p>Keep it as a rest day or assign one of your workout plans.</p>
            <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
            <md-filled-tonal-button
              onclick={() => {
                selectedWeekday = todayIndex;
                openProgramme();
              }}>Set today’s plan</md-filled-tonal-button
            >
          </div>
        {/if}
      </section>
    {:else if activeView === "programme"}
      <section class="screen programme-screen" aria-labelledby="programme-title">
        <header class="screen-heading">
          <div>
            <p>Seven days, your rules</p>
            <h1 id="programme-title">Programme</h1>
          </div>
        </header>
        <div class="programme-layout">
          <aside class="week-schedule" aria-labelledby="week-heading">
            <div class="section-heading">
              <div>
                <h2 id="week-heading">Your week</h2>
                <p>Tap a day to edit its workout.</p>
              </div>
              <span>7 days</span>
            </div>
            <button class="week-picker-toggle" onclick={() => (weekPickerOpen = !weekPickerOpen)} aria-expanded={weekPickerOpen}>
              <span class="week-picker-icon"><CalendarDays size={20} /></span>
              <span>
                <strong>{activeDayName}</strong>
                <small>{dayExercises.length ? `${dayExercises.length} ${dayExercises.length === 1 ? "exercise" : "exercises"}` : "Rest day"}</small>
              </span>
              <ChevronDown class={weekPickerOpen ? "turned" : ""} size={20} />
            </button>
            <div class:open={weekPickerOpen} class="schedule-collapse">
              <div class="schedule-list">
                {#each weekdays as weekday, index}
                  <button
                    class:today={index === todayIndex}
                    class:active={index === selectedWeekday}
                    class="schedule-row"
                    onclick={() => selectDay(days[index].id)}
                  >
                    <span
                      ><strong>{weekday}</strong>{#if index === todayIndex}<small>Today</small>{/if}</span
                    >
                    <span class="day-status">
                      {#if (days[index].id === activeDayId ? dayExercises : (workouts[days[index].id] ?? [])).length}
                        {(days[index].id === activeDayId ? dayExercises : (workouts[days[index].id] ?? [])).length} exercises
                      {:else}
                        Rest day
                      {/if}
                    </span>
                    <ChevronDown size={18} />
                  </button>
                {/each}
              </div>
            </div>
          </aside>

          {#key activeDayId}
            <section class="session-page" aria-labelledby="session-title">
              <header class="session-heading">
                <div class="plan-title">
                  <h2 id="session-title">{activeDayName}</h2>
                  <p>{dayExercises.length} {dayExercises.length === 1 ? "exercise" : "exercises"}</p>
                </div>
                <div class="programme-actions">
                  {#if editMode}
                    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
                    <md-filled-tonal-button bind:this={addMovementButton} class="add-movement" onclick={openLibrary}
                      ><span slot="icon"><LibraryBig size={18} /></span>Add exercise</md-filled-tonal-button
                    >
                    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
                    <md-text-button class:active={reorderMode} onclick={() => (reorderMode = !reorderMode)} aria-pressed={reorderMode}
                      ><span slot="icon"><GripVertical size={18} /></span>{reorderMode ? "Finish order" : "Reorder"}</md-text-button
                    >
                  {/if}
                  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
                  <md-filled-tonal-button class="edit-toggle" onclick={toggleEditMode}
                    ><span slot="icon"><Pencil size={18} /></span>{editMode ? "Done" : "Edit plan"}</md-filled-tonal-button
                  >
                </div>
              </header>

              {#if dayExercises.length}
                <div class="movement-list">
                  {#each dayExercises as exercise, index (exercise.id)}
                    <article
                      data-exercise-id={exercise.id}
                      class:reordering={reorderMode}
                      class:dragging={draggedExerciseId === exercise.id}
                      class:expanded={expanded.has(exercise.id)}
                      class="movement"
                    >
                      <div class="movement-main">
                        <div class="sequence-number">
                          {#if reorderMode}
                            <button
                              class="drag-handle"
                              onpointerdown={(event) => startPointerReorder(event, exercise.id)}
                              aria-label={`Drag ${exercise.name} to change its priority`}><GripVertical size={19} /></button
                            >
                          {/if}
                          <span>{String(index + 1).padStart(2, "0")}</span>
                        </div>

                        <div class="movement-name">
                          <h2>{exercise.name}</h2>
                          <p>
                            <span class="movement-muscles">{exercise.muscles.join(" / ")}</span><span class="movement-divider">•</span><span
                              >{exercise.equipment}</span
                            >
                          </p>
                        </div>

                        <button
                          class="details-toggle"
                          onclick={() => toggleExpanded(exercise.id)}
                          aria-expanded={expanded.has(exercise.id)}
                          aria-controls={`${exercise.id}-details`}
                          aria-label={`${expanded.has(exercise.id) ? "Hide" : "Show"} details for ${exercise.name}`}
                        >
                          <span>Details</span>
                          <ChevronDown class={expanded.has(exercise.id) ? "turned" : ""} size={17} />
                        </button>
                      </div>

                      {#if reorderMode}
                        <div class="reorder-strip">
                          <span><GripVertical size={14} /> Hold the grip and move</span>
                          <div>
                            <button onclick={() => moveExercise(index, -1)} disabled={index === 0} aria-label={`Move ${exercise.name} up`}
                              ><ArrowUp size={16} /></button
                            >
                            <button
                              onclick={() => moveExercise(index, 1)}
                              disabled={index === dayExercises.length - 1}
                              aria-label={`Move ${exercise.name} down`}><ArrowDown size={16} /></button
                            >
                          </div>
                        </div>
                      {/if}

                      {#if editMode}
                        <div class="prescription-editor">
                          <div class="prescription-control sets-control">
                            <span class="control-label">Sets</span>
                            <div class="number-stepper">
                              <button onclick={() => adjustSets(exercise, -1)} disabled={exercise.sets <= 1} aria-label={`Decrease sets for ${exercise.name}`}
                                ><Minus size={16} /></button
                              ><strong>{exercise.sets}</strong><button
                                onclick={() => adjustSets(exercise, 1)}
                                disabled={exercise.sets >= 20}
                                aria-label={`Increase sets for ${exercise.name}`}><Plus size={16} /></button
                              >
                            </div>
                          </div>
                          <div class="prescription-control weight-control">
                            <span class="control-label">Weight · ±2.5 kg</span>
                            <div class="weight-stepper">
                              <button
                                onclick={() => adjustWeight(exercise, -2.5)}
                                disabled={parseWeight(exercise.load) === null}
                                aria-label={`Decrease weight for ${exercise.name} by 2.5 kilograms`}><Minus size={16} /></button
                              ><label
                                ><input
                                  type="number"
                                  min="0"
                                  step="0.5"
                                  inputmode="decimal"
                                  value={weightInputValue(exercise.load)}
                                  placeholder="0"
                                  oninput={(event) => updateWeightInput(exercise, event)}
                                  onblur={() => settleWeight(exercise)}
                                  aria-label={`Weight for ${exercise.name} in kilograms`}
                                /><span>kg</span></label
                              ><button onclick={() => adjustWeight(exercise, 2.5)} aria-label={`Increase weight for ${exercise.name} by 2.5 kilograms`}
                                ><Plus size={16} /></button
                              >
                            </div>
                          </div>
                          <label class="text-prescription"><span>Rep range</span><input bind:value={exercise.reps} oninput={touch} placeholder="8–12" /></label>
                          <label class="text-prescription"><span>Rest</span><input bind:value={exercise.rest} oninput={touch} placeholder="90 sec" /></label>
                        </div>
                      {:else}
                        <div class="prescription-readout">
                          <p class="primary-prescription">
                            <span>Sets × load</span>
                            <strong
                              >{exercise.sets}<b aria-hidden="true">×</b>{weightLabel(exercise.load)}{#if parseWeight(exercise.load) !== null}<small>kg</small
                                >{/if}</strong
                            >
                          </p>
                          <div class="secondary-prescription">
                            <p class="reps-readout">
                              <span>Reps</span><strong>{exercise.reps || "Open"}</strong>
                            </p>
                            {#if exercise.rest && exercise.rest !== "—"}<p class="rest-readout">
                                <span>Rest</span><strong>{exercise.rest}</strong>
                              </p>{/if}
                          </div>
                        </div>
                      {/if}

                      {#if expanded.has(exercise.id)}
                        <div class="movement-details" id={`${exercise.id}-details`}>
                          {#if exercise.imageUrl}
                            <figure class="movement-media">
                              <img src={exercise.imageUrl} alt={`Reference for ${exercise.name}`} loading="lazy" />
                            </figure>
                          {/if}
                          {#if exercise.description}<p>{exercise.description}</p>{/if}
                          <div class="details-toolbar">
                            {#if exercise.guideUrl}<a href={exercise.guideUrl} target="_blank" rel="noreferrer"
                                ><ExternalLink size={14} /> Open form reference</a
                              >{/if}
                            {#if editMode}<label class="movement-note"
                                ><span>Private cue</span><input placeholder="What should you remember?" bind:value={exercise.note} oninput={touch} /></label
                              >{:else if exercise.note}<p class="movement-note-readout">
                                {exercise.note}
                              </p>{/if}
                            {#if editMode}<button class="delete-movement" onclick={() => removeExercise(exercise.id)} aria-label={`Remove ${exercise.name}`}
                                ><Trash2 size={15} /></button
                              >{/if}
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
                  <button
                    onclick={() => {
                      if (editMode) void openLibrary();
                      else toggleEditMode();
                    }}
                    ><Plus size={15} />
                    {editMode ? "Add the first movement" : "Edit this day"}</button
                  >
                </div>
              {/if}
            </section>
          {/key}
        </div>
      </section>
    {:else}
      <section class="screen settings-screen" aria-labelledby="settings-title">
        <header class="screen-heading">
          <div>
            <p>Local and personal</p>
            <h1 id="settings-title">Settings</h1>
          </div>
        </header>

        <div class="settings-groups">
          <section class="settings-group" aria-labelledby="appearance-heading">
            <header>
              <span><Settings size={20} /></span>
              <div>
                <h2 id="appearance-heading">Appearance</h2>
                <p>Choose a Catppuccin flavour and accent.</p>
              </div>
            </header>
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
                  <button
                    style={`--swatch: var(--${option})`}
                    class:active={accent === option}
                    onclick={() => (accent = option)}
                    aria-label={`Use ${option} accent`}
                    aria-pressed={accent === option}
                    title={option}
                  >
                    {#if accent === option}<Check size={13} strokeWidth={3} />{/if}
                  </button>
                {/each}
              </div>
            </fieldset>
          </section>

          <section class="settings-group" aria-labelledby="data-heading">
            <header>
              <span><FileJson size={20} /></span>
              <div>
                <h2 id="data-heading">App data</h2>
                <p>Your programme stays on this device.</p>
              </div>
            </header>
            <input class="hidden-file-input" bind:this={importInput} type="file" accept="application/json,.json" onchange={readImport} />
            <button class="settings-row" onclick={exportLedger}
              ><Download size={20} /><span><strong>Export data</strong><small>Save your programme, exercises, and history</small></span><ChevronDown
                size={18}
              /></button
            >
            <button class="settings-row" onclick={() => importInput.click()}
              ><Upload size={20} /><span><strong>Import data</strong><small>Restore from a Pulse JSON backup</small></span><ChevronDown size={18} /></button
            >

            {#if pendingImport}
              <div class="import-confirm">
                <p>Replace the data on this device with the selected backup?</p>
                <div><button onclick={() => (pendingImport = null)}>Cancel</button><button class="replace-data" onclick={applyImport}>Replace</button></div>
              </div>
            {/if}
            {#if transferMessage}<p
                class:transfer-error={transferMessage.includes("not valid") || transferMessage.includes("Could not")}
                class="transfer-message"
              >
                {transferMessage}
              </p>{/if}
          </section>
        </div>
      </section>
    {/if}
  </main>

  {#if libraryOpen}
    <button
      bind:this={vaultScrim}
      class:closing={libraryClosing}
      class="drawer-scrim"
      tabindex="-1"
      onclick={() => closeLibrary()}
      aria-label="Close exercise library"
    ></button>
    <div
      bind:this={vaultElement}
      class:closing={libraryClosing}
      class="exercise-vault"
      role="dialog"
      aria-modal="true"
      aria-labelledby="vault-title"
    >
      <button
        class="vault-drag-handle"
        type="button"
        aria-label="Swipe down or tap to close the exercise library"
        title="Drag down to close"
        onpointerdown={startVaultDrag}
        onpointermove={moveVaultDrag}
        onpointerup={finishVaultDrag}
        onpointercancel={(event) => finishVaultDrag(event, true)}
        onclick={activateVaultHandle}><span></span></button
      >
      <header class="vault-heading">
        <div class="vault-title">
          <h2 id="vault-title">Exercise library</h2>
          <p aria-live="polite">
            {visibleExercises.length}
            {showArchived ? "archived" : "available"}
          </p>
        </div>
        <div class="vault-heading-actions">
          <button class="create-exercise" onclick={openExerciseCreator}><Plus size={15} /><span>New exercise</span></button>
          <button bind:this={vaultCloseButton} class="icon-button" onclick={() => closeLibrary()} aria-label="Close exercise library" title="Close"
            ><X size={18} /></button
          >
        </div>
      </header>

      {#if exerciseEditorOpen}
        <form
          class="exercise-editor"
          onsubmit={(event) => {
            event.preventDefault();
            saveExerciseDefinition();
          }}
        >
          <header>
            <div>
              <p class="kicker">
                {editingExerciseId ? "Edit definition" : "New definition"}
              </p>
              <h3>
                {editingExerciseId ? "Refine exercise" : "Save an exercise"}
              </h3>
            </div>
            <button type="button" class="icon-button" onclick={() => (exerciseEditorOpen = false)} aria-label="Close exercise editor"><X size={16} /></button>
          </header>
          <div class="exercise-form-grid">
            <label class="wide"><span>Name</span><input bind:value={exerciseDraft.name} placeholder="e.g. Half-kneeling press" maxlength="80" /></label>
            <div class="combo-field">
              <span>Muscles</span><TagCombobox
                id="exercise-muscles"
                bind:values={exerciseDraft.muscles}
                options={muscleOptions}
                placeholder="Type or open suggestions"
              />
            </div>
            <div class="combo-field">
              <span>Equipment</span><AutocompleteInput
                id="exercise-equipment"
                bind:value={exerciseDraft.equipment}
                options={equipmentOptions}
                placeholder="Type or open suggestions"
              />
            </div>
            <label class="wide"><span>Personal tags</span><input bind:value={exerciseDraft.tags} placeholder="Lengthened, elbow-friendly, skill…" /></label>
            <label class="wide"
              ><span>Instructions or cues</span><textarea bind:value={exerciseDraft.description} placeholder="Only shown when the exercise is expanded"
              ></textarea></label
            >
            <label class="wide"><span>Reference link · optional</span><input type="url" bind:value={exerciseDraft.guideUrl} placeholder="https://…" /></label>
            <label class="wide"><span>Image link · cached after first view</span><input type="url" bind:value={exerciseDraft.imageUrl} placeholder="https://…" /></label>
          </div>
          {#if exerciseFormError}<p class="exercise-form-error">
              {exerciseFormError}
            </p>{/if}
          <footer>
            <button type="button" onclick={() => (exerciseEditorOpen = false)}>Cancel</button><button class="save-exercise" type="submit"
              ><Save size={14} /> Save exercise</button
            >
          </footer>
        </form>
      {/if}

      <div class="vault-tools">
        <div class="vault-search" role="search">
          <Search size={17} aria-hidden="true" />
          <input aria-label="Search exercises" placeholder="Search names, tags, equipment" bind:value={search} />
          {#if search}<button type="button" onclick={() => (search = "")} aria-label="Clear exercise search"><X size={16} /></button>{/if}
          <button
            class:active={vaultFiltersOpen}
            class:filtered={selectedMuscle !== "All" || showArchived}
            class="vault-filter-button"
            type="button"
            onclick={() => (vaultFiltersOpen = !vaultFiltersOpen)}
            aria-expanded={vaultFiltersOpen}
            aria-controls="vault-filters"
            aria-label="Filter exercises"><ListFilter size={18} /></button
          >
        </div>
      </div>

      {#if vaultFiltersOpen}
        <section class="vault-filter-panel" id="vault-filters" aria-label="Exercise filters">
          <header>
            <div>
              <h3>Filters</h3>
              <p>Muscle, tag, or archive status.</p>
            </div>
            {#if selectedMuscle !== "All" || showArchived}<button type="button" onclick={clearVaultFilters}>Reset</button>{/if}
          </header>
          <fieldset>
            <legend>Library</legend>
            <div class="vault-filter-mode">
              <button class:active={!showArchived} type="button" aria-pressed={!showArchived} onclick={() => (showArchived = false)}>Active</button>
              <button
                class:active={showArchived}
                type="button"
                aria-pressed={showArchived}
                onclick={() => (showArchived = true)}
                disabled={!archivedCount}>Archived · {archivedCount}</button
              >
            </div>
          </fieldset>
          <fieldset>
            <legend>Muscle or tag</legend>
            <div class="vault-filter-options">
              {#each availableGroups as muscle}
                <button class:active={selectedMuscle === muscle} type="button" aria-pressed={selectedMuscle === muscle} onclick={() => (selectedMuscle = muscle)}
                  >{muscle}</button
                >
              {/each}
            </div>
          </fieldset>
          <footer>
            <span>{visibleExercises.length} {visibleExercises.length === 1 ? "result" : "results"}</span>
            <button type="button" onclick={() => (vaultFiltersOpen = false)}>Done</button>
          </footer>
        </section>
      {/if}

      <div class="vault-list">
        {#each visibleExercises as exercise (exercise.id)}
          <article class="vault-item">
            <div class="vault-item-copy">
              <h3>{exercise.name}</h3>
              <p>
                {exercise.muscles.join(" / ") || "Personal"} · {exercise.equipment}
              </p>
              {#if exercise.tags?.length}<div class="exercise-tags">
                  {#each exercise.tags as tag}<span>{tag}</span>{/each}
                </div>{/if}
            </div>
            <div class="vault-item-actions">
              {#if !exercise.archived}<button
                  class:added={dayExercises.some((item) => item.id === exercise.id)}
                  class="add-from-vault"
                  onclick={() => addExercise(exercise)}
                  disabled={dayExercises.some((item) => item.id === exercise.id)}
                >
                  {#if dayExercises.some((item) => item.id === exercise.id)}<Check size={15} /> Added{:else}<Plus size={15} /> Add{/if}
                </button>{/if}
              <button
                class="vault-more"
                onclick={() => {
                  exerciseActionsId = exerciseActionsId === exercise.id ? null : exercise.id;
                  deleteExerciseCandidateId = null;
                }}
                aria-expanded={exerciseActionsId === exercise.id}
                aria-controls={`${exercise.id}-actions`}
                aria-label={`More actions for ${exercise.name}`}><EllipsisVertical size={19} /></button
              >
            </div>

            {#if exerciseActionsId === exercise.id}
              <div class="vault-item-menu" id={`${exercise.id}-actions`}>
                {#if deleteExerciseCandidateId === exercise.id}
                  <div class="delete-exercise-confirm">
                    <span>Delete this exercise from the vault?</span>
                    <div>
                      <button onclick={() => (deleteExerciseCandidateId = null)}>Keep</button><button onclick={() => deleteExerciseDefinition(exercise.id)}
                        >Delete</button
                      >
                    </div>
                  </div>
                {:else}
                  <button onclick={() => duplicateExercise(exercise)}><Copy size={16} /><span>Duplicate</span></button>
                  {#if exercise.custom}<button onclick={() => openExerciseEditor(exercise)}><Pencil size={16} /><span>Edit</span></button>{/if}
                  <button onclick={() => toggleExerciseArchive(exercise)}
                    >{#if exercise.archived}<ArchiveRestore size={16} /><span>Restore</span>{:else}<Archive size={16} /><span>Archive</span>{/if}</button
                  >
                  {#if exercise.custom}<button class="vault-delete" onclick={() => (deleteExerciseCandidateId = exercise.id)}
                      ><Trash2 size={16} /><span>Delete</span></button
                    >{/if}
                {/if}
              </div>
            {/if}
          </article>
        {:else}
          <p class="vault-empty">Nothing matches that search.</p>
        {/each}
      </div>
    </div>
  {/if}
</div>
