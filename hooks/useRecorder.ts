"use client";
import { useState, useRef, useCallback } from "react";
import { getSupportedMimeType } from "@/lib/video/codec";

export interface RecordingResult {
  blob: Blob;
  mimeType: string;
  durationSec: number;
}

export function useRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  const startRecording = useCallback((stream: MediaStream): Promise<RecordingResult> => {
    return new Promise((resolve, reject) => {
      chunksRef.current = [];
      const mimeType = getSupportedMimeType();
      let recorder: MediaRecorder;
      try {
        recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      } catch {
        reject(new Error("MediaRecorder init failed"));
        return;
      }
      recorderRef.current = recorder;
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const finalMime = mimeType || recorder.mimeType || "video/webm";
        resolve({
          blob: new Blob(chunksRef.current, { type: finalMime }),
          mimeType: finalMime,
          durationSec: (Date.now() - startTimeRef.current) / 1000,
        });
      };
      recorder.onerror = (e) => reject(e);
      recorder.start(250);
      startTimeRef.current = Date.now();
      setIsRecording(true);
      setElapsedSec(0);
      timerRef.current = setInterval(() => {
        setElapsedSec(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 500);
    });
  }, []);

  const stopRecording = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    recorderRef.current?.stop();
    setIsRecording(false);
    setElapsedSec(0);
  }, []);

  return { isRecording, elapsedSec, startRecording, stopRecording };
}
