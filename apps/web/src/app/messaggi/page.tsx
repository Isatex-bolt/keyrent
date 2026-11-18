import { Suspense } from "react";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { userDb } from "@/lib/supabase/server";
import { fmtDateTime } from "@/lib/bookings";
import { ProHeader, Skeleton } from "@/components/ProPage";

export const metadata = { title: "Messaggi" };

export default function Page() {
  return <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6"><Suspense fallback={<Skeleton />}><Inbox /></Suspense></div>;
}

type Conv = { id: string; listing_title: string; my_side: string; other_label: string; last_message_at: string | null; last_message: string | null };

async function Inbox() {
  await requireUser("/messaggi");
  const db = await userDb();
  const { data } = await db.rpc("my_conversations");
  const rows = (data ?? []) as Conv[];
  return (
    <div>
      <ProHeader title="Messaggi" subtitle="Per la tua sicurezza le conversazioni restano su KeyRent: i contatti diretti si sbloccano a prenotazione confermata." />
      <ul className="space-y-2">
        {rows.map((c) => (
          <li key={c.id}>
            <Link href={`/messaggi/${c.id}`} className="card block p-4 transition hover:border-teal-500/60">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-semibold">{c.other_label}</p>
                {c.last_message_at && <span className="text-xs text-mute">{fmtDateTime(c.last_message_at)}</span>}
              </div>
              <p className="text-sm text-mute">{c.listing_title}{c.my_side === "provider" ? " · come noleggiatore" : ""}</p>
              {c.last_message && <p className="mt-1 line-clamp-1 text-sm">{c.last_message}</p>}
            </Link>
          </li>
        ))}
        {!rows.length && <li className="card p-6 text-sm text-mute">Nessuna conversazione. Dalla scheda di un mezzo puoi cliccare “Fai una domanda”.</li>}
      </ul>
    </div>
  );
}
