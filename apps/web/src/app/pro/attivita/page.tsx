import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireProvider } from "@/lib/auth";
import { userDb } from "@/lib/supabase/server";
import { Badge, orgStatus } from "@/lib/status";
import { OrgFields } from "@/components/OrgFields";
import { Flash, ProHeader, Skeleton, type SP } from "@/components/ProPage";
import { updateOrganization } from "../actions";

export const metadata = { title: "La mia attività" };

export default function Page({ searchParams }: PageProps<"/pro/attivita">) {
  return <Suspense fallback={<Skeleton />}><Org searchParams={searchParams} /></Suspense>;
}

async function Org({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const { membership } = await requireProvider("/pro/attivita");
  if (!membership) redirect("/pro");
  const db = await userDb();
  const { data: org } = await db.from("organizations").select("*").eq("id", membership.organization_id).single();
  return (
    <div className="card p-6">
      <ProHeader title="La mia attività" subtitle="Anagrafica business: è distinta dal tuo profilo personale." action={<Badge map={orgStatus} value={org.verification_status} />} />
      <Flash sp={sp} />
      <form action={updateOrganization} className="space-y-6">
        <OrgFields org={org} lockLegal />
        <p className="text-xs text-mute">Ragione sociale e partita IVA si modificano solo tramite l&apos;assistenza KeyRent, perché sono oggetto di verifica.</p>
        {membership.role === "owner" && <button className="btn-primary">Salva</button>}
      </form>
    </div>
  );
}
