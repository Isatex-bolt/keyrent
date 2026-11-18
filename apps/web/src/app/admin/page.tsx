import { Suspense } from "react";
import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { userDb } from "@/lib/supabase/server";
import { ProHeader, Skeleton } from "@/components/ProPage";

export const metadata = { title: "Admin" };

export default function Page() {
  return <Suspense fallback={<Skeleton />}><Dash /></Suspense>;
}

async function Dash() {
  const { role } = await requireStaff();
  const db = await userDb();
  const count = async (q: PromiseLike<{ count: number | null }>) => (await q).count ?? 0;
  const [pending, orgs, published, revisions] = await Promise.all([
    count(db.from("listings").select("id", { count: "exact", head: true }).eq("status", "pending_review")),
    count(db.from("organizations").select("id", { count: "exact", head: true }).eq("verification_status", "pending")),
    count(db.from("listings").select("id", { count: "exact", head: true }).eq("status", "published")),
    count(db.from("listing_revisions").select("id", { count: "exact", head: true }).eq("status", "pending_review")),
  ]);
  const cards = [
    ["/admin/revisione", "Annunci da revisionare", pending], ["/admin/revisione", "Revisioni in coda (anche modifiche)", revisions],
    ["/admin/anagrafiche", "Attività da verificare", orgs], ["/cerca", "Annunci pubblicati", published],
  ] as const;
  return (
    <div>
      <ProHeader title="Dashboard" subtitle={`Ruolo: ${role}`} />
      <div className="grid gap-3 sm:grid-cols-2">
        {cards.map(([href, label, n]) => (
          <Link key={label} href={href} className="card p-5 transition hover:border-teal-500/60">
            <p className="text-sm text-mute">{label}</p><p className="mt-1 text-3xl font-bold">{n}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
