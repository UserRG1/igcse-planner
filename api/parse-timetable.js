/**
 * /api/parse-timetable
 *
 * Vercel serverless function.
 *
 * PDF FETCH STRATEGY
 * ──────────────────
 * Cambridge and Pearson both return 403 to server-side (non-browser) fetches.
 * PDFs must be uploaded once to Supabase Storage bucket "timetable-pdfs" by the
 * admin (you), then the function reads from there — no exam board dependency at
 * runtime. The upload is a one-time action per season.
 *
 * ENDPOINTS
 * ─────────
 * GET /api/parse-timetable?action=seasons
 *   → list all released seasons from timetable_sources
 *
 * GET /api/parse-timetable?action=status&curriculum=cambridge&season=2026-mj&zone=4
 *   → cache status for a specific timetable (is it parsed? when?)
 *
 * GET /api/parse-timetable?curriculum=cambridge&season=2026-mj&zone=4
 *   → return parsed JSON (from cache or parse-on-demand from Storage)
 *
 * GET /api/parse-timetable?curriculum=cambridge&season=2026-mj&zone=4&force=true
 *   → force re-parse even if cached
 *
 * SUPABASE STORAGE
 * ────────────────
 * Bucket:  timetable-pdfs  (private, service-role access only)
 * Key pattern:
 *   cambridge/2026-mj/zone-4.pdf
 *   cambridge/2026-mj/zone-uk.pdf
 *   edexcel-igcse/2026-summer/global.pdf
 *   edexcel-ial/2026-summer/global.pdf
 *   edexcel-gcse/2026-summer/global.pdf
 */

import { createClient }         from '@supabase/supabase-js';
import pdfParse                 from 'pdf-parse/lib/pdf-parse.js';
import { parseCambridgeText }   from './parsers/cambridge.js';
import { parsePearsonText }     from './parsers/pearson.js';

// ── Supabase (service role — bypasses RLS, accesses private storage) ──────────
function getSupabase() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key, { auth: { persistSession: false } });
}

// ── Storage key builder ────────────────────────────────────────────────────────
function storageKey(curriculum, season, zone) {
  // e.g. cambridge/2026-mj/zone-4.pdf
  //      edexcel-igcse/2026-summer/global.pdf
  const file = zone ? `zone-${zone}.pdf` : 'global.pdf';
  return `${curriculum}/${season}/${file}`;
}

// ── Checksum ───────────────────────────────────────────────────────────────────
async function md5hex(buffer) {
  try {
    const { createHash } = await import('crypto');
    return createHash('md5').update(buffer).digest('hex');
  } catch {
    return String(buffer.byteLength);
  }
}

// ── Route to parser ────────────────────────────────────────────────────────────
async function parsePDF(pdfBuffer, curriculum, season, zone) {
  const data    = await pdfParse(pdfBuffer);
  const rawText = data.text;

  if (curriculum === 'cambridge') {
    return parseCambridgeText(rawText, zone, season);
  }
  if (['edexcel-igcse', 'edexcel-ial', 'edexcel-gcse'].includes(curriculum)) {
    return parsePearsonText(rawText, curriculum, season);
  }
  throw new Error(`No parser for curriculum: ${curriculum}`);
}

// ── CORS ───────────────────────────────────────────────────────────────────────
function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
}

// ── Main ───────────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { cors(res); return res.status(204).end(); }
  cors(res);

  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { action, curriculum, season, zone = '', force } = req.query;

  let supabase;
  try { supabase = getSupabase(); }
  catch (e) { return res.status(500).json({ error: e.message }); }

  // ── action=seasons ───────────────────────────────────────────────────────────
  if (action === 'seasons') {
    const { data, error } = await supabase
      .from('timetable_sources')
      .select('curriculum, season, zone, label, status, released_on')
      .eq('status', 'released')
      .order('released_on', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.status(200).json({ seasons: data });
  }

  // ── action=status ────────────────────────────────────────────────────────────
  if (action === 'status') {
    if (!curriculum || !season)
      return res.status(400).json({ error: 'Missing curriculum or season' });
    const { data } = await supabase
      .from('parsed_timetables')
      .select('parsed_at, parser_version, checksum')
      .eq('curriculum', curriculum).eq('season', season).eq('zone', zone || '')
      .maybeSingle();
    const { data: src } = await supabase
      .from('timetable_sources')
      .select('status, source_url')
      .eq('curriculum', curriculum).eq('season', season).eq('zone', zone || '')
      .maybeSingle();
    // Check if PDF is in storage
    const key = storageKey(curriculum, season, zone);
    const { data: storageData } = await supabase.storage
      .from('timetable-pdfs').list(`${curriculum}/${season}`);
    const fileName  = zone ? `zone-${zone}.pdf` : 'global.pdf';
    const pdfInStorage = storageData?.some(f => f.name === fileName) ?? false;
    return res.status(200).json({
      curriculum, season, zone,
      cached:         !!data,
      parsed_at:      data?.parsed_at || null,
      parser_version: data?.parser_version || null,
      pdf_in_storage: pdfInStorage,
      storage_key:    key,
      source_status:  src?.status || 'unknown',
    });
  }

  // ── Validate ─────────────────────────────────────────────────────────────────
  if (!curriculum || !season)
    return res.status(400).json({
      error: 'Missing required params: curriculum, season',
      example: '/api/parse-timetable?curriculum=cambridge&season=2026-mj&zone=4',
    });

  const validCurricula = ['cambridge', 'edexcel-igcse', 'edexcel-ial', 'edexcel-gcse'];
  if (!validCurricula.includes(curriculum))
    return res.status(400).json({ error: `Unknown curriculum: ${curriculum}`, valid: validCurricula });

  if (curriculum === 'cambridge' && !zone)
    return res.status(400).json({ error: 'Cambridge requires zone param (1–6 or uk)' });

  // ── Cache lookup ──────────────────────────────────────────────────────────────
  if (!force) {
    const { data: cached } = await supabase
      .from('parsed_timetables')
      .select('parsed_json, parsed_at, parser_version')
      .eq('curriculum', curriculum).eq('season', season).eq('zone', zone)
      .maybeSingle();
    if (cached) {
      res.setHeader('X-Cache', 'HIT');
      res.setHeader('X-Parsed-At', cached.parsed_at);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.status(200).json(cached.parsed_json);
    }
  }

  // ── Fetch PDF from Supabase Storage ──────────────────────────────────────────
  const key = storageKey(curriculum, season, zone);
  const { data: pdfData, error: storageErr } = await supabase.storage
    .from('timetable-pdfs')
    .download(key);

  if (storageErr || !pdfData) {
    return res.status(404).json({
      error:       'PDF not found in storage',
      storage_key: key,
      hint: [
        'Download the PDF from the exam board website in your browser,',
        'then upload it to Supabase Storage → timetable-pdfs → ' + key,
        'See README for the exact download URLs and upload steps.',
      ].join(' '),
    });
  }

  // ── Parse ─────────────────────────────────────────────────────────────────────
  const t0        = Date.now();
  const arrayBuf  = await pdfData.arrayBuffer();
  const pdfBuffer = Buffer.from(arrayBuf);
  const checksum  = await md5hex(pdfBuffer);

  // Skip re-parse if same PDF already cached (force=true path)
  if (force) {
    const { data: existing } = await supabase
      .from('parsed_timetables')
      .select('checksum, parsed_json')
      .eq('curriculum', curriculum).eq('season', season).eq('zone', zone)
      .maybeSingle();
    if (existing?.checksum === checksum) {
      res.setHeader('X-Cache', 'HIT-CHECKSUM');
      return res.status(200).json(existing.parsed_json);
    }
  }

  let parsed;
  try {
    parsed = await parsePDF(pdfBuffer, curriculum, season, zone);
  } catch (e) {
    return res.status(500).json({ error: `Parse failed: ${e.message}`, curriculum, season, zone });
  }

  const parseMs      = Date.now() - t0;
  const subjectCount = parsed.subjects?.length
    ?? parsed.categories?.reduce((n, c) => n + c.subjects.length, 0)
    ?? 0;

  if (subjectCount === 0) {
    // Return the raw text sample so the parser can be debugged
    const { text } = await pdfParse(pdfBuffer);
    const sample   = text.split('\n').filter(l => l.trim()).slice(0, 80).join('\n');
    return res.status(500).json({
      error:      'Parser returned 0 subjects — PDF format needs investigation',
      curriculum, season, zone,
      hint:       'Check the raw_text_sample field below to understand the actual PDF text layout, then update api/parsers/cambridge.js or pearson.js regex accordingly.',
      raw_text_sample: sample,
    });
  }

  // ── Cache in Supabase ─────────────────────────────────────────────────────────
  const { error: upsertErr } = await supabase
    .from('parsed_timetables')
    .upsert({
      curriculum,
      season,
      zone,
      source_url:     key,
      checksum,
      parsed_json:    parsed,
      parsed_at:      new Date().toISOString(),
      parser_version: '1',
    }, { onConflict: 'curriculum,season,zone' });

  if (upsertErr) console.error('[parse-timetable] Cache write failed:', upsertErr.message);

  res.setHeader('X-Cache',    'MISS');
  res.setHeader('X-Parse-Ms', String(parseMs));
  res.setHeader('X-Subjects', String(subjectCount));
  res.setHeader('Cache-Control', 'public, max-age=86400');
  return res.status(200).json(parsed);
}

export const config = { maxDuration: 60 };
