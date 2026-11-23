import { Suspense } from "react";
import Link from "next/link";
import { loadCustomer } from "@/lib/v2/customer";
import { DemoBar, Thumb } from "@/components/v2/customer/ui";

export const metadata = { title: "Messaggi · anteprima" };
type SP = Promise<Record<string, string | string[] | undefined>>;

export default function Page({ searchParams }: { searchParams: SP }) {
  return <Suspense fallback={<div className="h-96 animate-pulse rounded-3xl bg-white" />}><Msgs searchParams={searchParams} /></Suspense>;
}

const ago = (iso: string | null) => {
  if (!iso) return "";
  const m = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (m < 60) return `${Math.max(1, m)} min`;
  if (m < 1440) return new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome" }).format(new Date(iso));
  return new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short", timeZone: "Europe/Rome" }).format(new Date(iso));
};

async function Msgs({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const c = await loadCustomer(sp);
  return (
    <div className="mx-auto max-w-md space-y-4">
      <DemoBar c={c} sp={sp} />
      <h1 className="text-[28px] font-bold tracking-tight">Messaggi</h1>
      <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white">
        {c.threads.map((t) => (
          <li key={t.id}>
            <Link href={c.demo ? "#" : `/messaggi/${t.id}`} className="flex items-center gap-3 px-4 py-3 active:bg-navy-50">
              <Thumb r={{ cover: t.cover, category: "" }} className="h-12 w-12" />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className={`truncate ${t.unread ? "font-bold" : "font-semibold"}`}>{t.title}</p>
                  <span className={`shrink-0 text-xs ${t.unread ? "font-semibold text-teal-600" : "text-mute"}`}>{ago(t.at)}</span>
                </div>
                <p className="truncate text-xs text-mute">{t.other}</p>
                <p className={`truncate text-sm ${t.unread ? "text-navy-900" : "text-mute"}`}>{t.last || "Nessun messaggio"}</p>
              </div>
              {t.unread && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-teal-500" />}
            </Link>
          </li>
        ))}
        {!c.threads.length && <li className="p-8 text-center text-sm text-mute">Nessuna conversazione. Puoi scrivere al noleggiatore dalla scheda di un mezzo.</li>}
      </ul>
      <p className="text-center text-xs text-mute">La chat vera e propria resta quella attuale (<Link href="/messaggi" className="underline">/messaggi</Link>).</p>
    </div>
  );
}
