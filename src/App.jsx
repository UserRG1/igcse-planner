import { useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { PlannerProvider, usePlanner } from './context/PlannerContext.jsx';
import { supabase, isSupabaseEnabled } from './lib/supabase.js';
import AuthModal from './components/AuthModal.jsx';
import LocationSelect from './pages/LocationSelect.jsx';
import ZoneConfirm    from './pages/ZoneConfirm.jsx';
import SubjectSelect  from './pages/SubjectSelect.jsx';
import CalendarView   from './pages/CalendarView.jsx';

const LS_KEY = 'igcse-planner-v5';

/**
 * CloudSync — bridges auth ↔ planner, manages storage tier switching.
 *
 * Signed-in:   setAuthUserId(user.id) → PlannerContext writes localStorage + Supabase
 * Signed-out:  setAuthUserId(null)    → PlannerContext writes sessionStorage only
 *              + clears localStorage so stale signed-in data doesn't linger
 */
function CloudSync() {
  const { user, authLoading }             = useAuth();
  const { step, zone, country,
          selectedCodes, events, geoData,
          setAuthUserId,
          loadFromCloud, syncToCloud }     = usePlanner();

  // ── Tell PlannerContext which storage tier to use ─────────────────────────
  useEffect(() => {
    if (authLoading) return; // wait until Supabase session is resolved
    if (user?.id) {
      setAuthUserId(user.id);   // → enables localStorage + Supabase writes
    } else {
      setAuthUserId(null);      // → sessionStorage only
      // Clear any stale localStorage from a previous signed-in session
      try { localStorage.removeItem(LS_KEY); } catch {}
    }
  }, [user?.id, authLoading]);

  // ── Cloud load: once on sign-in ───────────────────────────────────────────
  useEffect(() => {
    if (user?.id) loadFromCloud(user.id);
  }, [user?.id]);

  // ── Cloud save: debounced on every state change (signed-in only) ──────────
  useEffect(() => {
    if (user?.id) syncToCloud(user.id);
  }, [user?.id, step, zone, country, selectedCodes, events]);

  // ── Profile save: on sign-in and whenever geo/zone resolves ──────────────
  useEffect(() => {
    if (user && isSupabaseEnabled) saveProfile(user, geoData, zone);
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

function Router() {
  const { step } = usePlanner();
  if (step === 0) return <LocationSelect />;
  if (step === 1) return <ZoneConfirm />;
  if (step === 2) return <SubjectSelect />;
  return <CalendarView />;
}

export default function App() {
  return (
    <AuthProvider>
      <PlannerProvider>
        <CloudSync />
        <Router />
        <AuthModal />
      </PlannerProvider>
    </AuthProvider>
  );
}
