import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

export const supabase = createClient(
  "YOUR_PROJECT_URL",
  "YOUR_PUBLIC_ANON_KEY"
);
