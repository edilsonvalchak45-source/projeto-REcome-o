import "./runtime-config.js";

const runtime = window.RECOMECO_CONFIG || {};

export const CONFIG = Object.freeze({
  supabaseUrl: runtime.SUPABASE_URL || "",
  supabaseAnonKey: runtime.SUPABASE_ANON_KEY || "",
  recommenderApiUrl: (runtime.RECOMMENDER_API_URL || "").replace(/\/$/, ""),
  chatEndpoint: "/.netlify/functions/chat",
  isSupabaseConfigured: Boolean(runtime.SUPABASE_URL && runtime.SUPABASE_ANON_KEY)
});
