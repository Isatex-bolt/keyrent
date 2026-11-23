import { Suspense } from "react";
import Link from "next/link";
import { canEdit } from "@/lib/auth";
import { userDb } from "@/lib/supabase/server";
import { dayList, monthRange, shiftMonth } from "@/lib/v2/fleet";
import { keepSede, proFleet } from "@/lib/v2/pro";
import { FleetCatalog } from "@/components/v2/FleetCatalog";
import { SedeChips } from "@/components/v2/SedeChips";
import { Flash, Skeleton, type SP } from "@/components/ProPage";

export const metadata = { title: "I miei mezzi" };

export default function Page({ searchParams }: PageProps<"/pro/mezzi">) {
  return <Suspense fallback={<Skeleton />}><Mezzi searchParams={searchParams} /></Suspense>;
}

async function Mezzi({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const { from, to: monthEnd } = monthRange(undefined);
  // 4 mesi di disponibilità per il filtro "Dal / Al"; la vista calendario mostra il mese corrente
  const to = monthRange(shiftMonth(from.slice(0, 7), 3)).to;
  const { data, all, sede, membership } = await proFleet(sp, from, to, "/pro/mezzi");
  const db = await userDb();
  // avvisi sull'esito delle revisioni: mostrati una volta, poi segnati come letti
  const [{ data: notices }, { count: sedi }] = await Promise.all([
    db.from("listing_notices").select("id, listing_id, kind, message, listings(title)")
      .eq("organization_id", membership.organization_id).is("seen_at", null).order("created_at", { ascending: false }),
    db.from("locations").select("id", { count: "exact", head: true }).eq("organization_id", membership.organization_id),
  ]);
  if (notices?.length) await db.rpc("mark_listing_notices_seen", { p_listing: null });
  return (
    <div className="space-y-6">
      <SedeChips locations={all.locations} sede={sede} />
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">I miei mezzi</h1>
          <p className="text-mute">La tua flotta: stato degli annunci, disponibilità e prossime prenotazioni.</p>
        </div>
        {canEdit(membership) && <Link href="/pro/mezzi/importa" className="btn-ghost">Importa da Excel</Link>}
      </header>
      <Flash sp={sp} ok={{ eliminato: "Bozza eliminata." }} />
      {(notices?.length ?? 0) > 0 && (
        <div className="space-y-2">{((notices ?? []) as unknown as Notice[]).map((n) => <NoticeRow key={n.id} n={n} />)}</div>
      )}
      <FleetCatalog vehicles={data.vehicles} days={dayList(from, monthEnd)} bookings={[...data.bookings, ...data.requests]} today={data.today}
        locations={all.locations} vehicleBase="/pro/mezzi" qs={keepSede(sp)} addHref={canEdit(membership) ? (sedi ? "/pro/mezzi/nuovo" : "/pro/sedi") : ""} />
    </div>
  );
}

type Notice = { id: string; listing_id: string; kind: string; message: string | null; listings: { title: string } | null };

const NOTICE: Record<string, { text: string; tone: string; dot: string }> = {
  approved: { text: "è stato approvato ed è online", tone: "bg-teal-50 border-teal-500/40", dot: "bg-teal-500" },
  changes_approved: { text: "le tue modifiche sono state approvate e sono online", tone: "bg-teal-50 border-teal-500/40", dot: "bg-teal-500" },
  changes_required: { text: "servono alcune modifiche prima della pubblicazione", tone: "bg-amber-50 border-amber-400/50", dot: "bg-amber-500" },
  rejected: { text: "non è stato approvato", tone: "bg-red-50 border-red-300", dot: "bg-red-500" },
  changes_rejected: { text: "le modifiche non sono state approvate (l'annuncio resta online com'era)", tone: "bg-red-50 border-red-300", dot: "bg-red-500" },
};

function NoticeRow({ n }: { n: Notice }) {
  const c = NOTICE[n.kind] ?? NOTICE.approved;
  return (
    <Link href={`/pro/mezzi/${n.listing_id}/modifica`} className={`flex items-start gap-3 rounded-2xl border p-4 text-sm ${c.tone}`}>
      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${c.dot}`} />
      <span className="min-w-0">
        <span className="font-semibold">{n.listings?.title ?? "Annuncio"}</span>: {c.text}.
        {n.message && <span className="mt-1 block text-mute">Nota di KeyRent: {n.message}</span>}
      </span>
    </Link>
  );
}
