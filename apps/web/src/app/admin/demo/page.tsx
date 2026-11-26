import { Suspense } from "react";
import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { serviceDb } from "@/lib/supabase/admin";
import { ProHeader, Skeleton } from "@/components/ProPage";
import { mediaUrl } from "@/lib/supabase/public";
import { DemoTools } from "./DemoTools";
import { DemoUpload } from "./DemoUpload";
import { DemoLinkMaker } from "./DemoLinkMaker";

export default function Page() {
  return <Suspense fallback={<Skeleton />}><Demo /></Suspense>;
}

async function Demo() {
  await requireStaff();
  const db = serviceDb();
  const { data: ls, error } = await db.from("listings")
    .select("id, title, status, listing_media(storage_path, sort), organizations!inner(is_demo)")
    .eq("organizations.is_demo", true).is("organizations.demo_clone_of", null).eq("demo_keep", true).order("created_at");
  const { data: clones } = await db.rpc("svc_demo_clones_active");
  const { count: bookings } = await db.from("bookings").select("id", { count: "exact", head: true }).like("stripe_payment_intent_id", "pi_demo_%");
  // chi ha aperto i link personali (keyrent.it/demo?da=nome)
  const { data: vs } = await db.from("demo_visits").select("ref, first_seen, last_seen, visits, entered, entered_at, clone_org").order("last_seen", { ascending: false }).limit(200);
  const visits = (vs ?? []) as { ref: string; first_seen: string; last_seen: string; visits: number; entered: number; entered_at: string | null; clone_org: string | null }[];
  const orgs = visits.map((v) => v.clone_org).filter(Boolean) as string[];
  const { data: made } = orgs.length
    ? await db.from("listings").select("organization_id").in("organization_id", orgs).is("demo_source_id", null)
    : { data: [] as { organization_id: string }[] };
  const created = new Map<string, number>();
  for (const m of (made ?? []) as { organization_id: string }[]) created.set(m.organization_id, (created.get(m.organization_id) ?? 0) + 1);
  const when = (iso: string | null) => iso ? new Date(iso).toLocaleString("it-IT", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome" }) : "—";
  const rows = (ls ?? []) as unknown as { id: string; title: string; status: string; listing_media: { storage_path: string; sort: number }[] }[];
  return (
    <div className="space-y-6">
      <ProHeader title="Account demo" subtitle="L'account di prova per i concessionari: link /demo, utente concessionario@keyrent.it." />
      {error && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Manca la migrazione 0025 nel database.</p>}
      <section className="card space-y-4 p-5">
        <div>
          <h2 className="font-semibold">Chi ha aperto la demo</h2>
          <p className="text-sm text-mute">Per sapere chi la prova, manda a ognuno il suo link personale: lo crei qui sotto e lo incolli nell&apos;email al posto di keyrent.it/demo.</p>
        </div>
        <DemoLinkMaker />
        {visits.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead><tr className="text-left text-mute"><th className="py-2">Link</th><th className="py-2">Prima visita</th><th className="py-2 text-right">Visite</th><th className="py-2">Entrato nell&apos;area</th><th className="py-2 text-right">Annunci provati</th></tr></thead>
              <tbody>
                {visits.map((v) => (
                  <tr key={v.ref} className="border-t border-line">
                    <td className="py-2 font-semibold">{v.ref}</td>
                    <td className="py-2">{when(v.first_seen)}</td>
                    <td className="py-2 text-right">{v.visits}</td>
                    <td className="py-2">{v.entered ? <span className="font-semibold text-emerald-700">Sì · {when(v.entered_at)}{v.entered > 1 ? ` (${v.entered} volte)` : ""}</span> : <span className="text-mute">Non ancora</span>}</td>
                    <td className="py-2 text-right">{v.clone_org ? created.get(v.clone_org) ?? 0 : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="text-sm text-mute">Nessun link personale aperto finora.</p>}
      </section>

      <section className="card space-y-3 p-5">
        <p className="text-sm">Link da mandare: <Link href="/demo" className="font-semibold text-teal-700">keyrent.it/demo</Link> · {rows.length} annunci di esempio · {bookings ?? 0} noleggi finti · {typeof clones === "number" ? clones : 0} demo personali attive.</p>
        <p className="text-sm text-mute">Ogni visitatore riceve una copia tutta sua (con le foto caricate qui), cancellata dopo 24 ore. Ogni notte la demo torna com&apos;era: noleggi rigenerati rispetto alla data di oggi, annunci creati provando la demo cancellati dopo 24 ore.</p>
        <p className="text-sm text-mute">Foto: per ogni mezzo premi <strong>Carica foto</strong> e scegli l&apos;immagine (anche dal telefono). La nuova sostituisce quelle che ci sono.</p>
        <DemoTools />
      </section>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((l) => {
          const media = [...l.listing_media].sort((a, b) => a.sort - b.sort);
          return (
            <div key={l.id} className="card overflow-hidden">
              {media[0]
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={mediaUrl(media[0].storage_path)} alt="" className="aspect-[4/3] w-full bg-navy-50 object-cover" />
                : <div className="grid aspect-[4/3] place-items-center bg-navy-50 text-sm text-mute">Nessuna foto</div>}
              <div className="space-y-2 p-3">
                <p className="min-w-0 truncate text-sm font-semibold">{l.title}</p>
                <DemoUpload listingId={l.id} />
                {media.length > 1 && <p className="text-xs text-mute">{media.length} foto: caricandone una nuova restano solo quella.</p>}
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
