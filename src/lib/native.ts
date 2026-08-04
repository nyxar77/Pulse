import { Capacitor } from '@capacitor/core';

const themeColours: Record<string, string> = {
	latte: '#eff1f5',
	frappe: '#303446',
	macchiato: '#181926',
	mocha: '#11111b'
};

let appliedTheme = '';

export function isNativeApp(): boolean {
	return Capacitor.isNativePlatform();
}

export async function applyNativeTheme(theme: string): Promise<void> {
	if (!isNativeApp() || appliedTheme === theme) return;
	appliedTheme = theme;

	const { StatusBar, Style } = await import('@capacitor/status-bar');
	await Promise.all([
		StatusBar.setBackgroundColor({ color: themeColours[theme] ?? themeColours.mocha }),
		StatusBar.setStyle({ style: theme === 'latte' ? Style.Dark : Style.Light })
	]);
}

export async function shareLedgerFile(filename: string, contents: string): Promise<boolean> {
	if (isNativeApp()) {
		const [{ Directory, Encoding, Filesystem }, { Share }] = await Promise.all([import('@capacitor/filesystem'), import('@capacitor/share')]);
		const saved = await Filesystem.writeFile({
			path: `exports/${filename}`,
			data: contents,
			directory: Directory.Cache,
			encoding: Encoding.UTF8,
			recursive: true
		});
		await Share.share({
			title: 'Pulse ledger backup',
			text: 'A complete Pulse training ledger backup.',
			url: saved.uri,
			dialogTitle: 'Save or share your ledger'
		});
		return true;
	}

	const file = new File([contents], filename, { type: 'application/json' });
	if (navigator.share && navigator.canShare?.({ files: [file] })) {
		await navigator.share({ title: 'Pulse ledger backup', files: [file] });
		return true;
	}

	return false;
}
