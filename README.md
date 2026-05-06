# IGCSE Exam Planner — Cambridge M/J 2026

A deployment-ready React + Vite single-page application for planning Cambridge IGCSE May/June 2026 exams. Supports all 6 Cambridge administrative zones plus a dedicated UK timetable.

---

## Features

- **IP-based country detection** — auto-detects country via `ipapi.co/json()`, maps to the correct Cambridge zone
- **7 official timetables** — Zones 1–6 and a dedicated Zone 3 (UK) timetable, all sourced directly from official Cambridge International PDFs
- **Correct per-subject variants** — each subject shows only the exact paper codes present in its zone's official PDF; no phantom double-entries
- **Subject & paper selector** — expandable cards grouped by category, select all / deselect all per subject
- **April–June 2026 calendar** — fixed 76 px cells, weekend tinting, up to 3 events visible per cell
- **Full event management** — add, edit, delete events; two-tap delete confirmation
- **Collapsible side panel** — desktop; FAB + bottom sheet on mobile
- **Export PDF** — `window.print()` with `beforeprint`/`afterprint` DOM stripping; `@page { margin: 0 }` with `13mm 15mm 9mm` wrap padding
- **Export JPG** — fully programmatic Canvas 2D draw (no `html2canvas`); downloads at ~A4 300 dpi
- **Auto-save** — all state persisted to `localStorage` (key: `igcse-planner-v5`)

---

## User Flow

```
Step 0  LocationSelect   →  IP geo-detect country → searchable dropdown of 200 countries
Step 0b ZoneConfirm      →  Confirm detected zone or pick manually (Zones 1–6 + UK)
Step 1  SubjectSelect    →  Load zone-specific timetable; pick papers
Step 2  CalendarView     →  Full April–June 2026 planner; add notes; export
```

---

## Zone & Timetable Data

### Zone to timetable mapping

| Zone | Variants | Region | Cambridge PDF |
|------|----------|--------|---------------|
| Zone 1 | V1, V3 | Americas & Caribbean | 745755 |
| Zone 2 | V1 | Europe, North & West Africa | 745756 |
| Zone 3 | V1, V2 | East & South Africa, Middle East | 745758 |
| Zone 4 | V2 | South Asia (India, Pakistan, Bangladesh, Sri Lanka) | 745759 |
| Zone 5 | V2, V3 | East & South-East Asia | 745760 |
| Zone 6 | V3 | Australasia & Pacific | 745761 |
| Zone 3 (UK) | V1, V2 | United Kingdom | **745757** |

### About the UK timetable

The UK receives a dedicated Cambridge timetable (PDF 745757) that differs from the standard Zone 3 timetable in two ways:

1. **Additional subjects** only available in the UK: Latin (0480), Sanskrit (0499), Italian (0535), Malay (0546), Swahili (0262), First Language French (0501), First Language German (0505), First Language Thai (0518), First Language Turkish (0513), Literature in Spanish (0474), World Literature (0408)
2. All shared subjects have **identical dates and sessions** to standard Zone 3

United Kingdom (code `GB`) is the only country automatically routed to `timetable-zone-uk.json`. All other Zone 3 countries use `timetable-zone3.json`.

### Data files

```
public/data/
├── countries.json          200 countries with Cambridge zone mapping
├── timetable-zone1.json    Zone 1 — Americas & Caribbean
├── timetable-zone2.json    Zone 2 — Europe, N/W Africa
├── timetable-zone3.json    Zone 3 — E/S Africa, Middle East
├── timetable-zone4.json    Zone 4 — South Asia
├── timetable-zone5.json    Zone 5 — East & SE Asia
├── timetable-zone6.json    Zone 6 — Australasia & Pacific
└── timetable-zone-uk.json  Zone 3 UK — United Kingdom (51 subjects)
```

Each timetable JSON schema:

```json
{
  "zone": 4,
  "variants": [2],
  "label": "Zone 4",
  "regions": "South Asia (India, Pakistan, Bangladesh, Sri Lanka)",
  "source": "Cambridge Final Exam Timetable June 2026 — Zone 4 (official PDF 745759).",
  "subjects": [{
    "id": "0610",
    "name": "Biology",
    "code": "0610",
    "cat": "Sciences",
    "papers": [{
      "code": "0610/42",
      "v": 2,
      "name": "Paper 4 — Theory (Extended)",
      "date": "2026-04-30",
      "sess": "AM",
      "dur": "1h 15m"
    }]
  }]
}
```

`v` field: `1`, `2`, or `3` = variant number; `0` = variant-independent paper (e.g. Pakistan Studies 0448/01)

### How per-subject variants work

In multi-variant zones (1, 3, 5, UK), subjects are **not all available in every variant**. Each subject appears under exactly one variant in the official Cambridge A-Z timetable. For example, in Zone 3:

- Physics (0625) uses V1 codes: `0625/11`, `/21`, `/31`, `/41`, `/51`, `/61`
- Mathematics (0580) uses V2 codes: `0580/12`, `/22`, `/32`, `/42`

The planner generates **only** the paper codes actually present in each zone's raw PDF lookup — no phantom duplicates, no augmentation across variants. This means Physics in Zone 3 shows 6 papers, not 12.

---

## Country to Zone Mapping

`countries.json` covers 200 countries, verified against the official Cambridge administrative zone-finder tool (`cambridgeinternational.org/exam-administration/.../administrative-zone/`). Key corrections applied vs common misconceptions:

| Country | Zone | Common mistake |
|---------|------|----------------|
| United Kingdom | UK | Often assumed Zone 2 |
| UAE, Oman, Kuwait, Bahrain, Qatar, Saudi Arabia | 3 | Often assumed Zone 4 |
| Australia | 5 | Often assumed Zone 6 |
| Papua New Guinea, Solomon Islands, Vanuatu | 5 | Often assumed Zone 6 |
| New Zealand, Fiji, Tonga, Samoa | 6 | Correct |
| Thailand, Vietnam, Cambodia, Laos, Myanmar | 4 | Often assumed Zone 5 |
| Mauritius, Seychelles | 4 | Often assumed Zone 3 |
| Nigeria, Ghana, Kenya, Tanzania | 3 | Correct |

---

## Architecture

| Layer | Choice |
|-------|--------|
| Framework | React 18 + Vite 5 |
| Styling | Plain CSS (`app.css`) — no Tailwind |
| State | React `useState`/`useEffect` + `localStorage` (key: `igcse-planner-v5`) |
| Timetable data | Static JSON per zone in `/public/data/` — fetched at runtime |
| Export PDF | `window.print()` + `@media print` CSS + `beforeprint`/`afterprint` DOM strip |
| Export JPG | Programmatic Canvas 2D — no `html2canvas` |
| Backend | Supabase stub in `src/lib/supabase.js` — not active, ready for auth/sync |
| Deployment | Netlify (`netlify.toml` included) or Vercel (Vite auto-detected) |

---

## Colour Palette

```css
--bg:  #FFFFFF    --bg2: #F1EFE8    --bg3: #E8E6DF
--t1:  #2C2C2A    --t2:  #5F5E5A    --t3:  #888780    --t4: #B4B2A9
--exam-bg:  #FCEBEB   --exam-fg:  #A32D2D   --exam-bd:  #F09595
--study-bg: #E6F1FB   --study-fg: #185FA5   --study-bd: #85B7EB
```

Body background: `#F1EFE8`

---

## Getting Started

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # Output: dist/
```

## Deploy

**Netlify** — drag `dist/` into the Netlify dashboard, or connect via Git. `netlify.toml` is pre-configured.

**Vercel** — push to GitHub and import; Vite is auto-detected.

## Environment Variables (optional)

Copy `.env.example` to `.env` to enable future Supabase cloud sync:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

---

## Source File Map

```
src/
├── main.jsx                  Entry point — mounts App into #root
├── App.jsx                   Zone-based router wrapped in PlannerProvider
├── app.css                   All styles: design tokens, grid, print rules, mobile
├── context/
│   └── PlannerContext.jsx    Global state (step, country, zone, selectedCodes, events)
├── lib/
│   └── supabase.js           Supabase client stub (inactive)
├── utils/
│   ├── timetable.js          loadZoneTimetable(), buildTimetableEvents(), ZONE_INFO, date utils
│   └── jpgExport.js          drawCalendarToCanvas() — Canvas 2D A4 JPG export
└── pages/
    ├── LocationSelect.jsx    Step 0 — IP geolocation + country searchable dropdown
    ├── ZoneConfirm.jsx       Step 0b — Zone confirm / manual picker (Zones 1–6 + UK card)
    ├── SubjectSelect.jsx     Step 1 — Zone-specific paper picker, correct variants only
    └── CalendarView.jsx      Step 2 — Calendar, event CRUD, two-tap delete, export modal
```

---

## Data Accuracy Notes

- All timetable dates and sessions are taken directly from the official Cambridge International final timetable PDFs for June 2026
- Zone 3 (UK) PDF 745757 contains 51 subjects; all other zones contain 41 subjects
- The UK timetable shares all dates/sessions with standard Zone 3 for common subjects — the difference is 11 additional UK-only syllabuses
- Session times (`AM`/`PM`) are as published in the Cambridge PDFs; actual exam start times depend on your centre's Key Time — see `cambridgeinternational.org/keytime`
- If Cambridge publishes a timetable correction, update the relevant `public/data/timetable-zone*.json` file and redeploy — no code changes needed

---

## Authentication & Cloud Sync

### Overview

The app uses Supabase for cloud persistence. When Supabase is not configured (no env vars), the app runs entirely offline — localStorage only, no auth UI shown.

When Supabase **is** configured, users can sign in with Google OAuth or email/password. Their plan (zone, selected papers, all events) is synced to the cloud and survives browser clearing, device switches, and Safari's 7-day ITP purge.

### Supabase setup

1. Create a project at [supabase.com](https://supabase.com)
2. Enable **Google** as a provider under Authentication → Providers
3. Add your domain to the redirect allow-list
4. Run this SQL in the Supabase SQL editor:

```sql
create table public.planners (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete cascade unique,
  zone         text,
  country      jsonb,
  selected_codes text[],
  events       jsonb,
  updated_at   timestamptz default now()
);

alter table public.planners enable row level security;

create policy "Users own their planner"
  on public.planners for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

5. Copy your project URL and anon key into `.env`:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### Auth prompt strategy

Sign-in is never a hard wall — every prompt has a skip option. Prompts fire contextually:

| Trigger | Reason shown | When |
|---------|-------------|------|
| **Stale data banner** | "Your data may be at risk" | localStorage data is >5 days old and user not signed in |
| **5+ papers selected** | "Keep your selections safe" | One-time, fires once in Step 1 |
| **3 manual events added** | "Back up your revision plan" | One-time, fires once in Step 2 |
| **Export button** | "Save before you export" | Every export attempt; export proceeds regardless of choice |
| **Sign in button** | "Sign in to sync" | Always visible in header; user-initiated |

One-time prompts ("subjects", "events") record a dismissal timestamp in localStorage and never show again. Forced prompts ("export") always show but always have a skip.

### Sync behaviour

- **localStorage** is always written immediately on every state change (offline fallback)
- **Supabase** is written with a 1.5-second debounce to avoid excessive writes
- On sign-in, cloud data is loaded and merged with local data. If cloud is newer (by `updated_at`), cloud wins. Events from both sources are merged by ID (local wins on conflict).
