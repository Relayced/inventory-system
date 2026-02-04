import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

export const supabase = createClient(
  "https://qdvbglwslsjumvqunrob.supabase.co",
  "sb_publishable_JDcbWNmeTj4STn5STKYoOA_IbebKpuN"
);

console.log("LIVE supabase URL:", supabase.supabaseUrl);


console.log("Supabase URL:", supabase.supabaseUrl);
console.log("Anon key first 20:", "eyJhbGciOi...".slice(0, 20)); // or your variable if you stored it









