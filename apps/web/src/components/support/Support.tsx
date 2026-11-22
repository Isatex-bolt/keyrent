import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser, requireStaff } from "@/lib/auth";
import { userDb } from "@/lib/supabase/server";
import { serviceDb } from "@/lib/supabase/admin";
import { fmtDateTime } from "@/lib/bookings";
import { Flash, type SP } from "@/components/ProPage";
import { startSupport, replySupport, setSupportStatus } from "@/app/assistenza/actions";

type Mode = "user" | "staff";
type ThreadRow = {
  id: string; subject: string; status: string; last_message_at: string; last_from_staff: boolean;
  requester_id: string; organization_id: string | null; requester_read_at: string | null; staff_read_at: string | null;
};
const COLS = "id, subject, status, last_message_at, last_from_staff, requester_id, organization_id, requester_read_at, staff_read_at";
const OK = { inviato: "Messaggio inviato: il team KeyRent ti risponde qui (e ti avvisiamo per email).", chiusa: "Conversazione segnata come risolta.", riaperta: "Conversazione riaperta." };

const unread = (t: ThreadRow, mode: Mode) => mode === "staff"
  ? !t.last_from_staff && t.status === "open" && (!t.staff_read_at || t.last_message_at > t.staff_read_at)
  : t.last_from_staff && (!t.requester_read_at || t.last_message_at > t.requester_read_at);

/** Nome, email e attività di chi ha scritto (solo per lo staff). */
async function people(rows: { requester_id: string; organization_id: string | null }[]) {
  const db = serviceDb();
  const ids = [...new Set(rows.map((r) => r.requester_id))];
  const orgIds = [...new Set(rows.map((r) => r.organization_id).filter(Boolean))] as string[];
  const [users, orgs] = await Promise.all([
    Promise.all(ids.map(async (id) => {
      const { data } = await db.auth.admin.getUserById(id);
      const m = data.user?.user_metadata ?? {};
      const name = [m.first_name, m.last_name].filter(Boolean).join(" ");
      return [id, { name, email: data.user?.email ?? "" }] as const;
    })),
    orgIds.length ? db.from("organizations").select("id, legal_name, trade_name").in("id", orgIds) : Promise.resolve({ data: [] }),
  ]);
  const orgMap = new Map((orgs.data ?? []).map((o) => [o.id, o.trade_name || o.legal_name]));
  return { user: new Map(users), org: orgMap };
}

export async function SupportInbox({ base, mode, searchParams }: { base: string; mode: Mode; searchParams: SP }) {
  const sp = await searchParams;
  let rows: ThreadRow[] = [];
  let who: Awaited<ReturnType<typeof people>> | null = null;
  if (mode === "staff") {
    const { user } = await requireStaff();
    const { data } = await serviceDb().from("support_threads").select(COLS).neq("requester_id", user.id)
      .order("last_message_at", { ascending: false }).limit(100);
    rows = (data ?? []) as ThreadRow[];
    who = await people(rows);
  } else {
    const user = await requireUser(base);
    const { data } = await (await userDb()).from("support_threads").select(COLS).eq("requester_id", user.id)
      .order("last_message_at", { ascending: false });
    rows = (data ?? []) as ThreadRow[];
  }
  const open = rows.filter((r) => r.status === "open"), closed = rows.filter((r) => r.status === "closed");
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight">{mode === "staff" ? "Messaggi al team" : "Assistenza KeyRent"}</h1>
        <p className="text-sm text-mute">
          {mode === "staff" ? "Domande di noleggiatori e clienti. Rispondi da qui: ricevono la risposta nel sito e per email."
            : "Scrivi al team KeyRent per qualsiasi dubbio: annunci, pagamenti, il tuo account. Ti rispondiamo qui."}
        </p>
      </div>
      <Flash sp={sp} ok={OK} />
      {mode === "user" && (
        <form action={startSupport} className="card space-y-3 p-4">
          <input type="hidden" name="base" value={base} />
          <p className="font-semibold">Nuovo messaggio</p>
          <div><label className="label" htmlFor="subject">Argomento</label>
            <input id="subject" name="subject" required maxLength={200} className="field" placeholder="Es. Come carico i miei mezzi?" /></div>
          <div><label className="label" htmlFor="body">Messaggio</label>
            <textarea id="body" name="body" required rows={4} maxLength={4000} className="field" placeholder="Scrivi qui la tua domanda…" /></div>
          <button className="btn-primary">Invia al team KeyRent</button>
        </form>
      )}
      <List title={mode === "staff" ? "Da gestire" : "Le tue conversazioni"} rows={open} base={base} mode={mode} who={who}
        empty={mode === "staff" ? "Nessun messaggio aperto." : "Non hai ancora scritto al team."} />
      {closed.length > 0 && <List title="Risolte" rows={closed} base={base} mode={mode} who={who} empty="" />}
    </div>
  );
}

function List({ title, rows, base, mode, who, empty }: {
  title: string; rows: ThreadRow[]; base: string; mode: Mode; who: Awaited<ReturnType<typeof people>> | null; empty: string;
}) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-mute">{title}</h2>
      <ul className="card divide-y divide-line">
        {rows.map((t) => {
          const u = who?.user.get(t.requester_id);
          const org = t.organization_id ? who?.org.get(t.organization_id) : null;
          const isNew = unread(t, mode);
          return (
            <li key={t.id}>
              <Link href={`${base}/${t.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-navy-50/50">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${isNew ? "bg-teal-500" : "bg-transparent"}`} />
                <span className="min-w-0 flex-1">
                  <span className={`block truncate ${isNew ? "font-bold" : "font-medium"}`}>{t.subject}</span>
                  <span className="block truncate text-xs text-mute">
                    {mode === "staff"
                      ? [org ? `🏢 ${org}` : "Cliente", u?.name, u?.email].filter(Boolean).join(" · ")
                      : t.last_from_staff ? "Ha risposto il team KeyRent" : "In attesa di risposta"}
                  </span>
                </span>
                <span className="shrink-0 text-xs text-mute">{fmtDateTime(t.last_message_at)}</span>
              </Link>
            </li>
          );
        })}
        {!rows.length && <li className="px-4 py-6 text-sm text-mute">{empty}</li>}
      </ul>
    </section>
  );
}

export async function SupportThread({ params, searchParams, base, mode }: { params: Promise<{ id: string }>; searchParams: SP; base: string; mode: Mode }) {
  const { id } = await params;
  const sp = await searchParams;
  const user = mode === "staff" ? (await requireStaff()).user : await requireUser(`${base}/${id}`);
  const db = await userDb();
  const [{ data: t }, { data: msgs }] = await Promise.all([
    db.from("support_threads").select(COLS).eq("id", id).maybeSingle(),
    db.from("support_messages").select("id, sender_id, from_staff, body, created_at").eq("thread_id", id).order("created_at"),
  ]);
  if (!t || (mode === "user" && t.requester_id !== user.id)) notFound();
  await db.rpc("support_mark_read", { p_thread: id });
  const who = mode === "staff" ? await people([t]) : null;
  const u = who?.user.get(t.requester_id);
  const org = t.organization_id ? who?.org.get(t.organization_id) : null;
  const theirName = mode === "staff" ? (u?.name || u?.email || "Utente") : "Team KeyRent";
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href={base} className="text-sm text-mute hover:text-navy-900">← {mode === "staff" ? "Messaggi" : "Assistenza"}</Link>
          <h1 className="mt-1 text-xl font-bold tracking-tight">{t.subject}</h1>
          {mode === "staff" && (
            <p className="text-sm text-mute">{[org ? `🏢 ${org}` : "Cliente", u?.name, u?.email].filter(Boolean).join(" · ")}</p>
          )}
        </div>
        {mode === "staff" && (
          <form action={setSupportStatus}>
            <input type="hidden" name="thread_id" value={id} />
            <input type="hidden" name="status" value={t.status === "open" ? "closed" : "open"} />
            <button className="btn-ghost">{t.status === "open" ? "✓ Segna come risolta" : "Riapri"}</button>
          </form>
        )}
      </div>
      <Flash sp={sp} ok={OK} />
      <ol className="card space-y-3 p-4">
        {(msgs ?? []).map((m) => {
          const mine = mode === "staff" ? m.from_staff : m.sender_id === user.id;
          return (
            <li key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${mine ? "bg-navy-900 text-white" : "bg-canvas"}`}>
                {!mine && <p className="mb-0.5 text-[11px] font-semibold text-teal-600">{theirName}</p>}
                <p className="whitespace-pre-line">{m.body}</p>
                <p className={`mt-1 text-[11px] ${mine ? "text-white/60" : "text-mute"}`}>{fmtDateTime(m.created_at)}</p>
              </div>
            </li>
          );
        })}
      </ol>
      <form action={replySupport} id="fondo" className="card space-y-2 p-4">
        <input type="hidden" name="thread_id" value={id} />
        <input type="hidden" name="base" value={base} />
        <textarea name="body" required rows={3} maxLength={4000} className="field" placeholder={mode === "staff" ? "Rispondi…" : "Scrivi al team…"} />
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-mute">{mode === "staff" ? "La risposta arriva anche per email." : "Ti avvisiamo per email quando rispondiamo."}</p>
          <button className="btn-primary">Invia</button>
        </div>
      </form>
    </div>
  );
}
