# Swells R1 shell

A deliberately thin Android shell for the flashed Rabbit R1.

The shell does **not** contain Swells' signal model, AI logic, product credentials or durable sensing state. It hosts the authenticated `https://swells.app/r1` surface and adds the device behaviour that Android WebView handles more reliably natively:

- true immersive full-screen mode;
- screen-on behaviour while Swells is active;
- stable WebView cookies for the normal Swells sign-in flow;
- return to `/r1` after sign-in redirects through the standard dashboard;
- native microphone recording exposed through `window.SwellsDevice`;
- Android TTS exposed through the same bridge;
- wheel / DPAD navigation mapped to `ArrowUp` / `ArrowDown`;
- native haptic feedback.

The reusable mechanics live in `uk.co.goodship.device.r1`. Swells-specific configuration is isolated in `uk.co.goodship.swells.r1.MainActivity` so this can become a shared Good Ship device-shell foundation later.

## Build

Materialise the checked-in **debug-only** signing key:

```powershell
[IO.File]::WriteAllBytes(
  "apps/r1-shell/debug-signing/swells-r1-debug.keystore",
  [Convert]::FromBase64String((Get-Content "apps/r1-shell/debug-signing/swells-r1-debug.keystore.b64" -Raw).Trim())
)
gradle -p apps/r1-shell :app:assembleDebug
```

The debug APK is written to:

```text
apps/r1-shell/app/build/outputs/apk/debug/app-debug.apk
```

GitHub Actions also publishes `swells-r1-shell-debug.apk` as a workflow artifact.

The checked-in key is only for alpha/debug builds. Keeping it stable means later test APKs can replace earlier ones with `adb install -r` instead of Android treating every build as a different signing identity.

## Install

First install:

```powershell
.\adb.exe -s "<rabbit-adb-device>" install "swells-r1-shell-debug.apk"
```

Later alpha builds:

```powershell
.\adb.exe -s "<rabbit-adb-device>" install -r "swells-r1-shell-debug.apk"
```

Launch **Swells** from the launcher. The first run asks for microphone permission and opens the production R1 surface.

## Product/device boundary

The Android core knows only about browser hosting and physical-device capabilities. Swells remains responsible for:

- authentication and membership;
- observations and media storage;
- transcription/enrichment;
- signals and evidence;
- temperature semantics;
- surface projection.

Voice notes recorded by the Rabbit should therefore be uploaded as ordinary Swells observation media rather than transcribed into a second device-owned data path.

## Next native slice

- wire the R1 Notice screen to the native recorder and normal Swells media upload pipeline;
- add a signed self-update channel after the first shell/voice build is proven on-device;
- extract the generic Android core once both Attention and Swells are using the same contract.
