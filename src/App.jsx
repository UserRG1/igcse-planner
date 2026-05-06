import { useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { PlannerProvider, usePlanner } from './context/PlannerContext.jsx';
import AuthModal from './components/AuthModal.jsx';
import LocationSelect from './pages/LocationSelect.jsx';
import ZoneConfirm    from './pages/ZoneConfirm.jsx';
import SubjectSelect  from './pages/SubjectSelect.jsx';
import CalendarView   from './pages/CalendarView.jsx';

/**
 * CloudSync — sits inside both providers, wires auth ↔ planner sync.
 * Runs loadFromCloud on sign-in, syncToCloud on every state change.
 */
function CloudSync() {
  const { user }                    = useAuth();
  const { step, zone, country,
          selectedCodes, events,
          loadFromCloud, syncToCloud } = usePlanner();

  // Load cloud data when user first signs in
  useEffect(() => {
    if (user?.id) loadFromCloud(user.id);
  }, [user?.id]);

  // Sync to cloud on every meaningful state change
  useEffect(() => {
    if (user?.id) syncToCloud(user.id);
  }, [user?.id, step, zone, country, selectedCodes, events]);

  return null;
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
