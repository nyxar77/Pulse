# Pulse

Pulse is a local-first weekly workout planner for Android and the web. It is built for people who want to define their own training split instead of fitting a preset routine.

## What it does

- Maps custom workouts onto the seven days of the week
- Shows the workout that matches the device's current local date
- Saves a reusable exercise library with muscles, equipment, notes, images, and guide links
- Stores sets, reps, weight, and rest targets with drag-to-reorder priority
- Tracks completed exercises by date
- Imports and exports the complete programme as JSON
- Works offline and keeps programme data on the device
- Supports all Catppuccin flavours and accents

## Development

The Nix flake provides Bun, Java 21, and the Android SDK.

```sh
nix develop
bun install --frozen-lockfile
bun run verify
```

Build the Android project with:

```sh
bun run mobile:sync
cd android
./gradlew assembleDebug
```

## Releases and F-Droid

Release versions have three matching sources: `package.json`, `android/app/build.gradle`, and `.fdroid.yml`. Android `versionCode` must increase for every release, and its Fastlane changelog must be named `<versionCode>.txt`.

Before tagging a release:

```sh
bun run release:check
bun run verify
```

Tag the release with its exact version name, such as `0.1.2`. Publishing that tag as a GitHub release builds the signed upstream APK. The root `.fdroid.yml` is the F-Droid build recipe; copy it to `metadata/io.github.nyxar77.pulse.yml` in an `fdroiddata` fork when submitting the app.

## Privacy and license

Pulse has no accounts, ads, analytics, or trackers. See [PRIVACY.md](PRIVACY.md) for details.

Licensed under GPL-3.0-only. See [LICENSE](LICENSE).
