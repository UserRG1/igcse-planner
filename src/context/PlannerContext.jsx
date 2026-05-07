/**
 * PlannerContext — global planner state with tiered storage.
 *
 * Guest (not signed in):
 *   → sessionStorage ONLY  (cleared when tab closes = 1 session)
 *   → 3-hour TTL enforced  (long sessions also expire)
 *   → localStorage never touched for guests
 *
 * Signed in:
 *   → localStorage immediate backup  (offline fallback)
 *   → Supabase primary               (cloud, debounced 1.5s)
 *   → On first sign-in: guest session migrates to localStorage + Supabase
 */
import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { supabase, isSupabaseEnabled } from '../lib/supabase.js';

const LS_KEY      = 'igcse-planner-v5';      // localStorage  — signed-in users
const SS_KEY      = 'igcse-guest-session';   // sessionStorage — guests
const TTL_MS      = 3 * 60 * 60 * 1000;     // 3 hours in ms

// ── Storage helpers ─────────────────────────────────────────────────────────

function readLS() {
  try { const s = localStorage.getItem(LS_KEY); return s ? JSON.parse(s) : null; }
  catch { return null; }
}

function readSS() {
  try {
    const s = sessionStorage.getItem(SS_KEY);
    if (!s) return null;
    const d = JSON.parse(s);
    // Enforce 3-hour TTL
    if (d.savedAt && Date.now() - new Date(d.savedAt).getTime() > TTL_MS) {
      sessionStorage.removeItem(SS_KEY);
      return null;
    }
    return d;
  } catch { return null; }
}

function writeLS(state) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({
      ...state, savedAt: new Date().toISOString(),
    }));
  } catch {}
}

function writeSS(state) {
  try {
    sessionStorage.setItem(SS_KEY, JSON.stringify({
      ...state, savedAt: new Date().toISOString(),
    }));
  } catch {}
}

function clearSS() {
  try { sessionStorage.removeItem(SS_KEY); } catch {}
}

/** Merge two event arrays by id — localArr wins on conflicts. */
function mergeEvents(cloudArr = [], localArr = []) {
  const map = new Map();
  for (const e of cloudArr) map.set(e.id, e);
  for (const e of localArr)  map.set(e.id, e);
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** Load best available initial state — LS first (signed-in users), then SS (guests). */
function loadInitialState() {
  return readLS() ?? readSS() ?? null;
}

// ── Context ──────────────────────────────────────────────────────────────────

const PlannerContext = createContext(null);

export function PlannerProvider({ children }) {
  const initial = loadInitialState();

  const [step,          setStep]          = useState(initial?.step          ?? 0);
  const [country,       setCountry]       = useState(initial?.country       ?? null);
  const [zone,          setZone]          = useState(initial?.zone          ?? null);
  const [selectedCodes, setSelectedCodes] = useState(
    initial?.selectedCodes ? new Set(initial.selectedCodes) : new Set()
  );
  const [events,     setEvents]     = useState(initial?.events     ?? []);
  const [geoData,    setGeoData]    = useState(null);
  const [cloudSynced, setCloudSynced] = useState(false);

  // authUserId is set externally by CloudSync in App.jsx
  // null = guest, string = signed-in user id
  const [authUserId, setAuthUserId] = useState(null);

  const syncTimer   = useRef(null);
  const prevUserRef = useRef(null);

  // ── Derive serialisable snapshot ─────────────────────────────────────────
  function snapshot() {
    return { step, country, zone, selectedCodes: [...selectedCodes], events };
  }

  // ── Persist on every state change ────────────────────────────────────────
  useEffect(() => {
    const snap = snapshot();
    if (authUserId) {
      writeLS(snap);    // signed-in: persist to localStorage
    } else {
      writeSS(snap);    // guest: sessionStorage only
    }
  }, [step, country, zone, selectedCodes, events, authUserId]);

  // ── On sign-in: migrate guest sessionStorage → localStorage ──────────────
  useEffect(() => {
    if (!authUserId || prevUserRef.current === authUserId) return;
    prevUserRef.current = authUserId;

    const guestData = readSS();
    if (guestData) {
      // Merge guest session into current state (current state may already be
      // from localStorage if the user was previously signed in on this device)
      const lsData = readLS();
      const base   = lsData ?? guestData;
      // Use whichever is newer
      const usedGuest = !lsData ||
        new Date(guestData.savedAt || 0) > new Date(lsData.savedAt || 0);
      if (usedGuest) {
        if (guestData.zone)           setZone(guestData.zone);
        if (guestData.country)        setCountry(guestData.country);
        if (guestData.selectedCodes)  setSelectedCodes(new Set(guestData.selectedCodes));
        if (guestData.events?.length) setEvents(prev => mergeEvents(guestData.events, prev));
      }
      clearSS(); // guest session migrated — clear it
    }
  }, [authUserId]);

  // ── Cloud: load from Supabase on sign-in ─────────────────────────────────
  async function loadFromCloud(userId) {
    if (!isSupabaseEnabled || !userId) return;
    try {
      const { data, error } = await supabase
        .from('planners').select('*').eq('user_id', userId).single();
      if (error || !data) return;

      const cloudTs = new Date(data.updated_at).getTime();
      const localTs = new Date(readLS()?.savedAt || 0).getTime();

      if (cloudTs > localTs) {
        if (data.zone !== undefined)   setZone(data.zone);
        if (data.country !== undefined) setCountry(data.country);
        if (data.selected_codes)       setSelectedCodes(new Set(data.selected_codes));
        if (data.events)               setEvents(prev => mergeEvents(data.events, prev));
      } else if (data.events) {
        setEvents(prev => mergeEvents(data.events, prev));
      }
      setCloudSynced(true);
    } catch {}
  }

  // ── Cloud: debounced save to Supabase ─────────────────────────────────────
  async function syncToCloud(userId) {
    if (!isSupabaseEnabled || !userId) return;
    clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(async () => {
      try {
        await supabase.from('planners').upsert({
          user_id:        userId,
          zone, country,
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
    geoData, setGeoData,
    cloudSynced,
    authUserId, setAuthUserId,
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
