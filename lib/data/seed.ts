import { buildPlan } from "@/lib/plans/generate";
import { PLAN_SPECS } from "@/lib/plans/specs";
import type { ErgSession, WaterSession, PersonalRecord, TrainingPlan, TechniqueLesson, DashboardStats } from "@/lib/types";

export const mockStats: DashboardStats = {
  weekly_distance_m: 18500,
  weekly_time_min: 312,
  weekly_sessions: 5,
  avg_stroke_rate: 72,
  current_streak: 8,
  total_sessions: 147,
};

export const mockErgSessions: ErgSession[] = [
  {
    id: "e1", user_id: "demo", date: "2026-06-03",
    distance_m: 2000, duration_sec: 512, split_sec: 128,
    stroke_rate: 76, watts: 210, rpe: 8, paddle_side: "left",
    workout_type: "test", notes: "New 2k PR attempt. Felt strong in first 500m, faded slightly in 3rd 500m. Exit timing improved.",
    created_at: "2026-06-03T08:30:00Z",
  },
  {
    id: "e2", user_id: "demo", date: "2026-06-01",
    distance_m: 5000, duration_sec: 1320, split_sec: 132,
    stroke_rate: 68, rpe: 6, paddle_side: "left",
    workout_type: "steady", notes: "Easy 5k — kept stroke rate controlled at 68.",
    created_at: "2026-06-01T07:15:00Z",
  },
  {
    id: "e3", user_id: "demo", date: "2026-05-30",
    distance_m: 500, duration_sec: 118, split_sec: 118,
    stroke_rate: 86, watts: 285, rpe: 10, paddle_side: "left",
    workout_type: "test", notes: "500m all-out. Legs gave out at 400m but held on.",
    created_at: "2026-05-30T09:00:00Z",
  },
  {
    id: "e4", user_id: "demo", date: "2026-05-28",
    distance_m: 4000, duration_sec: 1080, split_sec: 135,
    stroke_rate: 70, rpe: 7, paddle_side: "right",
    workout_type: "intervals", notes: "8x500m intervals. Right-side today to even out muscle development.",
    created_at: "2026-05-28T17:30:00Z",
  },
  {
    id: "e5", user_id: "demo", date: "2026-05-26",
    distance_m: 2000, duration_sec: 524, split_sec: 131,
    stroke_rate: 74, rpe: 8, paddle_side: "left",
    workout_type: "test", notes: "2k at race pace simulation.",
    created_at: "2026-05-26T08:00:00Z",
  },
];

export const mockWaterSessions: WaterSession[] = [
  {
    id: "w1", user_id: "demo", date: "2026-06-02",
    distance_m: 5000, duration_sec: 1560, avg_pace_sec: 156,
    avg_speed_kmh: 11.5, max_speed_kmh: 14.2,
    stroke_rate: 70, rpe: 6, boat_type: "OC-1",
    water_condition: "flat", notes: "Morning flat water. Great reach day — focused on top arm extension.",
    created_at: "2026-06-02T06:45:00Z",
  },
  {
    id: "w2", user_id: "demo", date: "2026-05-31",
    distance_m: 500, duration_sec: 145, avg_pace_sec: 145,
    avg_speed_kmh: 12.4, max_speed_kmh: 15.1,
    stroke_rate: 88, rpe: 9, boat_type: "OC-1",
    water_condition: "slight_chop", notes: "500m time trial. Wind was slight headwind on return. Felt the catch improve.",
    created_at: "2026-05-31T07:00:00Z",
  },
];

export const mockPRs: PersonalRecord[] = [
  { id: "pr1", user_id: "demo", category: "erg", distance_m: 500, time_sec: 118, date: "2026-05-30", previous_time_sec: 122, improvement_sec: 4 },
  { id: "pr2", user_id: "demo", category: "erg", distance_m: 1000, time_sec: 248, date: "2026-05-14", previous_time_sec: 253, improvement_sec: 5 },
  { id: "pr3", user_id: "demo", category: "erg", distance_m: 2000, time_sec: 512, date: "2026-06-03", previous_time_sec: 524, improvement_sec: 12 },
  { id: "pr4", user_id: "demo", category: "water", distance_m: 500, time_sec: 145, date: "2026-05-31", previous_time_sec: 151, improvement_sec: 6 },
  { id: "pr5", user_id: "demo", category: "water", distance_m: 1000, time_sec: 310, date: "2026-04-20", previous_time_sec: 318, improvement_sec: 8 },
];

// Generated from the phase specs in lib/plans/specs.ts rather than written out
// session by session. The plans previously advertised 4-12 weeks and shipped
// with at most one week of content.
export const trainingPlans: TrainingPlan[] = PLAN_SPECS.map(buildPlan);

/**
 * A general beginner overview, shown on the library index rather than pinned
 * to one lesson. Its title describes the whole stroke, and nobody here has
 * watched it frame by frame to say which lesson it teaches — presenting it as
 * the material for a specific lesson would be a claim we can't back.
 *
 * Embedded through YouTube's player, which is what their terms allow. The
 * frames are not ours to lift into stills without asking the channel.
 */
export const featuredTechniqueVideo = {
  youtubeId: "s_cAyAd9M4Y",
  title: "Dragon Boat Technique For Beginners - How To Paddle",
  channel: "Paddles Up",
  channelUrl: "https://www.youtube.com/@PaddlesUpDB",
};

export const techniqueLessons: TechniqueLesson[] = [
  {
    id: "t1",
    title: "The Catch",
    category: "Stroke Mechanics",
    summary: "The catch is where power begins. A clean, deep, early catch is the single most important part of an efficient dragon boat stroke.",
    explanation: "The catch is the moment your paddle blade enters the water. In dragon boating, the goal is to place the blade as far forward as possible while keeping the blade fully buried before pulling. Think of it as 'hanging' off the paddle — you're not just pulling water, you're pulling the boat past a fixed point. The blade should enter quietly and cleanly, fully submerged before any backward movement begins.",
    common_mistakes: [
      "Catching with only half the blade in the water",
      "Pulling before the blade is fully buried",
      "Reaching with just the arms instead of torso rotation",
      "Blade angle too shallow — paddle skims instead of grips",
      "Catching behind the hips instead of in front",
    ],
    coaching_cues: [
      "Reach, bury, then pull",
      "Stack your hands — top arm fully extended overhead",
      "Quiet entry — no splash means a clean catch",
      "Grip the water before you move it",
      "Your blade should 'click in' before you pull",
    ],
    drills: [
      "Pause drill: freeze at full reach for 1 second before catching",
      "Slow-motion catch: practice catch entry at 50% speed, focusing on blade angle",
      "Catch count: count how many catches are clean versus splashy per 10 strokes",
    ],
    difficulty: "beginner",
  },
  {
    id: "t2",
    title: "Torso Rotation",
    category: "Power & Mechanics",
    summary: "Power in dragon boating comes from your torso, not your arms. Proper rotation multiplies your stroke efficiency.",
    explanation: "Most of your paddle power should come from your torso — specifically the rotation of your hips, obliques, and lats. Think of your arms as connectors, not the primary movers. As you reach forward, your outside shoulder (top hand side) should rotate toward the water. As you drive back, your hips and core unwind, generating the pulling force. Athletes who use only arms fatigue 3x faster than those using full body rotation.",
    common_mistakes: [
      "Paddling with only arms — shoulders barely move",
      "Rotating the upper torso but not the hips",
      "Collapsing the top arm during the rotation",
      "Over-rotating and losing balance in the boat",
      "Twisting the torso but not anchoring at the hips",
    ],
    coaching_cues: [
      "Think: wind up on the reach, unwind on the pull",
      "Squeeze the orange under your armpit as you drive",
      "Drive with your hip, not your shoulder",
      "Feel your obliques fire during the pull",
      "Your whole trunk should move as one unit",
    ],
    drills: [
      "Land drill: sit on floor, mimic stroke with rotation — feel the core engage",
      "Slow erg at low resistance: focus entirely on torso rotation, not speed",
      "Video yourself from behind — check shoulder rotation symmetry",
    ],
    difficulty: "intermediate",
  },
  {
    id: "t3",
    title: "The Exit",
    category: "Stroke Mechanics",
    summary: "A clean exit is as important as a clean catch. Dragging the blade past the hip kills your speed.",
    explanation: "The exit is when you remove your paddle from the water. Many paddlers continue pushing the blade past their hip, which creates drag that actually slows the boat. The optimal exit point is at or just before the hip. Your bottom hand drives the handle outward (away from the boat) to slice the blade cleanly out of the water, then flows forward quickly for the next catch.",
    common_mistakes: [
      "Exiting too late — blade past the hip",
      "Lifting the blade straight up instead of slicing out",
      "Letting the blade flutter underwater before exit",
      "Pausing between exit and return",
      "Not recovering fast enough for the next catch",
    ],
    coaching_cues: [
      "Exit at the hip — not behind it",
      "Slice, don't lift",
      "Think: exit quick, reach quick, catch quiet",
      "Your bottom elbow drives out and up",
      "Quick exit = more time to reach further forward",
    ],
    drills: [
      "Exit timing drill: place a water bottle at your hip as a target exit marker",
      "Feather drill: practice slicing blade out horizontally on each exit",
      "Count 10 strokes and note how many exits felt clean vs. late",
    ],
    difficulty: "beginner",
  },
  {
    id: "t4",
    title: "Stroke Timing & Synchronization",
    category: "Team Synchronization",
    summary: "A synchronized team is faster than a team of stronger individuals. Learn how to hit the water at exactly the same moment.",
    explanation: "In a dragon boat, 20 paddles should hit the water at the exact same millisecond. Even 0.1 seconds of spread creates turbulence that slows the boat. Timing comes from watching the pace-setter (usually Seat 1 or 2), listening for the beat from the drummer, and developing a feel for the team's rhythm. Individual paddlers should NOT try to be faster — matching the team's tempo is more important than your personal power.",
    common_mistakes: [
      "Watching your own paddle instead of the pacer",
      "Rushing the catch to hit harder",
      "Paddling to your own rhythm instead of the team's",
      "Timing off after a missed stroke — not recovering smoothly",
      "Looking down instead of across the boat",
    ],
    coaching_cues: [
      "Lock your eyes on Seat 1's shoulder",
      "Listen for the catch sound — you want one sound, not 20",
      "Be a mirror of the pacer — match, don't lead",
      "If you're off, take a smooth breath and re-sync on the next catch",
      "Feel the boat accelerate when the team is in sync",
    ],
    drills: [
      "Blind timing drill: close eyes, match the drummer beat exactly",
      "Two-person sync: paddle in pairs, focus on matching each other perfectly",
      "Film from the dock — count the entry spread in seconds",
    ],
    difficulty: "intermediate",
  },
  {
    id: "t5",
    title: "Race Starts",
    category: "Race Strategy",
    summary: "The first 10–15 strokes of a race set the tempo. Explosive, synchronized starts give you a critical early advantage.",
    explanation: "Dragon boat race starts require maximum power output with perfect synchronization. Coaches typically call a 'high start' — 8–10 short, explosive half-strokes at a very high stroke rate (90–100+ spm), followed by a transition to full race pace. The key is everyone hitting max power on the first stroke simultaneously. One person out of sync wastes the energy of the whole boat.",
    common_mistakes: [
      "Starting before the drummer signals",
      "Using full-length strokes on the start — should be short and explosive",
      "Stroke rate dropping after the first 5 strokes",
      "Body not fully loaded before the start signal",
      "Top arm collapsing during the explosive drive",
    ],
    coaching_cues: [
      "Blade already touching the water before 'Go'",
      "Short, explosive, vertical pulls for the first 8 strokes",
      "Feel the power transfer from your legs through your torso",
      "High stroke rate for the start — rate drops as strokes lengthen",
      "Your first stroke should be the most powerful stroke of the race",
    ],
    drills: [
      "Start simulations: 10x8-stroke starts on the erg at max effort",
      "Land starts: seated on land with paddle, practice the explosion without water",
      "Video analysis of race start footage from elite dragon boat teams",
    ],
    difficulty: "advanced",
  },
  {
    id: "t6",
    title: "Erg Technique",
    category: "Erg Training",
    summary: "The paddle erg rewards good technique. Learn how to translate water mechanics onto the erg for accurate performance data.",
    explanation: "A paddle erg simulates the water resistance of a paddle stroke. Unlike a rowing erg, the paddle erg is side-specific and emphasizes the same rotation, catch, and exit as on water. Your split time (seconds per 500m) is directly comparable to your water split if technique is consistent. The erg is also a diagnostic tool — you can isolate and fix technique issues that are hard to feel on the water.",
    common_mistakes: [
      "Using the erg as a rowing machine instead of a paddle machine",
      "Pulling with just the arms — no body rotation",
      "Resistance set too high — forces poor mechanics",
      "Not tracking split time progression",
      "Ignoring stroke rate — either too fast (sloppy) or too slow (unnatural)",
    ],
    coaching_cues: [
      "Same technique as on water — rotation is everything",
      "Aim for 65–75 spm for endurance, 80–90 spm for race pace",
      "Watch the split — small improvements (2–3 sec) are significant",
      "Every stroke should feel like a clean water catch",
      "Consistency matters more than max effort in training",
    ],
    drills: [
      "Rotation check: erg with one hand — forces full rotation",
      "Split ladder: 10 strokes each at 130/128/126/124 split — feel the pace difference",
      "Technique film: film yourself from the side while erging, compare to water footage",
    ],
    difficulty: "beginner",
  },
  {
    id: "t7",
    title: "Race Pacing",
    category: "Race Strategy",
    summary: "Going out too hard and dying at 300m is the most common dragon boat race mistake. Learn to pace strategically.",
    explanation: "Dragon boat races are anaerobic-aerobic events. For 500m (typically 2–3 minutes), you'll be working at 90–100% capacity. The biggest mistake is sprinting the first 200m and fading hard. Elite teams start at race pace, hold it, then sprint the final 100m. Erg training should include pacing intervals — same split for 200m, 250m, and 300m segments within the same 500m test.",
    common_mistakes: [
      "Starting 15–20 seconds per 500m faster than sustainable",
      "Not knowing your target split before the race",
      "Following a competitor's pace instead of your own plan",
      "Giving up and shutting down before the finish line",
      "Saving energy unnecessarily — leaving 5–10% in the tank",
    ],
    coaching_cues: [
      "Know your target split before the race starts",
      "The first 50m should feel controlled — fast, but controlled",
      "At 300m, you should feel pain — that's correct",
      "Sprint from 400m, not from 300m — save the final kick",
      "Give everything in the last 50m — no regrets at the finish",
    ],
    drills: [
      "Negative split training: first half intentionally 3–5 sec/500m slower, second half faster",
      "Pace feel training: erg at target split without looking at monitor",
      "Race simulation: 500m erg at full race conditions — no stopping",
    ],
    difficulty: "intermediate",
  },
  {
    id: "t8",
    title: "Left vs Right Side Paddling",
    category: "Technique & Position",
    summary: "Dragon boat paddlers are designated left or right side. Each side has different mechanics — understand your role.",
    explanation: "In a dragon boat, paddlers sit in pairs and all paddle on the same side (alternating left/right per row). Left-side paddlers lean slightly right, and right-side paddlers lean slightly left, helping balance the boat. Switching sides is uncommon in competition but important for erg training to prevent muscle imbalances. About 80% of athletes have a dominant side — training the weak side closes the gap.",
    common_mistakes: [
      "Switching sides during race without calling it out",
      "Neglecting erg training on non-dominant side",
      "Leaning the wrong way and unbalancing the boat",
      "Top hand crossing over the centerline of the boat",
      "Not adapting catch angle for each side's geometry",
    ],
    coaching_cues: [
      "Lean into your paddle side for better reach",
      "Top hand aligned over the gunwale, not over the center",
      "Your hips should face slightly toward the water",
      "Right-side: left hand on top. Left-side: right hand on top",
      "Train both sides on the erg — 60/40 toward your primary side",
    ],
    drills: [
      "Erg alternating sessions: one session left, next session right",
      "Land mirror: practice stroke on both sides in front of mirror",
      "Seated balance drill: hold balanced position at each phase of the stroke",
    ],
    difficulty: "beginner",
  },
];

export const weeklyVolumeData = [
  { week: "May 12", distance: 12400, time: 210, sessions: 4 },
  { week: "May 19", distance: 15200, time: 255, sessions: 5 },
  { week: "May 26", distance: 16800, time: 290, sessions: 5 },
  { week: "Jun 2", distance: 18500, time: 312, sessions: 5 },
];

export const ergProgressData = [
  { date: "Apr 7", split: 138, strokeRate: 72, distance: 2000 },
  { date: "Apr 21", split: 135, strokeRate: 73, distance: 2000 },
  { date: "May 5", split: 133, strokeRate: 74, distance: 2000 },
  { date: "May 19", split: 131, strokeRate: 75, distance: 2000 },
  { date: "Jun 3", split: 128, strokeRate: 76, distance: 2000 },
];
