import { Suspense } from "react";
import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { serviceDb } from "@/lib/supabase/admin";
import { publicDb } from "@/lib/supabase/public";
import { Flash, ProHeader, Skeleton, type SP } from "@/components/ProPage";
import { Wizard } from "@/app/pro/mezzi/nuovo/Wizard";
import { EXTRA_SUBCATEGORIES } from "@/data/catalog";
import { createListingForOrg } from "@/app/admin/listingActions";

export const metadata = { title: "Nuovo annuncio per un noleggiatore" };

export default function Page({ params, searchParams }: PageProps<"/admin/anagrafiche/[id]/nuovo">) {
  return <Suspense fallback={<Skeleton />}><New params={params} searchParams={searchParams} /></Suspense>;
}

async function New({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SP }) {
  const { id } = await params;
  const sp = await searchParams;
  await requireStaff();
  const pub = publicDb();
  const [{ data: org }, { data: locations }, { data: cats }, { data: attrs }] = await Promise.all([
    serviceDb().from("organizations").select("legal_name, trade_name").eq("id", id).maybeSingle(),
    serviceDb().from("locations").select("id, name, city").eq("active", true).eq("organization_id", id).order("created_at"),
    pub.from("categories").select("slug, name_it, sort, subcategories(slug, name_it, sort)").eq("active", true).order("sort"),
    pub.from("attribute_definitions").select("key, label_it, data_type, unit, options, sort, categories(slug)").order("sort"),
  ]);
  type C = { slug: string; name_it: string; subcategories: { slug: string; name_it: string; sort: number }[] };
  type A = { key: string; label_it: string; data_type: string; unit: string | null; options: string[] | null; categories: { slug: string } };
  return (
    <div className="space-y-4">
      <Link href={`/admin/anagrafiche/${id}`} className="text-sm text-mute hover:text-navy-900">← {org?.trade_name ?? org?.legal_name ?? "Noleggiatore"}</Link>
      <ProHeader title="Nuovo annuncio per il noleggiatore" subtitle={`Lo prepari tu per ${org?.trade_name ?? org?.legal_name ?? "il cliente"}: nasce come bozza della sua attività, poi lo invii in revisione.`} />
      <Flash sp={sp} />
      {!locations?.length ? <p className="card p-5 text-sm text-mute">Il noleggiatore deve prima avere una sede attiva.</p> : (
        <Wizard action={createListingForOrg} orgId={id} locations={locations}
          cats={((cats ?? []) as unknown as C[]).map((c) => {
            const subs = [...c.subcategories];
            for (const x of EXTRA_SUBCATEGORIES[c.slug] ?? []) if (!subs.some((s) => s.slug === x.slug)) subs.push({ slug: x.slug, name_it: x.name, sort: x.sort });
            return { slug: c.slug, name: c.name_it, subs: subs.sort((a, b) => a.sort - b.sort).map((s) => ({ slug: s.slug, name: s.name_it })) };
          })}
          attrs={((attrs ?? []) as unknown as A[]).map((a) => ({ category: a.categories.slug, key: a.key, label: a.label_it, type: a.data_type, unit: a.unit, options: a.options }))} />
      )}
    </div>
  );
}
