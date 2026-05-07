/**
 * AuthContext
 * ─ Manages Supabase auth session (Google OAuth + email)
 * ─ Exposes openAuth(reason, callbacks) to trigger the sign-in modal
 *   from anywhere in the tree without prop-drilling
 */
import { createContext, useContext, useState, useEffect } from 'react';
import { supabase, isSupabaseEnabled } from '../lib/supabase.js';

const AuthContext = createContext(null);

const DISMISSED_KEY = 'igcse-auth-dismissed';

function getDismissed() {
  try { return JSON.parse(localStorage.getItem(DISMISSED_KEY) || '{}'); } catch { return {}; }
}
function setDismissed(reason) {
  const d = getDismissed();
  d[reason] = Date.now();
  try { localStorage.setItem(DISMISSED_KEY, JSON.stringify(d)); } catch {}
}

export function AuthProvider({ children }) {
  const [user,          setUser]          = useState(null);
  const [authLoading,   setAuthLoading]   = useState(true);
  const [pendingExport, setPendingExport] = useState(false);

  // Modal state
  const [modal, setModal] = useState({
    open: false, reason: null, onSuccess: null, onSkip: null,
  });

  // ── Bootstrap session ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!isSupabaseEnabled) { setAuthLoading(false); return; }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);

      // If user just returned from an OAuth redirect and we had a pending callback,
      // retrieve and fire it. We store the reason in sessionStorage because the
      // redirect destroys all JS state.
      if (session?.user) {
        const pending = sessionStorage.getItem('auth-pending-action');
        if (pending === 'export') {
          sessionStorage.removeItem('auth-pending-action');
          // Small delay to ensure the UI has mounted before opening export
          setTimeout(() => {
            setPendingExport(true);
          }, 300);
        }
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // ── Auth actions ──────────────────────────────────────────────────────────
  async function signInWithGoogle() {
    if (!isSupabaseEnabled) return;
    // If there's a pending export, store it so we can resume after redirect
    if (modal.reason === 'export') {
      sessionStorage.setItem('auth-pending-action', 'export');
    }
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
  }

  async function signInWithEmail(email, password) {
    if (!isSupabaseEnabled) throw new Error('Supabase not configured');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }

  async function signUpWithEmail(email, password) {
    if (!isSupabaseEnabled) throw new Error('Supabase not configured');
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
  }

  async function signOut() {
    if (!isSupabaseEnabled) return;
    await supabase.auth.signOut();
    setUser(null);
  }

  // ── Modal trigger ─────────────────────────────────────────────────────────
  /**
   * openAuth(reason, { onSuccess?, onSkip? })
   *   reason: 'export' | 'protect' | 'subjects' | 'events' | 'general'
   *   onSuccess: called after successful sign-in
   *   onSkip:    called when user dismisses without signing in
   *
   * One-time reasons ('subjects', 'events') are silently no-opped if already dismissed.
   * 'export' and 'protect' always show.
   */
  function openAuth(reason, { onSuccess, onSkip } = {}) {
    if (!isSupabaseEnabled) { onSkip?.(); return; }
    const ONE_TIME = ['subjects', 'events'];
    if (ONE_TIME.includes(reason) && getDismissed()[reason]) {
      onSkip?.(); return;
    }
    setModal({ open: true, reason, onSuccess: onSuccess ?? null, onSkip: onSkip ?? null });
  }

  function closeModal({ skipped } = {}) {
    if (skipped) {
      setDismissed(modal.reason);
      modal.onSkip?.();
    }
    setModal({ open: false, reason: null, onSuccess: null, onSkip: null });
  }

  function onAuthSuccess() {
    const cb = modal.onSuccess;
    setModal({ open: false, reason: null, onSuccess: null, onSkip: null });
    cb?.();
  }

  const value = {
    user, authLoading, isSupabaseEnabled,
    signInWithGoogle, signInWithEmail, signUpWithEmail, signOut,
    modal, openAuth, closeModal, onAuthSuccess,
    pendingExport, clearPendingExport: () => setPendingExport(false),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
