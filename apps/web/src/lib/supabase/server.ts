import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/** Client legato alla sessione dell'utente: tutte le letture/scritture passano dalle policy RLS. */
export async function userDb() {
  const store = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // in un Server Component i cookie non si possono scrivere: ci pensa il proxy
        }
      },
    },
  });
}
