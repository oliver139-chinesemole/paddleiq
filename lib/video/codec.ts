export function getSupportedMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = [
    "video/mp4;codecs=h264,aac",
    "video/mp4",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  for (const t of candidates) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return "";
}

export function extForMime(mime: string): string {
  return mime.startsWith("video/mp4") ? "mp4" : "webm";
}

export function shouldUseIOSFallback(): boolean {
  if (typeof window === "undefined") return false;
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !("MSStream" in window);
  if (!isIOS) return false;
  const isPWA = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  const noRecorder = typeof MediaRecorder === "undefined";
  return isPWA || noRecorder;
}
