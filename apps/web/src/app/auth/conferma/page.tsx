import { Suspense } from "react";
import { redirect } from "next/navigation";
import type { EmailOtpType } from "@supabase/supabase-js";
import { AuthCard, FormError } from "@/components/AuthCard";
import { userDb } from "@/lib/supabase/server";

export const metadata = { title: "Conferma email" };

const TYPES: EmailOtpType[] = ["signup", "email", "magiclink", "recovery", "invite", "email_change"];
const safe = (n: string) => (n.startsWith("/") && !n.startsWith("//") ? n : "/account");

async function confirm(f: FormData) {
  "use server";
  const token_hash = String(f.get("token_hash") ?? "");
  const type = String(f.get("type") ?? "email") as EmailOtpType;
  const wanted = String(f.get("next") ?? "");
  const db = await userDb();
  const { data, error } = await db.auth.verifyOtp({ token_hash, type: TYPES.includes(type) ? type : "email" });
  const next = wanted ? safe(wanted) : data.user?.user_metadata?.account_type === "provider" ? "/pro" : "/account";
  if (error) {
    redirect(`/accedi?errore=${encodeURIComponent("Il link è scaduto o è già stato usato. Se avevi già confermato, accedi con email e password.")}&next=${encodeURIComponent(next)}`);
  }
  redirect(next);
}

/**
 * Conferma dal link nell'email. Serve un clic sul pulsante: così i controlli antivirus della posta,
 * che aprono i link in automatico, non "consumano" il link prima di te. Funziona da qualsiasi browser.
 */
export default function Page({ searchParams }: PageProps<"/auth/conferma">) {
  return <Suspense><Confirm searchParams={searchParams} /></Suspense>;
}

async function Confirm({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const tokenHash = one("token_hash");
  const type = one("type") || "email";
  const isLogin = type === "magiclink";
  return (
    <AuthCard title={isLogin ? "Accedi a KeyRent" : "Conferma il tuo account"}
      subtitle={isLogin ? "Premi il pulsante per entrare." : "Ultimo passo: premi il pulsante per attivare l'account."}>
      {!tokenHash ? <FormError message="Link incompleto. Apri di nuovo il link dall'email." /> : (
        <form action={confirm}>
          <input type="hidden" name="token_hash" value={tokenHash} />
          <input type="hidden" name="type" value={type} />
          <input type="hidden" name="next" value={one("next") ? safe(one("next")) : ""} />
          <button className="btn-primary w-full">{isLogin ? "Entra" : "Conferma e entra"}</button>
        </form>
      )}
    </AuthCard>
  );
}
