import { Suspense } from "react";
import { requireStaff } from "@/lib/auth";
import { userDb } from "@/lib/supabase/server";
import { Badge, orgStatus } from "@/lib/status";
import { Flash, ProHeader, Skeleton, type SP } from "@/components/ProPage";
import { setOrgVerification } from "../actions";

export const metadata = { title: "Anagrafiche" };

export default function Page({ searchParams }: PageProps<"/admin/anagrafiche">) {
  return <Suspense fallback={<Skeleton />}><Orgs searchParams={searchParams} /></Suspense>;
}

async function Orgs({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  await requireStaff();
  const db = await userDb();
  const { data: orgs } = await db.from("organizations")
    .select("id, legal_name, trade_name, vat_number, business_email, business_phone, verification_status, created_at, locations(id), listings(id)")
    .order("created_at", { ascending: false });
  type O = { id: string; legal_name: string; trade_name: string | null; vat_number: string; business_email: string | null; business_phone: string | null;
    verification_status: string; locations: { id: string }[]; listings: { id: string }[] };
  return (
    <div className="space-y-4">
      <ProHeader title="Anagrafiche" subtitle="Noleggiatori registrati. Verifica i dati (visura, P.IVA) prima di approvare." />
      <Flash sp={sp} ok={{ "1": "Stato aggiornato." }} />
      {((orgs ?? []) as unknown as O[]).map((o) => (
        <div key={o.id} className="card flex flex-wrap items-center justify-between gap-4 p-4">
          <div className="min-w-0 text-sm">
            <p className="font-semibold">{o.legal_name}{o.trade_name ? ` · ${o.trade_name}` : ""}</p>
            <p className="text-mute">P.IVA {o.vat_number} · {o.business_email ?? "—"} · {o.business_phone ?? "—"}</p>
            <p className="text-mute">{o.locations.length} sedi · {o.listings.length} annunci</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge map={orgStatus} value={o.verification_status} />
            <form action={setOrgVerification} className="flex gap-2">
              <input type="hidden" name="id" value={o.id} />
              {o.verification_status !== "verified" && <button name="status" value="verified" className="btn-primary">Verifica</button>}
              {o.verification_status === "pending" && <button name="status" value="rejected" className="btn-ghost">Rifiuta</button>}
              {o.verification_status === "verified" && <button name="status" value="suspended" className="btn-ghost text-red-700">Sospendi</button>}
            </form>
          </div>
        </div>
      ))}
    </div>
  );
}
