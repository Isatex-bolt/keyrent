import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

/**
 * Client con la chiave segreta: SOLO sul server, SOLO dopo aver verificato chi sta agendo.
 * Serve per le funzioni di dominio (transizioni annunci, verifiche, storage).
 */
export function serviceDb(): SupabaseClient {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY mancante nelle variabili d'ambiente");
  client ??= createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
