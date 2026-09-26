<script lang="ts">
  import { browser } from "$app/environment";
  import AutocompleteInput from "$lib/components/AutocompleteInput.svelte";
  import MuscleMap from "$lib/components/MuscleMap.svelte";
  import PulseMark from "$lib/components/PulseMark.svelte";
  import TagCombobox from "$lib/components/TagCombobox.svelte";
  import {
    defaultAutoBackupPreferences,
    formatBackupDelay,
    maximumBackupDelayMinutes,
    minimumBackupDelayMinutes,
    normaliseAutoBackupPreferences,
    normaliseBackupDelay,
    normalisePendingBackup,
    shouldRetryBackup,
    type AutoBackupPreferences,
    type PendingBackup,
  } from "$lib/backup";
  import { exerciseLibrary, starterWorkout } from "$lib/data";
  import { defaultExerciseLibraryVersion } from "$lib/default-exercises";
  import {
    mergeDefaultExerciseLibrary,
    reconcileDefaultExerciseLibrary,
    refreshWorkoutExerciseDefinitions,
  } from "$lib/exercise-library";
  import {
    clearExerciseImageCache,
    setExerciseImageLoading,
  } from "$lib/exercise-image-cache";
  import {
    accents,
    copyWorkout,
    isExercise,
    isLedgerExport,
    isOptionalWebUrl,
    localDateKey,
    moveItem,
    normaliseWeight,
    orderExercisesByCompletion,
    parseWeight,
    reorderItems,
    stepWeight,
    themes,
    weekIndex,
    weightInputValue,
    weightLabel,
    weekdays,
    type Accent,
    type LedgerExport,
    type Theme,
  } from "$lib/ledger";
  import { bodyMaps, normaliseBodyMap, type BodyMap } from "$lib/muscle-map";
  import {
    applyNativeAppearance,
    chooseScopedBackupFolder,
    clearScopedBackupFolder,
    getScopedBackupStatus,
    isNativeApp,
    shareLedgerFile,
    writeScopedBackup,
  } from "$lib/native";
  import { equipmentOptions, muscleOptions } from "$lib/options";
  import { sheetDragProgress, shouldDismissSheet } from "$lib/sheet";
  import {
    clearPendingBackupData,
    loadLedgerData,
    loadPendingBackupData,
    saveLedgerData,
    savePendingBackupData,
    type StoredLedger,
  } from "$lib/storage";
  import type {
    Exercise,
    SetGroup,
    TrainingDay,
    WeekSchedule,
    WorkoutExercise,
  } from "$lib/types";
  import Archive from "lucide-svelte/icons/archive";
  import ArchiveRestore from "lucide-svelte/icons/archive-restore";
  import ArrowDown from "lucide-svelte/icons/arrow-down";
  import ArrowUp from "lucide-svelte/icons/arrow-up";
  import CalendarDays from "lucide-svelte/icons/calendar-days";
  import Check from "lucide-svelte/icons/check";
  import Circle from "lucide-svelte/icons/circle";
  import CircleCheck from "lucide-svelte/icons/circle-check";
  import ChevronDown from "lucide-svelte/icons/chevron-down";
  import ChevronLeft from "lucide-svelte/icons/chevron-left";
  import ChevronRight from "lucide-svelte/icons/chevron-right";
  import Copy from "lucide-svelte/icons/copy";
  import Download from "lucide-svelte/icons/download";
  import Dumbbell from "lucide-svelte/icons/dumbbell";
  import ExternalLink from "lucide-svelte/icons/external-link";
  import FileJson from "lucide-svelte/icons/file-json";
  import FolderLock from "lucide-svelte/icons/folder-lock";
  import FolderOpen from "lucide-svelte/icons/folder-open";
  import GripVertical from "lucide-svelte/icons/grip-vertical";
  import ImageIcon from "lucide-svelte/icons/image";
  import LibraryBig from "lucide-svelte/icons/library-big";
  import ListFilter from "lucide-svelte/icons/list-filter";
  import Minus from "lucide-svelte/icons/minus";
  import Pencil from "lucide-svelte/icons/pencil";
  import Plus from "lucide-svelte/icons/plus";
  import Save from "lucide-svelte/icons/save";
  import Search from "lucide-svelte/icons/search";
  import Settings from "lucide-svelte/icons/settings";
  import ShieldCheck from "lucide-svelte/icons/shield-check";
  import Trash2 from "lucide-svelte/icons/trash-2";
  import Upload from "lucide-svelte/icons/upload";
  import X from "lucide-svelte/icons/x";
  import { flip } from "svelte/animate";
  import { onMount, tick } from "svelte";
  import { slide } from "svelte/transition";

  const suggestedGroups = [
    "Chest",
    "Back",
    "Shoulders",
    "Arms",
    "Legs",
    "Core",
  ];
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
  type LibraryMode = "manage" | "pick";
  type ViewTransitionDocument = Document & {
    startViewTransition?: (update: () => void | Promise<void>) => void;
  };
  const mobileVaultQuery =
    "(max-width: 600px), (max-width: 900px) and (max-height: 520px) and (orientation: landscape)";
  const autoBackupPreferencesKey = "pulse-auto-backup-v1";
  const exerciseImagePreferenceKey = "pulse-online-exercise-images-v1";
  const legacyPendingBackupKey = "pulse-auto-backup-pending-v1";
  const todayCompletionCacheKey = "pulse-today-completion-v1";
  const automaticBackupFilename = "pulse-ledger.json";
  const initialDate = new Date();
  const initialWeekday = weekIndex(initialDate);
  let days: TrainingDay[] = createFixedWeekDays();
  let activeDayId = days[initialWeekday].id;
  let workouts: Record<string, WorkoutExercise[]> = emptyWeekWorkouts(days);
  workouts[activeDayId] = starterWorkout;
  let dayExercises: WorkoutExercise[] = starterWorkout;
  let schedule: WeekSchedule = days.map((day) => day.id);
  let currentDate: Date | null = initialDate;
  let completionDateKey = localDateKey(initialDate);
  let todayCompletionOrder: string[] = [];
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
  let previewExerciseId: string | null = null;
  let exerciseDraft: ExerciseDraft = blankExerciseDraft();
  let exerciseFormError = "";
  let deleteExerciseCandidateId: string | null = null;
  let reorderMode = false;
  let reorderHintActive = false;
  let copyDayOpen = false;
  let clearDayPending = false;
  let programmeMessage = "";
  let libraryOpen = false;
  let libraryMode: LibraryMode = "manage";
  let theme: Theme = "mocha";
  let accent: Accent = "mauve";
  let bodyMap: BodyMap = "male";
  let expanded = new Set<string>();
  let hydrated = false;
  let draggedExerciseId: string | null = null;
  let dragHandle: HTMLElement | null = null;
  let dragGhost: HTMLElement | null = null;
  let dragOriginExercises: WorkoutExercise[] | null = null;
  let dragPointerOffsetX = 0;
  let dragPointerOffsetY = 0;
  let dragX = 0;
  let dragY = 0;
  let viewSwipePointerId: number | null = null;
  let viewSwipeStartX = 0;
  let viewSwipeStartY = 0;
  let viewSwipeStartedAt = 0;
  let viewSwipeHorizontal = false;
  let suppressClickAfterSwipe = false;
  let importInput: HTMLInputElement;
  let pendingImport: LedgerExport | null = null;
  let transferMessage = "";
  let transferError = false;
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
  let autoBackup: AutoBackupPreferences = { ...defaultAutoBackupPreferences };
  let backupFolderSelected = false;
  let backupBusy = false;
  let backupTimer: number | null = null;
  let lastBackupFingerprint = "";
  let backupWriteQueue = Promise.resolve();
  let queuedBackup: { pending: PendingBackup; generation: number } | null =
    null;
  let backupDrainRunning = false;
  let backupRevision = 0;
  let backupGeneration = 0;
  let backupReady = false;
  let backupSuspended = false;
  let nativePlatform = false;
  let onlineExerciseImages = false;
  let imageSettingsBusy = false;
  let imageSettingsMessage = "";
  let imageSettingsError = false;

  $: availableGroups = [
    "All",
    ...new Set([
      ...suggestedGroups,
      ...savedExercises.flatMap((exercise) => [
        ...exercise.muscles,
        ...(exercise.tags ?? []),
      ]),
    ]),
  ];
  $: archivedCount = savedExercises.filter(
    (exercise) => exercise.archived,
  ).length;
  $: visibleExercises = savedExercises.filter((exercise) => {
    const query = search.trim().toLowerCase();
    const searchable = [
      exercise.name,
      exercise.equipment,
      ...exercise.muscles,
      ...(exercise.tags ?? []),
    ]
      .join(" ")
      .toLowerCase();
    const matchesSearch = !query || searchable.includes(query);
    const matchesMuscle =
      selectedMuscle === "All" ||
      exercise.muscles.includes(selectedMuscle) ||
      exercise.tags?.includes(selectedMuscle);
    const alreadyInActiveDay =
      libraryMode === "pick" &&
      dayExercises.some((item) => item.id === exercise.id);
    return (
      matchesSearch &&
      matchesMuscle &&
      Boolean(exercise.archived) === showArchived &&
      !alreadyInActiveDay
    );
  });
  $: editingExercise = editingExerciseId
    ? savedExercises.find((exercise) => exercise.id === editingExerciseId)
    : undefined;
  $: previewExercise = previewExerciseId
    ? savedExercises.find((exercise) => exercise.id === previewExerciseId)
    : undefined;
  $: vaultAddVisible =
    libraryMode === "manage" &&
    !exerciseEditorOpen &&
    !vaultFiltersOpen &&
    !libraryClosing;
  $: activeDayName =
    days.find((day) => day.id === activeDayId)?.name ?? "Untitled day";
  $: savedWorkouts = { ...workouts, [activeDayId]: dayExercises };
  $: todayIndex = currentDate ? weekIndex(currentDate) : 0;
  $: todayKey = currentDate ? localDateKey(currentDate) : "";
  $: todayPlanId = schedule[todayIndex] ?? null;
  $: todayPlan = todayPlanId
    ? (days.find((day) => day.id === todayPlanId) ?? null)
    : null;
  $: todayExercises = todayPlanId
    ? todayPlanId === activeDayId
      ? dayExercises
      : (workouts[todayPlanId] ?? [])
    : [];
  $: todayCompleted = new Set(todayCompletionOrder);
  $: orderedTodayExercises = orderExercisesByCompletion(
    todayExercises,
    todayCompletionOrder,
  );
  $: completedTodayCount = todayExercises.filter((exercise) =>
    todayCompleted.has(exercise.id),
  ).length;
  $: if (browser) void applyNativeAppearance(theme, accent);
  $: if (browser) void applyBrandFavicon(theme, accent);
  $: if (browser && hydrated) {
    const ledger: StoredLedger = {
      workouts: savedWorkouts,
      days,
      activeDayId,
      theme,
      accent,
      bodyMap,
      exercises: savedExercises,
      schedule,
      defaultExerciseLibraryVersion,
    };
    saveLedgerData(ledger);
    if (backupReady) scheduleAutomaticBackup(ledger);
  }
  $: if (browser) document.body.classList.toggle("has-overlay", libraryOpen);

  onMount(() => {
    void Promise.all([
      import("@material/web/button/filled-tonal-button.js"),
      import("@material/web/button/text-button.js"),
    ]);
    currentDate = new Date();
    selectedWeekday = weekIndex(currentDate);
    restoreTodayCompletion(currentDate);
    nativePlatform = isNativeApp();
    void initialiseApplication();
    const refreshDate = () => {
      const nextDate = new Date();
      if (
        !currentDate ||
        localDateKey(nextDate) !== localDateKey(currentDate)
      ) {
        currentDate = nextDate;
        completionDateKey = localDateKey(nextDate);
        todayCompletionOrder = [];
        clearTodayCompletion();
      }
    };
    const dateRefreshTimer = window.setInterval(refreshDate, 60_000);
    document.addEventListener("visibilitychange", refreshDate);
    return () => {
      window.clearInterval(dateRefreshTimer);
      document.removeEventListener("visibilitychange", refreshDate);
      if (backupTimer !== null) window.clearTimeout(backupTimer);
      clearPointerReorder();
      document.body.classList.remove("is-reordering", "has-overlay");
    };
  });

  async function initialiseApplication() {
    await hydrateLedger();
    await initialiseAutomaticBackup();
    backupReady = true;
    if (autoBackup.enabled && backupFolderSelected)
      scheduleAutomaticBackup(currentStoredLedger());
  }

  onMount(() => {
    if (!isNativeApp()) return;

    let removeBackListener: (() => Promise<void>) | undefined;
    let removeStateListener: (() => Promise<void>) | undefined;
    void import("@capacitor/app").then(async ({ App }) => {
      const listener = await App.addListener("backButton", () => {
        if (exerciseEditorOpen) exerciseEditorOpen = false;
        else if (vaultFiltersOpen) vaultFiltersOpen = false;
        else if (libraryOpen) closeLibrary(false);
        else if (editMode) toggleEditMode();
        else void App.minimizeApp();
      });
      removeBackListener = () => listener.remove();
      const stateListener = await App.addListener(
        "appStateChange",
        ({ isActive }) => {
          if (isActive) void resumePendingBackup();
        },
      );
      removeStateListener = () => stateListener.remove();
    });

    return () => {
      void removeBackListener?.();
      void removeStateListener?.();
    };
  });

  async function hydrateLedger() {
    const saved = await loadLedgerData();
    onlineExerciseImages = readExerciseImagePreference(saved !== null);
    persistExerciseImagePreference();
    await setExerciseImageLoading(onlineExerciseImages).catch(() => {
      imageSettingsError = true;
      imageSettingsMessage = onlineExerciseImages
        ? "Image access could not be enabled on this device."
        : "Some cached images could not be removed.";
    });
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
          bodyMap: BodyMap;
          exercises: Exercise[];
          schedule: WeekSchedule;
          defaultExerciseLibraryVersion: number;
        }>;
        if (parsed.theme && themes.includes(parsed.theme)) theme = parsed.theme;
        if (parsed.accent && accents.includes(parsed.accent))
          accent = parsed.accent;
        bodyMap = normaliseBodyMap(parsed.bodyMap);
        const storedExercises = (parsed.exercises ?? []).filter(isExercise);
        savedExercises = reconcileDefaultExerciseLibrary(
          storedExercises,
          parsed.defaultExerciseLibraryVersion,
        );
        const sourceDays = parsed.days?.length
          ? typeof parsed.days[0] === "object"
            ? (parsed.days as TrainingDay[])
            : (parsed.days as string[]).map((name, index) => ({
                id: `legacy-${index}`,
                name,
              }))
          : [{ id: "legacy-0", name: "Workout" }];
        const sourceWorkouts =
          parsed.days?.length && typeof parsed.days[0] === "string"
            ? Object.fromEntries(
                (parsed.days as string[]).map((name, index) => [
                  `legacy-${index}`,
                  parsed.workouts?.[name] ?? [],
                ]),
              )
            : (parsed.workouts ?? { "legacy-0": parsed.dayExercises ?? [] });
        installWeeklyProgramme(sourceDays, sourceWorkouts);
      } catch {}
    }
    lastBackupFingerprint = ledgerFingerprint(currentStoredLedger());
    hydrated = true;
  }

  function readExerciseImagePreference(existingUser: boolean): boolean {
    try {
      const stored = localStorage.getItem(exerciseImagePreferenceKey);
      return stored === null ? existingUser : stored === "true";
    } catch {
      return false;
    }
  }

  function persistExerciseImagePreference() {
    try {
      localStorage.setItem(
        exerciseImagePreferenceKey,
        String(onlineExerciseImages),
      );
    } catch {
      // Keep the preference for this session when local storage is unavailable.
    }
  }

  async function setOnlineExerciseImages(enabled: boolean) {
    if (imageSettingsBusy || enabled === onlineExerciseImages) return;
    imageSettingsBusy = true;
    imageSettingsMessage = "";
    imageSettingsError = false;
    if (!enabled) onlineExerciseImages = false;
    persistExerciseImagePreference();
    try {
      await setExerciseImageLoading(enabled);
      onlineExerciseImages = enabled;
      persistExerciseImagePreference();
      imageSettingsMessage = enabled
        ? "Online exercise images enabled."
        : "Online exercise images disabled and cached images removed.";
    } catch {
      if (enabled) onlineExerciseImages = false;
      persistExerciseImagePreference();
      imageSettingsError = true;
      imageSettingsMessage = enabled
        ? "Image access could not be enabled on this device."
        : "Images are disabled, but some cached files could not be removed.";
    } finally {
      imageSettingsBusy = false;
    }
  }

  async function clearCachedExerciseImages() {
    if (imageSettingsBusy) return;
    imageSettingsBusy = true;
    imageSettingsMessage = "";
    imageSettingsError = false;
    try {
      await clearExerciseImageCache();
      imageSettingsMessage = "Cached exercise images removed.";
    } catch {
      imageSettingsError = true;
      imageSettingsMessage = "Cached exercise images could not be removed.";
    } finally {
      imageSettingsBusy = false;
    }
  }

  function createFixedWeekDays(): TrainingDay[] {
    return weekdays.map((name, index) => ({ id: `weekday-${index}`, name }));
  }

  function emptyWeekWorkouts(
    weekDays: TrainingDay[],
  ): Record<string, WorkoutExercise[]> {
    return Object.fromEntries(weekDays.map((day) => [day.id, []]));
  }

  function installWeeklyProgramme(
    sourceDays: TrainingDay[],
    sourceWorkouts: Record<string, WorkoutExercise[]>,
  ) {
    const fixedDays = createFixedWeekDays();
    const nextWorkouts = emptyWeekWorkouts(fixedDays);
    const alreadyFixed = fixedDays.every((day) =>
      sourceDays.some((sourceDay) => sourceDay.id === day.id),
    );

    if (alreadyFixed) {
      for (const day of fixedDays)
        nextWorkouts[day.id] = refreshWorkoutExerciseDefinitions(
          copyWorkout(sourceWorkouts[day.id] ?? []),
          savedExercises,
        );
    } else {
      sourceDays.slice(0, 7).forEach((sourceDay, offset) => {
        const namedWeekday = weekdays.findIndex(
          (weekday) =>
            weekday.toLowerCase() === sourceDay.name.trim().toLowerCase(),
        );
        const targetIndex =
          namedWeekday >= 0 ? namedWeekday : (initialWeekday + offset) % 7;
        nextWorkouts[fixedDays[targetIndex].id] =
          refreshWorkoutExerciseDefinitions(
            copyWorkout(sourceWorkouts[sourceDay.id] ?? []),
            savedExercises,
          );
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
  }

  function toggleExercisePreview(id: string) {
    previewExerciseId = previewExerciseId === id ? null : id;
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

    const existing = editingExerciseId
      ? savedExercises.find((exercise) => exercise.id === editingExerciseId)
      : undefined;
    const updated: Exercise = {
      id: existing?.id ?? `exercise-${Date.now()}`,
      name,
      muscles,
      tags,
      equipment: exerciseDraft.equipment.trim() || "No equipment",
      description: exerciseDraft.description.trim(),
      guideUrl,
      imageUrl: imageUrl || undefined,
      custom: existing ? Boolean(existing.custom) : true,
      archived: existing?.archived ?? false,
    };

    if (existing) {
      savedExercises = savedExercises.map((exercise) =>
        exercise.id === existing.id ? updated : exercise,
      );
      updateExerciseReferences(updated);
    } else {
      savedExercises = [...savedExercises, updated];
    }
    exerciseEditorOpen = false;
    editingExerciseId = null;
    exerciseFormError = "";
    if (!existing) showArchived = false;
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
    workouts = Object.fromEntries(
      Object.entries(workouts).map(([id, exercises]) => [
        id,
        exercises.map(merge),
      ]),
    );
  }

  function toggleExerciseArchive(exercise: Exercise) {
    savedExercises = savedExercises.map((item) =>
      item.id === exercise.id ? { ...item, archived: !item.archived } : item,
    );
    deleteExerciseCandidateId = null;
    exerciseEditorOpen = false;
    editingExerciseId = null;
  }

  function deleteExerciseDefinition(id: string) {
    savedExercises = savedExercises.filter((exercise) => exercise.id !== id);
    dayExercises = dayExercises.filter((exercise) => exercise.id !== id);
    workouts = Object.fromEntries(
      Object.entries(workouts).map(([dayId, exercises]) => [
        dayId,
        exercises.filter((exercise) => exercise.id !== id),
      ]),
    );
    deleteExerciseCandidateId = null;
    exerciseEditorOpen = false;
    editingExerciseId = null;
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
      reorderHintActive = false;
      clearPointerReorder();
      copyDayOpen = false;
      clearDayPending = false;
    }
  }

  function toggleReorderMode() {
    reorderMode = !reorderMode;
    reorderHintActive = reorderMode;
    if (!reorderMode) clearPointerReorder();
  }

  function copyDayTo(targetDayId: string) {
    const targetDay = days.find((day) => day.id === targetDayId);
    if (!targetDay || targetDayId === activeDayId) return;
    workouts = {
      ...savedWorkouts,
      [targetDayId]: copyWorkout(dayExercises),
    };
    copyDayOpen = false;
    programmeMessage = `${activeDayName} copied to ${targetDay.name}.`;
  }

  function requestClearDay() {
    if (!clearDayPending) {
      clearDayPending = true;
      copyDayOpen = false;
      return;
    }
    dayExercises = [];
    clearDayPending = false;
    programmeMessage = `${activeDayName} cleared.`;
  }

  function createSetGroup(source?: SetGroup): SetGroup {
    return {
      id: `group-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      sets: source?.sets ?? 3,
      reps: source?.reps ?? "8–12",
      load: source?.load ?? "—",
      rest: source?.rest ?? "90 sec",
    };
  }

  function addSetGroup(exercise: WorkoutExercise) {
    exercise.groups = [
      ...exercise.groups,
      createSetGroup(exercise.groups.at(-1)),
    ];
    touch();
  }

  function removeSetGroup(exercise: WorkoutExercise, groupId: string) {
    if (exercise.groups.length === 1) return;
    exercise.groups = exercise.groups.filter((group) => group.id !== groupId);
    touch();
  }

  function adjustSets(group: SetGroup, delta: number) {
    group.sets = Math.min(20, Math.max(1, Math.round(group.sets + delta)));
    touch();
  }

  function adjustWeight(group: SetGroup, delta: number) {
    group.load = stepWeight(group.load, delta);
    touch();
  }

  function updateWeightInput(group: SetGroup, event: Event) {
    group.load = (event.currentTarget as HTMLInputElement).value;
    touch();
  }

  function settleWeight(group: SetGroup) {
    group.load = normaliseWeight(group.load);
    touch();
  }

  function addExercise(exercise: Exercise) {
    if (dayExercises.some((item) => item.id === exercise.id)) return;
    dayExercises = [
      ...dayExercises,
      {
        ...exercise,
        groups: [createSetGroup()],
        note: "",
      },
    ];
    previewExerciseId = null;
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
    if (!reorderMode || event.button !== 0 || draggedExerciseId) return;
    event.preventDefault();
    const handle = event.currentTarget as HTMLElement;
    const movement = handle.closest<HTMLElement>(".movement");
    const app = movement?.closest<HTMLElement>(".app");
    if (!movement || !app) return;
    const rect = movement.getBoundingClientRect();
    const ghost = movement.cloneNode(true) as HTMLElement;
    ghost.classList.remove("dragging", "hinting");
    ghost.classList.add("movement-drag-ghost");
    ghost.setAttribute("aria-hidden", "true");
    ghost.style.width = `${rect.width}px`;
    ghost.style.height = `${rect.height}px`;
    app.append(ghost);

    reorderHintActive = false;
    draggedExerciseId = id;
    dragPointerId = event.pointerId;
    dragHandle = handle;
    dragGhost = ghost;
    dragOriginExercises = [...dayExercises];
    dragPointerOffsetX = event.clientX - rect.left;
    dragPointerOffsetY = event.clientY - rect.top;
    positionDragGhost(event.clientX, event.clientY);
    handle.setPointerCapture(event.pointerId);
    document.body.classList.add("is-reordering");
  }

  function positionDragGhost(clientX: number, clientY: number) {
    if (!dragGhost) return;
    dragX = clientX - dragPointerOffsetX;
    dragY = clientY - dragPointerOffsetY;
    dragGhost.style.transform = `translate3d(${dragX}px, ${dragY}px, 0)`;
  }

  function handlePointerReorder(event: PointerEvent) {
    if (dragPointerId !== event.pointerId || !draggedExerciseId) return;
    event.preventDefault();
    positionDragGhost(event.clientX, event.clientY);
    const edge = 72;
    if (event.clientY < edge) window.scrollBy(0, -10);
    else if (event.clientY > window.innerHeight - edge) window.scrollBy(0, 10);
    const destination = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>("[data-exercise-id]");
    const destinationId = destination?.dataset.exerciseId;
    const sourceIndex = dayExercises.findIndex(
      (exercise) => exercise.id === draggedExerciseId,
    );
    const destinationIndex = dayExercises.findIndex(
      (exercise) => exercise.id === destinationId,
    );
    if (
      sourceIndex < 0 ||
      destinationIndex < 0 ||
      sourceIndex === destinationIndex
    )
      return;
    dayExercises = reorderItems(dayExercises, sourceIndex, destinationIndex);
  }

  async function stopPointerReorder(event: PointerEvent, cancelled = false) {
    if (dragPointerId !== event.pointerId) return;
    const id = draggedExerciseId;
    const ghost = dragGhost;
    const releaseTarget = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>(".movement[data-exercise-id]");
    const validDrop =
      !cancelled &&
      Boolean(
        releaseTarget?.closest(".movement-list") &&
        releaseTarget.dataset.exerciseId,
      );
    if (!validDrop && dragOriginExercises) dayExercises = dragOriginExercises;

    dragPointerId = null;
    if (dragHandle?.hasPointerCapture(event.pointerId))
      dragHandle.releasePointerCapture(event.pointerId);
    await tick();

    const destination = id
      ? document.querySelector<HTMLElement>(
          `.movement-list .movement[data-exercise-id="${CSS.escape(id)}"]`,
        )
      : null;
    if (ghost && destination) {
      const rect = destination.getBoundingClientRect();
      const animation = ghost.animate(
        [
          {
            transform: `translate3d(${dragX}px, ${dragY}px, 0)`,
            scale: "1.025",
          },
          {
            transform: `translate3d(${rect.left}px, ${rect.top}px, 0)`,
            scale: "1",
          },
        ],
        {
          duration: window.matchMedia("(prefers-reduced-motion: reduce)")
            .matches
            ? 0
            : validDrop
              ? 150
              : 240,
          easing: validDrop
            ? "cubic-bezier(.2,.8,.2,1)"
            : "cubic-bezier(.2,.9,.2,1)",
          fill: "forwards",
        },
      );
      try {
        await animation.finished;
      } catch {
        // A cancelled animation still needs the same drag cleanup.
      }
    }
    clearPointerReorder();
  }

  function clearPointerReorder() {
    dragGhost?.remove();
    draggedExerciseId = null;
    dragPointerId = null;
    dragHandle = null;
    dragGhost = null;
    dragOriginExercises = null;
    document.body.classList.remove("is-reordering");
  }

  function startViewSwipe(event: PointerEvent) {
    if (
      event.pointerType === "mouse" ||
      libraryOpen ||
      reorderMode ||
      dragPointerId !== null ||
      !event.isPrimary
    )
      return;
    if (!(event.target instanceof Element)) return;
    if (
      event.target.closest(
        'input, textarea, select, [contenteditable="true"], .drag-handle, .vault-drag-handle',
      )
    )
      return;
    viewSwipePointerId = event.pointerId;
    viewSwipeStartX = event.clientX;
    viewSwipeStartY = event.clientY;
    viewSwipeStartedAt = performance.now();
    viewSwipeHorizontal = false;
  }

  function moveViewSwipe(event: PointerEvent) {
    if (viewSwipePointerId !== event.pointerId) return;
    const deltaX = event.clientX - viewSwipeStartX;
    const deltaY = event.clientY - viewSwipeStartY;
    if (
      !viewSwipeHorizontal &&
      Math.abs(deltaY) > 12 &&
      Math.abs(deltaY) > Math.abs(deltaX)
    ) {
      clearViewSwipe();
      return;
    }
    if (
      !viewSwipeHorizontal &&
      Math.abs(deltaX) > 12 &&
      Math.abs(deltaX) > Math.abs(deltaY) * 1.15
    )
      viewSwipeHorizontal = true;
    if (viewSwipeHorizontal) event.preventDefault();
  }

  function finishViewSwipe(event: PointerEvent) {
    if (viewSwipePointerId !== event.pointerId) return;
    const deltaX = event.clientX - viewSwipeStartX;
    const deltaY = event.clientY - viewSwipeStartY;
    const elapsed = Math.max(1, performance.now() - viewSwipeStartedAt);
    const fastSwipe =
      Math.abs(deltaX) > 42 && Math.abs(deltaX) / elapsed > 0.55;
    const deliberateSwipe =
      Math.abs(deltaX) >= Math.max(72, window.innerWidth * 0.18);
    const shouldNavigate =
      viewSwipeHorizontal &&
      Math.abs(deltaX) > Math.abs(deltaY) * 1.15 &&
      (fastSwipe || deliberateSwipe);
    clearViewSwipe();
    if (!shouldNavigate) return;
    suppressClickAfterSwipe = true;
    window.setTimeout(() => (suppressClickAfterSwipe = false), 350);

    const views: AppView[] = ["today", "programme", "settings"];
    const currentIndex = views.indexOf(activeView);
    const nextIndex = Math.min(
      views.length - 1,
      Math.max(0, currentIndex + (deltaX < 0 ? 1 : -1)),
    );
    if (nextIndex !== currentIndex) void showView(views[nextIndex]);
  }

  function clearViewSwipe() {
    viewSwipePointerId = null;
    viewSwipeHorizontal = false;
  }

  function suppressSwipeClick(event: MouseEvent) {
    if (!suppressClickAfterSwipe) return;
    event.preventDefault();
    event.stopPropagation();
    suppressClickAfterSwipe = false;
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
    if (transitionDocument.startViewTransition)
      transitionDocument.startViewTransition(renderView);
    else await renderView();
  }

  function openProgramme(dayId?: string) {
    if (dayId && days.some((day) => day.id === dayId)) selectDay(dayId);
    editMode = false;
    void showView("programme");
  }

  function toggleTodayExercise(exerciseId: string) {
    if (!todayKey) return;
    if (todayKey !== completionDateKey) {
      completionDateKey = todayKey;
      todayCompletionOrder = [];
    }
    todayCompletionOrder = todayCompletionOrder.includes(exerciseId)
      ? todayCompletionOrder.filter((id) => id !== exerciseId)
      : [...todayCompletionOrder, exerciseId];
    persistTodayCompletion();
  }

  function restoreTodayCompletion(date: Date) {
    const dateKey = localDateKey(date);
    completionDateKey = dateKey;
    try {
      const raw = localStorage.getItem(todayCompletionCacheKey);
      const cached = raw
        ? (JSON.parse(raw) as { date?: unknown; exerciseIds?: unknown })
        : null;
      if (
        cached?.date === dateKey &&
        Array.isArray(cached.exerciseIds) &&
        cached.exerciseIds.every((id) => typeof id === "string")
      ) {
        todayCompletionOrder = [...new Set(cached.exerciseIds)];
        return;
      }
    } catch {
      // A malformed cache is equivalent to no completion state for today.
    }
    todayCompletionOrder = [];
    clearTodayCompletion();
  }

  function persistTodayCompletion() {
    try {
      localStorage.setItem(
        todayCompletionCacheKey,
        JSON.stringify({
          date: completionDateKey,
          exerciseIds: todayCompletionOrder,
        }),
      );
    } catch {
      // Completion remains available in memory if local cache storage fails.
    }
  }

  function clearTodayCompletion() {
    try {
      localStorage.removeItem(todayCompletionCacheKey);
    } catch {
      // The in-memory reset is authoritative for the running app.
    }
  }

  function dateLabel(date: Date | null): string {
    if (!date) return "";
    return new Intl.DateTimeFormat(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
    }).format(date);
  }

  async function applyBrandFavicon(
    selectedTheme: Theme,
    selectedAccent: Accent,
  ) {
    await tick();
    const appRoot = document.querySelector<HTMLElement>(".app");
    const favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    const browserTheme = document.querySelector<HTMLMetaElement>(
      'meta[name="theme-color"]',
    );
    if (!appRoot || !favicon) return;

    const styles = getComputedStyle(appRoot);
    const accentColour = styles.getPropertyValue(`--${selectedAccent}`).trim();
    const surfaceColour = styles
      .getPropertyValue("--md-sys-color-surface")
      .trim();
    if (!CSS.supports("color", accentColour)) return;

    if (browserTheme && CSS.supports("color", surfaceColour))
      browserTheme.content = surfaceColour;

    const icon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><path d="M12 33h11l4-15 7 30 5-21 5 6h8" fill="none" stroke="${accentColour}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    favicon.href = `data:image/svg+xml,${encodeURIComponent(icon)}`;
    favicon.dataset.theme = selectedTheme;
    favicon.dataset.accent = selectedAccent;
  }

  function weekDateNumber(index: number): string {
    if (!currentDate) return "";
    const date = new Date(currentDate);
    date.setDate(date.getDate() - weekIndex(date) + index);
    return String(date.getDate());
  }

  function exerciseCountForDay(dayId: string | null): number {
    if (!dayId) return 0;
    return dayId === activeDayId
      ? dayExercises.length
      : (workouts[dayId]?.length ?? 0);
  }

  function selectDay(dayId: string) {
    const weekday = days.findIndex((day) => day.id === dayId);
    if (weekday >= 0) selectedWeekday = weekday;
    weekPickerOpen = false;
    copyDayOpen = false;
    clearDayPending = false;
    programmeMessage = "";
    if (dayId === activeDayId) return;
    workouts = { ...workouts, [activeDayId]: dayExercises };
    activeDayId = dayId;
    dayExercises = [...(workouts[dayId] ?? [])];
  }

  function currentStoredLedger(): StoredLedger {
    return {
      workouts: { ...workouts, [activeDayId]: dayExercises },
      days,
      activeDayId,
      theme,
      accent,
      bodyMap,
      exercises: savedExercises,
      schedule,
      defaultExerciseLibraryVersion,
    };
  }

  function createLedgerExport(ledger: StoredLedger): LedgerExport {
    const exportWorkouts = Object.fromEntries(
      Object.entries(ledger.workouts).map(([dayId, exercises]) => [
        dayId,
        copyWorkout(
          exercises.filter((exercise) =>
            ledger.exercises.some(
              (definition) => definition.id === exercise.id,
            ),
          ),
        ),
      ]),
    );
    return {
      app: "pulse",
      version: 4,
      exportedAt: new Date().toISOString(),
      settings: {
        theme: ledger.theme as Theme,
        accent: ledger.accent as Accent,
        bodyMap: normaliseBodyMap(ledger.bodyMap),
      },
      programme: {
        days: ledger.days,
        workouts: exportWorkouts,
        schedule: ledger.schedule,
      },
      library: ledger.exercises,
    };
  }

  function ledgerFingerprint(ledger: StoredLedger): string {
    return JSON.stringify({
      workouts: ledger.workouts,
      days: ledger.days,
      theme: ledger.theme,
      accent: ledger.accent,
      bodyMap: ledger.bodyMap,
      exercises: ledger.exercises,
      schedule: ledger.schedule,
    });
  }

  function automaticBackupContents(ledger: StoredLedger): string {
    return JSON.stringify(createLedgerExport(ledger), null, 2);
  }

  async function initialiseAutomaticBackup() {
    try {
      const storedPreferences = localStorage.getItem(autoBackupPreferencesKey);
      autoBackup = normaliseAutoBackupPreferences(
        storedPreferences ? JSON.parse(storedPreferences) : null,
      );
    } catch {
      autoBackup = { ...defaultAutoBackupPreferences };
    }

    if (!isNativeApp()) {
      autoBackup = {
        ...autoBackup,
        enabled: false,
        folderName: "",
        nextSaveAt: "",
      };
      backupFolderSelected = false;
      persistAutoBackupPreferences();
      return;
    }

    try {
      const status = await getScopedBackupStatus();
      backupFolderSelected = status.selected;
      autoBackup = {
        ...autoBackup,
        enabled: autoBackup.enabled && status.selected,
        folderName: status.selected
          ? (status.folderName ?? "Selected folder")
          : "",
        lastError: status.selected ? autoBackup.lastError : "",
        nextSaveAt: status.selected ? autoBackup.nextSaveAt : "",
      };
      persistAutoBackupPreferences();
      await resumePendingBackup();
    } catch (error) {
      backupFolderSelected = false;
      autoBackup = {
        ...autoBackup,
        enabled: false,
        lastError:
          error instanceof Error
            ? error.message
            : "Could not check backup folder access.",
        nextSaveAt: "",
      };
      persistAutoBackupPreferences();
    }
  }

  function scheduleAutomaticBackup(ledger: StoredLedger, force = false) {
    if (
      backupSuspended ||
      !autoBackup.enabled ||
      !backupFolderSelected ||
      !isNativeApp()
    )
      return;
    const fingerprint = ledgerFingerprint(ledger);
    if (!force && fingerprint === lastBackupFingerprint) return;
    lastBackupFingerprint = fingerprint;
    const contents = automaticBackupContents(ledger);

    if (autoBackup.timing === "immediate") {
      const pending = createPendingBackup(
        contents,
        fingerprint,
        Date.now() + 150,
      );
      void persistPendingBackup(pending);
      autoBackup = { ...autoBackup, nextSaveAt: "", lastError: "" };
      persistAutoBackupPreferences();
      armBackupTimer(pending, backupGeneration);
      return;
    }

    const dueAt = new Date(
      Date.now() + normaliseBackupDelay(autoBackup.delayMinutes) * 60_000,
    ).toISOString();
    const pending = createPendingBackup(
      contents,
      fingerprint,
      Date.parse(dueAt),
    );
    void persistPendingBackup(pending);
    autoBackup = { ...autoBackup, nextSaveAt: dueAt, lastError: "" };
    persistAutoBackupPreferences();
    armBackupTimer(pending, backupGeneration);
  }

  function createPendingBackup(
    contents: string,
    fingerprint: string,
    dueAt: number,
  ): PendingBackup {
    backupRevision += 1;
    return {
      contents,
      fingerprint,
      dueAt: new Date(dueAt).toISOString(),
      revision: backupRevision,
    };
  }

  async function persistPendingBackup(pending: PendingBackup) {
    try {
      await savePendingBackupData(pending);
    } catch (error) {
      if (pending.revision !== backupRevision) return;
      autoBackup = {
        ...autoBackup,
        lastError:
          error instanceof Error
            ? error.message
            : "Could not queue the automatic backup.",
      };
      persistAutoBackupPreferences();
    }
  }

  function armBackupTimer(pending: PendingBackup, generation: number) {
    if (backupTimer !== null) window.clearTimeout(backupTimer);
    const wait = Math.max(0, Date.parse(pending.dueAt) - Date.now());
    backupTimer = window.setTimeout(() => {
      backupTimer = null;
      if (
        generation !== backupGeneration ||
        pending.revision !== backupRevision ||
        !autoBackup.enabled ||
        !backupFolderSelected
      )
        return;
      void performAutomaticBackup(pending, generation);
    }, wait);
  }

  async function resumePendingBackup() {
    if (!autoBackup.enabled || !backupFolderSelected) return;
    const storedPending = await readPendingBackup();
    if (!storedPending) return;
    const ledger = currentStoredLedger();
    const pending = {
      ...storedPending,
      contents: automaticBackupContents(ledger),
      fingerprint: ledgerFingerprint(ledger),
    };
    await persistPendingBackup(pending);
    backupRevision = Math.max(backupRevision, pending.revision);
    lastBackupFingerprint = pending.fingerprint;
    if (Date.parse(pending.dueAt) <= Date.now())
      await performAutomaticBackup(pending, backupGeneration);
    else armBackupTimer(pending, backupGeneration);
  }

  function performAutomaticBackup(
    pending: PendingBackup,
    generation: number,
  ): Promise<void> {
    queuedBackup = { pending, generation };
    if (backupDrainRunning) return backupWriteQueue;
    backupDrainRunning = true;
    backupWriteQueue = drainAutomaticBackupQueue();
    return backupWriteQueue;
  }

  function queuedBackupRevision(): number {
    return queuedBackup?.pending.revision ?? -1;
  }

  async function drainAutomaticBackupQueue() {
    try {
      while (queuedBackup) {
        const request = queuedBackup;
        queuedBackup = null;
        const { pending, generation } = request;
        if (
          generation !== backupGeneration ||
          !autoBackup.enabled ||
          !backupFolderSelected
        )
          continue;

        backupBusy = true;
        try {
          const result = await writeScopedBackup(
            pending.contents,
            autoBackup.preservePrevious,
          );
          if (generation !== backupGeneration) continue;
          const stored = await readPendingBackup();
          if (stored?.revision === pending.revision)
            await clearPendingBackup(false);
          autoBackup = {
            ...autoBackup,
            folderName: result.folderName ?? autoBackup.folderName,
            lastSavedAt: new Date(result.savedAt).toISOString(),
            lastError: "",
            nextSaveAt:
              stored && stored.revision !== pending.revision
                ? stored.dueAt
                : "",
          };
          persistAutoBackupPreferences();
        } catch (error) {
          const hasNewerQueuedBackup =
            queuedBackupRevision() > pending.revision;
          if (
            hasNewerQueuedBackup ||
            !shouldRetryBackup(
              pending.revision,
              backupRevision,
              autoBackup.enabled,
              generation === backupGeneration,
            )
          )
            continue;
          const retry: PendingBackup = {
            ...pending,
            dueAt: new Date(Date.now() + 60_000).toISOString(),
          };
          await persistPendingBackup(retry);
          autoBackup = {
            ...autoBackup,
            lastError:
              error instanceof Error
                ? error.message
                : "Automatic backup failed.",
            nextSaveAt: retry.dueAt,
          };
          persistAutoBackupPreferences();
          armBackupTimer(retry, generation);
          break;
        } finally {
          backupBusy = false;
        }
      }
    } finally {
      backupDrainRunning = false;
      if (queuedBackup)
        void performAutomaticBackup(
          queuedBackup.pending,
          queuedBackup.generation,
        );
    }
  }

  async function cancelAutomaticBackups() {
    backupGeneration += 1;
    backupRevision += 1;
    queuedBackup = null;
    if (backupTimer !== null) window.clearTimeout(backupTimer);
    backupTimer = null;
    await clearPendingBackupData().catch(() => undefined);
  }

  async function waitForActiveBackup() {
    await backupWriteQueue.catch(() => undefined);
  }

  async function writeBackupNow(contents: string, fingerprint: string) {
    const pending = createPendingBackup(contents, fingerprint, Date.now());
    await persistPendingBackup(pending);
    await performAutomaticBackup(pending, backupGeneration);
  }

  /*
   * A folder write that has already crossed into Android cannot be interrupted.
   * Cancellation invalidates its result and all queued/retry work.
   */
  async function disableAutomaticBackup() {
    autoBackup = { ...autoBackup, enabled: false, nextSaveAt: "" };
    persistAutoBackupPreferences();
    backupSuspended = true;
    await cancelAutomaticBackups();
    backupSuspended = false;
  }

  async function selectAutomaticBackupFolder() {
    try {
      const result = await chooseScopedBackupFolder();
      if (!result.selected) return;
      backupSuspended = true;
      await cancelAutomaticBackups();
      backupFolderSelected = true;
      autoBackup = {
        ...autoBackup,
        enabled: true,
        folderName: result.folderName ?? "Selected folder",
        lastError: "",
      };
      persistAutoBackupPreferences();
      backupSuspended = false;
      scheduleAutomaticBackup(currentStoredLedger(), true);
    } catch (error) {
      backupSuspended = false;
      autoBackup = {
        ...autoBackup,
        lastError:
          error instanceof Error
            ? error.message
            : "Could not select that folder.",
      };
      persistAutoBackupPreferences();
    }
  }

  function setAutomaticBackupEnabled(enabled: boolean) {
    if (enabled && !backupFolderSelected) {
      void selectAutomaticBackupFolder();
      return;
    }
    if (!enabled) {
      void disableAutomaticBackup();
      return;
    }
    autoBackup = { ...autoBackup, enabled: true };
    persistAutoBackupPreferences();
    scheduleAutomaticBackup(currentStoredLedger(), true);
  }

  function setBackupTiming(timing: "immediate" | "delayed") {
    backupSuspended = true;
    autoBackup = { ...autoBackup, timing, lastError: "", nextSaveAt: "" };
    persistAutoBackupPreferences();
    void cancelAutomaticBackups().then(() => {
      backupSuspended = false;
      if (autoBackup.enabled)
        scheduleAutomaticBackup(currentStoredLedger(), true);
    });
  }

  function updateBackupDelay(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const delayMinutes = normaliseBackupDelay(input.value);
    input.value = String(delayMinutes);
    backupSuspended = true;
    autoBackup = { ...autoBackup, delayMinutes, lastError: "", nextSaveAt: "" };
    persistAutoBackupPreferences();
    void cancelAutomaticBackups().then(() => {
      backupSuspended = false;
      if (autoBackup.enabled && autoBackup.timing === "delayed")
        scheduleAutomaticBackup(currentStoredLedger(), true);
    });
  }

  function setPreservePrevious(preservePrevious: boolean) {
    autoBackup = { ...autoBackup, preservePrevious };
    persistAutoBackupPreferences();
  }

  async function saveAutomaticBackupNow() {
    if (!backupFolderSelected) {
      await selectAutomaticBackupFolder();
      return;
    }
    const ledger = currentStoredLedger();
    const fingerprint = ledgerFingerprint(ledger);
    lastBackupFingerprint = fingerprint;
    await writeBackupNow(automaticBackupContents(ledger), fingerprint);
  }

  async function removeAutomaticBackupAccess() {
    autoBackup = { ...autoBackup, enabled: false, nextSaveAt: "" };
    persistAutoBackupPreferences();
    backupSuspended = true;
    try {
      await cancelAutomaticBackups();
      await waitForActiveBackup();
      await clearScopedBackupFolder();
      backupFolderSelected = false;
      autoBackup = {
        ...defaultAutoBackupPreferences,
        timing: autoBackup.timing,
        delayMinutes: autoBackup.delayMinutes,
        preservePrevious: autoBackup.preservePrevious,
      };
      persistAutoBackupPreferences();
    } catch (error) {
      autoBackup = {
        ...autoBackup,
        lastError:
          error instanceof Error
            ? error.message
            : "Could not remove folder access.",
      };
      persistAutoBackupPreferences();
    } finally {
      backupSuspended = false;
    }
  }

  async function readPendingBackup(): Promise<PendingBackup | null> {
    try {
      const stored = normalisePendingBackup(await loadPendingBackupData());
      if (stored) return stored;

      const legacyRaw = localStorage.getItem(legacyPendingBackupKey);
      if (!legacyRaw) return null;
      const legacy = normalisePendingBackup(JSON.parse(legacyRaw));
      localStorage.removeItem(legacyPendingBackupKey);
      if (legacy) await savePendingBackupData(legacy);
      return legacy;
    } catch {
      return null;
    }
  }

  async function clearPendingBackup(updatePreferences = true) {
    if (backupTimer !== null) window.clearTimeout(backupTimer);
    backupTimer = null;
    await clearPendingBackupData().catch(() => undefined);
    if (updatePreferences && autoBackup.nextSaveAt) {
      autoBackup = { ...autoBackup, nextSaveAt: "" };
      persistAutoBackupPreferences();
    }
  }

  function persistAutoBackupPreferences() {
    try {
      localStorage.setItem(
        autoBackupPreferencesKey,
        JSON.stringify(autoBackup),
      );
    } catch {
      // Preferences are small; keep the current in-memory state if storage is unavailable.
    }
  }

  function formatBackupTimestamp(value: string): string {
    if (!value) return "Not saved yet";
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  }

  async function exportLedger() {
    const payload = createLedgerExport(currentStoredLedger());
    const contents = JSON.stringify(payload, null, 2);
    const filename = `pulse-ledger-${new Date().toISOString().slice(0, 10)}.json`;
    try {
      if (await shareLedgerFile(filename, contents)) {
        transferError = false;
        transferMessage = "Opened your device share sheet.";
        return;
      }
    } catch {
      transferError = false;
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
    transferError = false;
  }

  async function readImport(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
      const candidate: unknown = JSON.parse(await file.text());
      if (!isLedgerExport(candidate))
        throw new Error("This is not a valid Pulse ledger file.");
      pendingImport = candidate;
      transferMessage = "";
      transferError = false;
    } catch (error) {
      pendingImport = null;
      transferMessage =
        error instanceof Error ? error.message : "Could not read that file.";
      transferError = true;
    } finally {
      input.value = "";
    }
  }

  function applyImport() {
    if (!pendingImport) return;
    const imported = pendingImport;
    if (imported.library)
      savedExercises = mergeDefaultExerciseLibrary(imported.library);
    installWeeklyProgramme(
      imported.programme.days.map((day) => ({ ...day })),
      Object.fromEntries(
        Object.entries(imported.programme.workouts).map(([id, exercises]) => [
          id,
          copyWorkout(exercises),
        ]),
      ),
    );
    theme = imported.settings.theme;
    accent = imported.settings.accent;
    bodyMap = normaliseBodyMap(imported.settings.bodyMap);
    pendingImport = null;
    transferMessage = "Imported your weekly programme.";
    transferError = false;
  }

  async function openLibrary(mode: LibraryMode) {
    if (libraryOpen) return;
    libraryReturnFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    libraryMode = mode;
    search = "";
    selectedMuscle = "All";
    showArchived = false;
    libraryClosing = false;
    exerciseEditorOpen = false;
    editingExerciseId = null;
    previewExerciseId = null;
    deleteExerciseCandidateId = null;
    vaultFiltersOpen = false;
    resetVaultDrag();
    libraryOpen = true;
    await tick();
    vaultCloseButton?.focus();
  }

  async function closeLibrary(returnFocus = true) {
    if (!libraryOpen || libraryClosing) return;
    const animate =
      browser && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (animate) {
      libraryClosing = true;
      stopVaultDragRendering();
      vaultElement?.classList.add("closing");
      vaultElement?.classList.remove("dragging");
      await new Promise((resolve) => window.setTimeout(resolve, 220));
    }
    libraryOpen = false;
    libraryClosing = false;
    resetVaultDrag();
    exerciseEditorOpen = false;
    editingExerciseId = null;
    deleteExerciseCandidateId = null;
    vaultFiltersOpen = false;
    if (!returnFocus) {
      libraryReturnFocus = null;
      return;
    }
    await tick();
    const returnTarget = libraryReturnFocus?.isConnected
      ? libraryReturnFocus
      : addMovementButton;
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
    vaultScrim?.style.setProperty(
      "--sheet-scrim-opacity",
      String(Math.max(0.18, 1 - progress * 1.15)),
    );
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
      vaultDragVelocity =
        vaultDragVelocity === 0
          ? instantVelocity
          : instantVelocity * 0.72 + vaultDragVelocity * 0.28;
      vaultDragLastY = event.clientY;
      vaultDragLastAt = now;
    }
    vaultDragY = Math.max(0, event.clientY - vaultDragStartY);
    if (vaultDragY > 5) vaultDragMoved = true;
    scheduleVaultDragRender();
  }

  function startVaultDrag(event: PointerEvent) {
    if (
      !window.matchMedia(mobileVaultQuery).matches ||
      event.button !== 0 ||
      libraryClosing
    )
      return;
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
    if (handle.hasPointerCapture(event.pointerId))
      handle.releasePointerCapture(event.pointerId);
    if (Math.abs(event.clientY - vaultDragLastY) > 0.5) updateVaultDrag(event);
    stopVaultDragRendering();
    renderVaultDrag();
    const releaseVelocity =
      performance.now() - vaultDragLastAt <= 90 ? vaultDragVelocity : 0;
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
    if (
      event.shiftKey &&
      (document.activeElement === first ||
        !vaultElement.contains(document.activeElement))
    ) {
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
    } else if (vaultFiltersOpen) {
      vaultFiltersOpen = false;
    } else if (libraryOpen) {
      void closeLibrary();
    }
  }

  function handleGlobalPointerDown(event: PointerEvent) {
    if (!(event.target instanceof Element)) return;
    if (
      vaultFiltersOpen &&
      !event.target.closest(".vault-filter-button, .vault-filter-panel")
    )
      vaultFiltersOpen = false;
  }
</script>

<svelte:window
  onpointerdown={handleGlobalPointerDown}
  onpointermove={handlePointerReorder}
  onpointerup={stopPointerReorder}
  onpointercancel={(event) => stopPointerReorder(event, true)}
  onkeydown={handlePopoverKeydown}
/>

<svelte:head>
  <title>Pulse — Workout planner</title>
  <meta
    name="description"
    content="Your weekly training programme, available offline."
  />
</svelte:head>

<div class="app" data-theme={theme} data-accent={accent}>
  <nav class="app-navigation" aria-label="Main navigation" inert={libraryOpen}>
    <button
      class:active={activeView === "today" &&
        !(libraryOpen && libraryMode === "manage")}
      onclick={() => showView("today")}
      aria-current={activeView === "today" &&
      !(libraryOpen && libraryMode === "manage")
        ? "page"
        : undefined}
    >
      <span class="nav-indicator"><CalendarDays size={21} /></span>
      <span class="nav-label">Today</span>
    </button>
    <button
      class:active={activeView === "programme" &&
        !(libraryOpen && libraryMode === "manage")}
      onclick={() => openProgramme(activeDayId)}
      aria-current={activeView === "programme" &&
      !(libraryOpen && libraryMode === "manage")
        ? "page"
        : undefined}
    >
      <span class="nav-indicator"><Dumbbell size={21} /></span>
      <span class="nav-label">Programme</span>
    </button>
    <button
      class:active={libraryOpen && libraryMode === "manage"}
      onclick={() => openLibrary("manage")}
      aria-expanded={libraryOpen && libraryMode === "manage"}
      aria-haspopup="dialog"
    >
      <span class="nav-indicator"><LibraryBig size={21} /></span>
      <span class="nav-label">Exercises</span>
    </button>
    <button
      class:active={activeView === "settings" &&
        !(libraryOpen && libraryMode === "manage")}
      onclick={() => showView("settings")}
      aria-current={activeView === "settings" &&
      !(libraryOpen && libraryMode === "manage")
        ? "page"
        : undefined}
    >
      <span class="nav-indicator"><Settings size={21} /></span>
      <span class="nav-label">Settings</span>
    </button>
  </nav>

  <main
    class="app-content"
    inert={libraryOpen}
    onpointerdown={startViewSwipe}
    onpointermove={moveViewSwipe}
    onpointerup={finishViewSwipe}
    onpointercancel={clearViewSwipe}
    onclickcapture={suppressSwipeClick}
  >
    {#if activeView === "today"}
      <section class="screen today-screen" aria-labelledby="today-title">
        <header class="screen-heading">
          <div>
            <p>{dateLabel(currentDate)}</p>
            <h1 id="today-title">Today</h1>
          </div>
          <span class="screen-brand" aria-hidden="true"
            ><PulseMark size={30} /></span
          >
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
              <p>
                {todayExercises.length}
                {todayExercises.length === 1 ? "exercise" : "exercises"}
              </p>
            </div>
            <div
              class="progress-count"
              aria-label={`${completedTodayCount} of ${todayExercises.length} exercises done`}
            >
              <strong
                >{completedTodayCount}<small>/{todayExercises.length}</small
                ></strong
              >
              <span>done</span>
            </div>
            <div class="progress-track">
              <span
                style={`width: ${todayExercises.length ? (completedTodayCount / todayExercises.length) * 100 : 0}%`}
              ></span>
            </div>
          </section>

          {#if todayExercises.length}
            <div class="exercise-list today-exercise-list">
              {#each orderedTodayExercises as exercise (exercise.id)}
                <article
                  class:completed={todayCompleted.has(exercise.id)}
                  class:expanded={expanded.has(exercise.id)}
                  class="exercise-row"
                  animate:flip={{ duration: 190 }}
                >
                  <div class="exercise-row-main">
                    <button
                      class="completion-toggle"
                      onclick={() => toggleTodayExercise(exercise.id)}
                      aria-pressed={todayCompleted.has(exercise.id)}
                      aria-label={`${todayCompleted.has(exercise.id) ? "Mark" : "Mark"} ${exercise.name} ${todayCompleted.has(exercise.id) ? "not done" : "done"}`}
                    >
                      {#if todayCompleted.has(exercise.id)}<CircleCheck
                          size={24}
                        />{:else}<Circle size={24} />{/if}
                    </button>
                    <div class="exercise-copy">
                      <h3>{exercise.name}</h3>
                      <p>
                        {exercise.muscles.join(" · ")} · {exercise.equipment}
                      </p>
                    </div>
                    {#if exercise.groups.length === 1}
                      {@const group = exercise.groups[0]}
                      <div class="exercise-dose">
                        <strong
                          >{group.sets} × {weightLabel(
                            group.load,
                          )}{#if parseWeight(group.load) !== null}
                            kg{/if}</strong
                        >
                        <span
                          >{group.reps || "Open"} reps{#if group.rest && group.rest !== "—"}
                            · {group.rest}{/if}</span
                        >
                      </div>
                    {:else}
                      <span class="set-group-count"
                        >{exercise.groups.length} groups</span
                      >
                    {/if}
                    <button
                      class="row-action"
                      onclick={() => toggleExpanded(exercise.id)}
                      aria-expanded={expanded.has(exercise.id)}
                      aria-label={`${expanded.has(exercise.id) ? "Hide" : "Show"} details for ${exercise.name}`}
                      ><ChevronDown
                        class={expanded.has(exercise.id) ? "turned" : ""}
                        size={20}
                      /></button
                    >
                  </div>
                  {#if exercise.groups.length > 1}
                    <div
                      class="today-set-groups"
                      aria-label={`${exercise.name} set groups`}
                    >
                      {#each exercise.groups as group, groupIndex (group.id)}
                        <div class="today-set-group">
                          <span>{String(groupIndex + 1).padStart(2, "0")}</span>
                          <strong>{group.sets} × {group.reps || "open"}</strong>
                          <b
                            >{weightLabel(
                              group.load,
                            )}{#if parseWeight(group.load) !== null}
                              kg{/if}</b
                          >
                          <small>{group.rest || "No rest"}</small>
                        </div>
                      {/each}
                    </div>
                  {/if}
                  {#if expanded.has(exercise.id)}
                    <div
                      class="exercise-details"
                      in:slide={{ duration: 170 }}
                      out:slide={{ duration: 130 }}
                    >
                      {#if onlineExerciseImages && exercise.imageUrl}<img
                          src={exercise.imageUrl}
                          alt={`Reference for ${exercise.name}`}
                          loading="lazy"
                        />{/if}
                      {#if exercise.description}<p>
                          {exercise.description}
                        </p>{/if}
                      {#if exercise.note}<p class="exercise-cue">
                          {exercise.note}
                        </p>{/if}
                      {#if exercise.guideUrl}<a
                          href={exercise.guideUrl}
                          target="_blank"
                          rel="noreferrer"
                          ><ExternalLink size={16} /> Open form guide</a
                        >{/if}
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
              <md-filled-tonal-button
                onclick={() => openProgramme(todayPlan?.id)}
                >Open programme</md-filled-tonal-button
              >
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
      <section
        class="screen programme-screen"
        aria-labelledby="programme-title"
      >
        <header class="screen-heading">
          <div>
            <p>Seven days, your rules</p>
            <h1 id="programme-title">Programme</h1>
          </div>
          <span class="screen-brand" aria-hidden="true"
            ><PulseMark size={30} /></span
          >
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
            <button
              class="week-picker-toggle"
              onclick={() => (weekPickerOpen = !weekPickerOpen)}
              aria-expanded={weekPickerOpen}
            >
              <span class="week-picker-icon"><CalendarDays size={20} /></span>
              <span>
                <strong>{activeDayName}</strong>
                <small
                  >{dayExercises.length
                    ? `${dayExercises.length} ${dayExercises.length === 1 ? "exercise" : "exercises"}`
                    : "Rest day"}</small
                >
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
                      ><strong>{weekday}</strong
                      >{#if index === todayIndex}<small>Today</small>{/if}</span
                    >
                    <span class="day-status">
                      {#if (days[index].id === activeDayId ? dayExercises : (workouts[days[index].id] ?? [])).length}
                        {(days[index].id === activeDayId
                          ? dayExercises
                          : (workouts[days[index].id] ?? [])
                        ).length} exercises
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
              <header class:editing={editMode} class="session-heading">
                <div class="plan-title">
                  <h2 id="session-title">{activeDayName}</h2>
                  <p>
                    {dayExercises.length}
                    {dayExercises.length === 1 ? "exercise" : "exercises"}
                  </p>
                </div>
                <div class="programme-actions">
                  {#if editMode}
                    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
                    {#if reorderMode}
                      <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
                      <md-filled-tonal-button
                        class="finish-reorder"
                        onclick={toggleReorderMode}
                        ><span slot="icon"><Check size={18} /></span>Finish
                        order</md-filled-tonal-button
                      >
                    {:else}
                      <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
                      <md-filled-tonal-button
                        bind:this={addMovementButton}
                        class="add-movement"
                        onclick={() => openLibrary("pick")}
                        ><span slot="icon"><LibraryBig size={18} /></span>Add
                        exercise</md-filled-tonal-button
                      >
                      <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
                      <md-text-button onclick={toggleReorderMode}
                        ><span slot="icon"><GripVertical size={18} /></span
                        >Reorder</md-text-button
                      >
                      <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
                      <md-text-button
                        class:active={copyDayOpen}
                        onclick={() => {
                          copyDayOpen = !copyDayOpen;
                          clearDayPending = false;
                        }}
                        aria-expanded={copyDayOpen}
                        ><span slot="icon"><Copy size={18} /></span>Copy day</md-text-button
                      >
                      <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
                      <md-text-button
                        class:confirming={clearDayPending}
                        onclick={requestClearDay}
                        ><span slot="icon"><Trash2 size={18} /></span
                        >{clearDayPending
                          ? "Confirm clear"
                          : "Clear day"}</md-text-button
                      >
                    {/if}
                  {/if}
                  {#if !reorderMode}
                    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
                    <md-filled-tonal-button
                      class="edit-toggle"
                      onclick={toggleEditMode}
                      ><span slot="icon"><Pencil size={18} /></span>{editMode
                        ? "Done"
                        : "Edit plan"}</md-filled-tonal-button
                    >
                  {/if}
                </div>
              </header>

              {#if programmeMessage}
                <p class="programme-message" role="status">
                  {programmeMessage}
                </p>
              {/if}

              {#if copyDayOpen}
                <section
                  class="copy-day-panel"
                  aria-labelledby="copy-day-title"
                >
                  <div>
                    <h3 id="copy-day-title">Copy {activeDayName} to</h3>
                    <p>
                      This replaces the workout currently saved on that day.
                    </p>
                  </div>
                  <div class="copy-day-options">
                    {#each days.filter((day) => day.id !== activeDayId) as day}
                      <button type="button" onclick={() => copyDayTo(day.id)}>
                        <span>{day.name}</span>
                        <small
                          >{exerciseCountForDay(day.id)
                            ? `${exerciseCountForDay(day.id)} exercises`
                            : "Rest day"}</small
                        >
                      </button>
                    {/each}
                  </div>
                </section>
              {/if}

              {#if dayExercises.length}
                <div class="movement-list">
                  {#each dayExercises as exercise, index (exercise.id)}
                    <article
                      data-exercise-id={exercise.id}
                      class:reordering={reorderMode}
                      class:hinting={reorderMode && reorderHintActive}
                      class:dragging={draggedExerciseId === exercise.id}
                      class:expanded={expanded.has(exercise.id)}
                      class="movement"
                      animate:flip={{ duration: 180 }}
                    >
                      <div class="movement-main">
                        <div class="sequence-number">
                          {#if reorderMode}
                            <button
                              class="drag-handle"
                              onpointerdown={(event) =>
                                startPointerReorder(event, exercise.id)}
                              aria-label={`Hold and drag ${exercise.name} to change its position`}
                              ><GripVertical size={21} /></button
                            >
                          {:else}
                            <span>{String(index + 1).padStart(2, "0")}</span>
                          {/if}
                        </div>

                        <div class="movement-name">
                          <h2>{exercise.name}</h2>
                          <p>
                            <span class="movement-muscles"
                              >{exercise.muscles.join(" / ")}</span
                            ><span class="movement-divider">•</span><span
                              >{exercise.equipment}</span
                            >
                          </p>
                        </div>

                        {#if !reorderMode}
                          <button
                            class="details-toggle"
                            onclick={() => toggleExpanded(exercise.id)}
                            aria-expanded={expanded.has(exercise.id)}
                            aria-controls={`${exercise.id}-details`}
                            aria-label={`${expanded.has(exercise.id) ? "Hide" : "Show"} details for ${exercise.name}`}
                          >
                            <span>Details</span>
                            <ChevronDown
                              class={expanded.has(exercise.id) ? "turned" : ""}
                              size={17}
                            />
                          </button>
                        {/if}
                      </div>

                      {#if reorderMode}
                        <div class="reorder-strip">
                          <span
                            >Drag the highlighted handle or tap an arrow</span
                          >
                          <div>
                            <button
                              onclick={() => moveExercise(index, -1)}
                              disabled={index === 0}
                              aria-label={`Move ${exercise.name} up`}
                              ><ArrowUp size={16} /></button
                            >
                            <button
                              onclick={() => moveExercise(index, 1)}
                              disabled={index === dayExercises.length - 1}
                              aria-label={`Move ${exercise.name} down`}
                              ><ArrowDown size={16} /></button
                            >
                          </div>
                        </div>
                      {/if}

                      {#if !reorderMode}
                        {#if editMode}
                          <div
                            class:multiple={exercise.groups.length > 1}
                            class="prescription-editor"
                          >
                            {#each exercise.groups as group, groupIndex (group.id)}
                              <section class="set-group-editor">
                                {#if exercise.groups.length > 1}<header>
                                    <div>
                                      <span>Set group {groupIndex + 1}</span>
                                      <small>Performed in this order</small>
                                    </div>
                                    <button
                                      class="remove-set-group"
                                      type="button"
                                      onclick={() =>
                                        removeSetGroup(exercise, group.id)}
                                      aria-label={`Remove set group ${groupIndex + 1} from ${exercise.name}`}
                                      ><Trash2 size={15} /></button
                                    >
                                  </header>{/if}
                                <div class="set-group-controls">
                                  <div
                                    class="prescription-control sets-control"
                                  >
                                    <span class="control-label">Sets</span>
                                    <div class="number-stepper">
                                      <button
                                        onclick={() => adjustSets(group, -1)}
                                        disabled={group.sets <= 1}
                                        aria-label={`Decrease sets in group ${groupIndex + 1} for ${exercise.name}`}
                                        ><Minus size={16} /></button
                                      ><strong>{group.sets}</strong><button
                                        onclick={() => adjustSets(group, 1)}
                                        disabled={group.sets >= 20}
                                        aria-label={`Increase sets in group ${groupIndex + 1} for ${exercise.name}`}
                                        ><Plus size={16} /></button
                                      >
                                    </div>
                                  </div>
                                  <div
                                    class="prescription-control weight-control"
                                  >
                                    <span class="control-label"
                                      >Weight · ±2.5 kg</span
                                    >
                                    <div class="weight-stepper">
                                      <button
                                        onclick={() =>
                                          adjustWeight(group, -2.5)}
                                        disabled={parseWeight(group.load) ===
                                          null}
                                        aria-label={`Decrease weight in group ${groupIndex + 1} for ${exercise.name} by 2.5 kilograms`}
                                        ><Minus size={16} /></button
                                      ><label
                                        ><input
                                          type="number"
                                          min="0"
                                          step="0.5"
                                          inputmode="decimal"
                                          value={weightInputValue(group.load)}
                                          placeholder="0"
                                          oninput={(event) =>
                                            updateWeightInput(group, event)}
                                          onblur={() => settleWeight(group)}
                                          aria-label={`Weight in group ${groupIndex + 1} for ${exercise.name} in kilograms`}
                                        /><span>kg</span></label
                                      ><button
                                        onclick={() => adjustWeight(group, 2.5)}
                                        aria-label={`Increase weight in group ${groupIndex + 1} for ${exercise.name} by 2.5 kilograms`}
                                        ><Plus size={16} /></button
                                      >
                                    </div>
                                  </div>
                                  <label class="text-prescription"
                                    ><span>Rep range</span><input
                                      bind:value={group.reps}
                                      oninput={touch}
                                      placeholder="8–12"
                                    /></label
                                  >
                                  <label class="text-prescription"
                                    ><span>Rest</span><input
                                      bind:value={group.rest}
                                      oninput={touch}
                                      placeholder="90 sec"
                                    /></label
                                  >
                                </div>
                              </section>
                            {/each}
                            <button
                              class="add-set-group"
                              type="button"
                              onclick={() => addSetGroup(exercise)}
                              ><Plus size={16} /> Add set group</button
                            >
                          </div>
                        {:else}
                          <div
                            class:multiple={exercise.groups.length > 1}
                            class="prescription-readout"
                          >
                            {#each exercise.groups as group, groupIndex (group.id)}
                              <div class="prescription-group-row">
                                {#if exercise.groups.length > 1}<span
                                    class="prescription-group-index"
                                    >{String(groupIndex + 1).padStart(
                                      2,
                                      "0",
                                    )}</span
                                  >{/if}
                                <p class="primary-prescription">
                                  <span>Sets × load</span>
                                  <strong
                                    >{group.sets}<b aria-hidden="true">×</b
                                    >{weightLabel(
                                      group.load,
                                    )}{#if parseWeight(group.load) !== null}<small
                                        >kg</small
                                      >{/if}</strong
                                  >
                                </p>
                                <div class="secondary-prescription">
                                  <p class="reps-readout">
                                    <span>Reps</span><strong
                                      >{group.reps || "Open"}</strong
                                    >
                                  </p>
                                  {#if group.rest && group.rest !== "—"}<p
                                      class="rest-readout"
                                    >
                                      <span>Rest</span><strong
                                        >{group.rest}</strong
                                      >
                                    </p>{/if}
                                </div>
                              </div>
                            {/each}
                          </div>
                        {/if}
                      {/if}

                      {#if !reorderMode && expanded.has(exercise.id)}
                        <div
                          class="movement-details"
                          id={`${exercise.id}-details`}
                          in:slide={{ duration: 170 }}
                          out:slide={{ duration: 130 }}
                        >
                          {#if onlineExerciseImages && exercise.imageUrl}
                            <figure class="movement-media">
                              <img
                                src={exercise.imageUrl}
                                alt={`Reference for ${exercise.name}`}
                                loading="lazy"
                              />
                            </figure>
                          {/if}
                          {#if exercise.description}<p>
                              {exercise.description}
                            </p>{/if}
                          <div class="details-toolbar">
                            {#if exercise.guideUrl}<a
                                href={exercise.guideUrl}
                                target="_blank"
                                rel="noreferrer"
                                ><ExternalLink size={14} /> Open form reference</a
                              >{/if}
                            {#if editMode}<label class="movement-note"
                                ><span>Private cue</span><input
                                  placeholder="What should you remember?"
                                  bind:value={exercise.note}
                                  oninput={touch}
                                /></label
                              >{:else if exercise.note}<p
                                class="movement-note-readout"
                              >
                                {exercise.note}
                              </p>{/if}
                            {#if editMode}<button
                                class="delete-movement"
                                onclick={() => removeExercise(exercise.id)}
                                aria-label={`Remove ${exercise.name}`}
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
                      if (editMode) void openLibrary("pick");
                      else toggleEditMode();
                    }}
                    ><Plus size={15} />
                    {editMode
                      ? "Add the first movement"
                      : "Edit this day"}</button
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
          <span class="screen-brand" aria-hidden="true"
            ><PulseMark size={30} /></span
          >
        </header>

        <div class="settings-groups">
          <section
            class="settings-group appearance-settings"
            aria-labelledby="appearance-heading"
          >
            <header>
              <span><Settings size={20} /></span>
              <div>
                <h2 id="appearance-heading">Appearance</h2>
                <p>Choose colours and your exercise body map.</p>
              </div>
            </header>
            <fieldset class="flavour-options">
              <legend>Flavour</legend>
              {#each themes as option}
                <button
                  class:active={theme === option}
                  onclick={() => (theme = option)}
                  aria-pressed={theme === option}
                >
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
                    {#if accent === option}<Check
                        size={13}
                        strokeWidth={3}
                      />{/if}
                  </button>
                {/each}
              </div>
            </fieldset>
            <fieldset class="body-map-options">
              <legend>Body map</legend>
              <div>
                {#each bodyMaps as option}
                  <button
                    type="button"
                    class:active={bodyMap === option}
                    onclick={() => (bodyMap = option)}
                    aria-pressed={bodyMap === option}
                  >
                    <span>{option === "male" ? "Male" : "Female"}</span>
                    {#if bodyMap === option}<Check
                        size={16}
                        strokeWidth={2.8}
                      />{/if}
                  </button>
                {/each}
              </div>
              <small>Used only for exercise muscle diagrams.</small>
            </fieldset>
          </section>

          <section
            class="settings-group image-settings"
            aria-labelledby="image-settings-heading"
          >
            <header>
              <span><ImageIcon size={20} /></span>
              <div>
                <h2 id="image-settings-heading">Exercise images</h2>
                <p>Control the only content Pulse downloads from the web.</p>
              </div>
            </header>

            <div class="image-access-option">
              <div>
                <strong>Online exercise images</strong>
                <small
                  >Download exercise images and keep them available offline.</small
                >
              </div>
              <button
                class="settings-switch"
                class:active={onlineExerciseImages}
                role="switch"
                aria-checked={onlineExerciseImages}
                aria-label="Online exercise images"
                disabled={imageSettingsBusy}
                onclick={() => setOnlineExerciseImages(!onlineExerciseImages)}
                ><span></span></button
              >
            </div>

            <div class="image-settings-detail">
              <p>
                {onlineExerciseImages
                  ? "Pulse contacts an image host only when an uncached exercise image is shown."
                  : "Pulse won’t contact image hosts. Image links remain saved for later."}
              </p>
              {#if onlineExerciseImages}<button
                  type="button"
                  disabled={imageSettingsBusy}
                  onclick={clearCachedExerciseImages}
                  >Clear cached images</button
                >{/if}
            </div>

            {#if imageSettingsMessage}<p
                class:error={imageSettingsError}
                class="image-settings-message"
                aria-live="polite"
              >
                {imageSettingsMessage}
              </p>{/if}
          </section>

          {#if nativePlatform}<section
              class="settings-group backup-settings"
              aria-labelledby="backup-heading"
            >
              <header>
                <span><FolderLock size={20} /></span>
                <div>
                  <h2 id="backup-heading">Automatic backup</h2>
                  <p>Keep one current ledger in a folder you control.</p>
                </div>
                <button
                  class="settings-switch"
                  class:active={autoBackup.enabled}
                  role="switch"
                  aria-checked={autoBackup.enabled}
                  aria-label="Automatic backup"
                  onclick={() => setAutomaticBackupEnabled(!autoBackup.enabled)}
                  ><span></span></button
                >
              </header>

              <div
                class:connected={backupFolderSelected}
                class="backup-location"
              >
                <span><FolderOpen size={19} /></span>
                <div>
                  <small>Backup location</small>
                  <strong
                    >{backupFolderSelected
                      ? autoBackup.folderName
                      : "No folder selected"}</strong
                  >
                  <code>{automaticBackupFilename}</code>
                </div>
                <button onclick={selectAutomaticBackupFolder}
                  >{backupFolderSelected ? "Change" : "Choose folder"}</button
                >
              </div>

              <div class="backup-status-grid" aria-live="polite">
                <div>
                  <span>Status</span>
                  <strong class:working={backupBusy}
                    >{backupBusy
                      ? "Saving…"
                      : autoBackup.enabled
                        ? "Active"
                        : "Paused"}</strong
                  >
                </div>
                <div>
                  <span>Last saved</span>
                  <strong
                    >{formatBackupTimestamp(autoBackup.lastSavedAt)}</strong
                  >
                </div>
                <div>
                  <span>Next save</span>
                  <strong
                    >{autoBackup.nextSaveAt
                      ? formatBackupTimestamp(autoBackup.nextSaveAt)
                      : autoBackup.enabled && autoBackup.timing === "immediate"
                        ? "After each change"
                        : "No changes waiting"}</strong
                  >
                </div>
              </div>

              <fieldset class="backup-timing">
                <legend>Save changes</legend>
                <div class="segmented-setting">
                  <button
                    class:active={autoBackup.timing === "immediate"}
                    aria-pressed={autoBackup.timing === "immediate"}
                    onclick={() => setBackupTiming("immediate")}
                    >Immediately</button
                  >
                  <button
                    class:active={autoBackup.timing === "delayed"}
                    aria-pressed={autoBackup.timing === "delayed"}
                    onclick={() => setBackupTiming("delayed")}
                    >After a delay</button
                  >
                </div>
                {#if autoBackup.timing === "delayed"}
                  <label class="backup-delay">
                    <span>Delay after the latest change</span>
                    <div>
                      <input
                        type="number"
                        inputmode="numeric"
                        min={minimumBackupDelayMinutes}
                        max={maximumBackupDelayMinutes}
                        step="1"
                        value={autoBackup.delayMinutes}
                        onchange={updateBackupDelay}
                      />
                      <span>minutes</span>
                    </div>
                    <small
                      >{formatBackupDelay(autoBackup.delayMinutes)} · minimum 1 minute,
                      maximum 24 hours</small
                    >
                    <small
                      >If Android closes Pulse, an overdue backup runs the next
                      time you open the app.</small
                    >
                  </label>
                {/if}
              </fieldset>

              <div class="backup-option">
                <div>
                  <strong>Preserve the previous file</strong>
                  <small
                    >Before overwriting, copy the old ledger to <code
                      >pulse-ledger.previous.json</code
                    > in the same folder.</small
                  >
                </div>
                <button
                  class="settings-switch"
                  class:active={autoBackup.preservePrevious}
                  role="switch"
                  aria-checked={autoBackup.preservePrevious}
                  aria-label="Preserve previous backup"
                  onclick={() =>
                    setPreservePrevious(!autoBackup.preservePrevious)}
                  ><span></span></button
                >
              </div>

              <div class="backup-actions">
                <button
                  class="primary-backup-action"
                  disabled={!backupFolderSelected || backupBusy}
                  onclick={saveAutomaticBackupNow}
                  ><Save size={17} /> Save now</button
                >
                {#if backupFolderSelected}<button
                    class="remove-folder-access"
                    onclick={removeAutomaticBackupAccess}
                    >Remove folder access</button
                  >{/if}
              </div>

              <p class="scoped-access-note">
                <ShieldCheck size={15} /> Pulse can access only this selected folder.
                No full-storage permission is requested.
              </p>
              {#if autoBackup.lastError}<p class="backup-error" role="alert">
                  {autoBackup.lastError}
                </p>{/if}
            </section>{/if}

          <section
            class="settings-group transfer-settings"
            aria-labelledby="data-heading"
          >
            <header>
              <span><FileJson size={20} /></span>
              <div>
                <h2 id="data-heading">Transfer and restore</h2>
                <p>
                  Create a one-off copy or restore an existing Pulse ledger.
                </p>
              </div>
            </header>
            <input
              class="hidden-file-input"
              bind:this={importInput}
              type="file"
              accept="application/json,.json"
              onchange={readImport}
            />
            <button class="settings-row" onclick={exportLedger}
              ><Download size={20} /><span
                ><strong>Export data</strong><small
                  >Save your programme and exercise library</small
                ></span
              ><ChevronDown size={18} /></button
            >
            <button class="settings-row" onclick={() => importInput.click()}
              ><Upload size={20} /><span
                ><strong>Import data</strong><small
                  >Restore from a Pulse JSON backup</small
                ></span
              ><ChevronDown size={18} /></button
            >

            {#if pendingImport}
              <div class="import-confirm">
                <p>Replace the data on this device with the selected backup?</p>
                <div>
                  <button onclick={() => (pendingImport = null)}>Cancel</button
                  ><button class="replace-data" onclick={applyImport}
                    >Replace</button
                  >
                </div>
              </div>
            {/if}
            {#if transferMessage}<p
                class:transfer-error={transferError}
                class="transfer-message"
              >
                {transferMessage}
              </p>{/if}
          </section>
        </div>
        <footer class="settings-footer">
          <a
            href="https://github.com/nyxar77/Pulse"
            target="_blank"
            rel="noreferrer"
          >
            <PulseMark size={23} />
            <span>Pulse on GitHub</span>
            <ExternalLink size={14} />
          </a>
        </footer>
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
      class:fab-visible={vaultAddVisible}
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
          <h2 id="vault-title">
            {libraryMode === "manage" ? "Exercise library" : "Add exercises"}
          </h2>
          <p aria-live="polite">
            {visibleExercises.length}
            {showArchived
              ? "archived"
              : libraryMode === "manage"
                ? "available · Tap one to preview"
                : "to choose from · Tap one to preview"}
          </p>
        </div>
        <div class="vault-heading-actions">
          {#if libraryMode === "manage"}<button
              class="create-exercise"
              onclick={openExerciseCreator}
              ><Plus size={15} /><span>New exercise</span></button
            >{/if}
          <button
            bind:this={vaultCloseButton}
            class="icon-button close-button"
            onclick={() => closeLibrary()}
            aria-label="Close exercise library"
            title="Close"><X size={18} strokeWidth={2.4} /></button
          >
        </div>
      </header>

      {#if previewExercise && !exerciseEditorOpen}
        <section
          class="exercise-preview-panel"
          id="exercise-preview-panel"
          aria-label="Exercise details"
        >
          <header>
            <button
              class="preview-back"
              type="button"
              onclick={() => (previewExerciseId = null)}
              ><ChevronLeft size={20} /><span>Exercises</span></button
            >
            <button
              type="button"
              class="icon-button close-button"
              onclick={() => closeLibrary()}
              aria-label="Close exercise library"
              title="Close"><X size={18} strokeWidth={2.4} /></button
            >
          </header>
          <div class="exercise-preview-content">
            <div class="exercise-preview-title">
              <span>{previewExercise.equipment}</span>
              <h3>{previewExercise.name}</h3>
              <p>{previewExercise.muscles.join(" · ")}</p>
            </div>
            <MuscleMap muscles={previewExercise.muscles} {bodyMap} />
            {#if previewExercise.description}<section
                class="exercise-preview-cue"
              >
                <small>Form cue</small>
                <p>{previewExercise.description}</p>
              </section>{/if}
            {#if previewExercise.tags?.length}<div
                class="exercise-preview-tags"
              >
                {#each previewExercise.tags as tag}<span>{tag}</span>{/each}
              </div>{/if}
            {#if previewExercise.guideUrl}<a
                class="exercise-preview-reference"
                href={previewExercise.guideUrl}
                target="_blank"
                rel="noreferrer"
                ><ExternalLink size={16} /> Open form reference</a
              >{/if}
          </div>
          <footer>
            {#if libraryMode === "manage"}<button
                type="button"
                class="preview-primary-action"
                onclick={() => openExerciseEditor(previewExercise)}
                ><Pencil size={17} /> Edit exercise</button
              >{:else}<button
                type="button"
                class="preview-primary-action"
                onclick={() => addExercise(previewExercise)}
                ><Plus size={17} /> Add to {activeDayName}</button
              >{/if}
          </footer>
        </section>
      {/if}

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
            <button
              type="button"
              class="icon-button close-button"
              onclick={() => (exerciseEditorOpen = false)}
              aria-label="Close exercise editor"
              title="Close"><X size={18} strokeWidth={2.4} /></button
            >
          </header>
          <div class="exercise-form-grid">
            <label class="wide"
              ><span>Name</span><input
                bind:value={exerciseDraft.name}
                placeholder="e.g. Half-kneeling press"
                maxlength="80"
              /></label
            >
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
            <section class="exercise-muscle-preview wide">
              <div>
                <span>Muscle map</span>
                <small>Highlights update from the structured muscle list.</small
                >
              </div>
              <MuscleMap muscles={exerciseDraft.muscles} {bodyMap} compact />
            </section>
            <label class="wide"
              ><span>Personal tags</span><input
                bind:value={exerciseDraft.tags}
                placeholder="Lengthened, elbow-friendly, skill…"
              /></label
            >
            <label class="wide"
              ><span>Instructions or cues</span><textarea
                bind:value={exerciseDraft.description}
                placeholder="Only shown when the exercise is expanded"
              ></textarea></label
            >
            <label class="wide"
              ><span>Reference link · optional</span><input
                type="url"
                bind:value={exerciseDraft.guideUrl}
                placeholder="https://…"
              /></label
            >
            <label class="wide"
              ><span
                >Image link · {onlineExerciseImages
                  ? "cached after first view"
                  : "online images off"}</span
              ><input
                type="url"
                bind:value={exerciseDraft.imageUrl}
                placeholder="https://…"
              />{#if !onlineExerciseImages}<small class="image-setting-hint"
                  >The link stays saved. Enable online exercise images in
                  Settings to load it.</small
                >{/if}</label
            >
          </div>
          {#if exerciseFormError}<p class="exercise-form-error">
              {exerciseFormError}
            </p>{/if}
          {#if editingExercise}
            <div
              class="exercise-editor-management"
              aria-label="Exercise management actions"
            >
              {#if deleteExerciseCandidateId === editingExercise.id}
                <div class="editor-delete-confirm">
                  <span
                    >Delete this exercise from the library? Existing workout
                    copies will stay.</span
                  >
                  <div>
                    <button
                      type="button"
                      onclick={() => (deleteExerciseCandidateId = null)}
                      >Keep</button
                    >
                    <button
                      type="button"
                      onclick={() =>
                        deleteExerciseDefinition(editingExercise.id)}
                      >Delete</button
                    >
                  </div>
                </div>
              {:else}
                <button
                  type="button"
                  onclick={() => duplicateExercise(editingExercise)}
                  ><Copy size={16} /><span>Duplicate</span></button
                >
                <button
                  type="button"
                  onclick={() => toggleExerciseArchive(editingExercise)}
                  >{#if editingExercise.archived}<ArchiveRestore
                      size={16}
                    /><span>Restore</span>{:else}<Archive size={16} /><span
                      >Archive</span
                    >{/if}</button
                >
                {#if editingExercise.custom}<button
                    class="editor-delete"
                    type="button"
                    onclick={() =>
                      (deleteExerciseCandidateId = editingExercise.id)}
                    ><Trash2 size={16} /><span>Delete</span></button
                  >{/if}
              {/if}
            </div>
          {/if}
          <footer>
            <button type="button" onclick={() => (exerciseEditorOpen = false)}
              >Cancel</button
            ><button class="save-exercise" type="submit"
              ><Save size={14} /> Save exercise</button
            >
          </footer>
        </form>
      {/if}

      <div class="vault-tools">
        <div class="vault-search" role="search">
          <Search size={17} aria-hidden="true" />
          <input
            aria-label="Search exercises"
            placeholder="Search names, tags, equipment"
            bind:value={search}
          />
          {#if search}<button
              type="button"
              onclick={() => (search = "")}
              aria-label="Clear exercise search"><X size={16} /></button
            >{/if}
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
        <section
          class="vault-filter-panel"
          id="vault-filters"
          aria-label="Exercise filters"
        >
          <header>
            <div>
              <h3>Filters</h3>
              <p>
                {libraryMode === "manage"
                  ? "Muscle, tag, or archive status."
                  : "Narrow the workout picker."}
              </p>
            </div>
            {#if selectedMuscle !== "All" || showArchived}<button
                type="button"
                onclick={clearVaultFilters}>Reset</button
              >{/if}
          </header>
          {#if libraryMode === "manage"}
            <fieldset>
              <legend>Library</legend>
              <div class="vault-filter-mode">
                <button
                  class:active={!showArchived}
                  type="button"
                  aria-pressed={!showArchived}
                  onclick={() => (showArchived = false)}>Active</button
                >
                <button
                  class:active={showArchived}
                  type="button"
                  aria-pressed={showArchived}
                  onclick={() => (showArchived = true)}
                  disabled={!archivedCount}>Archived · {archivedCount}</button
                >
              </div>
            </fieldset>
          {/if}
          <fieldset>
            <legend>Muscle or tag</legend>
            <div class="vault-filter-options">
              {#each availableGroups as muscle}
                <button
                  class:active={selectedMuscle === muscle}
                  type="button"
                  aria-pressed={selectedMuscle === muscle}
                  onclick={() => (selectedMuscle = muscle)}>{muscle}</button
                >
              {/each}
            </div>
          </fieldset>
          <footer>
            <span
              >{visibleExercises.length}
              {visibleExercises.length === 1 ? "result" : "results"}</span
            >
            <button type="button" onclick={() => (vaultFiltersOpen = false)}
              >Done</button
            >
          </footer>
        </section>
      {/if}

      <div class="vault-list">
        {#each visibleExercises as exercise (exercise.id)}
          <article class="vault-item">
            <div class="vault-item-main">
              <button
                class="vault-item-copy"
                type="button"
                aria-expanded={previewExerciseId === exercise.id}
                aria-controls="exercise-preview-panel"
                onclick={() => toggleExercisePreview(exercise.id)}
              >
                <span>
                  <strong>{exercise.name}</strong>
                  <p>
                    {exercise.muscles.join(" / ") || "Personal"} · {exercise.equipment}
                  </p>
                  {#if exercise.tags?.length}<span class="exercise-tags">
                      {#each exercise.tags as tag}<span>{tag}</span>{/each}
                    </span>{/if}
                </span>
                <ChevronRight size={18} />
              </button>
              {#if libraryMode === "manage" || (!exercise.archived && !dayExercises.some((item) => item.id === exercise.id))}<div
                  class="vault-item-actions"
                >
                  {#if libraryMode === "manage"}
                    <button
                      class="edit-from-vault"
                      type="button"
                      onclick={() => openExerciseEditor(exercise)}
                      ><Pencil size={16} /><span>Edit</span></button
                    >
                  {:else}<button
                      class="add-from-vault"
                      type="button"
                      aria-label={`Add ${exercise.name} to ${activeDayName}`}
                      onclick={() => addExercise(exercise)}
                      ><Plus size={15} /> Add
                    </button>{/if}
                </div>{/if}
            </div>
          </article>
        {:else}
          <p class="vault-empty">
            {libraryMode === "manage"
              ? "Nothing matches that search."
              : "No exercises match this picker."}
          </p>
        {/each}
      </div>

      {#if vaultAddVisible}<button
          class="visible vault-add-fab"
          type="button"
          onclick={openExerciseCreator}
        >
          <Plus size={20} strokeWidth={2.3} />
          <span>Add exercise</span>
        </button>{/if}
    </div>
  {/if}
</div>
