import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

export const supabase = createClient(
  "",
  "sb_publishable_6inzRiKXwFjOE8vSIDOjdw_eCzD2HCl"
);

console.log("LIVE supabase URL:", supabase.supabaseUrl);


console.log("Supabase URL:", supabase.supabaseUrl);
console.log("Anon key first 20:", "eyJhbGciOi...".slice(0, 20)); // or your variable if you stored it






