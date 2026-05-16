/**
 * Timetable utilities — multi-curriculum (Cambridge IGCSE, Edexcel IGCSE/IAL, IB DP)
 */

/** Zero-pad → "YYYY-MM-DD" */
export function dateKey(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** "2026-05-08" → "Thu 8 May" */
export function fmtDateLong(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return new Date(+y, +m - 1, +d).toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short',
  });
}

/** "2026-05-08" → "8 May" */
export function fmtDateShort(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return new Date(+y, +m - 1, +d).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short',
  });
}

// ── Season detection ──────────────────────────────────────────────────────
// Default active season — updated here once per year when new timetables drop.
// The API will serve whichever season the user selects (future: season picker UI).
export const ACTIVE_SEASON = {
  cambridge:     '2026-mj',
  'edexcel-igcse': '2026-summer',
  'edexcel-ial':   '2026-summer',
  'edexcel-gcse':  '2026-summer',
  'ib-dp':         '2026-may',  // IB stays static for now
};

// Static fallback URLs — used if API is unavailable (e.g. Vercel free tier timeout)
const STATIC_FALLBACK = {
  cambridge:       (zone) => {
    const slug = zone === 'uk' ? 'zone-uk' : `zone${zone}`;
    return `/data/timetable-${slug}.json`;
  },
  'edexcel-igcse': () => '/data/edexcel/igcse.json',
  'edexcel-ial':   () => '/data/edexcel/ial.json',
  'edexcel-gcse':  () => '/data/edexcel/gcse.json',
  'ib-dp':         () => '/data/ib/may-2026.json',
};

/**
 * Core loader — API-first, static fallback.
 * @param {string} curriculum
 * @param {string} zone        - Cambridge zone ('1'–'6'|'uk') or '' for others
 * @param {string} [season]    - defaults to ACTIVE_SEASON[curriculum]
 */
async function loadTimetable(curriculum, zone = '', season) {
  const activeSeason = season || ACTIVE_SEASON[curriculum];

  // IB stays as static JSON until we resolve the 403 issue
  if (curriculum === 'ib-dp') {
    const res = await fetch('/data/ib/may-2026.json');
    if (!res.ok) throw new Error('Failed to load IB timetable');
    return res.json();
  }

  // Build API URL
  const params = new URLSearchParams({ curriculum, season: activeSeason });
  if (zone) params.set('zone', zone);
  const apiUrl = `/api/parse-timetable?${params}`;

  // Try API first (with a 15s timeout so we don't hang the UI)
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    const res = await fetch(apiUrl, { signal: controller.signal });
    clearTimeout(timer);

    if (res.ok) {
      const json = await res.json();
      // Sanity check: make sure we got usable data
      const hasData = json.subjects?.length > 0 ||
        json.categories?.some(c => c.subjects?.length > 0);
      if (hasData) return json;
      console.warn('[timetable] API returned empty data, falling back to static');
    } else {
      console.warn(`[timetable] API ${res.status} for ${curriculum}/${zone}, falling back`);
    }
  } catch (e) {
    console.warn(`[timetable] API unavailable (${e.message}), falling back to static JSON`);
  }

  // Static fallback
  const fallbackFn = STATIC_FALLBACK[curriculum];
  if (!fallbackFn) throw new Error(`No fallback for curriculum: ${curriculum}`);
  const fallbackUrl = fallbackFn(zone);
  const res = await fetch(fallbackUrl);
  if (!res.ok) throw new Error(`Failed to load fallback timetable: ${fallbackUrl}`);
  return res.json();
}

// ── Public loaders ────────────────────────────────────────────────────────

/** Load Cambridge IGCSE timetable for a zone. */
export async function loadZoneTimetable(zoneKey, season) {
  return loadTimetable('cambridge', String(zoneKey), season);
}

/** Load non-Cambridge timetable (Edexcel IGCSE/IAL/GCSE, IB). */
export async function loadCurriculumData(curriculum, season) {
  return loadTimetable(curriculum, '', season);
}

/** Load available seasons from API (for future season-picker UI). */
export async function loadAvailableSeasons() {
  try {
    const res = await fetch('/api/parse-timetable?action=seasons');
    if (res.ok) return res.json();
  } catch {}
  return { seasons: [] };
}

export async function loadCountries() {
  const res = await fetch('/data/countries.json');
  if (!res.ok) throw new Error('Failed to load countries');
  return res.json();
}

// ── Paper event ID ────────────────────────────────────────────────────────

export function paperEventId(code) {
  return 'tt-' + code.replace(/[/\s]/g, '_');
}

// ── Event builders ────────────────────────────────────────────────────────

/** Cambridge IGCSE — flat subjects[] with papers[] */
export function buildTimetableEvents(timetableData, selectedCodes) {
  const events = [];
  for (const subj of timetableData.subjects) {
    for (const paper of subj.papers) {
      if (selectedCodes.has(paper.code)) {
        const varLabel = paper.v > 0 ? ` (V${paper.v})` : '';
        events.push({
          id:       paperEventId(paper.code),
          date:     paper.date,
          type:     'exam',
          subject:  `${subj.name}${varLabel} — ${paper.code}`,
          time:     paper.sess,
          duration: paper.dur,
          note:     '',
          source:   'timetable',
        });
      }
    }
  }
  return events;
}

/** Edexcel IGCSE / IAL — categories[{subjects[{papers[]}]}] */
export function buildEdexcelEvents(data, selectedCodes) {
  const events = [];
  for (const cat of data.categories) {
    for (const subj of cat.subjects) {
      for (const paper of subj.papers) {
        if (selectedCodes.has(paper.code)) {
          events.push({
            id:       paperEventId(paper.code),
            date:     paper.date,
            type:     'exam',
            subject:  `${subj.name} — ${paper.name} (${paper.code})`,
            time:     paper.sess,
            duration: paper.dur,
            note:     '',
            source:   'timetable',
          });
        }
      }
    }
  }
  return events;
}

/** IB DP — categories[{subjects[{papers[level]}]}] */
export function buildIBEvents(data, selectedCodes) {
  const events = [];
  for (const cat of data.categories) {
    for (const subj of cat.subjects) {
      for (const paper of subj.papers) {
        if (selectedCodes.has(paper.code)) {
          const levelLabel = paper.level ? ` ${paper.level}` : '';
          events.push({
            id:       paperEventId(paper.code),
            date:     paper.date,
            type:     'exam',
            subject:  `${subj.name}${levelLabel} — ${paper.name}`,
            time:     paper.sess,
            duration: paper.dur,
            note:     '',
            source:   'timetable',
          });
        }
      }
    }
  }
  return events;
}

/** Unified router */
export function buildEventsForCurriculum(curriculum, data, selectedCodes) {
  if (curriculum === 'cambridge')     return buildTimetableEvents(data, selectedCodes);
  if (curriculum === 'edexcel-igcse' || curriculum === 'edexcel-ial' || curriculum === 'edexcel-gcse') return buildEdexcelEvents(data, selectedCodes);
  if (curriculum === 'ib-dp')         return buildIBEvents(data, selectedCodes);
  return [];
}

/** Flatten Edexcel/IB categories into subjects[] with cat name attached */
export function flattenCategories(data) {
  const subjects = [];
  for (const cat of data.categories) {
    for (const subj of cat.subjects) {
      subjects.push({ ...subj, cat: cat.name });
    }
  }
  return subjects;
}

// ── Curriculum metadata ───────────────────────────────────────────────────

export const CURRICULUM_INFO = {
  'cambridge':     { label: 'Cambridge IGCSE',               shortLabel: 'Cambridge IGCSE', session: 'M/J 2026 · April – June'  },
  'edexcel-gcse': { label: 'Edexcel GCSE',              shortLabel: 'Edexcel GCSE',  session: 'Summer 2026 · May – June' },
  'edexcel-igcse': { label: 'Edexcel International GCSE',    shortLabel: 'Edexcel IGCSE',   session: 'Summer 2026 · May – June' },
  'edexcel-ial':   { label: 'Edexcel International A Level', shortLabel: 'Edexcel IAL',     session: 'Summer 2026 · May – June' },
  'ib-dp':         { label: 'IB Diploma Programme',          shortLabel: 'IB DP',           session: 'May 2026 · April – May'   },
};

/** Calendar months to show per curriculum */
export function getCalendarMonths(curriculum) {
  if (curriculum === 'ib-dp') {
    return [
      { y: 2026, m: 3, name: 'April 2026', id: 'c-apr' },
      { y: 2026, m: 4, name: 'May 2026',   id: 'c-may' },
    ];
  }
  if (curriculum === 'edexcel-igcse' || curriculum === 'edexcel-ial' || curriculum === 'edexcel-gcse') {
    return [
      { y: 2026, m: 4, name: 'May 2026',  id: 'c-may' },
      { y: 2026, m: 5, name: 'June 2026', id: 'c-jun' },
    ];
  }
  // Cambridge default: April + May + June
  return [
    { y: 2026, m: 3, name: 'April 2026', id: 'c-apr' },
    { y: 2026, m: 4, name: 'May 2026',   id: 'c-may' },
    { y: 2026, m: 5, name: 'June 2026',  id: 'c-jun' },
  ];
}

/** Zone metadata — Cambridge only */
export const ZONE_INFO = {
  1:  { label: 'Zone 1',      regions: 'Americas & Caribbean',               variants: [1, 3] },
  2:  { label: 'Zone 2',      regions: 'Europe, North & West Africa',        variants: [1]    },
  3:  { label: 'Zone 3',      regions: 'East & South Africa, Middle East',   variants: [1, 2] },
  4:  { label: 'Zone 4',      regions: 'South Asia (India, Pakistan, etc.)', variants: [2]    },
  5:  { label: 'Zone 5',      regions: 'East & South-East Asia',             variants: [2, 3] },
  6:  { label: 'Zone 6',      regions: 'Australasia & Pacific',              variants: [3]    },
  uk: { label: 'Zone 3 (UK)', regions: 'United Kingdom',                     variants: [1, 2], isUK: true },
};
