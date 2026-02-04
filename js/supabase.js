import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

/*
  IMPORTANT:
  - Use your Project URL from Supabase Settings -> API
  - Use your anon public key (starts with "eyJ..."), NOT sb_publishable_...
*/

const SUPABASE_URL = "https://qdvbglwslsjumvqunrob.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_JDcbWNmeTj4STn5STKYoOA_IbebKpuN";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Debug (safe to keep while testing)
console.log("Supabase URL loaded:", supabase.supabaseUrl);
