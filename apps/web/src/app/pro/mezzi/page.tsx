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
    .order("updated_at", { ascending: false });
  type Row = { id: string; title: string; status: string; quantity_mode: string; price_from_cents: number | null;
    categories: { name_it: string } | null; locations: { city: string } | null };
  return (
    <div>
      <ProHeader title="I miei mezzi" action={canEdit(membership) && <Link href="/pro/mezzi/nuovo" className="btn-primary">+ Aggiungi mezzo</Link>} />
      <Flash sp={sp} />
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
