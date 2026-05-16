/**
 * Pearson Edexcel timetable PDF parser
 * Covers: International GCSE (4XX1), IAL (WXX), GCSE UK+International (1XX0)
 *
 * All three share the same underlying PDF layout from Pearson,
 * so one parser handles all three with minor per-variant logic.
 *
 * Typical pdf-parse text line patterns:
 *
 * IGCSE / GCSE subject block:
 *   4BI1  Biology
 *   4BI1 01  Paper 1                    12 May 2026  Afternoon  2 hours
 *   4BI1 02  Paper 2                    08 Jun 2026  Morning    1 hour 15 minutes
 *
 * IAL subject block:
 *   WBI Biology
 *   WBI11/01  Unit 1 – Lifestyle, Transport…   05 May 2026  Afternoon  1 hour 30 minutes
 *
 * Pearson uses "Morning" / "Afternoon" / "Window" (not AM/PM).
 * Durations written as "2 hours" / "1 hour 15 minutes" / "35 minutes".
 *
 * Foundation/Higher tier:
 *   4MA1 1F  Paper 1 (Foundation)  14 May 2026  Morning  2 hours
 *   4MA1 1H  Paper 1 (Higher)      14 May 2026  Morning  2 hours
 */

const MONTH_MAP = {
  jan:1, feb:2, mar:3, apr:4, may:5, jun:6,
  jul:7, aug:8, sep:9, oct:10, nov:11, dec:12,
  january:1,february:2,march:3,april:4,june:6,
  july:7,august:8,september:9,october:10,november:11,december:12,
};

function isoDate(day, monthStr, year) {
  const key = monthStr.toLowerCase().slice(0, 3);
  const m   = MONTH_MAP[key];
  if (!m || !year) return null;
  return `${year}-${String(m).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
}

function normSession(s) {
  const u = s.trim().toLowerCase();
  if (u === 'morning')   return 'AM';
  if (u === 'afternoon') return 'PM';
  if (u === 'window')    return 'Window';
  if (u === 'am')        return 'AM';
  if (u === 'pm')        return 'PM';
  return s.toUpperCase();
}

function normDuration(s) {
  if (!s) return '';
  return s.trim()
    .replace(/(\d+)\s*hours?/i, '$1h')
    .replace(/(\d+)\s*minutes?/i, '$1m')
    .replace(/(\d+)h\s*(\d+)m/i, '$1h $2m')
    .replace(/(\d+)h$/, '$1h')
    .replace(/(\d+)m$/, '$1m')
    .trim();
}

// ── Code classification ──────────────────────────────────────────────────────

function qualFromCode(code, curriculum) {
  if (curriculum === 'edexcel-ial')    return 'ial';
  if (curriculum === 'edexcel-igcse')  return 'igcse-international';
  if (curriculum === 'edexcel-gcse')   return 'gcse';
  return 'gcse';
}

function catFromSubjectName(name) {
  const n = name.toLowerCase();
  if (/biology|chemistry|physics|science|human bio|sehs|ess/.test(n)) return 'Sciences';
  if (/math|statistics|further pure|mechanics|decision/.test(n))       return 'Mathematics';
  if (/english|literature/.test(n))                                    return 'English';
  if (/french|german|spanish|arabic|chinese|mandarin|japanese|swahili|tamil|sinhala|bangla|greek|urdu|gujarati|italian|portuguese|russian|turkish|persian|biblical/.test(n)) return 'Languages';
  if (/history|geography|religious|citizenship|global|pakistan|bangladesh|islamic/.test(n)) return 'Humanities';
  if (/business|economics|accounting|commerce|psychology/.test(n))     return 'Business & Economics';
  if (/computer|ict|information/.test(n))                              return 'ICT & Computing';
  if (/drama|music|art|design|physical|pe|astronomy/.test(n))          return 'Arts & PE';
  return 'Other';
}

// ── Main parse function ──────────────────────────────────────────────────────

/**
 * @param {string} rawText    - pdf-parse text output
 * @param {string} curriculum - 'edexcel-igcse' | 'edexcel-ial' | 'edexcel-gcse'
 * @param {string} season     - e.g. '2026-summer'
 * @returns {object}          - same schema as /public/data/edexcel/*.json
 */
export function parsePearsonText(rawText, curriculum, season) {
  const lines = rawText
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean);

  // ── Code patterns ──────────────────────────────────────────────────────────
  // IGCSE/GCSE subject header: "4BI1" or "4BI1  Biology" or "1MA1  Mathematics"
  const IGCSE_SUBJ_RE = /^([14][A-Z]{2}[0-9]|[14][A-Z]{3})\s{2,}(.+)$/;

  // IGCSE paper row: "4BI1 01  Paper 1  12 May 2026  Afternoon  2 hours"
  // Also handles: "4MA1 1F  Paper 1 (Foundation)  ..."
  const IGCSE_PAPER_RE = /^([14][A-Z]{2}[0-9]\/[0-9A-Z]{1,4}|[14][A-Z]{2,3}\s+[0-9][A-Z0-9]?)\s{2,}(.+?)\s{2,}(\d{1,2})\s+(\w+)\s+(20\d{2})\s{2,}(\w+(?:\s+\w+)?)\s{2,}(.+)$/i;

  // IAL subject header: "WBI  Biology" or "WBI Biology"
  const IAL_SUBJ_RE = /^(W[A-Z]{2,3})\s{2,}(.+)$/;

  // IAL paper row: "WBI11/01  Unit 1 – ...  05 May 2026  Afternoon  1 hour 30 minutes"
  const IAL_PAPER_RE = /^(W[A-Z]{2,3}\d{2,3}\/\d{2}|[A-Z]{2,4}\d{2}\/\d{2})\s{2,}(.+?)\s{2,}(\d{1,2})\s+(\w+)\s+(20\d{2})\s{2,}(\w+(?:\s+\w+)?)\s{2,}(.+)$/i;

  // Generic date+session+duration at end of any line — fallback matcher
  const DATE_RE = /(\d{1,2})\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(20\d{2})/i;
  const SESS_RE = /(Morning|Afternoon|Window|AM|PM)/i;
  const DUR_RE  = /(\d+\s*h(?:ours?)?\s*\d*\s*m(?:inutes?)?|\d+\s*m(?:inutes?)|\d+\s*h(?:ours?))/i;

  const isIAL  = curriculum === 'edexcel-ial';

  // Collect all subjects as a flat list, then group by category
  const subjectsMap = new Map(); // code → subject object
  let currentSubjCode = null;

  function getOrCreate(code, name) {
    if (!subjectsMap.has(code)) {
      subjectsMap.set(code, {
        id:   code.toLowerCase().replace(/[^a-z0-9]/g, '-'),
        name,
        code,
        cat:  catFromSubjectName(name),
        qualification: qualFromCode(code, curriculum),
        papers: [],
      });
    }
    return subjectsMap.get(code);
  }

  function tryParsePaperLine(line) {
    // Try the specific regexes first
    const re = isIAL ? IAL_PAPER_RE : IGCSE_PAPER_RE;
    const m  = line.match(re);
    if (m) {
      const [, rawCode, paperName, day, month, year, sess, dur] = m;
      const paperCode = rawCode.replace(/\s+/, '/').toUpperCase();
      return { paperCode, paperName: paperName.trim(), day, month, year, sess, dur };
    }

    // Fallback: try to extract date+session+duration from anywhere in line
    const dm = line.match(DATE_RE);
    const sm = line.match(SESS_RE);
    const um = line.match(DUR_RE);
    if (dm && sm && um) {
      // Extract paper code from start of line
      const codeMatch = line.match(/^([14W][A-Z0-9\/]{3,10})/);
      if (codeMatch) {
        const paperCode = codeMatch[1];
        const paperName = line
          .slice(paperCode.length)
          .replace(DATE_RE, '').replace(SESS_RE, '').replace(DUR_RE, '')
          .trim();
        return {
          paperCode: paperCode.toUpperCase(),
          paperName,
          day:   dm[1], month: dm[2], year: dm[3],
          sess:  sm[1], dur:   um[1],
        };
      }
    }
    return null;
  }

  for (const line of lines) {
    // ── Subject header detection ───────────────────────────────────────────
    const shRe = isIAL ? IAL_SUBJ_RE : IGCSE_SUBJ_RE;
    const sh   = line.match(shRe);
    if (sh && !line.match(DATE_RE)) {  // don't misparse paper lines as headers
      currentSubjCode = sh[1].toUpperCase();
      getOrCreate(currentSubjCode, sh[2].trim());
      continue;
    }

    // ── Paper row ──────────────────────────────────────────────────────────
    const parsed = tryParsePaperLine(line);
    if (parsed) {
      const { paperCode, paperName, day, month, year, sess, dur } = parsed;

      // Resolve subject: paper code starts with subject code
      let subjCode = currentSubjCode;
      if (!subjCode) {
        // Infer from paper code: e.g. "4BI1/01" → "4BI1", "WBI11/01" → "WBI"
        subjCode = isIAL
          ? paperCode.replace(/\d{2,}\/.*$/, '')
          : paperCode.replace(/\/.*$/, '');
      }

      const subj = subjectsMap.get(subjCode);
      if (!subj) continue; // orphaned paper, skip

      subj.papers.push({
        code: paperCode,
        name: paperName,
        date: isoDate(day, month, year),
        sess: normSession(sess),
        v:    0,                       // Pearson has no variant system
        dur:  normDuration(dur),
      });
    }
  }

  const subjects = [...subjectsMap.values()].filter(s => s.papers.length > 0);

  if (subjects.length < 3) {
    console.warn(`[pearson-parser] Only ${subjects.length} subjects parsed for ${curriculum}. Check PDF format.`);
  }

  return buildPearsonOutput(subjects, curriculum, season);
}

function buildPearsonOutput(subjects, curriculum, season) {
  // Group subjects by category
  const catMap = new Map();
  for (const subj of subjects) {
    if (!catMap.has(subj.cat)) catMap.set(subj.cat, []);
    catMap.get(subj.cat).push(subj);
  }

  const CURRICULUM_META = {
    'edexcel-igcse': { label: 'Edexcel International GCSE',    qualification: 'igcse' },
    'edexcel-ial':   { label: 'Edexcel International A Level', qualification: 'ial'   },
    'edexcel-gcse':  { label: 'Edexcel GCSE',                  qualification: 'gcse'  },
  };
  const meta = CURRICULUM_META[curriculum] || { label: curriculum, qualification: 'gcse' };

  return {
    curriculum,
    qualification: meta.qualification,
    label:         meta.label,
    session:       season,
    note:          'Single global timetable — no zone system. Parsed from official Pearson PDF.',
    parsed:        true,
    parsed_at:     new Date().toISOString(),
    categories: [...catMap.entries()].map(([catName, catSubjects]) => ({
      id:       catName.toLowerCase().replace(/[^a-z0-9]/g, '-'),
      name:     catName,
      subjects: catSubjects,
    })),
  };
}
