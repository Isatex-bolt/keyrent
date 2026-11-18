import { Suspense } from "react";
import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { userDb } from "@/lib/supabase/server";
import { Badge, listingStatus } from "@/lib/status";
import { Flash, ProHeader, Skeleton, type SP } from "@/components/ProPage";

export const metadata = { title: "Revisione annunci" };

export default function Page({ searchParams }: PageProps<"/admin/revisione">) {
  return <Suspense fallback={<Skeleton />}><Queue searchParams={searchParams} /></Suspense>;
}

async function Queue({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  await requireStaff();
  const db = await userDb();
  const { data: revs } = await db.from("listing_revisions")
    .select("id, number, submitted_at, snapshot, listing:listings(id, title, status, organizations(legal_name, trade_name))")
    .eq("status", "pending_review").order("submitted_at");
  const { data: all } = await db.from("listings").select("id, title, status, updated_at, organizations(legal_name)")
    .in("status", ["published", "changes_required", "suspended", "unpublished"]).order("updated_at", { ascending: false }).limit(30);
  type R = { id: string; number: number; submitted_at: string; snapshot: { changes?: object };
    listing: { id: string; title: string; status: string; organizations: { legal_name: string; trade_name: string | null } } };
  return (
    <div className="space-y-6">
      <ProHeader title="Revisione annunci" subtitle="In ordine di arrivo." />
      <Flash sp={sp} ok={{ approvato: "Annuncio approvato e pubblicato." }} />
      <ul className="space-y-2">
        {((revs ?? []) as unknown as R[]).map((r) => (
          <li key={r.id}>
            <Link href={`/admin/revisione/${r.listing.id}`} className="card flex flex-wrap items-center justify-between gap-3 p-4 transition hover:border-teal-500/60">
              <div>
                <p className="font-semibold">{r.listing.title}</p>
                <p className="text-sm text-mute">{r.listing.organizations.trade_name ?? r.listing.organizations.legal_name} · {r.snapshot?.changes ? "modifica a un annuncio pubblicato" : "nuovo annuncio"} · {new Date(r.submitted_at).toLocaleString("it-IT", { timeZone: "Europe/Rome" })}</p>
              </div>
              <Badge map={listingStatus} value={r.listing.status} />
            </Link>
          </li>
        ))}
        {!revs?.length && <li className="card p-6 text-sm text-mute">Nessun annuncio in attesa.</li>}
      </ul>
      <section>
        <h2 className="mb-2 font-semibold">Altri annunci</h2>
        <ul className="card divide-y divide-line">
          {((all ?? []) as unknown as { id: string; title: string; status: string; organizations: { legal_name: string } }[]).map((l) => (
            <li key={l.id}><Link href={`/admin/revisione/${l.id}`} className="flex items-center justify-between gap-3 p-3 text-sm hover:bg-canvas">
              <span>{l.title} <span className="text-mute">· {l.organizations.legal_name}</span></span><Badge map={listingStatus} value={l.status} />
            </Link></li>
          ))}
        </ul>
      </section>
    </div>
  );
}
