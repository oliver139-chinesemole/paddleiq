# 🐉 PaddleIQ — Dragon Boat Training App

> **Train smarter. Paddle faster. Built exclusively for dragon boat athletes.**

PaddleIQ is the all-in-one training platform for dragon boat athletes. Track erg sessions, water time trials, team practices, and strength training — whether you're a competitive racer, a beginner, or training solo.

**Live App:** [Coming soon after Render deployment]  
**GitHub:** https://github.com/oliver139-chinesemole/paddleiq

---

## Features

### Training Modes
- **🏋️ Paddle Erg Mode** — Log split time, stroke rate, watts, heart rate, RPE. Automatic PR detection across 200m, 500m, 1k, 2k.
- **🌊 Solo Water Time Trial** — GPS-based time trials in OC, kayak, canoe, or solo paddle craft. Pace, speed, conditions, route.
- **🐉 Dragon Boat Team Practice** — Log team sessions with seat position, practice type, stroke rate, and coach feedback.
- **💪 Dryland / Strength** — Track exercises designed for paddlers: pull-ups, lat pulldown, rows, Russian twists, core work.

### Dashboard & Analytics
- Home dashboard with weekly stats, streak, PRs, and today's planned workout
- Analytics page with weekly distance chart, erg split progress chart, and training load
- Personal Records page for all erg and water distances

### Training Plans (8 Built-in)
- Dragon Boat Foundation (8 weeks, beginner)
- 500m Race Prep (6 weeks, intermediate)
- Erg Improvement (10 weeks)
- Tryout Prep (4 weeks)
- 200m Sprint Plan
- Off-Season Strength
- Solo Time Trial Improvement
- In-Season Maintenance

### Technique Library
- 8 in-depth technique lessons covering: Catch, Rotation, Exit, Timing, Race Starts, Erg Form, Pacing, Side Mechanics
- Common mistakes, coaching cues, and practice drills for each
- "Set as Weekly Focus" feature

### Team & Coach Features
- Team roster with seat assignments and paddle side
- Team leaderboard (500m erg scores)
- Announcements board
- Coach feedback on sessions

### AI Coach
- Weekly training summary and insight
- Personalized suggestions based on training data
- Overtraining warnings
- Chat interface with preset dragon-boat-specific questions

### Onboarding
- Role selection (paddler, coach, captain, beginner, competitive)
- Training environment setup
- Goals and race distance preferences

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| Charts | Recharts |
| Icons | Lucide React |
| Form handling | React Hook Form + Zod |
| Deployment | Render |
| CI/CD | GitHub Actions |

---

## Project Structure

```
paddleiq/
├── app/                        # Next.js App Router
│   ├── (auth)/                 # Login, Signup, Onboarding
│   │   ├── login/
│   │   ├── signup/
│   │   └── onboarding/
│   ├── (dashboard)/            # Main app (requires auth)
│   │   ├── layout.tsx          # Dashboard layout with nav
│   │   ├── dashboard/          # Home dashboard
│   │   ├── train/              # Training modes
│   │   │   ├── erg/            # Paddle erg logger
│   │   │   ├── water/          # Solo water time trial
│   │   │   ├── team/           # Dragon boat team practice
│   │   │   └── dryland/        # Gym/strength training
│   │   ├── analytics/          # Charts and progress
│   │   ├── technique/          # Technique library
│   │   ├── team/               # Team management
│   │   ├── plans/              # Training plans
│   │   ├── records/            # Personal records
│   │   ├── ai-coach/           # AI Coach feature
│   │   └── profile/            # User profile
│   ├── page.tsx                # Landing page
│   ├── layout.tsx              # Root layout
│   └── globals.css             # Global styles + theme
├── components/
│   ├── ui/                     # Reusable UI components
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── badge.tsx
│   │   ├── input.tsx
│   │   ├── select.tsx
│   │   ├── progress.tsx
│   │   └── textarea.tsx
│   ├── nav/                    # Navigation components
│   │   ├── bottom-nav.tsx      # Mobile bottom navigation
│   │   └── top-nav.tsx         # Top header bar
│   └── charts/                 # Chart components
│       ├── volume-chart.tsx    # Weekly distance chart
│       └── progress-chart.tsx  # PR progression chart
├── lib/
│   ├── supabase/               # Supabase clients
│   │   ├── client.ts           # Browser client
│   │   └── server.ts           # Server component client
│   ├── data/
│   │   └── seed.ts             # Mock/demo data
│   ├── types.ts                # TypeScript interfaces
│   └── utils.ts                # Utility functions
├── supabase/
│   └── schema.sql              # Full database schema + RLS policies
├── .github/
│   └── workflows/
│       └── ci.yml              # GitHub Actions CI
├── proxy.ts                    # Auth proxy (Next.js 16 equivalent of middleware)
├── render.yaml                 # Render deployment config
├── .env.example                # Required environment variables (no secrets)
└── .gitignore                  # Ignores .env files and sensitive data
```

---

## Setup Instructions

### Prerequisites
- Node.js 20+
- npm or yarn
- A Supabase project (free tier works)

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/oliver139-chinesemole/paddleiq.git
   cd paddleiq
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your Supabase credentials
   ```

4. **Set up Supabase database**
   - Create a free project at [supabase.com](https://supabase.com)
   - Open the SQL Editor in your Supabase dashboard
   - Run the contents of `supabase/schema.sql`

5. **Start the development server**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000)

> **Demo Mode:** If you don't set up Supabase, the app runs in demo mode with mock data. All pages are accessible without auth.

---

## Environment Variables

Copy `.env.example` to `.env.local` and fill in:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key  # Server-side only
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Security rules:**
- Never commit `.env.local` or any file with real credentials
- The `SUPABASE_SERVICE_ROLE_KEY` is never exposed to the browser
- All secrets go in `.env.local` (gitignored) or GitHub Secrets for CI

---

## Deployment Instructions

### Deploy to Render

1. Push this repo to GitHub (already done)
2. Go to [render.com](https://render.com) and create a new Web Service
3. Connect your GitHub repo `paddleiq`
4. Render will auto-detect `render.yaml` — review the settings
5. Add environment variables in Render dashboard:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
6. Click **Deploy**

### Automatic Redeploys
Every push to `main` will trigger a new Render deployment automatically.

### GitHub Actions CI
Every push to `main` or PR runs:
- `npm run lint` — ESLint check
- `npm run build` — Production build verification

---

## Future Roadmap

### Near Term
- [ ] Live GPS route recording for water sessions
- [ ] Supabase auth fully wired (currently in demo mode)
- [ ] Real-time team session sync
- [ ] Coach dashboard (web/tablet optimized)
- [ ] Push notifications (workout reminders, coach feedback)

### Medium Term
- [ ] AI Coach powered by Claude API with real training history
- [ ] Video technique upload and frame-by-frame review
- [ ] Wearable device integration (Garmin, Apple Watch)
- [ ] Bluetooth erg device data sync

### Long Term
- [ ] Race Prep mode with auto-generated taper plans
- [ ] Team leaderboard with public profiles
- [ ] Drag-and-drop lineup builder for coaches
- [ ] Competition results tracking and comparison

---

## Contributing

1. Fork the repo
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit changes: `git commit -m "add your feature"`
4. Push: `git push origin feature/your-feature`
5. Open a Pull Request

---

## License

MIT License — built for the dragon boat community.

---

*PaddleIQ v1.0.0 Beta — Built for dragon boat athletes worldwide.*
