// Stages the MediaPipe pose assets into public/mediapipe/ so form check runs
// fully on-device and keeps working offline in the PWA.
//
// These are ~48MB of binaries, so they are gitignored and staged at build time
// instead of being committed. The wasm is copied out of node_modules (already a
// dependency); only the model weights are fetched from Google's CDN.
//
// Runs automatically via `postinstall` and `prebuild`.

import { createWriteStream } from "node:fs";
import { mkdir, cp, stat, access } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, "public", "mediapipe");
const WASM_SRC = path.join(ROOT, "node_modules", "@mediapipe", "tasks-vision", "wasm");

const MODELS = [
  {
    file: "pose_landmarker_lite.task",
    url: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
  },
  {
    file: "pose_landmarker_full.task",
    url: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task",
  },
];

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function copyWasm() {
  if (!(await exists(WASM_SRC))) {
    throw new Error(`MediaPipe wasm not found at ${WASM_SRC} — is @mediapipe/tasks-vision installed?`);
  }
  await cp(WASM_SRC, path.join(OUT, "wasm"), { recursive: true });
  console.log("  wasm/ copied from node_modules");
}

async function fetchModel({ file, url }) {
  const dest = path.join(OUT, file);
  if (await exists(dest)) {
    const { size } = await stat(dest);
    if (size > 1_000_000) {
      console.log(`  ${file} already present (${(size / 1e6).toFixed(1)}MB), skipping`);
      return;
    }
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${file}: ${res.status} ${res.statusText}`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(dest));
  const { size } = await stat(dest);
  console.log(`  ${file} downloaded (${(size / 1e6).toFixed(1)}MB)`);
}

console.log("Staging MediaPipe pose assets into public/mediapipe/");
await mkdir(OUT, { recursive: true });
await copyWasm();
for (const m of MODELS) await fetchModel(m);
console.log("Pose assets ready.");
