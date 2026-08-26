/**
 * CSV export.
 *
 * Athletes should be able to take their training history somewhere else — a
 * spreadsheet, a coach's own tracker, another app. A log you can't get out of
 * isn't really yours, and this app stores most of its data in IndexedDB, where
 * "just read the database" isn't an option for a normal person.
 *
 * The escaping here is the whole substance of the module. Two things have to
 * be right: RFC 4180 quoting, so a note containing a comma doesn't shift every
 * later column; and formula neutralisation, so a note starting with "=" can't
 * execute when the file is opened in Excel or Sheets.
 */

export interface Column<Row> {
  key: string;
  header: string;
  /** Pulls the value out of a row. Defaults to `row[key]`. */
  get?: (row: Row) => unknown;
}

/**
 * Characters that make a spreadsheet treat a cell as a formula rather than
 * text. A session note is free text an athlete typed, and on a shared export
 * it could equally be text someone else typed, so it must never be handed to
 * Excel as something to evaluate.
 */
const FORMULA_PREFIXES = ["=", "+", "-", "@", "\t", "\r"];

/**
 * Render one value as a CSV field.
 *
 * Null and undefined become empty rather than the strings "null"/"undefined",
 * which is what a spreadsheet user expects for a missing optional field.
 */
export function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return "";

  let text = value instanceof Date ? value.toISOString() : String(value);

  // Prefix with an apostrophe so the spreadsheet stores it as text. The
  // apostrophe is a display convention, not part of the value, so it doesn't
  // survive a round trip back out — which is the right trade against a cell
  // that runs on open.
  if (FORMULA_PREFIXES.some((p) => text.startsWith(p))) {
    text = `'${text}`;
  }

  // RFC 4180: quote if the field contains a delimiter, a quote or a newline,
  // and double any embedded quotes.
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

/**
 * Build a CSV document from rows and an explicit column list.
 *
 * Columns are explicit rather than inferred from the first row's keys, because
 * inference silently drops a field whenever the first row happens not to have
 * it — and optional fields like heart rate are exactly the ones that go
 * missing early on.
 */
export function toCSV<Row>(rows: Row[], columns: Column<Row>[]): string {
  const header = columns.map((c) => escapeCell(c.header)).join(",");
  const body = rows.map((row) =>
    columns
      .map((c) => escapeCell(c.get ? c.get(row) : (row as Record<string, unknown>)[c.key]))
      .join(","),
  );

  // CRLF is what RFC 4180 specifies and what Excel is happiest with; every
  // other reader accepts it.
  return [header, ...body].join("\r\n");
}

/** One training session, flattened across the four session types. */
export interface ExportRow {
  date: string;
  type: "erg" | "water" | "team" | "dryland";
  distance_m?: number;
  duration_sec?: number;
  pace_per_500m_sec?: number;
  stroke_rate?: number;
  heart_rate?: number;
  watts?: number;
  effort_rpe?: number;
  paddle_side?: string;
  workout_type?: string;
  boat_type?: string;
  water_condition?: string;
  notes?: string;
  synced?: boolean;
}

export const SESSION_COLUMNS: Column<ExportRow>[] = [
  { key: "date", header: "Date" },
  { key: "type", header: "Type" },
  { key: "distance_m", header: "Distance (m)" },
  { key: "duration_sec", header: "Duration (s)" },
  { key: "pace_per_500m_sec", header: "Pace per 500m (s)" },
  { key: "stroke_rate", header: "Stroke Rate (spm)" },
  { key: "heart_rate", header: "Heart Rate (bpm)" },
  { key: "watts", header: "Watts" },
  { key: "effort_rpe", header: "Effort (1-10)" },
  { key: "paddle_side", header: "Paddle Side" },
  { key: "workout_type", header: "Workout Type" },
  { key: "boat_type", header: "Boat Type" },
  { key: "water_condition", header: "Water Condition" },
  { key: "notes", header: "Notes" },
  { key: "synced", header: "Synced", get: (r) => (r.synced === undefined ? "" : r.synced ? "yes" : "no") },
];

/** Loosely-typed session record, for reading fields that vary by type. */
type AnySession = Record<string, unknown>;

/**
 * Sessions as they come back from Dexie. Declared as plain objects rather
 * than Record<string, unknown> because an interface without an index
 * signature isn't assignable to that, and these arrive as typed Dexie rows.
 */
export interface SessionBundle {
  erg?: readonly object[];
  water?: readonly object[];
  team?: readonly object[];
  dryland?: readonly object[];
}

const num = (v: unknown): number | undefined => (typeof v === "number" ? v : undefined);
const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);

/**
 * Flatten every session type into one table.
 *
 * A single file beats four, because the first thing anyone does with this is
 * sort by date to see their whole training history in order — which four files
 * make into a manual merge. Columns that don't apply to a type are left empty.
 */
export function toExportRows(bundle: SessionBundle): ExportRow[] {
  const rows: ExportRow[] = [];

  for (const raw of bundle.erg ?? []) {
    const s = raw as AnySession;
    rows.push({
      date: str(s.date) ?? "",
      type: "erg",
      distance_m: num(s.distance_m),
      duration_sec: num(s.duration_sec),
      pace_per_500m_sec: num(s.split_sec),
      stroke_rate: num(s.stroke_rate),
      heart_rate: num(s.heart_rate),
      watts: num(s.watts),
      effort_rpe: num(s.rpe),
      paddle_side: str(s.paddle_side),
      workout_type: str(s.workout_type),
      notes: str(s.notes),
      synced: s.synced === undefined ? undefined : s.synced === 1 || s.synced === true,
    });
  }

  for (const raw of bundle.water ?? []) {
    const s = raw as AnySession;
    rows.push({
      date: str(s.date) ?? "",
      type: "water",
      distance_m: num(s.distance_m),
      duration_sec: num(s.duration_sec),
      pace_per_500m_sec: num(s.avg_pace_sec),
      stroke_rate: num(s.stroke_rate),
      heart_rate: num(s.heart_rate),
      effort_rpe: num(s.rpe),
      boat_type: str(s.boat_type),
      water_condition: str(s.water_condition),
      notes: str(s.notes),
      synced: s.synced === undefined ? undefined : s.synced === 1 || s.synced === true,
    });
  }

  for (const raw of bundle.team ?? []) {
    const s = raw as AnySession;
    // Team practices are recorded in minutes; convert so the duration column
    // means the same thing in every row.
    const mins = num(s.duration_min);
    rows.push({
      date: str(s.date) ?? "",
      type: "team",
      distance_m: num(s.distance_m),
      duration_sec: mins === undefined ? undefined : mins * 60,
      effort_rpe: num(s.rpe),
      paddle_side: str(s.paddle_side),
      workout_type: str(s.practice_type),
      notes: str(s.notes),
      synced: s.synced === undefined ? undefined : s.synced === 1 || s.synced === true,
    });
  }

  for (const raw of bundle.dryland ?? []) {
    const s = raw as AnySession;
    const mins = num(s.duration_min);
    rows.push({
      date: str(s.date) ?? "",
      type: "dryland",
      duration_sec: mins === undefined ? undefined : mins * 60,
      effort_rpe: num(s.rpe),
      workout_type: str(s.session_type),
      notes: str(s.notes),
      synced: s.synced === undefined ? undefined : s.synced === 1 || s.synced === true,
    });
  }

  // Newest first, matching how sessions are listed everywhere else in the app.
  return rows.sort((a, b) => b.date.localeCompare(a.date));
}

/** Filename for a dated export, e.g. paddleiq-sessions-2026-08-26.csv */
export function exportFilename(today: string): string {
  return `paddleiq-sessions-${today}.csv`;
}
