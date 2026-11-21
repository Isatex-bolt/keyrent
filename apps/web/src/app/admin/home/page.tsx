import { Suspense } from "react";
import Image from "next/image";
import { requireStaff } from "@/lib/auth";
import { getCollections, getDestinations, TILE_GRADIENT } from "@/lib/content";
import { ProHeader, Skeleton } from "@/components/ProPage";
import { ContentImage } from "./ContentImage";

export const metadata = { title: "Immagini home" };
export const maxDuration = 90;

export default function Page() {
  return <Suspense fallback={<Skeleton />}><Content /></Suspense>;
}

async function Content() {
  await requireStaff();
  const [cols, dests] = await Promise.all([getCollections(), getDestinations()]);
  if (cols.length === 0 && dests.length === 0) {
    return (
      <div className="space-y-4">
        <ProHeader title="Immagini home" subtitle="Manca un aggiornamento del database." />
        <p className="card p-4 text-sm">Esegui prima nell&apos;editor SQL di Supabase il blocco &quot;Home&quot; che ti ho mandato in chat.</p>
      </div>
    );
  }
  const Row = ({ img, title, sub, kind, slug, grad }: { img: string | null; title: string; sub: string; kind: "collection" | "destination"; slug: string; grad?: string }) => (
    <div className="flex flex-wrap items-center gap-4 p-3">
      <div className={`relative h-20 w-32 flex-none overflow-hidden rounded-xl bg-gradient-to-br ${grad ?? "from-navy-800 to-teal-500"}`}>
        {img && <Image src={img} alt="" fill sizes="128px" className="object-cover" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{title}</p>
        <p className="text-xs text-mute">{sub}{img ? "" : " · nessuna foto (si vede il colore)"}</p>
      </div>
      <ContentImage kind={kind} slug={slug} />
    </div>
  );
  return (
    <div className="space-y-6">
      <ProHeader title="Immagini home" subtitle="Le foto dei riquadri “Cosa ti serve oggi?” e delle mete “Dove andare”. Puoi crearle con l'AI o caricarle tu." />
      <section>
        <h2 className="mb-2 font-bold">Cosa ti serve oggi?</h2>
        <div className="card divide-y divide-line">
          {cols.map((c) => <Row key={c.slug} img={c.image} title={c.title} sub={c.subtitle} kind="collection" slug={c.slug} grad={TILE_GRADIENT[c.slug]} />)}
        </div>
      </section>
      <section>
        <h2 className="mb-2 font-bold">Dove andare</h2>
        <div className="card divide-y divide-line">
          {dests.map((d) => <Row key={d.slug} img={d.image} title={d.name} sub={`${d.region} · ${d.tagline}`} kind="destination" slug={d.slug} />)}
        </div>
      </section>
    </div>
  );
}
