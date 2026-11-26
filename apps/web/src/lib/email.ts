import "server-only";
import { after } from "next/server";
import { serviceDb } from "./supabase/admin";

/**
 * Invio delle email di KeyRent (notifiche) con Resend.
 * Le email nascono nel database (tabella email_deliveries, stato "pending") e partono da qui.
 * Senza RESEND_API_KEY non si invia nulla e le email restano in attesa: mai simulare l'invio.
 */

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "https://keyrent.it").replace(/\/$/, "");
const FROM = process.env.EMAIL_FROM || "KeyRent <noreply@keyrent.it>";
const MAX_ATTEMPTS = 5;

type Payload = Record<string, string | null | undefined>;
type Mail = { subject: string; title: string; intro: string; cta?: { label: string; href: string }; note?: string };

const LISTING_TEXT: Record<string, [string, string]> = {
  listing_approved: ["Il tuo annuncio è online ✅", "è stato approvato ed è ora visibile ai clienti su KeyRent."],
  listing_changes_approved: ["Modifiche approvate ✅", "le modifiche al tuo annuncio sono state approvate e sono online."],
  listing_changes_required: ["Servono alcune modifiche al tuo annuncio", "ha bisogno di qualche modifica prima di essere pubblicato."],
  listing_rejected: ["Il tuo annuncio non è stato approvato", "non è stato approvato."],
  listing_changes_rejected: ["Modifiche non approvate", "le modifiche non sono state approvate: l'annuncio resta online com'era."],
};

/** Testo di ogni email. null = tipo di notifica senza email. */
function compose(type: string, p: Payload, side: "provider" | "customer"): Mail | null {
  const code = p.code ? ` ${p.code}` : "";
  const booking = (who: "provider" | "customer") =>
    who === "provider" ? `${SITE}/pro/prenotazioni` : `${SITE}/account/prenotazioni/${p.booking_id}`;
  switch (type) {
    case "booking_requested":
      return {
        subject: `Nuova richiesta di prenotazione${code}`,
        title: "Hai una nuova richiesta di prenotazione",
        intro: "Un cliente ha chiesto di prenotare uno dei tuoi mezzi. Hai 24 ore per accettare o rifiutare: finché non accetti, al cliente non viene addebitato nulla.",
        cta: { label: "Vedi la richiesta", href: `${SITE}/pro/richieste` },
      };
    case "booking_accepted":
      return {
        subject: `Prenotazione${code} accettata`,
        title: "Il noleggiatore ha accettato la tua richiesta",
        intro: "Buone notizie: la tua richiesta è stata accettata. Apri la prenotazione per vedere i dettagli e completare la conferma.",
        cta: { label: "Apri la prenotazione", href: booking("customer") },
      };
    case "booking_declined":
      return {
        subject: `Richiesta${code} non accettata`,
        title: "La tua richiesta non è stata accettata",
        intro: "Il noleggiatore non può soddisfare questa richiesta. Non ti è stato addebitato nulla: puoi cercare un altro mezzo per le stesse date.",
        cta: { label: "Cerca un altro mezzo", href: `${SITE}/cerca` },
      };
    case "booking_expired":
      return side === "provider"
        ? { subject: `Richiesta${code} scaduta`, title: "Una richiesta è scaduta", intro: "Una richiesta di prenotazione non ha ricevuto risposta entro 24 ore ed è scaduta. Rispondere in tempo migliora la tua posizione nei risultati.", cta: { label: "Vai alle richieste", href: `${SITE}/pro/richieste` } }
        : { subject: `Richiesta${code} scaduta`, title: "La tua richiesta è scaduta", intro: "Il noleggiatore non ha risposto in tempo. Non ti è stato addebitato nulla: puoi cercare un altro mezzo per le stesse date.", cta: { label: "Cerca un altro mezzo", href: `${SITE}/cerca` } };
    case "booking_confirmed":
      return side === "provider"
        ? { subject: `Prenotazione${code} confermata`, title: "Prenotazione confermata", intro: "Il cliente ha confermato la prenotazione. Trovi date, mezzo e contatti nella tua area noleggiatore.", cta: { label: "Vedi la prenotazione", href: booking("provider") } }
        : { subject: `Prenotazione${code} confermata`, title: "La tua prenotazione è confermata 🎉", intro: "Tutto pronto! Nella prenotazione trovi indirizzo di ritiro, contatti del noleggiatore e istruzioni.", cta: { label: "Apri la prenotazione", href: booking("customer") } };
    case "booking_cancelled":
      return side === "provider"
        ? { subject: `Prenotazione${code} annullata`, title: "Una prenotazione è stata annullata", intro: "Il mezzo torna disponibile per quelle date.", cta: { label: "Vedi le prenotazioni", href: booking("provider") } }
        : { subject: `Prenotazione${code} annullata`, title: "La prenotazione è stata annullata", intro: "Trovi i dettagli dell'annullamento e di un eventuale rimborso nella prenotazione.", cta: { label: "Apri la prenotazione", href: booking("customer") } };
    case "payout_paid":
      return { subject: "Pagamento inviato", title: "Ti abbiamo inviato un pagamento", intro: "Il pagamento per una prenotazione conclusa è stato inviato al tuo conto.", cta: { label: "Vai alla tua area", href: `${SITE}/pro` } };
    case "new_message":
      return {
        subject: "Nuovo messaggio su KeyRent",
        title: "Hai un nuovo messaggio",
        intro: side === "provider" ? "Un cliente ti ha scritto. Rispondere in fretta aumenta le prenotazioni." : "Il noleggiatore ti ha risposto.",
        cta: { label: "Leggi e rispondi", href: `${SITE}/${side === "provider" ? "pro/messaggi" : "messaggi"}/${p.conversation_id}` },
      };
    case "support_to_staff":
      return {
        subject: `Nuovo messaggio al team: ${p.subject ?? ""}`.trim(),
        title: "Un utente ha scritto al team KeyRent",
        intro: `Argomento: “${p.subject ?? ""}”. Rispondi dall'area admin: la risposta gli arriva nel sito e per email.`,
        cta: { label: "Leggi e rispondi", href: `${SITE}/admin/messaggi/${p.thread_id}` },
      };
    case "support_reply":
      return {
        subject: "Il team KeyRent ti ha risposto",
        title: "Il team KeyRent ti ha risposto",
        intro: `Hai una risposta alla tua richiesta “${p.subject ?? ""}”.`,
        cta: { label: "Leggi la risposta", href: `${SITE}${p.path ?? "/assistenza"}` },
      };
    default:
      if (LISTING_TEXT[type]) {
        const [subject, text] = LISTING_TEXT[type];
        return {
          subject, title: subject,
          intro: `“${p.title ?? "Il tuo annuncio"}” ${text}`,
          note: p.message ? `Nota di KeyRent: ${p.message}` : undefined,
          cta: { label: "Apri l'annuncio", href: `${SITE}/pro/mezzi/${p.listing_id}` },
        };
      }
      return null;
  }
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export function renderEmail(m: Mail, name?: string | null) {
  const hello = name ? `Ciao ${esc(name)},` : "Ciao,";
  const html = `<!doctype html><html lang="it"><body style="margin:0;background:#F4F6F9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0F1A2B">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F6F9;padding:32px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:20px;overflow:hidden">
<tr><td style="padding:28px 32px 8px"><img src="${SITE}/brand/keyrent-logo-email.png" width="160" height="35" alt="KeyRent" style="display:block;border:0"></td></tr>
<tr><td style="padding:16px 32px 8px"><h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;color:#011938">${esc(m.title)}</h1>
<p style="margin:0 0 12px;font-size:16px;line-height:1.55">${hello}</p>
<p style="margin:0 0 16px;font-size:16px;line-height:1.55;color:#33404F">${esc(m.intro)}</p>
${m.note ? `<p style="margin:0 0 16px;padding:12px 14px;border-radius:12px;background:#E3F5F5;font-size:15px;line-height:1.5;color:#0F1A2B">${esc(m.note)}</p>` : ""}
${m.cta ? `<p style="margin:24px 0 8px"><a href="${m.cta.href}" style="display:inline-block;background:#02A8A9;color:#010E20;text-decoration:none;font-weight:700;font-size:16px;padding:14px 24px;border-radius:12px">${esc(m.cta.label)}</a></p>` : ""}
</td></tr>
<tr><td style="padding:24px 32px 28px;font-size:12px;line-height:1.5;color:#6B7685;border-top:1px solid #E1E7EF">
Ricevi questa email perché hai un account su KeyRent.it. Per la tua sicurezza non rispondere a questa email: scrivi dalla chat del sito.<br>KeyRent.it · noleggio di mezzi da professionisti verificati
</td></tr></table></td></tr></table></body></html>`;
  const text = `${m.title}\n\n${hello}\n${m.intro}\n${m.note ? `\n${m.note}\n` : ""}${m.cta ? `\n${m.cta.label}: ${m.cta.href}\n` : ""}\n— KeyRent.it`;
  return { html, text };
}

type Row = {
  id: string; user_id: string | null; template: string; attempts: number; created_at: string;
  notifications: { type: string; payload: Payload } | null;
};

/** Invia le email in attesa (al massimo `limit`). Sicuro da chiamare più volte in parallelo. */
export async function flushEmails(limit = 25) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { sent: 0, skipped: 0, failed: 0, waiting: true };
  const db = serviceDb();
  const { data, error } = await db.from("email_deliveries")
    .select("id, user_id, template, attempts, created_at, notifications(type, payload)")
    .eq("status", "pending").order("created_at").limit(limit);
  if (error) throw new Error(error.message);
  let sent = 0, skipped = 0, failed = 0;

  for (const r of (data ?? []) as unknown as Row[]) {
    // presa in carico: solo chi incrementa per primo i tentativi invia questa email
    const { data: claimed } = await db.from("email_deliveries").update({ attempts: r.attempts + 1 })
      .eq("id", r.id).eq("status", "pending").eq("attempts", r.attempts).select("id");
    if (!claimed?.length) continue;
    const finish = (status: "sent" | "skipped" | "failed", extra: Record<string, unknown> = {}) =>
      db.from("email_deliveries").update({ status, ...extra }).eq("id", r.id);

    const payload = r.notifications?.payload ?? {};
    if (!r.user_id) { await finish("skipped", { error: "utente non trovato" }); skipped++; continue; }

    // messaggi: al massimo un'email ogni 15 minuti per conversazione e destinatario
    const threadKey = r.template === "new_message" ? "conversation_id" : r.template.startsWith("support_") ? "thread_id" : null;
    if (threadKey) {
      const since = new Date(Date.now() - 15 * 60_000).toISOString();
      const { data: recent } = await db.from("email_deliveries")
        .select("id, notifications!inner(payload)").eq("user_id", r.user_id).eq("template", r.template)
        .eq("status", "sent").gte("updated_at", since)
        .eq(`notifications.payload->>${threadKey}`, String(payload[threadKey] ?? ""));
      if (recent?.length) { await finish("skipped", { error: "già avvisato da poco" }); skipped++; continue; }
    }

    const { data: u } = await db.auth.admin.getUserById(r.user_id);
    const email = u?.user?.email;
    if (!email) { await finish("skipped", { error: "email mancante" }); skipped++; continue; }
    // account della demo (clienti finti, visitatori, account condiviso): nessuna email vera, niente rimbalzi
    if (/@(demo|prova)\.keyrent\.it$/i.test(email) || email.toLowerCase() === "concessionario@keyrent.it") {
      await finish("skipped", { error: "account demo" }); skipped++; continue;
    }
    const providerOnly = r.template.startsWith("support_") || r.template.startsWith("listing_") || r.template === "payout_paid" || r.template === "booking_requested";
    const isProvider = providerOnly || await providerSide(db, payload, r.user_id);
    const mail = compose(r.template, payload, isProvider ? "provider" : "customer");
    if (!mail) { await finish("skipped", { error: "tipo senza email" }); skipped++; continue; }

    const { html, text } = renderEmail(mail, (u?.user?.user_metadata?.first_name as string | undefined) ?? null);
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "Idempotency-Key": r.id },
        body: JSON.stringify({ from: FROM, to: [email], subject: mail.subject, html, text }),
      });
      const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
      if (res.ok) { await finish("sent", { provider_message_id: body.id ?? null, error: null }); sent++; }
      else if (r.attempts + 1 >= MAX_ATTEMPTS || res.status === 422) { await finish("failed", { error: body.message ?? `HTTP ${res.status}` }); failed++; }
      else await db.from("email_deliveries").update({ error: body.message ?? `HTTP ${res.status}` }).eq("id", r.id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (r.attempts + 1 >= MAX_ATTEMPTS) { await finish("failed", { error: msg }); failed++; }
      else await db.from("email_deliveries").update({ error: msg }).eq("id", r.id);
    }
  }
  return { sent, skipped, failed, waiting: false };
}

/** Per gli eventi che arrivano a entrambe le parti: è il noleggiatore se fa parte dell'attività della prenotazione/conversazione. */
async function providerSide(db: ReturnType<typeof serviceDb>, p: Payload, userId: string) {
  let org: string | null = null;
  if (p.booking_id) org = (await db.from("bookings").select("organization_id").eq("id", p.booking_id).maybeSingle()).data?.organization_id ?? null;
  else if (p.conversation_id) {
    const c = (await db.from("conversations").select("organization_id, customer_id").eq("id", p.conversation_id).maybeSingle()).data;
    if (c?.customer_id === userId) return false;
    org = c?.organization_id ?? null;
  }
  if (!org) return false;
  const { count } = await db.from("organization_members").select("user_id", { head: true, count: "exact" })
    .eq("organization_id", org).eq("user_id", userId).eq("status", "active");
  return (count ?? 0) > 0;
}

/** Da chiamare nelle azioni che generano notifiche: le email partono subito dopo la risposta, senza rallentare la pagina. */
export function sendEmailsSoon() {
  after(async () => {
    try { await flushEmails(); } catch (e) { console.error("email", e); }
  });
}
