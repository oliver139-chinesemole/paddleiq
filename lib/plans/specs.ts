// The eight training plans the landing page advertises.
//
// Five existed with at most one week of content; 200m Sprint, Solo Time Trial
// Improvement and In-Season Maintenance were named in the marketing copy and
// had no record at all.
//
// Each is a set of phases rather than a list of sessions — see generate.ts for
// why. Durations are the *first week* of each phase; the generator grows them
// across the phase and cuts them on deload and taper weeks.

import type { PlanSpec } from "./generate";

// ─── reusable days ───────────────────────────────────────────────────────────

const REST = {
  type: "rest" as const,
  name: "Rest",
  description: "Complete rest, or a gentle walk and some mobility work.",
  baseMin: 0,
  intensity: "easy" as const,
};

const MOBILITY = {
  type: "rest" as const,
  name: "Mobility",
  description: "Light stretching through the lats, thoracic spine and hips — the three that limit rotation.",
  baseMin: 20,
  intensity: "easy" as const,
};

const DRYLAND_BASE = {
  type: "dryland" as const,
  name: "Paddle Strength",
  description: "Pull-ups, seated rows, single-arm lat pulldown, Russian twists, plank. 3 sets each.",
  baseMin: 40,
  intensity: "moderate" as const,
};

const TECHNIQUE_ERG = {
  type: "erg" as const,
  name: "Technique Erg",
  description: "Easy pace with the catch as the only focus. Stop and reset if the blade starts slipping in.",
  baseMin: 30,
  intensity: "easy" as const,
  strokeRate: 62,
};

// ─── the plans ───────────────────────────────────────────────────────────────

export const PLAN_SPECS: PlanSpec[] = [
  {
    id: "plan-beginner",
    name: "Dragon Boat Foundation",
    description:
      "Eight weeks for new paddlers. Builds an aerobic base, introduces stroke mechanics, and gets you ready for your first team practice.",
    difficulty: "beginner",
    focus: ["technique", "endurance", "erg base"],
    suits: { roles: ["beginner"], goals: ["technique", "fitness", "endurance"], env: ["team_boat", "erg"], distances: [] },
    phases: [
      {
        name: "Base",
        weeks: 4,
        progression: 0.08,
        days: [
          TECHNIQUE_ERG,
          REST,
          DRYLAND_BASE,
          { type: "erg", name: "Steady Erg", description: "Continuous steady paddling. You should be able to speak in short sentences throughout.", baseMin: 30, intensity: "moderate", strokeRate: 65 },
          REST,
          { type: "erg", name: "Longer Steady", description: "The week's longest piece. Settle into a rhythm and hold it.", baseMin: 40, intensity: "moderate", strokeRate: 66 },
          MOBILITY,
        ],
      },
      {
        name: "Build",
        weeks: 4,
        progression: 0.1,
        days: [
          TECHNIQUE_ERG,
          REST,
          DRYLAND_BASE,
          { type: "erg", name: "Intervals", description: "6 x 3 min at a pace you could hold for about 20 minutes, 2 min easy between.", baseMin: 40, intensity: "hard", strokeRate: 70 },
          MOBILITY,
          { type: "team", name: "Team Practice", description: "Sit in with the crew. Timing off the stroke matters more than power here.", baseMin: 90, intensity: "moderate", strokeRate: 68 },
          REST,
        ],
      },
    ],
  },

  {
    id: "plan-500m",
    name: "500m Race Prep",
    description:
      "Six weeks to peak for a 500m. Erg testing, race-pace intervals, start practice and a taper into race day.",
    difficulty: "intermediate",
    focus: ["500m speed", "race starts", "peak"],
    suits: { roles: ["competitive", "paddler", "captain"], goals: ["race", "erg_score"], env: ["team_boat", "erg"], distances: [500] },
    phases: [
      {
        name: "Build",
        weeks: 3,
        progression: 0.1,
        days: [
          { type: "erg", name: "Threshold Erg", description: "4 x 5 min at a pace you could just hold for 30 min. 3 min easy between.", baseMin: 40, intensity: "hard", strokeRate: 72 },
          REST,
          DRYLAND_BASE,
          { type: "erg", name: "Race Pace 500s", description: "5 x 500m at target race split, full recovery between. Stop the set if the split slips twice.", baseMin: 45, intensity: "max", strokeRate: 82, distanceM: 2500 },
          MOBILITY,
          { type: "team", name: "Team Practice — Starts", description: "Race starts off the line: 10 hard, 10 build, settle to race pace.", baseMin: 90, intensity: "hard", strokeRate: 85 },
          REST,
        ],
      },
      {
        name: "Peak",
        weeks: 2,
        progression: 0.05,
        days: [
          { type: "erg", name: "Sharpener", description: "8 x 250m at faster than race pace, long recovery. Quality only — stop when it drops.", baseMin: 35, intensity: "max", strokeRate: 88, distanceM: 2000 },
          REST,
          { type: "dryland", name: "Power Maintenance", description: "Lower volume, explosive intent. Nothing to failure this close to racing.", baseMin: 30, intensity: "moderate" },
          { type: "erg", name: "Race Simulation", description: "One full 500m at race effort. Treat it as a rehearsal of the whole thing, start included.", baseMin: 30, intensity: "max", strokeRate: 85, distanceM: 500 },
          MOBILITY,
          { type: "team", name: "Team Race Pieces", description: "Full-crew 500s at race pace. Timing under pressure is the point.", baseMin: 90, intensity: "max", strokeRate: 85 },
          REST,
        ],
      },
      {
        name: "Taper",
        weeks: 1,
        taper: true,
        days: [
          { type: "erg", name: "Short Sharpener", description: "4 x 250m at race pace with long rests. Enough to stay sharp, not enough to tire.", baseMin: 25, intensity: "hard", strokeRate: 85, distanceM: 1000 },
          REST,
          { type: "erg", name: "Loosener", description: "15 min easy with a few 20-stroke bursts to keep the feel.", baseMin: 20, intensity: "easy", strokeRate: 70 },
          REST,
          MOBILITY,
          { type: "team", name: "Race Day", description: "Warm up properly, then race. Everything useful was done weeks ago.", baseMin: 60, intensity: "max", strokeRate: 85 },
          REST,
        ],
      },
    ],
  },

  {
    id: "plan-erg",
    name: "Erg Improvement",
    description:
      "Ten weeks aimed squarely at your erg splits across 500m, 1k and 2k. Threshold work, testing, and a progression you can see.",
    difficulty: "intermediate",
    focus: ["erg performance", "split improvement", "threshold"],
    suits: { roles: ["competitive", "paddler"], goals: ["erg_score", "endurance"], env: ["erg"], distances: [1000, 2000] },
    phases: [
      {
        name: "Aerobic Base",
        weeks: 4,
        progression: 0.08,
        days: [
          { type: "erg", name: "Steady State", description: "Long continuous piece, conversational. This is the work most paddlers skip.", baseMin: 45, intensity: "easy", strokeRate: 64 },
          DRYLAND_BASE,
          REST,
          { type: "erg", name: "Threshold", description: "3 x 8 min at your one-hour pace, 3 min easy between.", baseMin: 40, intensity: "hard", strokeRate: 70 },
          MOBILITY,
          { type: "erg", name: "Long Steady", description: "The week's longest piece. Keep the split flat from start to finish.", baseMin: 55, intensity: "moderate", strokeRate: 66 },
          REST,
        ],
      },
      {
        name: "Threshold Build",
        weeks: 4,
        progression: 0.1,
        days: [
          { type: "erg", name: "Steady State", description: "Easy continuous work between the hard days. Resist making it a race.", baseMin: 45, intensity: "easy", strokeRate: 64 },
          DRYLAND_BASE,
          REST,
          { type: "erg", name: "Threshold Intervals", description: "5 x 6 min at threshold, 2 min easy. The last one should be the same split as the first.", baseMin: 45, intensity: "hard", strokeRate: 72 },
          MOBILITY,
          { type: "erg", name: "Pyramid", description: "250-500-750-1000-750-500-250m, building rate as the pieces shorten.", baseMin: 45, intensity: "hard", strokeRate: 76, distanceM: 4000 },
          REST,
        ],
      },
      {
        name: "Test",
        weeks: 2,
        progression: 0,
        days: [
          { type: "erg", name: "Primer", description: "20 min easy with 4 x 30s at race rate to wake the system up.", baseMin: 30, intensity: "easy", strokeRate: 68 },
          REST,
          { type: "erg", name: "2k Test", description: "Full 2k for time. Pace the first 500 as though you have to hold it — because you do.", baseMin: 35, intensity: "max", strokeRate: 78, distanceM: 2000 },
          REST,
          { type: "erg", name: "Recovery Paddle", description: "Easy and short. Nothing to prove the day after a test.", baseMin: 25, intensity: "easy", strokeRate: 62 },
          { type: "erg", name: "500m Test", description: "Full 500m for time, fully rested.", baseMin: 25, intensity: "max", strokeRate: 88, distanceM: 500 },
          REST,
        ],
      },
    ],
  },

  {
    id: "plan-tryout",
    name: "Tryout Prep",
    description:
      "Four focused weeks before team tryouts. Erg testing, team stroke technique and the conditioning selectors look for.",
    difficulty: "intermediate",
    focus: ["tryout readiness", "team technique", "conditioning"],
    suits: { roles: ["beginner", "paddler"], goals: ["team", "fitness"], env: ["team_boat", "erg", "dryland"], distances: [] },
    phases: [
      {
        name: "Sharpen",
        weeks: 3,
        progression: 0.08,
        days: [
          { type: "erg", name: "500m Repeats", description: "4 x 500m at the split you want on test day, 4 min rest. This is the number they'll write down.", baseMin: 40, intensity: "max", strokeRate: 84, distanceM: 2000 },
          DRYLAND_BASE,
          TECHNIQUE_ERG,
          { type: "team", name: "Team Stroke Work", description: "Sit in a boat if you can. Selectors notice timing before they notice power.", baseMin: 90, intensity: "moderate", strokeRate: 70 },
          MOBILITY,
          { type: "erg", name: "Threshold", description: "4 x 6 min at threshold. Builds the base the repeats sit on.", baseMin: 40, intensity: "hard", strokeRate: 72 },
          REST,
        ],
      },
      {
        name: "Taper",
        weeks: 1,
        taper: true,
        days: [
          { type: "erg", name: "Primer", description: "20 min easy with 4 x 30s at test rate.", baseMin: 25, intensity: "easy", strokeRate: 70 },
          REST,
          TECHNIQUE_ERG,
          REST,
          MOBILITY,
          { type: "erg", name: "Tryout Day", description: "Warm up thoroughly. Trust the work.", baseMin: 60, intensity: "max", strokeRate: 85 },
          REST,
        ],
      },
    ],
  },

  {
    id: "plan-200m",
    name: "200m Sprint Plan",
    description:
      "Six weeks for the 200m. Starts, top-end rate and the anaerobic power a sprint lives on — a different event from the 500m.",
    difficulty: "advanced",
    focus: ["sprint", "race starts", "peak rate"],
    suits: { roles: ["competitive", "paddler", "captain"], goals: ["race"], env: ["team_boat", "erg"], distances: [200, 250] },
    phases: [
      {
        name: "Power Base",
        weeks: 3,
        progression: 0.08,
        days: [
          { type: "dryland", name: "Explosive Strength", description: "Heavy pulls and jumps, low reps, full recovery. Speed of movement is the point, not the load.", baseMin: 45, intensity: "hard" },
          REST,
          { type: "erg", name: "Start Practice", description: "10 x (5 hard strokes from a dead stop, 60s rest). Every one from stationary.", baseMin: 30, intensity: "max", strokeRate: 95 },
          TECHNIQUE_ERG,
          MOBILITY,
          { type: "team", name: "Team Starts", description: "Crew starts on the call. A 200m is decided in the first ten strokes.", baseMin: 75, intensity: "max", strokeRate: 92 },
          REST,
        ],
      },
      {
        name: "Sprint Sharpen",
        weeks: 2,
        progression: 0.05,
        days: [
          { type: "erg", name: "Max Rate Intervals", description: "8 x 20 strokes at the highest rate you can hold cleanly, full recovery.", baseMin: 30, intensity: "max", strokeRate: 100 },
          REST,
          { type: "dryland", name: "Power Maintenance", description: "Low volume, explosive intent. Nothing to failure.", baseMin: 30, intensity: "moderate" },
          { type: "erg", name: "200m Simulations", description: "3 x 200m flat out, 6 min rest. Race the start every time.", baseMin: 30, intensity: "max", strokeRate: 95, distanceM: 600 },
          MOBILITY,
          { type: "team", name: "Crew Sprints", description: "Full-crew 200s. Timing at 90+ spm is the hard part.", baseMin: 75, intensity: "max", strokeRate: 92 },
          REST,
        ],
      },
      {
        name: "Taper",
        weeks: 1,
        taper: true,
        days: [
          { type: "erg", name: "Starts Only", description: "5 x 5 strokes from a stop. Sharp and short.", baseMin: 20, intensity: "hard", strokeRate: 95 },
          REST,
          { type: "erg", name: "Loosener", description: "15 min easy with a few rate bursts.", baseMin: 20, intensity: "easy", strokeRate: 70 },
          REST,
          MOBILITY,
          { type: "team", name: "Race Day", description: "Warm up long, race short.", baseMin: 60, intensity: "max", strokeRate: 92 },
          REST,
        ],
      },
    ],
  },

  {
    id: "plan-offseason",
    name: "Off-Season Strength",
    description:
      "Twelve weeks away from racing to build the strength base next season sits on, without losing the feel of the water.",
    difficulty: "intermediate",
    focus: ["strength", "power", "durability"],
    suits: { roles: ["competitive", "paddler", "captain"], goals: ["fitness", "endurance"], env: ["dryland", "erg"], distances: [] },
    phases: [
      {
        name: "Hypertrophy",
        weeks: 4,
        progression: 0.06,
        days: [
          { type: "dryland", name: "Upper Pull", description: "Pull-ups, barbell rows, lat pulldown, face pulls. 4 sets, 8–12 reps.", baseMin: 50, intensity: "moderate" },
          { type: "erg", name: "Easy Erg", description: "Aerobic maintenance so the off-season doesn't cost you the base.", baseMin: 30, intensity: "easy", strokeRate: 62 },
          { type: "dryland", name: "Legs and Core", description: "Squats, deadlifts, Russian twists, hanging leg raises.", baseMin: 50, intensity: "moderate" },
          REST,
          { type: "dryland", name: "Push and Stability", description: "Overhead press, dips, single-arm carries, side plank.", baseMin: 45, intensity: "moderate" },
          { type: "erg", name: "Long Steady", description: "The week's aerobic anchor. Conversational throughout.", baseMin: 45, intensity: "easy", strokeRate: 64 },
          REST,
        ],
      },
      {
        name: "Strength",
        weeks: 4,
        progression: 0.05,
        days: [
          { type: "dryland", name: "Heavy Pull", description: "Weighted pull-ups and heavy rows. 5 sets, 3–5 reps, long rests.", baseMin: 55, intensity: "hard" },
          { type: "erg", name: "Easy Erg", description: "Aerobic maintenance between the heavy days.", baseMin: 30, intensity: "easy", strokeRate: 62 },
          { type: "dryland", name: "Heavy Legs", description: "Squats and deadlifts, 5 x 3–5. Leave a rep in reserve.", baseMin: 55, intensity: "hard" },
          REST,
          MOBILITY,
          { type: "erg", name: "Steady with Bursts", description: "40 min steady with 6 x 1 min harder, to keep some intensity in the legs.", baseMin: 45, intensity: "moderate", strokeRate: 66 },
          REST,
        ],
      },
      {
        name: "Power Conversion",
        weeks: 4,
        progression: 0.05,
        days: [
          // Explosive pull, jumps and rate work are all hard days, so they're
          // spaced rather than stacked — three in a row is how a written plan
          // injures the person following it.
          { type: "dryland", name: "Explosive Pull", description: "Speed-focused pulls and medicine ball throws. Move the load fast.", baseMin: 45, intensity: "hard" },
          { type: "erg", name: "Easy Erg", description: "Recovery between the two power days. Genuinely easy.", baseMin: 30, intensity: "easy", strokeRate: 62 },
          { type: "dryland", name: "Jumps and Core", description: "Box jumps, broad jumps, rotational core. Quality over volume.", baseMin: 40, intensity: "hard" },
          REST,
          { type: "erg", name: "Rate Work", description: "8 x 45s at high rate, full recovery. Reintroducing race rates.", baseMin: 35, intensity: "hard", strokeRate: 80 },
          { type: "erg", name: "Longer Steady", description: "Rebuilding the aerobic side before the season proper.", baseMin: 50, intensity: "moderate", strokeRate: 66 },
          REST,
        ],
      },
    ],
  },

  {
    id: "plan-timetrial",
    name: "Solo Time Trial Improvement",
    description:
      "Eight weeks on the water in a solo craft. Pacing, steering economy and a repeatable time trial you can actually compare.",
    difficulty: "intermediate",
    focus: ["water pace", "steering", "solo craft"],
    suits: { roles: ["paddler", "competitive"], goals: ["endurance", "technique"], env: ["solo_water"], distances: [1000, 2000] },
    phases: [
      {
        name: "Water Base",
        weeks: 4,
        progression: 0.08,
        days: [
          { type: "water", name: "Steady Paddle", description: "Continuous easy paddling. Hold a line — every correction stroke costs you distance.", baseMin: 45, intensity: "easy", strokeRate: 60, distanceM: 6000 },
          DRYLAND_BASE,
          REST,
          { type: "water", name: "Pace Work", description: "4 x 5 min at time-trial effort with 3 min easy. Watch your GPS pace, not your feeling.", baseMin: 45, intensity: "hard", strokeRate: 68, distanceM: 7000 },
          MOBILITY,
          { type: "water", name: "Long Paddle", description: "The week's distance day. Same route each week so the times mean something.", baseMin: 60, intensity: "moderate", strokeRate: 62, distanceM: 9000 },
          REST,
        ],
      },
      {
        name: "Trial Build",
        weeks: 4,
        progression: 0.08,
        days: [
          { type: "water", name: "Steady Paddle", description: "Easy continuous work. Technique holds up better when you're not tired.", baseMin: 45, intensity: "easy", strokeRate: 60, distanceM: 6000 },
          DRYLAND_BASE,
          REST,
          { type: "water", name: "Time Trial", description: "Your benchmark distance, full effort, same course. Record it with GPS so the comparison is real.", baseMin: 40, intensity: "max", strokeRate: 70, distanceM: 5000 },
          MOBILITY,
          { type: "water", name: "Recovery Paddle", description: "Easy and unhurried the day after the trial.", baseMin: 40, intensity: "easy", strokeRate: 58, distanceM: 5000 },
          REST,
        ],
      },
    ],
  },

  {
    id: "plan-inseason",
    name: "In-Season Maintenance",
    description:
      "Six weeks of holding fitness through a racing block. Enough stimulus to keep sharp, little enough to arrive at each race fresh.",
    difficulty: "intermediate",
    focus: ["maintenance", "recovery", "race readiness"],
    suits: { roles: ["competitive", "captain", "paddler"], goals: ["race", "team"], env: ["team_boat"], distances: [200, 250, 500] },
    phases: [
      {
        name: "Maintain",
        weeks: 6,
        progression: 0.02,
        days: [
          { type: "erg", name: "Short Threshold", description: "3 x 5 min at threshold. Enough to hold fitness, not enough to dig a hole.", baseMin: 35, intensity: "hard", strokeRate: 72 },
          MOBILITY,
          { type: "dryland", name: "Maintenance Strength", description: "Two sets of everything, none to failure. Keeping what you built, not adding.", baseMin: 35, intensity: "moderate" },
          TECHNIQUE_ERG,
          REST,
          { type: "team", name: "Team Practice", description: "Crew work at race pace. Racing is the hard session in a race block.", baseMin: 90, intensity: "hard", strokeRate: 78 },
          REST,
        ],
      },
    ],
  },
];
