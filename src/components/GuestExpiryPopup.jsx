/**
 * GuestExpiryPopup
 * Shown to signed-out users when they reach the calendar view.
 * Displays a live countdown of remaining session time (3-hour TTL).
 * Dismissed state persists only for the current browser session.
 */
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

const SS_KEY      = 'igcse-guest-session';
const DISMISS_KEY = 'igcse-popup-dismissed';
const TTL_MS      = 3 * 60 * 60 * 1000; // 3 hours
const APPEAR_MS   = 2000;               // delay before sliding in

function getRemainingMs() {
  try {
    const raw = sessionStorage.getItem(SS_KEY);
    if (!raw) return null;
    const { savedAt } = JSON.parse(raw);
    if (!savedAt) return null;
    const elapsed = Date.now() - new Date(savedAt).getTime();
    return Math.max(0, TTL_MS - elapsed);
  } catch { return null; }
}

function formatCountdown(ms) {
  if (ms === null) return null;
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m`;
  if (m > 0) return `${m}m ${s.toString().padStart(2, '0')}s`;
  return `${s}s`;
}

export default function GuestExpiryPopup() {
  const { user, openAuth, isSupabaseEnabled } = useAuth();

  const [visible,   setVisible]   = useState(false);
  const [entered,   setEntered]   = useState(false);
  const [remaining, setRemaining] = useState(null);

  const timerRef  = useRef(null);
  const countRef  = useRef(null);

  // Don't show if: signed in, Supabase disabled, or already dismissed this session
  const shouldMount = !user && isSupabaseEnabled &&
    !sessionStorage.getItem(DISMISS_KEY);

  useEffect(() => {
    if (!shouldMount) return;

    // Initial remaining time
    setRemaining(getRemainingMs());

    // Appear after APPEAR_MS delay
    timerRef.current = setTimeout(() => {
      setVisible(true);
      setTimeout(() => setEntered(true), 20); // trigger CSS transition
    }, APPEAR_MS);

    // Live countdown ticker (every second)
    countRef.current = setInterval(() => {
      const rem = getRemainingMs();
      setRemaining(rem);
      if (rem !== null && rem <= 0) dismiss(); // expired — dismiss silently
    }, 1000);

    return () => {
      clearTimeout(timerRef.current);
      clearInterval(countRef.current);
    };
  }, [shouldMount]);

  // Hide immediately when user signs in
  useEffect(() => {
    if (user) { setVisible(false); setEntered(false); }
  }, [user]);

  function dismiss() {
    setEntered(false);
    try { sessionStorage.setItem(DISMISS_KEY, '1'); } catch {}
    setTimeout(() => setVisible(false), 380); // wait for slide-out
  }

  function handleSignIn() {
    dismiss();
    openAuth('general');
  }

  if (!visible) return null;

  const fmt = formatCountdown(remaining);
  const urgent = remaining !== null && remaining < 30 * 60 * 1000; // <30 min

  return (
    <div className={`gep-wrap${entered ? ' in' : ''}`} role="status" aria-live="polite">
      <div className={`gep${urgent ? ' urgent' : ''}`}>

        {/* Dismiss */}
        <button className="gep-close" onClick={dismiss} title="Dismiss">×</button>

        {/* Icon + headline */}
        <div className="gep-top">
          <span className="gep-icon">⏳</span>
          <div>
            <p className="gep-title">Your calendar is temporary</p>
            {fmt && (
              <p className={`gep-timer${urgent ? ' urgent' : ''}`}>
                Expires in <strong>{fmt}</strong>
              </p>
            )}
            {fmt === null && (
              <p className="gep-timer">Clears when you close this tab</p>
            )}
          </div>
        </div>

        {/* Body */}
        <p className="gep-body">
          Guest sessions aren't saved. Your exam schedule and notes will be gone
          when your session expires — including if you close the tab.
        </p>

        {/* CTA */}
        <div className="gep-actions">
          <button className="gep-cta" onClick={handleSignIn}>
            Sign in to save permanently
          </button>
          <button className="gep-skip" onClick={dismiss}>
            I understand, continue anyway
          </button>
        </div>
      </div>
    </div>
  );
}
