/**
 * AuthHeaderButton — shown in every page header.
 * Renders "Sign in" when logged out, "✓ Synced + Sign out" when logged in.
 * Returns null when Supabase is not configured.
 */
import { useAuth } from '../context/AuthContext.jsx';

export default function AuthHeaderButton() {
  const { user, signOut, openAuth, isSupabaseEnabled } = useAuth();

  if (!isSupabaseEnabled) return null;

  if (user) {
    const name = user.user_metadata?.full_name || user.email || 'Signed in';
    return (
      <div className="auth-status">
        <span className="auth-synced" title={`Signed in as ${user.email}`}>
          ✓ {name.split(' ')[0]}
        </span>
        <button className="auth-signout-btn" onClick={signOut}>
          Sign out
        </button>
      </div>
    );
  }

  return (
    <button
      className="auth-signin-btn"
      onClick={() => openAuth('general')}
      title="Sign in to sync your calendar to the cloud"
    >
      Sign in
    </button>
  );
}
