import { useEffect } from 'react';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { PlannerProvider, usePlanner } from './context/PlannerContext.jsx';
import { supabase, isSupabaseEnabled } from './lib/supabase.js';
import AuthModal         from './components/AuthModal.jsx';
import CurriculumSelect  from './pages/CurriculumSelect.jsx';
import LocationSelect    from './pages/LocationSelect.jsx';
import ZoneConfirm       from './pages/ZoneConfirm.jsx';
import SubjectSelect     from './pages/SubjectSelect.jsx';
import CalendarView      from './pages/CalendarView.jsx';
import PrivacyPolicy     from './pages/PrivacyPolicy.jsx';
import TermsOfService    from './pages/TermsOfService.jsx';

const LS_KEY = 'igcse-planner-v5';

function CloudSync() {
  const { user, authLoading } = useAuth();
  const { step, zone, country, curriculum, selectedCodes, events, geoData,
          setAuthUserId, setGeoData, loadFromCloud, syncToCloud } = usePlanner();

  // ── Geo fetch: always runs on mount, regardless of step/page ─────────────
  useEffect(() => {
    if (geoData) return;
    fetch('https://ipapi.co/json/')
      .then(r => r.json())
      .then(data => { if (data && !data.error) setGeoData(data); })
      .catch(() => {});
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
  }, [user?.id, step, zone, country, curriculum, selectedCodes, events]);

  // ── Profile save: fires when user + geoData both resolved ────────────────
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
  const { step, curriculum } = usePlanner();

  // Step 0 — curriculum select (new entry point)
  if (step === 0) return <CurriculumSelect />;

  // Step 1 — location (Cambridge only; non-Cambridge jump straight to step 2)
  if (step === 1) {
    if (curriculum === 'cambridge') return <LocationSelect />;
    // Safety fallback: non-Cambridge curricula that somehow land on step 1
    return <SubjectSelect />;
  }

  // Step 1b — zone confirm (Cambridge only, injected inside LocationSelect flow)
  // ZoneConfirm is reached via step 1 sub-navigation in LocationSelect → setStep(1b).
  // We use step === 'zone' as a sentinel to avoid colliding with the numeric steps.
  if (step === 'zone') return <ZoneConfirm />;

  // Step 2 — subject select
  if (step === 2) return <SubjectSelect />;

  // Step 3 — calendar
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
