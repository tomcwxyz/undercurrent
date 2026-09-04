# Swells tablet shell

A small Android WebView shell for the Swells tablet surface.

## Purpose

The tablet is a richer sensemaking surface, not a stretched Rabbit UI. It opens `https://swells.app/tablet`, keeps web authentication/cookies in the app, supports portrait and landscape rotation, grants microphone access to the web surface for Notice capture, and runs full-screen while active.

The shell is intentionally resolution-agnostic. The first physical test target is Android 10 at 1200×1920, but the web surface is responsive and the Android minimum is SDK 26.

## Package

- release: `uk.co.goodship.swells.tablet`
- debug/alpha: `uk.co.goodship.swells.tablet.debug`
- version: `0.1.0` (`versionCode 1`)

The alpha build uses the same stable Good Ship debug key as the R1 alpha so repeated tablet builds remain upgrade-compatible.

## Build locally

From the repository root on Windows PowerShell:

```powershell
[IO.File]::WriteAllBytes(
  "apps/r1-shell/debug-signing/swells-r1-debug.keystore",
  [Convert]::FromBase64String((Get-Content "apps/r1-shell/debug-signing/swells-r1-debug.keystore.b64" -Raw).Trim())
)

gradle -p apps/tablet-shell :app:assembleDebug
```

APK output:

`apps/tablet-shell/app/build/outputs/apk/debug/app-debug.apk`

## Alpha release

`.github/workflows/tablet-shell.yml` builds the APK when native tablet-shell files change. A push to `master` publishes the current signed APK to the `swells-tablet-alpha` GitHub prerelease.

Web-only tablet surface changes do not rebuild the APK; the installed shell loads the live surface from `swells.app`.
