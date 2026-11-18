import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireProvider, canEdit } from "@/lib/auth";
import { userDb } from "@/lib/supabase/server";
import { publicDb } from "@/lib/supabase/public";
import { Flash, ProHeader, Skeleton, type SP } from "@/components/ProPage";
import { Wizard } from "./Wizard";

export const metadata = { title: "Aggiungi mezzo" };

export default function Page({ searchParams }: PageProps<"/pro/mezzi/nuovo">) {
  return <Suspense fallback={<Skeleton />}><New searchParams={searchParams} /></Suspense>;
}

async function New({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const { membership } = await requireProvider("/pro/mezzi/nuovo");
  if (!membership) redirect("/pro");
  if (!canEdit(membership)) redirect("/pro/mezzi");
  const db = await userDb();
  const pub = publicDb();
  const [{ data: locations }, { data: cats }, { data: models }, { data: attrs }] = await Promise.all([
    db.from("locations").select("id, name, city").eq("active", true).eq("organization_id", membership.organization_id).order("created_at"),
    pub.from("categories").select("slug, name_it, sort, subcategories(slug, name_it, sort)").eq("active", true).order("sort"),
    pub.from("models").select("slug, name, makes(slug, name), categories(slug)").order("name"),
    pub.from("attribute_definitions").select("key, label_it, data_type, unit, options, sort, categories(slug)").order("sort"),
  ]);
  if (!locations?.length) {
    return (
      <div className="card p-6">
        <ProHeader title="Prima aggiungi una sede" subtitle="Ogni mezzo va associato a una sede di ritiro." />
        <Link href="/pro/sedi" className="btn-primary">Aggiungi sede</Link>
      </div>
    );
  }
  type M = { slug: string; name: string; makes: { slug: string; name: string }; categories: { slug: string } };
  const makes = new Map<string, { slug: string; name: string; category: string; models: { slug: string; name: string }[] }>();
  for (const m of (models ?? []) as unknown as M[]) {
    const k = `${m.categories.slug}:${m.makes.slug}`;
    const e = makes.get(k) ?? { slug: m.makes.slug, name: m.makes.name, category: m.categories.slug, models: [] };
    e.models.push({ slug: m.slug, name: m.name });
    makes.set(k, e);
  }
  type C = { slug: string; name_it: string; subcategories: { slug: string; name_it: string; sort: number }[] };
  type A = { key: string; label_it: string; data_type: string; unit: string | null; options: string[] | null; categories: { slug: string } };
  return (
    <div>
      <ProHeader title="Aggiungi un mezzo" subtitle="Procedura guidata in 7 passi. Puoi modificare tutto anche dopo." />
      <Flash sp={sp} />
      <Wizard
        locations={locations}
        cats={((cats ?? []) as unknown as C[]).map((c) => ({ slug: c.slug, name: c.name_it, subs: [...c.subcategories].sort((a, b) => a.sort - b.sort).map((s) => ({ slug: s.slug, name: s.name_it })) }))}
        makes={[...makes.values()].sort((a, b) => a.name.localeCompare(b.name, "it"))}
        attrs={((attrs ?? []) as unknown as A[]).map((a) => ({ category: a.categories.slug, key: a.key, label: a.label_it, type: a.data_type, unit: a.unit, options: a.options }))}
      />
    </div>
  );
}
