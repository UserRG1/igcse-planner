/**
 * tools/inspect-pdf.mjs
 *
 * Run this locally to:
 *   1. Inspect the raw text output of any exam board PDF
 *   2. Validate the parser produces subjects correctly
 *   3. Upload the PDF to Supabase Storage ready for the API
 *
 * Usage:
 *   node tools/inspect-pdf.mjs inspect  <path-to-pdf> <curriculum> <zone-or-blank>
 *   node tools/inspect-pdf.mjs validate <path-to-pdf> <curriculum> <season> <zone-or-blank>
 *   node tools/inspect-pdf.mjs upload   <path-to-pdf> <curriculum> <season> <zone-or-blank>
 *
 * Examples:
 *   node tools/inspect-pdf.mjs inspect  ~/Downloads/zone4.pdf cambridge 4
 *   node tools/inspect-pdf.mjs validate ~/Downloads/zone4.pdf cambridge 2026-mj 4
 *   node tools/inspect-pdf.mjs upload   ~/Downloads/zone4.pdf cambridge 2026-mj 4
 *   node tools/inspect-pdf.mjs upload   ~/Downloads/igcse.pdf  edexcel-igcse 2026-summer
 *   node tools/inspect-pdf.mjs upload   ~/Downloads/ial.pdf    edexcel-ial   2026-summer
 *   node tools/inspect-pdf.mjs upload   ~/Downloads/gcse.pdf   edexcel-gcse  2026-summer
 */

import fs        from 'fs';
import path      from 'path';
import pdfParse  from 'pdf-parse/lib/pdf-parse.js';
import { createClient } from '@supabase/supabase-js';
import { parseCambridgeText } from '../api/parsers/cambridge.js';
import { parsePearsonText }   from '../api/parsers/pearson.js';

// Load .env.local manually (no dotenv dependency)
function loadEnv() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) {
    console.error('Missing .env.local — copy .env.example and fill it in');
    process.exit(1);
  }
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const [k, ...vParts] = line.split('=');
    if (k && !k.startsWith('#') && vParts.length) {
      process.env[k.trim()] = vParts.join('=').trim();
    }
  }
}

function getSupabase() {
  loadEnv();
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local');
    process.exit(1);
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

function storageKey(curriculum, season, zone) {
  const file = zone ? `zone-${zone}.pdf` : 'global.pdf';
  return `${curriculum}/${season}/${file}`;
}

// ── Commands ───────────────────────────────────────────────────────────────────

async function inspect(pdfPath, curriculum, zone) {
  console.log(`\nInspecting: ${pdfPath}`);
  const buf  = fs.readFileSync(pdfPath);
  const data = await pdfParse(buf);
  const lines = data.text.split('\n').map(l => l.trimEnd()).filter(l => l.trim());

  console.log(`\nTotal non-empty lines: ${lines.length}`);
  console.log(`\n${'═'.repeat(70)}`);
  console.log('LINES 1–150 (look for subject headers and paper rows):');
  console.log('═'.repeat(70));
  lines.slice(0, 150).forEach((l, i) => {
    console.log(`${String(i + 1).padStart(4)} │ ${JSON.stringify(l)}`);
  });
  console.log(`\n${'═'.repeat(70)}`);
  console.log('LINES 150–250:');
  console.log('═'.repeat(70));
  lines.slice(150, 250).forEach((l, i) => {
    console.log(`${String(i + 151).padStart(4)} │ ${JSON.stringify(l)}`);
  });
}

async function validate(pdfPath, curriculum, season, zone) {
  console.log(`\nValidating parser for: ${curriculum}/${season}/zone=${zone||'global'}`);
  const buf     = fs.readFileSync(pdfPath);
  const data    = await pdfParse(buf);
  const rawText = data.text;

  let result;
  try {
    if (curriculum === 'cambridge') {
      result = parseCambridgeText(rawText, zone, season);
    } else {
      result = parsePearsonText(rawText, curriculum, season);
    }
  } catch (e) {
    console.error('\n✗ Parser threw an error:', e.message);
    process.exit(1);
  }

  const subjectCount = result.subjects?.length
    ?? result.categories?.reduce((n, c) => n + c.subjects.length, 0)
    ?? 0;
  const paperCount = result.subjects
    ? result.subjects.reduce((n, s) => n + s.papers.length, 0)
    : result.categories?.reduce((n, c) => c.subjects.reduce((m, s) => m + s.papers.length, n), 0) ?? 0;

  if (subjectCount === 0) {
    console.error('\n✗ Parser returned 0 subjects.');
    console.error('  Run `inspect` command first to see the actual PDF text format,');
    console.error('  then update api/parsers/cambridge.js or api/parsers/pearson.js.');
    process.exit(1);
  }

  console.log(`\n✓ ${subjectCount} subjects parsed, ${paperCount} papers total`);
  console.log('\nFirst 5 subjects:');
  const subjects = result.subjects ?? result.categories?.flatMap(c => c.subjects) ?? [];
  subjects.slice(0, 5).forEach(s => {
    console.log(`  • ${s.name} (${s.code}) — ${s.papers.length} papers`);
    s.papers.slice(0, 2).forEach(p => {
      console.log(`      ${p.code}  ${p.date}  ${p.sess}  ${p.dur}`);
    });
  });
  console.log('\n✓ Parser looks correct. Run upload command to push to Supabase Storage.');
}

async function upload(pdfPath, curriculum, season, zone) {
  await validate(pdfPath, curriculum, season, zone);

  const supabase = getSupabase();
  const key      = storageKey(curriculum, season, zone);
  const buf      = fs.readFileSync(pdfPath);

  console.log(`\nUploading to Supabase Storage: timetable-pdfs/${key}`);
  const { error } = await supabase.storage
    .from('timetable-pdfs')
    .upload(key, buf, {
      contentType: 'application/pdf',
      upsert:      true,           // overwrite if already uploaded
    });

  if (error) {
    console.error('\n✗ Upload failed:', error.message);
    process.exit(1);
  }

  console.log('✓ Uploaded successfully.');
  console.log(`\nTest it now:`);
  console.log(`  http://localhost:3000/api/parse-timetable?curriculum=${curriculum}&season=${season}${zone ? '&zone='+zone : ''}`);
}

// ── Entry point ────────────────────────────────────────────────────────────────
const [, , command, pdfPath, curriculum, arg1, arg2] = process.argv;

if (!command || !pdfPath || !curriculum) {
  console.log([
    '',
    'Usage:',
    '  node tools/inspect-pdf.mjs inspect  <pdf> <curriculum> [zone]',
    '  node tools/inspect-pdf.mjs validate <pdf> <curriculum> <season> [zone]',
    '  node tools/inspect-pdf.mjs upload   <pdf> <curriculum> <season> [zone]',
    '',
    'Curricula: cambridge | edexcel-igcse | edexcel-ial | edexcel-gcse',
    'Seasons:   2026-mj (Cambridge) | 2026-summer (Edexcel)',
    'Zones:     1 2 3 4 5 6 uk (Cambridge only)',
    '',
    'Examples:',
    '  node tools/inspect-pdf.mjs inspect  zone4.pdf cambridge 4',
    '  node tools/inspect-pdf.mjs validate zone4.pdf cambridge 2026-mj 4',
    '  node tools/inspect-pdf.mjs upload   zone4.pdf cambridge 2026-mj 4',
    '  node tools/inspect-pdf.mjs upload   igcse.pdf edexcel-igcse 2026-summer',
  ].join('\n'));
  process.exit(0);
}

if (command === 'inspect')  await inspect(pdfPath, curriculum, arg1);
if (command === 'validate') await validate(pdfPath, curriculum, arg1, arg2 || '');
if (command === 'upload')   await upload(pdfPath, curriculum, arg1, arg2 || '');
