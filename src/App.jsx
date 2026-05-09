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
          setAuthUserId, loadFromCloud, syncToCloud } = usePlanner();

  useEffect(() => {
    if (authLoading) return;
    if (user?.id) {
      setAuthUserId(user.id);
    } else {
      setAuthUserId(null);
      try { localStorage.removeItem(LS_KEY); } catch {}
    }
  }, [user?.id, authLoading]);

  useEffect(() => {
    if (user?.id) loadFromCloud(user.id);
  }, [user?.id]);

  useEffect(() => {
    if (user?.id) syncToCloud(user.id);
  }, [user?.id, step, zone, country, selectedCodes, events]);

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
