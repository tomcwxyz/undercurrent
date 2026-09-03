export type NativeRecordingResult = {
  ok?: boolean;
  mimeType?: string;
  base64?: string;
  error?: string;
};

export type NativeSwellsDevice = {
  speak?: (text: string) => void;
  stopSpeaking?: () => void;
  haptic?: (milliseconds: number) => void;
  startVoiceRecording?: () => string;
  stopVoiceRecording?: () => string;
  cancelVoiceRecording?: () => string;
  microphoneState?: () => string;
  version?: () => string;
};

export function nativeSwellsDevice(): NativeSwellsDevice | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as Window & { SwellsDevice?: NativeSwellsDevice }).SwellsDevice;
}

export function hasNativeSwellsRecorder() {
  const device = nativeSwellsDevice();
  return (
    typeof device?.startVoiceRecording === "function" &&
    typeof device?.stopVoiceRecording === "function"
  );
}

export function parseNativeRecordingResult(
  raw: string,
): NativeRecordingResult {
  try {
    return JSON.parse(raw) as NativeRecordingResult;
  } catch {
    return { ok: false, error: raw || "Invalid native recording response" };
  }
}

export function blobFromBase64(base64: string, mimeType: string) {
  const raw = window.atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) {
    bytes[index] = raw.charCodeAt(index);
  }
  return new Blob([bytes], { type: mimeType });
}

export function extensionForMime(mimeType: string) {
  if (mimeType.includes("mp4")) return "m4a";
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("wav")) return "wav";
  return "webm";
}

export function stopR1Speech() {
  nativeSwellsDevice()?.stopSpeaking?.();
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}

export function speakR1Text(text: string) {
  const clean = text.trim();
  if (!clean || typeof window === "undefined") return false;

  const device = nativeSwellsDevice();
  if (device?.speak) {
    device.speak(clean);
    return true;
  }

  if (!("speechSynthesis" in window)) return false;
  const utterance = new SpeechSynthesisUtterance(clean);
  utterance.rate = 1.02;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
  return true;
}
