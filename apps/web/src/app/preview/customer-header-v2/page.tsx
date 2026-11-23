import { Suspense } from "react";
import Link from "next/link";
import { cookies } from "next/headers";
import { getUser } from "@/lib/auth";
import { PREVIEW_V2_COOKIE } from "@/lib/v2/flag";
import { setPreviewV2 } from "../actions";

export const metadata = { title: "Header cliente V2 · anteprima" };

export default function Page() {
  return <Suspense fallback={<div className="mx-auto h-96 max-w-4xl animate-pulse rounded-2xl bg-white" />}><Header /></Suspense>;
}

function Bar({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-bold uppercase tracking-wide text-mute">{label}</p>
      <div className="flex items-center justify-between rounded-2xl border border-line bg-white px-4 py-3 shadow-sm">
        <span className="text-lg font-bold text-navy-900">Key<span className="text-teal-500">Rent</span></span>
        <div className="flex items-center gap-1">{children}</div>
      </div>
    </div>
  );
}

async function Header() {
  const user = await getUser();
  const on = (await cookies()).get(PREVIEW_V2_COOKIE)?.value === "1";
  const first = (user?.user_metadata?.first_name as string | undefined) || "Filippo";
  const last = (user?.user_metadata?.last_name as string | undefined) || "";
  const initials = `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase();
  const pill = (cls: string, t: string) => <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${cls}`}>{t}</span>;
  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-10 sm:px-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Cliente: header e accesso V2</h1>
        <p className="mt-2 text-mute">Confronto tra l&apos;header di oggi e la proposta. In V2 il cliente non vede un&apos;etichetta di ruolo e dopo l&apos;accesso resta sulla home.</p>
      </div>
      <Bar label="Oggi (V1)">
        <span className="px-3 text-sm text-mute">Messaggi</span>
        <span className="btn-ghost gap-2 py-2">{pill("bg-teal-50 text-teal-600", "Cliente")}{first} ▾</span>
      </Bar>
      <Bar label="Proposta (V2) · cliente">
        <span className="px-3 text-sm text-mute">Messaggi</span>
        <span className="btn-ghost gap-2 py-2"><span className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-navy-900 to-teal-600 text-[11px] font-bold text-white">{initials}</span>{first} ▾</span>
      </Bar>
      <Bar label="Proposta (V2) · noleggiatore (resta il contesto)">
        <span className="px-3 text-sm text-mute">Messaggi</span><span className="px-3 text-sm text-mute">Le mie prenotazioni</span>
        <span className="btn-ghost gap-2 py-2">{pill("bg-navy-900 text-white", "Noleggiatore")}{first} ▾</span>
      </Bar>
      <div className="card space-y-3 p-5">
        <h2 className="font-semibold">Provalo davvero su questo browser</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-mute">
          <li>Header cliente con avatar e nome, senza “Cliente” (menu personale e Esci invariati).</li>
          <li>Accesso come cliente → torni alla <b>home</b> invece che al profilo.</li>
          <li>Vale solo per questo browser; gli altri utenti vedono il sito di sempre.</li>
        </ul>
        <form action={setPreviewV2} className="flex flex-wrap items-center gap-3">
          <input type="hidden" name="on" value={on ? "0" : "1"} />
          <button className={on ? "btn-ghost" : "btn-primary"}>{on ? "Disattiva anteprima V2" : "Attiva anteprima V2 su questo browser"}</button>
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${on ? "bg-emerald-50 text-emerald-800" : "bg-navy-50 text-mute"}`}>{on ? "Attiva" : "Non attiva"}</span>
          {on && <Link href="/" className="text-sm font-semibold text-teal-600">Vai alla home →</Link>}
        </form>
      </div>
    </div>
  );
}
