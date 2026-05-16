/**
 * Cambridge CAIE timetable PDF parser
 *
 * Handles all qualification types found in the same zone PDF:
 *   IG  = Cambridge IGCSE
 *   9-1 = Cambridge IGCSE (9–1)
 *   OL  = Cambridge O Level
 *   AS  = Cambridge International AS Level
 *   AL  = Cambridge International A Level
 *
 * Expected pdf-parse text output format (per paper line):
 *   {code}/{paper}  {paper name}  {Weekday} {D} {Month} {YYYY}  {AM|PM|EV}  {V1|V2|V3}?  {dur}
 *
 * Subject block header:
 *   {QUAL_TAG} {4-digit-code} {Subject Name}
 *
 * Example lines:
 *   IG 0580 Mathematics
 *   0580/22  Paper 2 (Extended)  Tuesday 28 April 2026  AM  V1  1h 30m
 *   OL 4024 Mathematics - Syllabus D
 *   4024/12  Paper 1  Thursday 30 April 2026  AM  V2  2h
 */

// Maps qualification tag → normalised qualification key
const QUAL_TAG_MAP = {
  'IG':  'igcse',
  '9-1': 'igcse-9-1',
  'OL':  'olevel',
  'AS':  'as',
  'AL':  'alevel',
};

// Cambridge category lookup by code prefix — rough heuristic, overridable
const CODE_CATEGORIES = {
  '0': 'IGCSE',      // 0xxx = Cambridge IGCSE
  '1': 'IGCSE 9-1',  // 1xxx = Cambridge IGCSE (9-1)
  '2': 'O Level',    // 2xxx = Cambridge O Level (language/lit)
  '4': 'O Level',    // 4xxx = Cambridge O Level
  '5': 'O Level',    // 5xxx = Cambridge O Level Sciences
  '7': 'AS/A Level', // 7xxx
  '8': 'AS/A Level', // 8xxx
  '9': 'AS/A Level', // 9xxx = Cambridge AS/A Level
};

const MONTH_MAP = {
  january:1, february:2, march:3, april:4, may:5, june:6,
  july:7, august:8, september:9, october:10, november:11, december:12,
};
const MONTHS_RE = Object.keys(MONTH_MAP).join('|');

/**
 * Parse raw text from pdf-parse into structured Cambridge timetable JSON.
 *
 * @param {string} rawText  - output of pdfParse(buffer).text
 * @param {string|number} zone - '1'–'6' | 'uk'
 * @param {string} season   - e.g. '2026-mj'
 * @returns {object} - same schema as timetable-zoneN.json
 */
export function parseCambridgeText(rawText, zone, season) {
  const lines = rawText
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean);

  const subjects = [];           // final flat subjects array
  let currentQual = null;        // 'igcse' | 'olevel' | 'as' | 'alevel' | 'igcse-9-1'
  let currentSubject = null;     // { id, name, code, cat, qualification, papers[] }

  // Regex: subject header — e.g. "IG 0580 Mathematics" or "OL 5090 Biology (Core)"
  const SUBJ_RE = /^(IG|9-1|OL|AS|AL)\s+(\d{4})\s+(.+)$/;

  // Regex: paper row — flexible to handle varied whitespace from pdf-parse
  // Groups: 1=code, 2=paper name, 3=day-of-week(ignored), 4=day, 5=month, 6=year, 7=session, 8=variant(optional), 9=duration
  const PAPER_RE = new RegExp(
    [
      /^(\d{4}\/\d{2,3}[A-Z]?)\s+/,          // paper code e.g. 0580/22  0580/12B
      /(.+?)\s+/,                              // paper name (non-greedy)
      /(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s+/,
      /(\d{1,2})\s+/,                          // day of month
      `(${MONTHS_RE})\\s+`,                    // month name
      /(20\d{2})\s+/,                          // year
      /(AM|PM|EV|Morning|Afternoon|Evening)\s+/, // session
      /(?:(V[123])\s+)?/,                      // optional variant
      /(.+)$/,                                 // duration
    ].map(r => (r instanceof RegExp ? r.source : r)).join(''),
    'i'
  );

  // Regex: variant-independent paper (v=0, no variant listed)
  // Some papers have no variant code at all — same regex but variant group is empty
  const PAPER_NOVAR_RE = new RegExp(
    [
      /^(\d{4}\/\d{2,3}[A-Z]?)\s+/,
      /(.+?)\s+/,
      /(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s+/,
      /(\d{1,2})\s+/,
      `(${MONTHS_RE})\\s+`,
      /(20\d{2})\s+/,
      /(AM|PM|EV|Morning|Afternoon|Evening)\s+/,
      /(\d.+)$/,                               // duration (no variant before it)
    ].map(r => (r instanceof RegExp ? r.source : r)).join(''),
    'i'
  );

  function normSession(s) {
    const u = s.toUpperCase();
    if (u === 'MORNING'   || u === 'AM') return 'AM';
    if (u === 'AFTERNOON' || u === 'PM') return 'PM';
    if (u === 'EVENING'   || u === 'EV') return 'EV';
    return u;
  }

  function normDuration(s) {
    // Normalise "1 hour 30 minutes" → "1h 30m", "2 hours" → "2h"
    return s.trim()
      .replace(/(\d+)\s*hours?/i, '$1h')
      .replace(/(\d+)\s*minutes?/i, '$1m')
      .replace(/(\d+)h(\d+)m/, '$1h $2m')
      .trim();
  }

  function isoDate(day, monthStr, year) {
    const m = MONTH_MAP[monthStr.toLowerCase()];
    if (!m) return null;
    return `${year}-${String(m).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
  }

  function flushSubject() {
    if (currentSubject && currentSubject.papers.length > 0) {
      subjects.push(currentSubject);
    }
    currentSubject = null;
  }

  function catForCode(code, qual) {
    if (qual === 'igcse' || qual === 'igcse-9-1') return 'Cambridge IGCSE';
    if (qual === 'olevel')  return 'Cambridge O Level';
    if (qual === 'as')      return 'Cambridge AS Level';
    if (qual === 'alevel')  return 'Cambridge A Level';
    return CODE_CATEGORIES[code[0]] || 'Other';
  }

  for (const line of lines) {
    // ── Subject header ─────────────────────────────────────────────────────
    const sh = line.match(SUBJ_RE);
    if (sh) {
      flushSubject();
      currentQual = QUAL_TAG_MAP[sh[1].toUpperCase()] || 'igcse';
      const code  = sh[2];
      const name  = sh[3].trim();
      currentSubject = {
        id:            code,
        name,
        code,
        cat:           catForCode(code, currentQual),
        qualification: currentQual,
        papers:        [],
      };
      continue;
    }

    if (!currentSubject) continue;

    // ── Paper row (with explicit variant) ──────────────────────────────────
    let pm = line.match(PAPER_RE);
    if (pm) {
      const [, paperCode, paperName, day, month, year, sess, variant, dur] = pm;
      currentSubject.papers.push({
        code: paperCode.toUpperCase(),
        name: paperName.trim(),
        date: isoDate(day, month, year),
        sess: normSession(sess),
        v:    variant ? parseInt(variant[1]) : 0,
        dur:  normDuration(dur),
      });
      continue;
    }

    // ── Paper row (no variant — variant-independent papers) ────────────────
    pm = line.match(PAPER_NOVAR_RE);
    if (pm) {
      const [, paperCode, paperName, day, month, year, sess, dur] = pm;
      currentSubject.papers.push({
        code: paperCode.toUpperCase(),
        name: paperName.trim(),
        date: isoDate(day, month, year),
        sess: normSession(sess),
        v:    0,
        dur:  normDuration(dur),
      });
    }
  }
  flushSubject();

  // Validate: warn if very few subjects parsed (likely format mismatch)
  if (subjects.length < 5) {
    console.warn(`[cambridge-parser] Only ${subjects.length} subjects parsed for zone=${zone}. Check PDF format.`);
  }

  return buildOutput(subjects, zone, season);
}

function buildOutput(subjects, zone, season) {
  const zoneNum  = zone === 'uk' ? 'uk' : Number(zone);
  const isUK     = zone === 'uk';

  // Derive variant list from what was actually found in the PDF
  const variantSet = new Set();
  subjects.forEach(s => s.papers.forEach(p => { if (p.v > 0) variantSet.add(p.v); }));
  const variants = [...variantSet].sort();

  // Build label and regions (matches ZONE_INFO in timetable.js)
  const ZONE_META = {
    1:   { label: 'Zone 1',      regions: 'Americas & Caribbean'              },
    2:   { label: 'Zone 2',      regions: 'Europe, North & West Africa'       },
    3:   { label: 'Zone 3',      regions: 'East & South Africa, Middle East'  },
    4:   { label: 'Zone 4',      regions: 'South Asia (India, Pakistan, etc.)'},
    5:   { label: 'Zone 5',      regions: 'East & South-East Asia'            },
    6:   { label: 'Zone 6',      regions: 'Australasia & Pacific'             },
    uk:  { label: 'Zone 3 (UK)', regions: 'United Kingdom'                    },
  };
  const meta = ZONE_META[zoneNum] || { label: `Zone ${zone}`, regions: '' };

  return {
    curriculum:    'cambridge',
    qualification: 'igcse',           // legacy field — subjects have individual .qualification
    zone:          zoneNum,
    variants,
    label:         meta.label,
    regions:       meta.regions,
    season,
    parsed:        true,              // flag: came from parser, not static JSON
    parsed_at:     new Date().toISOString(),
    subjects,                         // flat array — same as static timetable-zoneN.json
  };
}
