/**
 * PlannerContext — global state for zone, subjects, events.
 *
 * Persistence layers (in priority order):
 *   1. Supabase (cloud) — when user is signed in
 *   2. localStorage     — always, as offline fallback
 *
 * On sign-in:  load Supabase data; if newer than local, adopt it
 * On change:   write localStorage immediately + debounced Supabase sync (1.5s)
 */
import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { supabase, isSupabaseEnabled } from '../lib/supabase.js';

const STORAGE_KEY = 'igcse-planner-v5';

function loadState() {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (s) return JSON.parse(s);
  } catch {}
  return null;
}

function saveLocal(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      ...state,
      savedAt: new Date().toISOString(),
    }));
  } catch {}
}

/** Merge two event arrays by id — localArr wins on conflicts. */
function mergeEvents(cloudArr = [], localArr = []) {
  const map = new Map();
  for (const e of cloudArr) map.set(e.id, e);
  for (const e of localArr)  map.set(e.id, e); // local wins
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}

const PlannerContext = createContext(null);

export function PlannerProvider({ children }) {
  const saved = loadState();

  const [step,          setStep]          = useState(saved?.step          ?? 0);
  const [country,       setCountry]       = useState(saved?.country       ?? null);
  const [zone,          setZone]          = useState(saved?.zone          ?? null);
  const [selectedCodes, setSelectedCodes] = useState(
    saved?.selectedCodes ? new Set(saved.selectedCodes) : new Set()
  );
  const [events,        setEvents]        = useState(saved?.events        ?? []);
  const [cloudSynced,   setCloudSynced]   = useState(false);

  const syncTimer = useRef(null);

  // ── 1. Save to localStorage on every change ───────────────────────────────
  useEffect(() => {
    saveLocal({ step, country, zone, selectedCodes: [...selectedCodes], events });
  }, [step, country, zone, selectedCodes, events]);

  // ── 2. Load from Supabase when user signs in ──────────────────────────────
  // We import useAuth lazily via a prop injected from App to avoid circular deps.
  // Instead, we expose a loadFromCloud() function that App calls after auth.

  async function loadFromCloud(userId) {
    if (!isSupabaseEnabled || !userId) return;
    try {
      const { data, error } = await supabase
        .from('planners')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error || !data) return; // no cloud record yet

      // Compare timestamps — use cloud if it's newer than local
      const cloudTs = new Date(data.updated_at).getTime();
      const localTs = saved?.savedAt ? new Date(saved.savedAt).getTime() : 0;

      if (cloudTs > localTs) {
        if (data.zone      !== undefined) setZone(data.zone);
        if (data.country   !== undefined) setCountry(data.country);
        if (data.selected_codes)          setSelectedCodes(new Set(data.selected_codes));
        if (data.events)                  setEvents(mergeEvents(data.events, events));
      } else {
        // Local is newer — but still merge events in case they diverged
        if (data.events)                  setEvents(mergeEvents(data.events, events));
      }

      setCloudSynced(true);
    } catch {}
  }

  // ── 3. Debounced save to Supabase ─────────────────────────────────────────
  async function syncToCloud(userId) {
    if (!isSupabaseEnabled || !userId) return;
    clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(async () => {
      try {
        await supabase.from('planners').upsert({
          user_id:        userId,
          zone,
          country,
          selected_codes: [...selectedCodes],
          events,
          updated_at:     new Date().toISOString(),
        }, { onConflict: 'user_id' });
        setCloudSynced(true);
      } catch {}
    }, 1500);
  }

  const value = {
    step, setStep,
    country, setCountry,
    zone, setZone,
    selectedCodes, setSelectedCodes,
    events, setEvents,
    cloudSynced,
    loadFromCloud,
    syncToCloud,
  };

  return <PlannerContext.Provider value={value}>{children}</PlannerContext.Provider>;
}

export function usePlanner() {
  const ctx = useContext(PlannerContext);
  if (!ctx) throw new Error('usePlanner must be inside PlannerProvider');
  return ctx;
}
