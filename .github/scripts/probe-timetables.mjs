/**
 * .github/scripts/probe-timetables.mjs
 *
 * Runs in GitHub Actions (Node 20, ESM).
 * 1. Builds candidate PDF URLs for the next season(s) for each board.
 * 2. HEAD-requests each URL to check if the PDF has been published.
 * 3. For any newly-found PDFs: inserts into timetable_sources and triggers
 *    the parse-timetable API to pre-warm the Supabase cache.
 * 4. Sets GitHub Actions output variables so the workflow can create an issue.
 */

import { createClient } from '@supabase/supabase-js';

// ── Supabase ──────────────────────────────────────────────────────────────────
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

// ── GitHub Actions output helper ──────────────────────────────────────────────
function setOutput(name, value) {
  // GitHub Actions output syntax
  process.stdout.write(`::set-output name=${name}::${value}\n`);
}

// ── Candidate URL generators per board ───────────────────────────────────────
//
// These encode each board's URL pattern. When a new season is released,
// the board typically uses a predictable slug. We probe several candidates.
//
// Cambridge: PDF IDs are NOT predictable (e.g. 745759 for Zone 4 2026-mj).
// So we probe the Cambridge timetables *listing page* for new PDF links,
// then extract them. For simplicity in v1, we probe a known pattern and
// flag for manual review if the ID can't be guessed.
//
// Pearson: URL slug is fully predictable:
//   int-gcse-summer-{YEAR}-final.pdf
//   ial-summer-{YEAR}-final.pdf
//   gcse-summer-{YEAR}-final.pdf

const CURRENT_YEAR = new Date().getFullYear();
const NEXT_YEAR    = CURRENT_YEAR + 1;

// Pearson candidate URLs — check both current and next year
function pearsonCandidates() {
  const years  = [CURRENT_YEAR, NEXT_YEAR];
  const boards = [
    {
      curriculum: 'edexcel-igcse',
      slug:       'int-gcse-summer',
      basePath:   'https://qualifications.pearson.com/content/dam/pdf/Support/Examination-timetables-for-International-GCSE',
      season:     (y) => `${y}-summer`,
      label:      (y) => `Edexcel International GCSE · Summer ${y}`,
    },
    {
      curriculum: 'edexcel-ial',
      slug:       'ial-summer',
      basePath:   'https://qualifications.pearson.com/content/dam/pdf/Support/Examination-timetables-for-IAL',
      season:     (y) => `${y}-summer`,
      label:      (y) => `Edexcel IAL · Summer ${y}`,
    },
    {
      curriculum: 'edexcel-gcse',
      slug:       'gcse-summer',
      basePath:   'https://qualifications.pearson.com/content/dam/pdf/Support/Examination-timetables-for-UK-Edexcel-GCSE',
      season:     (y) => `${y}-summer`,
      label:      (y) => `Edexcel GCSE · Summer ${y}`,
    },
  ];

  const candidates = [];
  for (const board of boards) {
    for (const y of years) {
      candidates.push({
        curriculum: board.curriculum,
        season:     board.season(y),
        zone:       '',
        url:        `${board.basePath}/${board.slug}-${y}-final.pdf`,
        label:      board.label(y),
      });
    }
  }
  return candidates;
}

// Cambridge: scrape the main timetables page to find PDF links dynamically.
// The page lists all zone PDFs with their document IDs.
async function cambridgeCandidates() {
  const candidates = [];
  try {
    const res = await fetch(
      'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-igcse/cambridge-igcse-timetables/',
      {
        headers: { 'User-Agent': 'IGCSEPlanner-probe/1.0 (+https://igcseplanner.vercel.app)' },
        signal:  AbortSignal.timeout(10_000),
      }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();

    // Extract PDF links — Cambridge uses /Images/{ID}-june-{YEAR}-...-zone-{N}.pdf
    const pdfRe = /href="(\/Images\/(\d{6})-[^"]*june-(\d{4})[^"]*zone-([1-6uk]+)[^"]*\.pdf)"/gi;
    let m;
    while ((m = pdfRe.exec(html)) !== null) {
      const [, path, docId, year, rawZone] = m;
      const zone   = rawZone === 'uk' ? 'uk' : rawZone;
      const season = `${year}-mj`;
      candidates.push({
        curriculum: 'cambridge',
        season,
        zone,
        url:   `https://www.cambridgeinternational.org${path}`,
        label: `Cambridge Zone ${zone} · M/J ${year}`,
      });
    }
  } catch (e) {
    console.error('[probe] Failed to scrape Cambridge timetables page:', e.message);
    // Fallback: don't add any Cambridge candidates this run
  }
  return candidates;
}

// ── HTTP HEAD check ───────────────────────────────────────────────────────────
async function pdfExists(url) {
  try {
    const res = await fetch(url, {
      method:  'HEAD',
      headers: {
        'User-Agent': 'IGCSEPlanner-probe/1.0 (+https://igcseplanner.vercel.app)',
        'Accept':     'application/pdf,*/*',
      },
      signal: AbortSignal.timeout(8_000),
    });
    // 200 = exists, 206 = partial (also means file is there), anything else = not available
    return res.status === 200 || res.status === 206;
  } catch {
    return false;
  }
}

// ── Trigger pre-warm parse on the Vercel API ──────────────────────────────────
async function triggerParse(curriculum, season, zone) {
  const base   = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'https://igcseplanner.vercel.app';
  const params = new URLSearchParams({ curriculum, season, force: 'true' });
  if (zone) params.set('zone', zone);
  const url = `${base}/api/parse-timetable?${params}`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(90_000) });
    const data = await res.json();
    const count = data.subjects?.length ?? data.categories?.reduce(
      (n, c) => n + (c.subjects?.length ?? 0), 0
    ) ?? 0;
    return { ok: res.ok, status: res.status, subjectCount: count };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`[probe] Starting timetable probe — ${new Date().toISOString()}`);

  // Fetch all already-known sources from Supabase
  const { data: existingSources } = await supabase
    .from('timetable_sources')
    .select('curriculum, season, zone');

  const knownKeys = new Set(
    (existingSources || []).map(r => `${r.curriculum}|${r.season}|${r.zone}`)
  );

  // Build all candidates
  const candidates = [
    ...pearsonCandidates(),
    ...(await cambridgeCandidates()),
  ];

  // Deduplicate candidates
  const seen = new Set();
  const uniqueCandidates = candidates.filter(c => {
    const k = `${c.curriculum}|${c.season}|${c.zone}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  console.log(`[probe] Checking ${uniqueCandidates.length} candidate URLs…`);

  const newlyFound   = [];
  const parseResults = [];

  for (const candidate of uniqueCandidates) {
    const key = `${candidate.curriculum}|${candidate.season}|${candidate.zone}`;
    const isKnown = knownKeys.has(key);

    process.stdout.write(`  ${isKnown ? '·' : '?'} ${candidate.label} … `);
    const exists = await pdfExists(candidate.url);
    console.log(exists ? '✓ found' : '✗ not yet');

    if (!exists) continue;

    if (!isKnown) {
      // New timetable found — insert into timetable_sources
      console.log(`  → NEW: inserting ${key}`);
      const { error } = await supabase
        .from('timetable_sources')
        .upsert({
          curriculum:  candidate.curriculum,
          season:      candidate.season,
          zone:        candidate.zone,
          label:       candidate.label,
          source_url:  candidate.url,
          status:      'released',
          released_on: new Date().toISOString().slice(0, 10),
        }, { onConflict: 'curriculum,season,zone' });

      if (error) {
        console.error(`  ✗ Insert failed: ${error.message}`);
        continue;
      }
      newlyFound.push(candidate);
    }

    // Pre-warm cache for new sources (or all if FORCE_PARSE=true)
    const shouldParse = !isKnown || process.env.FORCE_PARSE === 'true';
    if (shouldParse) {
      process.stdout.write(`  → Triggering parse for ${candidate.label} … `);
      const result = await triggerParse(
        candidate.curriculum, candidate.season, candidate.zone
      );
      parseResults.push({ ...candidate, ...result });
      console.log(result.ok
        ? `✓ parsed (${result.subjectCount} subjects)`
        : `✗ parse failed: ${result.error || result.status}`
      );
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n[probe] Summary:');
  console.log(`  Candidates checked: ${uniqueCandidates.length}`);
  console.log(`  New timetables:     ${newlyFound.length}`);
  console.log(`  Parse jobs run:     ${parseResults.length}`);

  if (newlyFound.length > 0) {
    const summaryLines = newlyFound.map(c => {
      const r = parseResults.find(p => p.curriculum === c.curriculum && p.season === c.season && p.zone === c.zone);
      const parseStatus = r?.ok ? `✓ cached (${r.subjectCount} subjects)` : `⚠ parse pending`;
      return `- **${c.label}**: ${c.url}\n  Parse: ${parseStatus}`;
    });

    setOutput('new_found', 'true');
    setOutput('new_summary', summaryLines.join('\n'));
  } else {
    setOutput('new_found', 'false');
    setOutput('new_summary', 'No new timetables found.');
    console.log('[probe] No new timetables found. All up to date.');
  }

  process.exit(0);
}

main().catch(e => {
  console.error('[probe] Fatal error:', e);
  setOutput('new_found', 'false');
  process.exit(1);
});
