import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireProvider, canEdit } from "@/lib/auth";
import { userDb } from "@/lib/supabase/server";
import { Badge, listingStatus } from "@/lib/status";
import { euro } from "@/lib/format";
import { Flash, ProHeader, Skeleton, type SP } from "@/components/ProPage";

export const metadata = { title: "I miei mezzi" };

export default function Page({ searchParams }: PageProps<"/pro/mezzi">) {
  return <Suspense fallback={<Skeleton />}><Mezzi searchParams={searchParams} /></Suspense>;
}

async function Mezzi({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const { membership } = await requireProvider("/pro/mezzi");
  if (!membership) redirect("/pro");
  const db = await userDb();
  const { data: rows } = await db.from("listings")
    .select("id, title, status, quantity_mode, price_from_cents, updated_at, categories(name_it), locations(city)")
    .eq("organization_id", membership.organization_id).order("updated_at", { ascending: false });
  // avvisi sull'esito delle revisioni: mostrati una volta, poi segnati come letti
  const { data: notices } = await db.from("listing_notices")
    .select("id, listing_id, kind, message, listings(title)")
    .eq("organization_id", membership.organization_id).is("seen_at", null).order("created_at", { ascending: false });
  if (notices?.length) await db.rpc("mark_listing_notices_seen", { p_listing: null });
  type Row = { id: string; title: string; status: string; quantity_mode: string; price_from_cents: number | null;
    categories: { name_it: string } | null; locations: { city: string } | null };
  return (
    <div>
      <ProHeader title="I miei mezzi" action={canEdit(membership) && (
        <div className="flex flex-wrap gap-2">
          <Link href="/pro/mezzi/importa" className="btn-ghost">Importa da Excel</Link>
          <Link href="/pro/mezzi/nuovo" className="btn-primary">+ Aggiungi mezzo</Link>
        </div>
      )} />
      <Flash sp={sp} />
      {(notices?.length ?? 0) > 0 && (
        <div className="mb-4 space-y-2">
          {((notices ?? []) as unknown as Notice[]).map((n) => <NoticeRow key={n.id} n={n} />)}
        </div>
      )}
      <ul className="space-y-2">
        {((rows ?? []) as unknown as Row[]).map((r) => (
          <li key={r.id}>
            <Link href={`/pro/mezzi/${r.id}`} className="card flex flex-wrap items-center justify-between gap-3 p-4 transition hover:border-teal-500/60">
              <div className="min-w-0">
                <p className="truncate font-semibold">{r.title}</p>
                <p className="text-sm text-mute">{r.categories?.name_it} · {r.locations?.city}{r.quantity_mode === "pool" ? " · più unità" : ""}{r.price_from_cents ? ` · da ${euro(r.price_from_cents)}` : ""}</p>
              </div>
              <Badge map={listingStatus} value={r.status} />
            </Link>
          </li>
        ))}
        {!rows?.length && <li className="card p-6 text-sm text-mute">Nessun mezzo ancora. Clicca “Aggiungi mezzo”.</li>}
      </ul>
    </div>
  );
}

type Notice = { id: string; listing_id: string; kind: string; message: string | null; listings: { title: string } | null };

const NOTICE: Record<string, { icon: string; text: string; tone: string }> = {
  approved: { icon: "✅", text: "è stato approvato ed è online", tone: "bg-teal-50 border-teal-500/40" },
  changes_approved: { icon: "✅", text: "le tue modifiche sono state approvate e sono online", tone: "bg-teal-50 border-teal-500/40" },
  changes_required: { icon: "✏️", text: "servono alcune modifiche prima della pubblicazione", tone: "bg-amber-50 border-amber-400/50" },
  rejected: { icon: "⛔", text: "non è stato approvato", tone: "bg-red-50 border-red-300" },
  changes_rejected: { icon: "⛔", text: "le modifiche non sono state approvate (l'annuncio resta online com'era)", tone: "bg-red-50 border-red-300" },
};

function NoticeRow({ n }: { n: Notice }) {
  const c = NOTICE[n.kind] ?? NOTICE.approved;
  return (
    <Link href={`/pro/mezzi/${n.listing_id}`} className={`flex items-start gap-3 rounded-2xl border p-4 text-sm ${c.tone}`}>
      <span className="text-xl leading-none">{c.icon}</span>
      <span className="min-w-0">
        <span className="font-semibold">{n.listings?.title ?? "Annuncio"}</span>: {c.text}.
        {n.message && <span className="mt-1 block text-mute">Nota di KeyRent: {n.message}</span>}
      </span>
    </Link>
  );
}
