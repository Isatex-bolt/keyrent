import { Suspense } from "react";
import Link from "next/link";
import { requireProvider } from "@/lib/auth";
import { userDb } from "@/lib/supabase/server";
import { Badge, orgStatus, listingStatus } from "@/lib/status";
import { OrgFields } from "@/components/OrgFields";
import { Flash, ProHeader, Skeleton, type SP } from "@/components/ProPage";
import { createOrganization, switchOrganization } from "./actions";

export const metadata = { title: "Area noleggiatore" };

export default function Page({ searchParams }: PageProps<"/pro">) {
  return <Suspense fallback={<Skeleton />}><Dashboard searchParams={searchParams} /></Suspense>;
}

async function Dashboard({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const { membership, memberships } = await requireProvider("/pro");
  if (!membership) {
    return (
      <div className="card p-6">
        <ProHeader title="Registra la tua attività" subtitle="KeyRent è riservato a operatori professionali. Dopo la verifica potrai pubblicare i tuoi mezzi." />
        <Flash sp={sp} />
        <form action={createOrganization} className="space-y-6">
          <OrgFields />
          <button className="btn-primary">Registra attività</button>
        </form>
      </div>
    );
  }
  const db = await userDb();
  const [{ data: listings }, { count: sedi }] = await Promise.all([
    db.from("listings").select("status").eq("organization_id", membership.organization_id),
    db.from("locations").select("id", { count: "exact", head: true }).eq("organization_id", membership.organization_id),
  ]);
  const by = (s: string) => (listings ?? []).filter((l) => l.status === s).length;
  const org = membership.org;
  return (
    <div className="space-y-6">
      <ProHeader title={org.trade_name ?? org.legal_name} action={<Badge map={orgStatus} value={org.verification_status} />} />
      {memberships.length > 1 && (
        <form action={switchOrganization} className="card flex flex-wrap items-center gap-3 p-3">
          <label htmlFor="org" className="text-sm text-mute">Stai lavorando su</label>
          <select id="org" name="organization_id" defaultValue={membership.organization_id} className="field max-w-xs py-2">
            {memberships.map((m) => <option key={m.organization_id} value={m.organization_id}>{m.org.trade_name ?? m.org.legal_name}</option>)}
          </select>
          <button className="btn-ghost">Cambia</button>
        </form>
      )}
      <Flash sp={sp} />
      {org.verification_status === "pending" && (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
          KeyRent sta verificando la tua attività. Intanto puoi aggiungere sedi e mezzi: potrai inviarli in revisione dopo la verifica.
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-4">
        {[["Pubblicati", by("published")], ["In revisione", by("pending_review")], ["Da modificare", by("changes_required")], ["Bozze", by("draft")]].map(([l, n]) => (
          <div key={l} className="card p-4"><p className="text-xs text-mute">{l}</p><p className="mt-1 text-2xl font-bold">{n}</p></div>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Link href={sedi ? "/pro/mezzi/nuovo" : "/pro/sedi"} className="card p-5 transition hover:border-teal-500/60">
          <p className="font-semibold">{sedi ? "Aggiungi un mezzo" : "Aggiungi la prima sede"}</p>
          <p className="mt-1 text-sm text-mute">{sedi ? "Procedura guidata: categoria, modello, caratteristiche, prezzi." : "Ogni mezzo va associato a una sede di ritiro."}</p>
        </Link>
        <Link href="/pro/mezzi" className="card p-5 transition hover:border-teal-500/60">
          <p className="font-semibold">I miei mezzi</p>
          <p className="mt-1 text-sm text-mute">{(listings ?? []).length} annunci · {Object.keys(listingStatus).length} stati possibili</p>
        </Link>
      </div>
    </div>
  );
}
