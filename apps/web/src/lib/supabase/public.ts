import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Client per le pagine pubbliche: usa solo la chiave pubblica, nessuna sessione.
 * Legge esclusivamente viste e funzioni pensate per l'accesso anonimo (RLS lato database).
 */
let client: SupabaseClient | null = null;

export function isSupabaseConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function publicDb(): SupabaseClient {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase non configurato: mancano NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  client ??= createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

export function mediaUrl(path: string) {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/listings/${path}`;
}
