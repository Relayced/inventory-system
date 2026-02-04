import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

/*
  GitHub Pages / Frontend setup:
  - SUPABASE_URL = Settings -> API -> Project URL
  - SUPABASE_ANON_KEY = Settings -> API -> anon public (starts with "eyJ...")
*/

const SUPABASE_URL = "https://qdvbglwslsjumvqunrob.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFkdmJnbHdzbHNqdW12cXVucm9iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxNzg4ODYsImV4cCI6MjA4NTc1NDg4Nn0.WW9U6puKGl76sdGqGO4jtXtRlOylu5Kn1vjf-W9S47Q";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    // ✅ keep the login across refresh/page changes
    persistSession: true,

    // ✅ refresh token automatically (important for long sessions)
    autoRefreshToken: true,

    // ✅ supports magic link / OAuth redirects (safe to keep on)
    detectSessionInUrl: true,
  },
});

// Debug
console.log("Supabase URL loaded:", supabase.supabaseUrl);
console.log("Anon key starts with:", SUPABASE_ANON_KEY.slice(0, 3)); // should be "eyJ"
