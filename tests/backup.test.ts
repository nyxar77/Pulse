import { describe, expect, test } from "bun:test";
import {
  formatBackupDelay,
  isPendingBackup,
  maximumBackupDelayMinutes,
  normaliseAutoBackupPreferences,
  normaliseBackupDelay,
  normalisePendingBackup,
  shouldRetryBackup,
} from "../src/lib/backup";

describe("automatic backup settings", () => {
  test("accepts whole-minute delays from one minute through 24 hours", () => {
    expect(normaliseBackupDelay(0)).toBe(1);
    expect(normaliseBackupDelay(12.7)).toBe(13);
    expect(normaliseBackupDelay(2000)).toBe(maximumBackupDelayMinutes);
    expect(formatBackupDelay(60)).toBe("1 hour");
    expect(formatBackupDelay(1440)).toBe("24 hours");
  });

  test("repairs malformed preferences without enabling access", () => {
    expect(
      normaliseAutoBackupPreferences({
        enabled: "yes",
        timing: "seconds",
        delayMinutes: -4,
      }),
    ).toMatchObject({
      enabled: false,
      timing: "immediate",
      delayMinutes: 1,
    });
  });

  test("only restores complete pending writes", () => {
    expect(
      isPendingBackup({
        contents: "{}",
        fingerprint: "abc",
        dueAt: "2026-09-22T10:00:00.000Z",
        revision: 3,
      }),
    ).toBeTrue();
    expect(isPendingBackup({ contents: "{}", dueAt: "soon" })).toBeFalse();
  });

  test("migrates pending backups created before revisions were added", () => {
    expect(
      normalisePendingBackup({
        contents: "{}",
        fingerprint: "abc",
        dueAt: "2026-09-22T10:00:00.000Z",
      }),
    ).toEqual({
      contents: "{}",
      fingerprint: "abc",
      dueAt: "2026-09-22T10:00:00.000Z",
      revision: 0,
    });
  });

  test("retries only the latest enabled backup from the active generation", () => {
    expect(shouldRetryBackup(4, 4, true, true)).toBeTrue();
    expect(shouldRetryBackup(3, 4, true, true)).toBeFalse();
    expect(shouldRetryBackup(4, 4, false, true)).toBeFalse();
    expect(shouldRetryBackup(4, 4, true, false)).toBeFalse();
  });
});
