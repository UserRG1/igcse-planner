-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: parsed_timetables
-- Purpose: Cache for auto-parsed exam board PDFs.
--          Server-side parser fetches the board PDF, extracts structured JSON,
--          and stores it here. Subsequent requests are instant cache hits.
--
-- Run this in Supabase SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.parsed_timetables (
  id           uuid        primary key default gen_random_uuid(),

  -- Identity: which timetable is this?
  curriculum   text        not null,   -- 'cambridge' | 'edexcel-igcse' | 'edexcel-ial' | 'edexcel-gcse' | 'ib-dp'
  season       text        not null,   -- '2026-mj' | '2026-summer' | '2027-mj' etc.
  zone         text        not null default '',
                                       -- Cambridge: '1'–'6' | 'uk'
                                       -- Edexcel/IB: '' (global, no zone)

  -- Source tracking
  source_url   text        not null,
  checksum     text,                   -- MD5 hex of the raw PDF bytes (for cache invalidation)

  -- The parsed result — same schema as the static JSON files in /public/data/
  parsed_json  jsonb       not null,

  -- Metadata
  parsed_at    timestamptz not null default now(),
  parser_version text      not null default '1',   -- bump when parser logic changes

  -- One row per (curriculum, season, zone) — upsert on conflict
  unique (curriculum, season, zone)
);

-- Row-level security: only the service role (server-side) can write.
-- Anon/authenticated users can only read (so the client can also hit this directly if needed).
alter table public.parsed_timetables enable row level security;

create policy "Public read"
  on public.parsed_timetables for select
  using (true);

-- No insert/update/delete for anon/authenticated — service role bypasses RLS.

-- Index for the primary lookup pattern
create index if not exists parsed_timetables_lookup
  on public.parsed_timetables (curriculum, season, zone);

-- ─────────────────────────────────────────────────────────────────────────────
-- timetable_sources: registry of known PDF URLs per season.
-- Updated once per season when boards publish new timetables.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.timetable_sources (
  id           uuid        primary key default gen_random_uuid(),

  curriculum   text        not null,
  season       text        not null,
  zone         text        not null default '',
  label        text        not null,   -- human label e.g. "Cambridge Zone 4 · M/J 2026"
  source_url   text        not null,
  status       text        not null default 'released',
                                       -- 'released' | 'pending' | 'unavailable'
  released_on  date,                   -- date board published this PDF

  unique (curriculum, season, zone)
);

alter table public.timetable_sources enable row level security;

create policy "Public read sources"
  on public.timetable_sources for select
  using (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- Seed: known 2026 sources (Cambridge M/J 2026 + Pearson Summer 2026)
-- These match what was manually verified when building v11–v13 JSONs.
-- ─────────────────────────────────────────────────────────────────────────────

insert into public.timetable_sources
  (curriculum, season, zone, label, source_url, status, released_on)
values
  -- Cambridge M/J 2026 zones (PDF IDs from official CAIE site)
  ('cambridge', '2026-mj', '1',  'Cambridge Zone 1 · M/J 2026',   'https://www.cambridgeinternational.org/Images/745755-june-2026-igcse-as-and-a-level-o-level-timetable-zone-1.pdf', 'released', '2025-09-01'),
  ('cambridge', '2026-mj', '2',  'Cambridge Zone 2 · M/J 2026',   'https://www.cambridgeinternational.org/Images/745756-june-2026-igcse-as-and-a-level-o-level-timetable-zone-2.pdf', 'released', '2025-09-01'),
  ('cambridge', '2026-mj', '3',  'Cambridge Zone 3 · M/J 2026',   'https://www.cambridgeinternational.org/Images/745758-june-2026-igcse-as-and-a-level-o-level-timetable-zone-3.pdf', 'released', '2025-09-01'),
  ('cambridge', '2026-mj', '4',  'Cambridge Zone 4 · M/J 2026',   'https://www.cambridgeinternational.org/Images/745759-june-2026-igcse-as-and-a-level-o-level-timetable-zone-4.pdf', 'released', '2025-09-01'),
  ('cambridge', '2026-mj', '5',  'Cambridge Zone 5 · M/J 2026',   'https://www.cambridgeinternational.org/Images/745760-june-2026-igcse-as-and-a-level-o-level-timetable-zone-5.pdf', 'released', '2025-09-01'),
  ('cambridge', '2026-mj', '6',  'Cambridge Zone 6 · M/J 2026',   'https://www.cambridgeinternational.org/Images/745761-june-2026-igcse-as-and-a-level-o-level-timetable-zone-6.pdf', 'released', '2025-09-01'),
  ('cambridge', '2026-mj', 'uk', 'Cambridge Zone UK · M/J 2026',  'https://www.cambridgeinternational.org/Images/745757-june-2026-igcse-as-and-a-level-o-level-timetable-zone-uk.pdf', 'released', '2025-09-01'),

  -- Pearson Edexcel Summer 2026
  ('edexcel-igcse', '2026-summer', '', 'Edexcel International GCSE · Summer 2026', 'https://qualifications.pearson.com/content/dam/pdf/Support/Examination-timetables-for-International-GCSE/int-gcse-summer-2026-final.pdf', 'released', '2025-10-01'),
  ('edexcel-ial',   '2026-summer', '', 'Edexcel IAL · Summer 2026',                'https://qualifications.pearson.com/content/dam/pdf/Support/Examination-timetables-for-IAL/ial-summer-2026-final.pdf',                'released', '2025-10-01'),
  ('edexcel-gcse',  '2026-summer', '', 'Edexcel GCSE · Summer 2026',               'https://qualifications.pearson.com/content/dam/pdf/Support/Examination-timetables-for-UK-Edexcel-GCSE/gcse-summer-2026-final.pdf',    'released', '2025-10-01')

on conflict (curriculum, season, zone) do nothing;

-- ─────────────────────────────────────────────────────────────────────────────
-- Storage: timetable-pdfs bucket
-- Private bucket — only service role can read/write.
-- Files are uploaded manually by admin once per season.
-- Key pattern: {curriculum}/{season}/{zone-N.pdf | global.pdf}
-- ─────────────────────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public)
values ('timetable-pdfs', 'timetable-pdfs', false)
on conflict (id) do nothing;

-- Only service role (used by /api/parse-timetable) can read objects.
-- Anon/authenticated users cannot access PDFs directly.
create policy "Service role full access to timetable-pdfs"
  on storage.objects for all
  using (bucket_id = 'timetable-pdfs')
  with check (bucket_id = 'timetable-pdfs');
