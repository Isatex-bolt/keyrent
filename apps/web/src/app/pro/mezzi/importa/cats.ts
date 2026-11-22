import "server-only";
import { publicDb } from "@/lib/supabase/public";
import { EXTRA_SUBCATEGORIES } from "@/data/catalog";
import type { Cat } from "@/lib/importSheet";

export async function importCats(): Promise<Cat[]> {
  const { data } = await publicDb().from("categories").select("slug, name_it, sort, subcategories(slug, name_it, sort)").eq("active", true).order("sort");
  type C = { slug: string; name_it: string; subcategories: { slug: string; name_it: string; sort: number }[] };
  return ((data ?? []) as unknown as C[]).map((c) => {
    const subs = [...c.subcategories];
    for (const x of EXTRA_SUBCATEGORIES[c.slug] ?? []) if (!subs.some((s) => s.slug === x.slug)) subs.push({ slug: x.slug, name_it: x.name, sort: x.sort });
    return { slug: c.slug, name: c.name_it, subs: subs.sort((a, b) => a.sort - b.sort).map((s) => ({ slug: s.slug, name: s.name_it })) };
  });
}
