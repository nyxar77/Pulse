export const minimumBackupDelayMinutes = 1;
export const maximumBackupDelayMinutes = 24 * 60;
export const defaultBackupDelayMinutes = 15;

export type BackupTiming = "immediate" | "delayed";

export type AutoBackupPreferences = {
  enabled: boolean;
  timing: BackupTiming;
  delayMinutes: number;
  preservePrevious: boolean;
  folderName: string;
  lastSavedAt: string;
  lastError: string;
  nextSaveAt: string;
};

export type PendingBackup = {
  contents: string;
  fingerprint: string;
  dueAt: string;
  revision: number;
};

export const defaultAutoBackupPreferences: AutoBackupPreferences = {
  enabled: false,
  timing: "immediate",
  delayMinutes: defaultBackupDelayMinutes,
  preservePrevious: false,
  folderName: "",
  lastSavedAt: "",
  lastError: "",
  nextSaveAt: "",
};

export function normaliseBackupDelay(value: unknown): number {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return defaultBackupDelayMinutes;
  return Math.min(
    maximumBackupDelayMinutes,
    Math.max(minimumBackupDelayMinutes, Math.round(numeric)),
  );
}

export function normaliseAutoBackupPreferences(
  value: unknown,
): AutoBackupPreferences {
  if (!value || typeof value !== "object")
    return { ...defaultAutoBackupPreferences };
  const candidate = value as Partial<AutoBackupPreferences>;
  return {
    enabled: candidate.enabled === true,
    timing: candidate.timing === "delayed" ? "delayed" : "immediate",
    delayMinutes: normaliseBackupDelay(candidate.delayMinutes),
    preservePrevious: candidate.preservePrevious === true,
    folderName:
      typeof candidate.folderName === "string" ? candidate.folderName : "",
    lastSavedAt: validDate(candidate.lastSavedAt) ? candidate.lastSavedAt! : "",
    lastError:
      typeof candidate.lastError === "string" ? candidate.lastError : "",
    nextSaveAt: validDate(candidate.nextSaveAt) ? candidate.nextSaveAt! : "",
  };
}

export function isPendingBackup(value: unknown): value is PendingBackup {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<PendingBackup>;
  return (
    typeof candidate.contents === "string" &&
    typeof candidate.fingerprint === "string" &&
    validDate(candidate.dueAt) &&
    Number.isSafeInteger(candidate.revision) &&
    candidate.revision! >= 0
  );
}

export function normalisePendingBackup(value: unknown): PendingBackup | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<PendingBackup>;
  if (
    typeof candidate.contents !== "string" ||
    typeof candidate.fingerprint !== "string" ||
    !validDate(candidate.dueAt)
  )
    return null;
  return {
    contents: candidate.contents,
    fingerprint: candidate.fingerprint,
    dueAt: candidate.dueAt,
    revision:
      Number.isSafeInteger(candidate.revision) && candidate.revision! >= 0
        ? candidate.revision!
        : 0,
  };
}

export function shouldRetryBackup(
  failedRevision: number,
  latestRevision: number,
  enabled: boolean,
  generationMatches: boolean,
): boolean {
  return enabled && generationMatches && failedRevision === latestRevision;
}

export function formatBackupDelay(minutes: number): string {
  const safeMinutes = normaliseBackupDelay(minutes);
  if (safeMinutes === 60) return "1 hour";
  if (safeMinutes % 60 === 0) return `${safeMinutes / 60} hours`;
  return `${safeMinutes} ${safeMinutes === 1 ? "minute" : "minutes"}`;
}

function validDate(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    Number.isFinite(Date.parse(value))
  );
}
