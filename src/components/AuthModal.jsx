/**
 * AuthModal — rendered once at the App level, controlled via AuthContext.
 * Supports: Google OAuth, email sign-in, email sign-up.
 * Copy adapts based on the `reason` prop for maximum contextual relevance.
 */
import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

const REASON_COPY = {
  export: {
    headline: 'Sign in to export',
    body: 'Create a free account to export your calendar — and back it up to the cloud at the same time. It takes one click with Google.',
    skip: null, // no skip — export is gated
  },
  protect: {
    headline: 'Protect your plan',
    body: 'Safari and some browsers automatically clear local data after 7 days of inactivity. Sign in to move your calendar to the cloud where it\'s safe.',
    skip: 'I\'ll risk it',
  },
  subjects: {
    headline: 'Keep your selections safe',
    body: 'You\'ve chosen your papers. Sign in once to back them up — your choices will be waiting on any device, even if the browser clears local storage.',
    skip: 'Maybe later',
  },
  events: {
    headline: 'Back up your revision plan',
    body: 'You\'ve put real effort into this calendar. Sign in to save it to the cloud — it takes one click with Google.',
    skip: 'Maybe later',
  },
  general: {
    headline: 'Sign in to sync',
    body: 'Keep your IGCSE planner synced across all your devices. One account, everywhere.',
    skip: 'Maybe later',
  },
};

export default function AuthModal() {
  const { modal, closeModal, onAuthSuccess, signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth();

  const [mode,     setMode]     = useState('signin'); // 'signin' | 'signup'
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [sent,     setSent]     = useState(false); // email confirmation sent

  if (!modal.open) return null;

  const copy = REASON_COPY[modal.reason] || REASON_COPY.general;

  function reset() {
    setEmail(''); setPassword(''); setConfirm('');
    setError(''); setLoading(false); setSent(false);
  }

  function switchMode(m) { setMode(m); setError(''); }

  async function handleGoogle() {
    setError(''); setLoading(true);
    try {
      await signInWithGoogle();
      // signInWithOAuth triggers a full-page redirect to Google.
      // onAuthSuccess will be called automatically by onAuthStateChange
      // in AuthContext after the user returns and the session is confirmed.
      // We do NOT call onAuthSuccess() here to avoid the unlock gap.
    } catch (e) {
      setError(e.message || 'Google sign-in failed.');
      setLoading(false);
    }
  }

  async function handleEmail(e) {
    e.preventDefault();
    setError('');
    if (!email || !password) { setError('Please enter your email and password.'); return; }
    if (mode === 'signup' && password !== confirm) { setError('Passwords don\'t match.'); return; }
    if (mode === 'signup' && password.length < 8) { setError('Password must be at least 8 characters.'); return; }

    setLoading(true);
    try {
      if (mode === 'signin') {
        await signInWithEmail(email, password);
        onAuthSuccess();
      } else {
        await signUpWithEmail(email, password);
        setSent(true); // Supabase sends a confirmation email
      }
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally { setLoading(false); }
  }

  function handleSkip() {
    reset();
    closeModal({ skipped: true });
  }

  function handleBackdrop(e) {
    if (e.target !== e.currentTarget) return;
    // Export modal is mandatory — cannot be dismissed by clicking backdrop
    if (modal.reason === 'export') return;
    handleSkip();
  }

  return (
    <div className="auth-overlay" onClick={handleBackdrop}>
      <div className="auth-modal">

        {/* Close — hidden for mandatory export modal */}
        {copy.skip && (
          <button className="auth-close" onClick={handleSkip} title="Close">×</button>
        )}

        {/* Header */}
        <div className="auth-header">
          <p className="auth-headline">{copy.headline}</p>
          <p className="auth-body">{copy.body}</p>
        </div>

        {sent ? (
          /* ── Email confirmation sent ── */
          <div className="auth-sent">
            <div className="auth-sent-icon">✉</div>
            <p className="auth-sent-title">Check your email</p>
            <p className="auth-sent-sub">
              We sent a confirmation link to <strong>{email}</strong>.
              Click it to activate your account, then come back here.
            </p>
            <button className="auth-skip" onClick={handleSkip}>Done</button>
          </div>
        ) : (
          <>
            {/* ── Google button ── */}
            <button
              className="auth-google"
              onClick={handleGoogle}
              disabled={loading}
            >
              <GoogleIcon />
              Continue with Google
            </button>

            {/* ── Divider ── */}
            <div className="auth-divider"><span>or</span></div>

            {/* ── Mode tabs ── */}
            <div className="auth-tabs">
              <button
                className={`auth-tab${mode === 'signin' ? ' active' : ''}`}
                onClick={() => switchMode('signin')}
              >Sign in</button>
              <button
                className={`auth-tab${mode === 'signup' ? ' active' : ''}`}
                onClick={() => switchMode('signup')}
              >Create account</button>
            </div>

            {/* ── Email form ── */}
            <form className="auth-form" onSubmit={handleEmail} noValidate>
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoComplete="email"
                disabled={loading}
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                disabled={loading}
              />
              {mode === 'signup' && (
                <input
                  type="password"
                  placeholder="Confirm password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  autoComplete="new-password"
                  disabled={loading}
                />
              )}
              {error && <p className="auth-error">{error}</p>}
              <button
                type="submit"
                className="auth-submit"
                disabled={loading}
              >
                {loading
                  ? 'Please wait…'
                  : mode === 'signin' ? 'Sign in' : 'Create account'
                }
              </button>
            </form>

            {/* ── Skip link — hidden for mandatory reasons ── */}
            {copy.skip && (
              <button className="auth-skip" onClick={handleSkip} disabled={loading}>
                {copy.skip}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z"/>
      <path fill="#FBBC05" d="M3.964 10.706A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.038l3.007-2.332z"/>
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58z"/>
    </svg>
  );
}
