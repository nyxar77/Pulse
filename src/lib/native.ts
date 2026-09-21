import { Capacitor, registerPlugin } from "@capacitor/core";

type LauncherIconPlugin = {
  setIcon(options: { theme: string; accent: string }): Promise<void>;
};

export type ScopedBackupStatus = {
  selected: boolean;
  folderName?: string;
  filename?: string;
};

type ScopedBackupResult = ScopedBackupStatus & {
  savedAt: number;
  previousCreated: boolean;
};

type ScopedBackupPlugin = {
  chooseFolder(): Promise<ScopedBackupStatus>;
  getStatus(): Promise<ScopedBackupStatus>;
  clearFolder(): Promise<void>;
  writeBackup(options: {
    contents: string;
    preservePrevious: boolean;
  }): Promise<ScopedBackupResult>;
};

const LauncherIcon = registerPlugin<LauncherIconPlugin>("LauncherIcon");
const ScopedBackup = registerPlugin<ScopedBackupPlugin>("ScopedBackup");

const themeColours: Record<string, string> = {
  latte: "#eff1f5",
  frappe: "#303446",
  macchiato: "#181926",
  mocha: "#11111b",
};

let appliedAppearance = "";
let applyingAppearance = "";
let appearanceRequest = 0;

export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

export async function applyNativeAppearance(
  theme: string,
  accent: string,
): Promise<void> {
  const appearance = `${theme}:${accent}`;
  if (
    !isNativeApp() ||
    appliedAppearance === appearance ||
    applyingAppearance === appearance
  )
    return;
  applyingAppearance = appearance;
  const request = ++appearanceRequest;

  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    await Promise.all([
      StatusBar.setBackgroundColor({
        color: themeColours[theme] ?? themeColours.mocha,
      }),
      StatusBar.setStyle({
        style: theme === "latte" ? Style.Light : Style.Dark,
      }),
      LauncherIcon.setIcon({ theme, accent }),
    ]);
    if (request === appearanceRequest) appliedAppearance = appearance;
  } catch (error) {
    // Appearance is non-critical. Leave it uncached so the next render can retry.
    console.warn("Could not apply the native Pulse appearance.", error);
  } finally {
    if (applyingAppearance === appearance) applyingAppearance = "";
  }
}

export async function shareLedgerFile(
  filename: string,
  contents: string,
): Promise<boolean> {
  if (isNativeApp()) {
    const [{ Directory, Encoding, Filesystem }, { Share }] = await Promise.all([
      import("@capacitor/filesystem"),
      import("@capacitor/share"),
    ]);
    const saved = await Filesystem.writeFile({
      path: `exports/${filename}`,
      data: contents,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
      recursive: true,
    });
    await Share.share({
      title: "Pulse ledger backup",
      text: "A complete Pulse training ledger backup.",
      url: saved.uri,
      dialogTitle: "Save or share your ledger",
    });
    return true;
  }

  const file = new File([contents], filename, { type: "application/json" });
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    await navigator.share({ title: "Pulse ledger backup", files: [file] });
    return true;
  }

  return false;
}

export async function chooseScopedBackupFolder(): Promise<ScopedBackupStatus> {
  if (!isNativeApp()) return { selected: false };
  return ScopedBackup.chooseFolder();
}

export async function getScopedBackupStatus(): Promise<ScopedBackupStatus> {
  if (!isNativeApp()) return { selected: false };
  return ScopedBackup.getStatus();
}

export async function clearScopedBackupFolder(): Promise<void> {
  if (!isNativeApp()) return;
  await ScopedBackup.clearFolder();
}

export async function writeScopedBackup(
  contents: string,
  preservePrevious: boolean,
): Promise<ScopedBackupResult> {
  if (!isNativeApp())
    throw new Error(
      "Automatic folder backups are available in the Android app.",
    );
  return ScopedBackup.writeBackup({ contents, preservePrevious });
}
