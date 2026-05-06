import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL  || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Client is null when env vars are not set (local dev without Supabase).
// All sync code checks for null before calling — app works fully offline.
export const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey)
  : null;

export const isSupabaseEnabled = Boolean(supabase);
