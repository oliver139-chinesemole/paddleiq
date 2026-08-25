// GPS track maths for water sessions.
//
// The landing page has advertised "GPS-based time trials… pace, speed,
// conditions, route" since launch, while the water form was manual entry of
// distance and duration. This is the missing half.
//
// The hard part isn't distance, it's that consumer GPS lies. A fix can land
// tens of metres off, and a bad one between two good ones adds phantom distance
// in both directions. Filtering has to happen before any summing, or a paddler
// sitting still accumulates kilometres.
//
// Pure — no browser APIs, no React.

/** One position fix, as the Geolocation API reports it. */
export interface Fix {
  lat: number;
  lon: number;
  /** Reported horizontal accuracy in metres. Larger is worse. */
  accuracy: number;
  /** Epoch milliseconds. */
  t: number;
}

export interface TrackStats {
  /** Metres travelled, after filtering. */
  distanceM: number;
  /** Wall-clock seconds from first to last accepted fix. */
  durationSec: number;
  /** Seconds spent actually moving, ignoring pauses. */
  movingSec: number;
  /** Seconds per 500m over the whole session, the unit paddlers use. */
  pacePer500Sec: number;
  avgSpeedKmh: number;
  maxSpeedKmh: number;
  /** Fixes kept after filtering. */
  usedFixes: number;
  /** Fixes thrown away as unusable. */
  rejectedFixes: number;
}

// ─── tunables ────────────────────────────────────────────────────────────────

/**
 * Worst accuracy worth keeping. Anything vaguer than this on open water is a
 * lost signal rather than a position, and including it invents distance.
 */
export const MAX_ACCURACY_M = 30;

/**
 * Fastest plausible speed. A racing dragon boat peaks around 20 km/h and a solo
 * craft well below that, so anything above this is a GPS jump, not paddling.
 */
export const MAX_SPEED_KMH = 35;

/** Below this the paddler is drifting, not moving — excluded from moving time. */
export const MOVING_THRESHOLD_KMH = 1.5;

/**
 * Movement smaller than this between fixes is noise. A stationary receiver
 * wanders by a few metres, which would otherwise accumulate all session.
 */
export const MIN_STEP_M = 2;

const EARTH_RADIUS_M = 6_371_000;

// ─── geometry ────────────────────────────────────────────────────────────────

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Great-circle distance in metres.
 *
 * Haversine rather than a flat approximation: the error of treating lat/lon as
 * a plane is small over a 500m piece but grows with latitude, and getting it
 * right costs nothing.
 */
export function haversineM(a: Fix, b: Fix): number {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Speed between two fixes in km/h, or 0 if they share a timestamp. */
export function speedKmhBetween(a: Fix, b: Fix): number {
  const seconds = (b.t - a.t) / 1000;
  if (seconds <= 0) return 0;
  return (haversineM(a, b) / seconds) * 3.6;
}

// ─── filtering ───────────────────────────────────────────────────────────────

/**
 * Drops fixes that would add distance the paddler didn't travel.
 *
 * Three rules, in order: an imprecise fix is discarded outright; a fix implying
 * an impossible speed is a jump and is discarded; and movement under a couple
 * of metres is treated as the receiver wandering rather than the boat moving.
 */
export function filterFixes(fixes: Fix[]): { kept: Fix[]; rejected: number } {
  const usable = fixes.filter(
    (f) =>
      Number.isFinite(f.lat) &&
      Number.isFinite(f.lon) &&
      Number.isFinite(f.t) &&
      Math.abs(f.lat) <= 90 &&
      Math.abs(f.lon) <= 180 &&
      (!Number.isFinite(f.accuracy) || f.accuracy <= MAX_ACCURACY_M)
  );

  const kept: Fix[] = [];
  for (const f of usable) {
    const last = kept[kept.length - 1];
    if (!last) {
      kept.push(f);
      continue;
    }
    if (f.t <= last.t) continue; // out of order or duplicate
    if (speedKmhBetween(last, f) > MAX_SPEED_KMH) continue; // GPS jump
    if (haversineM(last, f) < MIN_STEP_M) continue; // receiver noise
    kept.push(f);
  }

  return { kept, rejected: fixes.length - kept.length };
}

// ─── summary ─────────────────────────────────────────────────────────────────

const EMPTY_STATS: TrackStats = {
  distanceM: 0, durationSec: 0, movingSec: 0, pacePer500Sec: 0,
  avgSpeedKmh: 0, maxSpeedKmh: 0, usedFixes: 0, rejectedFixes: 0,
};

/** Summarises a raw track. Filtering happens here, so callers pass raw fixes. */
export function summarise(fixes: Fix[]): TrackStats {
  const { kept, rejected } = filterFixes(fixes);
  if (kept.length < 2) {
    return { ...EMPTY_STATS, usedFixes: kept.length, rejectedFixes: rejected };
  }

  let distanceM = 0;
  let movingSec = 0;
  let maxSpeedKmh = 0;

  for (let i = 1; i < kept.length; i++) {
    const step = haversineM(kept[i - 1], kept[i]);
    const seconds = (kept[i].t - kept[i - 1].t) / 1000;
    const speed = seconds > 0 ? (step / seconds) * 3.6 : 0;

    distanceM += step;
    if (speed >= MOVING_THRESHOLD_KMH) movingSec += seconds;
    if (speed > maxSpeedKmh) maxSpeedKmh = speed;
  }

  const durationSec = (kept[kept.length - 1].t - kept[0].t) / 1000;
  const avgSpeedKmh = durationSec > 0 ? (distanceM / durationSec) * 3.6 : 0;
  // Paddlers read pace per 500m, not per km.
  const pacePer500Sec = distanceM > 0 ? (durationSec / distanceM) * 500 : 0;

  return {
    distanceM,
    durationSec,
    movingSec,
    pacePer500Sec,
    avgSpeedKmh,
    maxSpeedKmh,
    usedFixes: kept.length,
    rejectedFixes: rejected,
  };
}

// ─── drawing ─────────────────────────────────────────────────────────────────

export interface Point2D {
  x: number;
  y: number;
}

/**
 * Projects a track into a unit square for drawing.
 *
 * Deliberately no basemap: map tiles mean a third-party request, which breaks
 * both the offline story and the CSP. The shape of the line is what tells a
 * paddler whether they held a straight course anyway.
 *
 * Longitude is scaled by cos(latitude) so the route isn't stretched sideways,
 * and the aspect ratio is preserved so a straight-line piece doesn't render as
 * a square blob.
 */
export function toPolyline(fixes: Fix[]): Point2D[] {
  const { kept } = filterFixes(fixes);
  if (kept.length < 2) return [];

  const midLat = toRad(kept.reduce((s, f) => s + f.lat, 0) / kept.length);
  const xs = kept.map((f) => f.lon * Math.cos(midLat));
  const ys = kept.map((f) => f.lat);

  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const spanX = maxX - minX;
  const spanY = maxY - minY;
  const span = Math.max(spanX, spanY);

  // A track that never moved has no shape to draw.
  if (span === 0) return [];

  // Centre the smaller axis so the route keeps its true proportions.
  const padX = (span - spanX) / 2;
  const padY = (span - spanY) / 2;

  return kept.map((_, i) => ({
    x: (xs[i] - minX + padX) / span,
    // Canvas y grows downward; latitude grows north, so flip it.
    y: 1 - (ys[i] - minY + padY) / span,
  }));
}
