import { Suspense } from "react";
import Link from "next/link";
import { getViewer } from "@/lib/viewer";

/** Pulsante "Registra la tua attività" che sa chi sei: se l'attività è già registrata lo dice e porta all'area noleggiatore. */
export function PartnerCta({ dark = true, showLogin = false }: { dark?: boolean; showLogin?: boolean }) {
  const fallback = <Link href="/registrati?tipo=noleggiatore" className="btn-primary px-6 py-3.5 text-base">Registra la tua attività</Link>;
  return <Suspense fallback={fallback}><Cta dark={dark} showLogin={showLogin} /></Suspense>;
}

async function Cta({ dark, showLogin }: { dark: boolean; showLogin: boolean }) {
  const v = await getViewer();
  if (v.provider) {
    return (
      <div className="space-y-3">
        <p className={`text-sm font-medium ${dark ? "text-white/80" : "text-mute"}`}>
          ✓ La tua attività{v.orgName ? <> <b className={dark ? "text-white" : "text-ink"}>{v.orgName}</b></> : ""} è già registrata su KeyRent.
        </p>
        <Link href="/pro" className="btn-primary px-6 py-3.5 text-base">Vai all&apos;area noleggiatore</Link>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap gap-3">
      {/* già dentro come cliente: l'attività si aggiunge al proprio account, senza una nuova registrazione */}
      <Link href={v.loggedIn ? "/pro" : "/registrati?tipo=noleggiatore"} className="btn-primary px-6 py-3.5 text-base">Registra la tua attività</Link>
      {showLogin && !v.loggedIn && (
        <Link href="/accedi?tipo=noleggiatore" className="inline-flex items-center rounded-xl px-5 py-3.5 font-semibold text-white ring-1 ring-white/30 hover:bg-white/10">Accedi</Link>
      )}
    </div>
  );
}
