import { useEffect } from 'react';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { PlannerProvider, usePlanner } from './context/PlannerContext.jsx';
import { supabase, isSupabaseEnabled } from './lib/supabase.js';
import AuthModal      from './components/AuthModal.jsx';
import LocationSelect from './pages/LocationSelect.jsx';
import ZoneConfirm    from './pages/ZoneConfirm.jsx';
import SubjectSelect  from './pages/SubjectSelect.jsx';
import CalendarView   from './pages/CalendarView.jsx';
import PrivacyPolicy  from './pages/PrivacyPolicy.jsx';
import TermsOfService from './pages/TermsOfService.jsx';

const LS_KEY = 'igcse-planner-v5';

function CloudSync() {
  const { user, authLoading } = useAuth();
  const { step, zone, country, selectedCodes, events, geoData,
          setAuthUserId, setGeoData, loadFromCloud, syncToCloud } = usePlanner();

  // ── Geo fetch: always runs on mount, regardless of which step/page ────────
  // Previously this only ran inside LocationSelect (step 0), so returning
  // signed-in users who load directly into the calendar never populated geoData.
  useEffect(() => {
    if (geoData) return; // already fetched this session — don't re-fetch
    fetch('https://ipapi.co/json/')
      .then(r => r.json())
      .then(data => {
        if (data && !data.error) setGeoData(data);
      })
      .catch(() => {}); // non-critical — silently ignore network errors
  }, []);

  // ── Storage tier ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (authLoading) return;
    if (user?.id) {
      setAuthUserId(user.id);
    } else {
      setAuthUserId(null);
      try { localStorage.removeItem(LS_KEY); } catch {}
    }
  }, [user?.id, authLoading]);

  // ── Cloud load: once on sign-in ───────────────────────────────────────────
  useEffect(() => {
    if (user?.id) loadFromCloud(user.id);
  }, [user?.id]);

  // ── Cloud save: debounced on every state change ───────────────────────────
  useEffect(() => {
    if (user?.id) syncToCloud(user.id);
  }, [user?.id, step, zone, country, selectedCodes, events]);

  // ── Profile save: fires when user is known AND geoData has resolved ───────
  // Depends on both user?.id and geoData so it re-runs once geoData arrives,
  // which may be after the initial sign-in effect if the fetch was still pending.
  useEffect(() => {
    if (user && isSupabaseEnabled && geoData) saveProfile(user, geoData, zone);
  }, [user?.id, geoData, zone]);

  return null;
}

async function saveProfile(user, geoData, zone) {
  if (!user || !isSupabaseEnabled) return;
  try {
    const meta = user.user_metadata || {};
    await supabase.from('profiles').upsert({
      id:           user.id,
      email:        user.email,
      full_name:    meta.full_name || meta.name || null,
      avatar_url:   meta.avatar_url || meta.picture || null,
      ip_address:   geoData?.ip           || null,
      country_code: geoData?.country_code || null,
      country_name: geoData?.country_name || null,
      city:         geoData?.city         || null,
      region:       geoData?.region       || null,
      latitude:     geoData?.latitude     || null,
      longitude:    geoData?.longitude    || null,
      timezone:     geoData?.timezone     || null,
      org:          geoData?.org          || null,
      zone:         zone ? String(zone)   : null,
      last_seen_at: new Date().toISOString(),
    }, { onConflict: 'id' });
  } catch (e) {
    console.warn('Profile save failed (non-critical):', e.message);
  }
}

function PlannerRouter() {
  const { step } = usePlanner();
  if (step === 0) return <LocationSelect />;
  if (step === 1) return <ZoneConfirm />;
  if (step === 2) return <SubjectSelect />;
  return <CalendarView />;
}

function PlannerApp() {
  return (
    <AuthProvider>
      <PlannerProvider>
        <CloudSync />
        <PlannerRouter />
        <AuthModal />
      </PlannerProvider>
    </AuthProvider>
  );
}

// ── Top-level router — legal pages need no auth/planner state ────────────
export default function App() {
  const path = window.location.pathname;
  if (path === '/privacy') return (
    <>
      <PrivacyPolicy />
      <Analytics />
      <SpeedInsights />
    </>
  );
  if (path === '/terms') return (
    <>
      <TermsOfService />
      <Analytics />
      <SpeedInsights />
    </>
  );
  return (
    <>
      <PlannerApp />
      <Analytics />
      <SpeedInsights />
    </>
  );
}
