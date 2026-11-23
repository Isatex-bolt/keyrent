import { Suspense } from "react";
import Link from "next/link";
import { requireProvider } from "@/lib/auth";
import { userDb } from "@/lib/supabase/server";
import { Badge, orgStatus } from "@/lib/status";
import { bySede, loadFleet } from "@/lib/v2/fleet";
import { keepSede } from "@/lib/v2/pro";
import { DashboardView, dashboardRange } from "@/components/v2/DashboardView";
import { OrgFields } from "@/components/OrgFields";
import { pendingOrgOf } from "@/lib/pendingOrg";
import { Flash, ProHeader, Skeleton, type SP } from "@/components/ProPage";
import { createOrganization, switchOrganization } from "./actions";
import { ProChecklist, type CheckItem } from "@/components/guide/ProChecklist";

export const metadata = { title: "Area noleggiatore" };

export default function Page({ searchParams }: PageProps<"/pro">) {
  return <Suspense fallback={<Skeleton />}><Dashboard searchParams={searchParams} /></Suspense>;
}

async function Dashboard({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const { user, membership, memberships } = await requireProvider("/pro");
  if (!membership) {
    const p = pendingOrgOf(user);
    const org = p ? { ...p, legal_address: { street: p.street ?? "", city: p.city ?? "", postal_code: p.postal_code ?? "", province: p.province ?? "" } } : undefined;
    return (
      <div className="card p-6">
        <ProHeader title={p ? "Conferma i dati della tua attività" : "Registra la tua attività"}
          subtitle={p ? "Abbiamo compilato i dati inseriti in registrazione: controllali e conferma." : "KeyRent è riservato a operatori professionali. Dopo la verifica potrai pubblicare i tuoi mezzi."} />
        <Flash sp={sp} />
        <form action={createOrganization} className="space-y-6">
          <OrgFields org={org} />
          <div className="flex flex-wrap items-center gap-3">
            <button className="btn-primary">Registra attività</button>
            {!p && <Link href="/account" className="btn-ghost">Annulla, resto cliente</Link>}
          </div>
          {!p && <p className="text-xs text-mute">Finché non registri l&apos;attività il tuo account resta un account cliente.</p>}
        </form>
      </div>
    );
  }
  const org = membership.org;
  const { monthStart, to } = dashboardRange();
  const all = await loadFleet(membership.organization_id, org.trade_name ?? org.legal_name, monthStart, to);
  const sede = typeof sp.sede === "string" ? sp.sede : "tutte";
  const db = await userDb();
  const [{ count: sedi }, { data: o }] = await Promise.all([
    db.from("locations").select("id", { count: "exact", head: true }).eq("organization_id", membership.organization_id),
    db.from("organizations").select("vat_number, business_phone, business_email, legal_address").eq("id", membership.organization_id).maybeSingle(),
  ]);
  const addr = (o?.legal_address ?? {}) as Record<string, string>;
  const orgDone = !!(o?.vat_number && (o.business_phone || o.business_email) && addr.city);
  const published = all.vehicles.some((v) => v.status === "published");
  const checklist: CheckItem[] = published
    ? [
      { key: "org", label: "Attività configurata", done: orgDone, href: "/pro/attivita", cta: "Completa" },
      { key: "sede", label: "Prima sede", done: !!sedi, href: "/pro/sedi", cta: "Aggiungi" },
      { key: "mezzo", label: "Primo mezzo pubblicato", done: true, href: "/pro/mezzi", cta: "Vedi" },
      { key: "cal", label: "Controlla la disponibilità nel calendario", done: false, href: "/pro/calendario", cta: "Apri", doneOnClick: true },
      { key: "guida", label: "Scopri come gestire una prenotazione", done: false, href: "/guida/noleggiatori", cta: "Guarda", doneOnClick: true },
    ]
    : [
      { key: "account", label: "Account creato", done: true, href: "/pro/profilo", cta: "" },
      { key: "org", label: "Completa la tua attività", done: orgDone, href: "/pro/attivita", cta: "Completa" },
      { key: "sede", label: "Inserisci una sede", done: !!sedi, href: "/pro/sedi", cta: "Aggiungi" },
      { key: "mezzo", label: "Pubblica il primo mezzo", done: false, href: "/pro/mezzi/nuovo", cta: "Inserisci" },
    ];
  const header = (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold text-navy-900">{org.trade_name ?? org.legal_name}</p>
        <Badge map={orgStatus} value={org.verification_status} />
      </div>
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
      <ProChecklist orgId={membership.organization_id} items={checklist} />
      {org.verification_status === "pending" && (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
          KeyRent sta verificando la tua attività. Intanto puoi aggiungere sedi e mezzi: potrai inviarli in revisione dopo la verifica.
        </p>
      )}
    </>
  );
  return <DashboardView data={bySede(all, sede)} all={all} sede={sede} q={keepSede(sp)} header={header} />;
}
