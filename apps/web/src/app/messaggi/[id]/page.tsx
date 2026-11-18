import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { userDb } from "@/lib/supabase/server";
import { fmtDateTime } from "@/lib/bookings";
import { Flash, Skeleton, type SP } from "@/components/ProPage";
import { sendMessage } from "../actions";

export const metadata = { title: "Conversazione" };

export default function Page({ params, searchParams }: PageProps<"/messaggi/[id]">) {
  return <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6"><Suspense fallback={<Skeleton />}><Thread params={params} searchParams={searchParams} /></Suspense></div>;
}

async function Thread({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SP }) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await requireUser(`/messaggi/${id}`);
  const db = await userDb();
  const [{ data: convs }, { data: msgs }] = await Promise.all([
    db.rpc("my_conversations", { p_conversation: id }),
    db.from("messages").select("id, sender_id, sender_side, body_shown, filter_result, created_at").eq("conversation_id", id).order("created_at"),
  ]);
  const c = convs?.[0];
  if (!c) notFound();
  await db.rpc("mark_conversation_read", { p_conversation: id });
  return (
    <div className="space-y-4">
      <div>
        <Link href="/messaggi" className="text-sm text-mute hover:text-navy-900">← Messaggi</Link>
        <h1 className="mt-1 text-xl font-bold tracking-tight">{c.other_label}</h1>
        <p className="text-sm text-mute">{c.listing_title}</p>
      </div>
      <Flash sp={sp} />
      <ol className="card space-y-3 p-4">
        {(msgs ?? []).map((m) => {
          const mine = m.sender_id === user.id;
          return (
            <li key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${mine ? "bg-navy-900 text-white" : "bg-canvas"}`}>
                <p className="whitespace-pre-line">{m.body_shown}</p>
                <p className={`mt-1 text-[11px] ${mine ? "text-white/60" : "text-mute"}`}>{fmtDateTime(m.created_at)}</p>
                {mine && m.filter_result !== "clean" && m.filter_result !== "unfiltered" && (
                  <p className="mt-1 text-[11px] text-teal-400">Abbiamo rimosso dati di contatto: si sbloccano a prenotazione confermata.</p>
                )}
              </div>
            </li>
          );
        })}
        {!msgs?.length && <li className="text-sm text-mute">Nessun messaggio.</li>}
      </ol>
      <form action={sendMessage} id="fondo" className="card space-y-2 p-4">
        <input type="hidden" name="conversation_id" value={id} />
        <textarea name="body" required rows={3} maxLength={4000} className="field" placeholder="Scrivi un messaggio…" />
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-mute">{c.booking_confirmed ? "Prenotazione confermata: puoi scambiare i contatti." : "Telefono, email, link e social vengono rimossi fino alla conferma."}</p>
          <button className="btn-primary">Invia</button>
        </div>
      </form>
    </div>
  );
}
