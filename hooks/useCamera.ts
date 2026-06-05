"use client";
import { useState, useRef, useCallback } from "react";

export type CameraFacing = "user" | "environment";
export type CameraStatus = "idle" | "requesting" | "active" | "denied" | "no-camera" | "unsupported";

export function useCamera() {
  const [status, setStatus] = useState<CameraStatus>("idle");
  const [facing, setFacing] = useState<CameraFacing>("environment");
  const streamRef = useRef<MediaStream | null>(null);

  const startCamera = useCallback(async (requestedFacing: CameraFacing = "environment") => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setStatus("unsupported");
      return null;
    }
    setStatus("requesting");
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: requestedFacing, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });
      streamRef.current = stream;
      setFacing(requestedFacing);
      setStatus("active");
      return stream;
    } catch (err: unknown) {
      const name = (err as Error)?.name ?? "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") setStatus("denied");
      else if (name === "NotFoundError" || name === "DevicesNotFoundError") setStatus("no-camera");
      else setStatus("unsupported");
      return null;
    }
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const flipCamera = useCallback(async () => {
    const next: CameraFacing = facing === "environment" ? "user" : "environment";
    return startCamera(next);
  }, [facing, startCamera]);

  return { status, facing, streamRef, startCamera, stopCamera, flipCamera };
}
