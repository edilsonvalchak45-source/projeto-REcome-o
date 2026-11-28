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
    let query = client.from("support_resources").select("id,name,category,address,city,state,description,phone,website,updated_at").eq("is_published", true).order("name");
    if (type) query = query.eq("category", type);
    if (search) query = query.or(`name.ilike.%${search}%,city.ilike.%${search}%,description.ilike.%${search}%`);
    const { data, error } = await query.limit(60);
    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

export async function isCurrentUserAdmin() {
  try {
    const client = requireClient();
    const { data: { user }, error: userError } = await client.auth.getUser();
    if (userError) throw userError;
    if (!user) return { data: false, error: null };
    const { data, error } = await client.from("admin_users")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) throw error;
    return { data: Boolean(data), error: null };
  } catch (error) {
    return { data: null, error };
  }
}

export async function listAdminClinics() {
  try {
    const client = requireClient();
    const { data, error } = await client.from("support_resources")
      .select("id,name,address,city,state,description,phone,website,is_published,verified_at,created_at")
      .eq("category", "Clínicas")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

export async function createClinic(clinic) {
  try {
    const client = requireClient();
    const { data, error } = await client.from("support_resources")
      .insert({ ...clinic, category: "Clínicas" })
      .select("id,name,address,city,state,description,phone,website,is_published,verified_at,created_at")
      .single();
    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

export async function deleteClinic(id) {
  try {
    const client = requireClient();
    const { error } = await client.from("support_resources")
      .delete()
      .eq("id", id)
      .eq("category", "Clínicas")
      .select("id")
      .single();
    if (error) throw error;
    return { error: null };
  } catch (error) {
    return { error };
  }
}

export async function listPublicTestimonials() {
  try {
    const client = requireClient();
    const { data, error } = await client.from("testimonials")
      .select("id,name,content,created_at")
      .eq("is_published", true)
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

export async function submitTestimonial({ name, content }) {
  try {
    const client = requireClient();
    const { error } = await client.from("testimonials").insert({
      name,
      content,
      is_published: false,
      consent: true
    });
    if (error) throw error;
    return { error: null };
  } catch (error) {
    return { error };
  }
}

export async function listAdminTestimonials() {
  try {
    const client = requireClient();
    const { data, error } = await client.from("testimonials")
      .select("id,name,content,is_published,created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

export async function setTestimonialPublished(id, isPublished) {
  try {
    const client = requireClient();
    const { error } = await client.from("testimonials")
      .update({ is_published: isPublished })
      .eq("id", id);
    if (error) throw error;
    return { error: null };
  } catch (error) {
    return { error };
  }
}

export async function deleteTestimonial(id) {
  try {
    const client = requireClient();
    const { error } = await client.from("testimonials")
      .delete()
      .eq("id", id)
      .select("id")
      .single();
    if (error) throw error;
    return { error: null };
  } catch (error) {
    return { error };
  }
}

export function isSupabaseReady() {
  return Boolean(supabase);
}
