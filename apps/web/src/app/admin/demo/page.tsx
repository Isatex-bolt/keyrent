import { Suspense } from "react";
import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { serviceDb } from "@/lib/supabase/admin";
import { ProHeader, Skeleton } from "@/components/ProPage";
import { mediaUrl } from "@/lib/supabase/public";
import { DemoTools } from "./DemoTools";
import { clearDemoPhotos } from "./actions";

export default function Page() {
  return <Suspense fallback={<Skeleton />}><Demo /></Suspense>;
}

async function Demo() {
  await requireStaff();
  const db = serviceDb();
  const { data: ls, error } = await db.from("listings")
    .select("id, title, status, listing_media(storage_path, sort), organizations!inner(is_demo)")
    .eq("organizations.is_demo", true).eq("demo_keep", true).order("created_at");
  const { count: bookings } = await db.from("bookings").select("id", { count: "exact", head: true }).like("stripe_payment_intent_id", "pi_demo_%");
  const rows = (ls ?? []) as unknown as { id: string; title: string; status: string; listing_media: { storage_path: string; sort: number }[] }[];
  return (
    <div className="space-y-6">
      <ProHeader title="Account demo" subtitle="L'account di prova per i concessionari: link /demo, utente concessionario@keyrent.it." />
      {error && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Manca la migrazione 0025 nel database.</p>}
      <section className="card space-y-3 p-5">
        <p className="text-sm">Link da mandare: <Link href="/demo" className="font-semibold text-teal-700">keyrent.it/demo</Link> · {rows.length} annunci di esempio · {bookings ?? 0} noleggi finti.</p>
        <p className="text-sm text-mute">Ogni notte la demo torna com&apos;era: noleggi rigenerati rispetto alla data di oggi, annunci creati provando la demo cancellati dopo 24 ore.</p>
        <DemoTools />
      </section>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((l) => {
          const media = [...l.listing_media].sort((a, b) => a.sort - b.sort);
          return (
            <div key={l.id} className="card overflow-hidden">
              <div className="grid grid-cols-3 gap-0.5 bg-navy-50">
                {[0, 1, 2].map((i) => {
                  const m = media.find((x) => x.sort === i);
                  return m
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img key={i} src={mediaUrl(m.storage_path)} alt="" className="aspect-[4/3] w-full object-cover" />
                    : <div key={i} className="grid aspect-[4/3] place-items-center text-xs text-mute">manca</div>;
                })}
              </div>
              <div className="flex items-center justify-between gap-2 p-3">
                <p className="min-w-0 truncate text-sm font-semibold">{l.title}</p>
                {media.length > 0 && (
                  <form action={clearDemoPhotos.bind(null, l.id)}>
                    <button className="flex-none text-xs font-semibold text-mute hover:text-red-700">Rifai foto</button>
                  </form>
                )}
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
