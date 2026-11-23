import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { userDb } from "@/lib/supabase/server";
import { getListing } from "@/lib/data";
import { listingHref } from "@/lib/urls";
import { Flash, Skeleton, type SP } from "@/components/ProPage";
import { startConversation } from "../actions";

export const metadata = { title: "Fai una domanda" };

export default function Page({ searchParams }: PageProps<"/messaggi/nuovo">) {
  return <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6"><Suspense fallback={<Skeleton />}><New searchParams={searchParams} /></Suspense></div>;
}

async function New({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const listing = typeof sp.annuncio === "string" ? sp.annuncio : "";
  const testo = typeof sp.testo === "string" ? sp.testo.slice(0, 1000) : "";
  await requireUser(`/messaggi/nuovo?annuncio=${listing}${testo ? `&testo=${encodeURIComponent(testo)}` : ""}`);
  const data = listing ? await getListing(listing) : null;
  if (!data) notFound();
  const db = await userDb();
  const { data: convs } = await db.rpc("my_conversations");
  const existing = (convs ?? []).find((c: { listing_id: string; my_side: string }) => c.listing_id === listing && c.my_side === "customer");
  if (existing) redirect(`/messaggi/${existing.id}`);
  const l = data.listing;
  return (
    <div className="space-y-4">
      <Link href={listingHref({ id: l.id, slug: l.slug })} className="text-sm text-mute hover:text-navy-900">← {l.title}</Link>
      <h1 className="text-2xl font-bold tracking-tight">{testo ? "Richiedi il noleggio a lungo termine" : "Fai una domanda"}</h1>
      <p className="text-sm text-mute">Scrivi al noleggiatore professionale verificato di {l.city}. Ti risponde qui su KeyRent.</p>
      <Flash sp={sp} />
      <form action={startConversation} className="card space-y-3 p-5">
        <input type="hidden" name="listing_id" value={l.id} />
        <textarea name="body" required rows={5} maxLength={4000} defaultValue={testo} className="field" placeholder="Es. Il camper ha il portabici? Si può ritirare il sabato pomeriggio?" />
        <p className="text-xs text-mute">Non inserire telefono, email o link: verrebbero rimossi automaticamente fino alla conferma della prenotazione.</p>
        <button className="btn-primary">{testo ? "Invia richiesta" : "Invia domanda"}</button>
      </form>
    </div>
  );
}
