import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { CONFIG } from "./config.js";

let supabase = null;
if (CONFIG.isSupabaseConfigured) {
  supabase = createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
}

function requireClient() {
  if (!supabase) throw new Error("Supabase ainda não foi configurado. Preencha SUPABASE_URL e SUPABASE_ANON_KEY.");
  return supabase;
}

export async function getSession() {
  try {
    const client = requireClient();
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    return data.session;
  } catch (error) {
    console.error("[Supabase] getSession:", error.message);
    return null;
  }
}

export async function signUp(email, password) {
  try {
    const client = requireClient();
    const { data, error } = await client.auth.signUp({ email, password });
    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

export async function signIn(email, password) {
  try {
    const client = requireClient();
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

export async function signOut() {
  try {
    const client = requireClient();
    const { error } = await client.auth.signOut();
    if (error) throw error;
    return { error: null };
  } catch (error) {
    return { error };
  }
}

export function onAuthStateChange(callback) {
  if (!supabase) return { data: { subscription: { unsubscribe() {} } } };
  return supabase.auth.onAuthStateChange(callback);
}

export async function listPublicResources({ type = null, search = "" } = {}) {
  try {
    const client = requireClient();
    let query = client.from("support_resources").select("id,name,category,city,state,description,phone,website,updated_at").eq("is_published", true).order("name");
    if (type) query = query.eq("category", type);
    if (search) query = query.or(`name.ilike.%${search}%,city.ilike.%${search}%,description.ilike.%${search}%`);
    const { data, error } = await query.limit(60);
    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

export async function saveJournalEntry({ title, body, mood = null }) {
  try {
    const client = requireClient();
    const { data: { user }, error: userError } = await client.auth.getUser();
    if (userError) throw userError;
    if (!user) throw new Error("Entre na sua conta para salvar no banco de dados.");
    const { data, error } = await client.from("journal_entries").insert({
      user_id: user.id,
      title,
      body,
      mood
    }).select("id,created_at").single();
    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

export function isSupabaseReady() {
  return Boolean(supabase);
}
