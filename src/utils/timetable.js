/**
 * Timetable utilities for IGCSE Planner (zone-based, M/J 2026)
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

/**
 * Load the timetable for a specific zone key (1–6 or "uk").
 * Returns the parsed JSON object.
 */
export async function loadZoneTimetable(zoneKey) {
  const slug = zoneKey === 'uk' ? 'zone-uk' : `zone${zoneKey}`;
  const res  = await fetch(`/data/timetable-${slug}.json`);
  if (!res.ok) throw new Error(`Failed to load timetable for zone ${zoneKey}`);
  return res.json();
}

/**
 * Load countries list.
 */
export async function loadCountries() {
  const res = await fetch('/data/countries.json');
  if (!res.ok) throw new Error('Failed to load countries');
  return res.json();
}

/**
 * Given a timetable subject + paper, build the event id.
 */
export function paperEventId(code) {
  return 'tt-' + code.replace(/\//g, '_');
}

/**
 * Build timetable events from selected paper codes + timetable data.
 */
export function buildTimetableEvents(timetableData, selectedCodes) {
  const events = [];
  for (const subj of timetableData.subjects) {
    for (const paper of subj.papers) {
      if (selectedCodes.has(paper.code)) {
        // Show variant badge in the event label when the paper is variant-based (v > 0)
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

/** Zone metadata lookup — supports numeric zones 1–6 and "uk" */
export const ZONE_INFO = {
  1:  { label: 'Zone 1',       regions: 'Americas & Caribbean',                 variants: [1, 3] },
  2:  { label: 'Zone 2',       regions: 'Europe, North & West Africa',          variants: [1]    },
  3:  { label: 'Zone 3',       regions: 'East & South Africa, Middle East',     variants: [1, 2] },
  4:  { label: 'Zone 4',       regions: 'South Asia (India, Pakistan, etc.)',   variants: [2]    },
  5:  { label: 'Zone 5',       regions: 'East & South-East Asia',               variants: [2, 3] },
  6:  { label: 'Zone 6',       regions: 'Australasia & Pacific',                variants: [3]    },
  uk: { label: 'Zone 3 (UK)',  regions: 'United Kingdom',                       variants: [1, 2], isUK: true },
};
