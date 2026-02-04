import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const SUPABASE_URL = "https://qdvbglwslsjumvqunrob.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_JDcbWNmeTj4STn5STKYoOA_IbebKpuN";

export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);
