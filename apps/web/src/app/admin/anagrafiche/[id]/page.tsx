import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { serviceDb } from "@/lib/supabase/admin";
import { Badge, listingStatus, orgStatus } from "@/lib/status";
import { euro } from "@/lib/format";
import { Flash, ProHeader, Skeleton, type SP } from "@/components/ProPage";

export const metadata = { title: "Attività di noleggio" };

export default function Page({ params, searchParams }: PageProps<"/admin/anagrafiche/[id]">) {
  return <Suspense fallback={<Skeleton />}><Org params={params} searchParams={searchParams} /></Suspense>;
}

async function Org({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SP }) {
  const { id } = await params;
  const sp = await searchParams;
  await requireStaff();
  const db = serviceDb();
  const [{ data: o }, { data: listings }, { data: sedi }] = await Promise.all([
    db.from("organizations").select("id, legal_name, trade_name, vat_number, business_email, business_phone, verification_status, kind").eq("id", id).maybeSingle(),
    db.from("listings").select("id, title, status, price_from_cents, updated_at, locations(name, city)").eq("organization_id", id).order("updated_at", { ascending: false }),
    db.from("locations").select("id").eq("organization_id", id).eq("active", true),
  ]);
  if (!o) notFound();
  type L = { id: string; title: string; status: string; price_from_cents: number | null; locations: { name: string; city: string } | null };
  return (
    <div className="space-y-5">
      <Link href="/admin/anagrafiche" className="text-sm text-mute hover:text-navy-900">← Anagrafiche</Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <ProHeader title={o.trade_name ?? o.legal_name} subtitle={`${o.legal_name} · P.IVA ${o.vat_number} · ${o.business_email ?? "—"} · ${o.business_phone ?? "—"}`} />
        <Badge map={orgStatus} value={o.verification_status} />
      </div>
      <Flash sp={sp} />
      <section className="card space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">Annunci del noleggiatore</h2>
            <p className="text-sm text-mute">Su richiesta del cliente puoi inserire o modificare i suoi annunci. Ogni modifica resta nel registro attività.</p>
          </div>
          {sedi?.length ? <Link href={`/admin/anagrafiche/${id}/nuovo`} className="btn-primary">+ Nuovo annuncio</Link>
            : <span className="text-sm text-amber-900">Il noleggiatore non ha ancora una sede attiva</span>}
        </div>
        <ul className="divide-y divide-line">
          {((listings ?? []) as unknown as L[]).map((l) => (
            <li key={l.id}>
              <Link href={`/admin/anagrafiche/${id}/annunci/${l.id}`} className="flex flex-wrap items-center justify-between gap-3 py-3 hover:bg-navy-50/40">
                <span className="min-w-0"><span className="block truncate font-medium">{l.title}</span>
                  <span className="text-sm text-mute">{l.locations ? `${l.locations.name} · ${l.locations.city}` : "—"} · {l.price_from_cents ? `da ${euro(l.price_from_cents)}` : "senza prezzo"}</span></span>
                <span className="flex items-center gap-2"><Badge map={listingStatus} value={l.status} /><span aria-hidden className="text-mute">›</span></span>
              </Link>
            </li>
          ))}
          {!listings?.length && <li className="py-3 text-sm text-mute">Nessun annuncio.</li>}
        </ul>
      </section>
    </div>
  );
}
