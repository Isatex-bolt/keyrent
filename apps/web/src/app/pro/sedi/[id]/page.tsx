import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireProvider, canEdit } from "@/lib/auth";
import { userDb } from "@/lib/supabase/server";
import { AddressFields } from "@/components/AddressFields";
import { Flash, ProHeader, Skeleton, type SP } from "@/components/ProPage";
import { updateLocation } from "../../actions";

export const metadata = { title: "Modifica sede" };

export default function Page({ params, searchParams }: PageProps<"/pro/sedi/[id]">) {
  return <Suspense fallback={<Skeleton />}><Edit params={params} searchParams={searchParams} /></Suspense>;
}

async function Edit({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SP }) {
  const { id } = await params;
  const sp = await searchParams;
  const { membership } = await requireProvider(`/pro/sedi/${id}`);
  if (!membership || !canEdit(membership)) redirect("/pro/sedi");
  const db = await userDb();
  const { data: s } = await db.from("locations")
    .select("id, name, address_line, postal_code, city, province, latitude, longitude, phone, pickup_instructions")
    .eq("id", id).eq("organization_id", membership.organization_id).maybeSingle();
  if (!s) notFound();
  return (
    <div className="space-y-6">
      <div>
        <Link href="/pro/sedi" className="text-sm text-mute hover:text-navy-900">← Le mie sedi</Link>
        <ProHeader title={`Modifica: ${s.name}`} subtitle="Le modifiche valgono subito per tutti i mezzi di questa sede." />
      </div>
      <Flash sp={sp} />
      <form action={updateLocation} className="card space-y-4 p-6">
        <input type="hidden" name="id" value={s.id} />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><label className="label" htmlFor="name">Nome sede</label>
            <input id="name" name="name" defaultValue={s.name} className="field" /></div>
          <AddressFields initial={{ address_line: s.address_line, postal_code: s.postal_code, city: s.city, province: s.province, lat: s.latitude, lng: s.longitude }} />
          <div><label className="label" htmlFor="phone">Telefono sede</label>
            <input id="phone" name="phone" type="tel" defaultValue={s.phone ?? ""} className="field" /></div>
          <div className="sm:col-span-2"><label className="label" htmlFor="pickup_instructions">Istruzioni per il ritiro</label>
            <textarea id="pickup_instructions" name="pickup_instructions" rows={3} defaultValue={s.pickup_instructions ?? ""} className="field" /></div>
        </div>
        <div className="flex gap-3">
          <button className="btn-primary">Salva modifiche</button>
          <Link href="/pro/sedi" className="btn-ghost">Annulla</Link>
        </div>
      </form>
    </div>
  );
}
