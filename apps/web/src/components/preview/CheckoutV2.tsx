"use client";

/* PREVIEW checkout V2. Tutto simulato (MOCK): nessuna chiamata a Stripe o al database. */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CategoryIcon } from "@/components/CategoryIcon";
import type { Scenario } from "./scenarios";

type Wallet = "apple" | "google" | "none";
type Method = "wallet" | "link" | "card";
type Step = "date" | "opzioni" | "requisiti" | "paga";
type Result = null | "confirmed" | "sent" | "accepted";
type Settings = { wallet: Wallet | "auto"; failFirst: boolean; afterAccept: "pay" | "auto" };

const eur = (c: number) => new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: c % 100 ? 2 : 0 }).format(c / 100);
const ymd = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(d);
const plus = (n: number) => ymd(new Date(Date.now() + n * 86_400_000));
const dayLabel = (s: string) => cap(new Intl.DateTimeFormat("it-IT", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${s}T12:00:00Z`)));
const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const daysBetween = (a: string, b: string) => Math.max(1, Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function detectWallet(): Wallet {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua) || ("ApplePaySession" in window)) return "apple";
  if (/Android/.test(ua)) return "google";
  return "none";
}

const STEP_TITLE: Record<Step, string> = { date: "Quando", opzioni: "Consegna ed extra", requisiti: "Ci manca qualcosa", paga: "Riepilogo e pagamento" };

export function CheckoutV2({ s }: { s: Scenario }) {
  const [mounted, setMounted] = useState(false);
  const [settings, setSettings] = useState<Settings>({ wallet: "auto", failFirst: false, afterAccept: "pay" });
  const [detected, setDetected] = useState<Wallet>("none");
  const [panel, setPanel] = useState(false);
  const [events, setEvents] = useState<{ t: string; name: string }[]>([]);

  // stato del checkout: resta tutto anche se chiudi il foglio, se Apple Pay viene annullato o se ricarichi la pagina
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("date");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [tFrom, setTFrom] = useState("");
  const [tTo, setTTo] = useState("");
  const [ctx, setCtx] = useState(s.defaults.ctx);
  const [ctxOpen, setCtxOpen] = useState(false);
  const [delivery, setDelivery] = useState(s.defaults.delivery);
  const [address, setAddress] = useState(s.defaults.address);
  const [newAddr, setNewAddr] = useState("");
  const [extras, setExtras] = useState<string[]>([]);
  const [phone, setPhone] = useState(s.user.phone ?? "");
  const [license, setLicense] = useState<"none" | "uploading" | "done">(s.user.licenseVerified ? "done" : "none");
  const [method, setMethod] = useState<Method>("card");
  const [card, setCard] = useState({ n: "", e: "", c: "" });
  const [saveCard, setSaveCard] = useState(false);
  const [busy, setBusy] = useState<"" | "prep" | "confirm">("");
  const [sheet, setSheet] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [result, setResult] = useState<Result>(null);
  const [paidWith, setPaidWith] = useState("");
  const [holdUntil, setHoldUntil] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [showCancel, setShowCancel] = useState(false);
  const [toast, setToast] = useState("");
  const inFlight = useRef(false);
  const storeKey = `kr-preview-checkout-${s.key}`;

  const track = useCallback((name: string, props?: Record<string, unknown>) => {
    console.info("[checkout]", name, props ?? {});
    setEvents((e) => [...e.slice(-40), { t: new Date().toLocaleTimeString("it-IT"), name }]);
  }, []);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- inizializzazione dopo il montaggio (date di oggi, wallet del dispositivo) */
    setMounted(true);
    setDetected(detectWallet());
    setNow(Date.now());
    let saved: Record<string, unknown> | null = null;
    try { saved = JSON.parse(sessionStorage.getItem(storeKey) ?? "null"); } catch { saved = null; }
    if (saved && typeof saved.from === "string") {
      setFrom(saved.from as string); setTo(saved.to as string); setTFrom(saved.tFrom as string); setTTo(saved.tTo as string);
      setCtx(saved.ctx as string); setDelivery(!!saved.delivery); setAddress(saved.address as string);
      setExtras((saved.extras as string[]) ?? []); setStep((saved.step as Step) ?? "date");
      if (typeof saved.phone === "string") setPhone(saved.phone);
    } else {
      setFrom(plus(s.defaults.from)); setTo(plus(s.defaults.to));
      setTFrom(`${String(Math.max(s.hours[0], 9)).padStart(2, "0")}:00`); setTTo(`${String(Math.min(s.hours[1], 18)).padStart(2, "0")}:00`);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [s, storeKey]);

  useEffect(() => {
    if (!mounted || !from) return;
    try { sessionStorage.setItem(storeKey, JSON.stringify({ from, to, tFrom, tTo, ctx, delivery, address, extras, step, phone })); } catch { /* storage non disponibile */ }
  }, [mounted, storeKey, from, to, tFrom, tTo, ctx, delivery, address, extras, step, phone]);

  useEffect(() => {
    if (!holdUntil) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [holdUntil]);

  const wallet: Wallet = settings.wallet === "auto" ? detected : settings.wallet;
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- il metodo predefinito segue il wallet disponibile
    setMethod(wallet !== "none" ? "wallet" : "link");
  }, [wallet]);

  const needPhone = !s.user.phone;
  const needLicense = !!s.license && !s.user.licenseVerified;
  const hasOptions = !!s.deliveryCents || s.extras.length > 0;
  const steps = useMemo<Step[]>(() => ["date", ...(hasOptions ? ["opzioni" as const] : []), ...(needPhone || needLicense ? ["requisiti" as const] : []), "paga"], [hasOptions, needPhone, needLicense]);
  const idx = steps.indexOf(step);

  const days = from && to ? daysBetween(from, to) : 1;
  const rental = days * s.dayCents;
  const deliveryCents = delivery && s.deliveryCents ? s.deliveryCents : 0;
  const extraLines = s.extras.filter((x) => extras.includes(x.id)).map((x) => ({ ...x, total: x.per === "day" ? x.cents * days : x.cents }));
  const total = rental + deliveryCents + extraLines.reduce((a, x) => a + x.total, 0);
  const org = s.user.orgs.find((o) => o.id === ctx);
  const who = org ? org.name : `${s.user.first} ${s.user.last}`;
  const addresses = s.user.addresses.filter((a) => a.id !== "isatex" || org || s.user.orgs.length > 0);
  const addrLine = address === "new" ? newAddr : addresses.find((a) => a.id === address)?.line ?? "";
  const datesOk = !!from && !!to && to >= from && (from !== to || tTo > tFrom);
  const reqOk = (!needPhone || phone.replace(/\D/g, "").length >= 9) && (!needLicense || license === "done");
  const optOk = !delivery || (address !== "new" ? !!addrLine : newAddr.trim().length > 6);
  const cardOk = card.n.replace(/\D/g, "").length === 16 && /^\d{2}\s?\/\s?\d{2}$/.test(card.e) && /^\d{3,4}$/.test(card.c);
  const left = holdUntil ? Math.max(0, Math.floor((holdUntil - now) / 1000)) : null;
  const walletName = wallet === "apple" ? "Apple Pay" : "Google Pay";

  const hours = useMemo(() => {
    const out: string[] = [];
    for (let h = s.hours[0]; h <= s.hours[1]; h++) { out.push(`${String(h).padStart(2, "0")}:00`); if (h < s.hours[1]) out.push(`${String(h).padStart(2, "0")}:30`); }
    return out;
  }, [s.hours]);

  function openSheet() {
    setOpen(true);
    track("booking_started", { scenario: s.key, resume_step: step });
  }
  function closeSheet() {
    setOpen(false);
    if (idx > 0) track("checkout_abandoned", { step });
  }
  function go(next: Step) {
    setStep(next);
    if (next === "paga") {
      track("checkout_started", { total });
      if (!holdUntil || Date.now() > holdUntil) { setHoldUntil(Date.now() + 10 * 60_000); setNow(Date.now()); }
      if (wallet !== "none") track("wallet_shown", { wallet });
    }
  }
  function nextStep() { const n = steps[idx + 1]; if (n) go(n); }
  function back() { const p = steps[idx - 1]; if (p) setStep(p); }
  function quick(k: "oggi" | "domani" | "weekend") {
    if (k === "oggi") { setFrom(plus(0)); setTo(plus(0)); }
    if (k === "domani") { setFrom(plus(1)); setTo(plus(1)); }
    if (k === "weekend") {
      const wd = new Date().getDay(); const toSat = wd === 6 ? 0 : wd === 0 ? 6 : 6 - wd;
      setFrom(plus(toSat)); setTo(plus(toSat + 1));
    }
    track("dates_selected", { k });
  }

  async function pay() {
    if (inFlight.current) return; // doppio tocco: una sola operazione
    inFlight.current = true;
    setFailed(false);
    setBusy("prep");
    track("payment_started", { method, total, attempt: attempts + 1 });
    await sleep(600);
    if (method === "card") { await finishPayment(); return; }
    setBusy("");
    setSheet(true); // foglio Apple Pay / Google Pay / Link (simulato)
  }
  async function walletApproved() {
    setSheet(false);
    await finishPayment();
  }
  function walletCanceled() {
    // chiudere Apple Pay non è un errore: si torna al riepilogo con tutto com'era
    setSheet(false); setBusy(""); inFlight.current = false;
    track("payment_canceled", { method });
  }
  async function finishPayment() {
    setBusy("confirm");
    await sleep(900);
    const n = attempts + 1;
    setAttempts(n);
    if (settings.failFirst && n === 1) {
      setBusy(""); setFailed(true); inFlight.current = false;
      track("payment_failed", { method, reason: "card_declined" });
      return;
    }
    setPaidWith(method === "wallet" ? walletName : method === "link" ? "Link" : `Carta •••• ${card.n.replace(/\D/g, "").slice(-4) || "4242"}`);
    setBusy(""); setOpen(false); inFlight.current = false;
    try { sessionStorage.removeItem(storeKey); } catch { /* niente */ }
    if (s.mode === "instant") { setResult("confirmed"); track("payment_success", { total }); track("booking_completed", { mode: "instant" }); }
    else { setResult("sent"); track("payment_authorized", { total }); track("booking_requested"); }
  }
  async function providerAccepts() {
    track("provider_accepted");
    if (settings.afterAccept === "auto") {
      setToast("Prenotazione confermata: il noleggiatore ha accettato");
      setResult("confirmed"); track("payment_success", { capture: "auto" }); track("booking_completed", { mode: "request" });
    } else {
      setToast("Il mezzo è disponibile 🎉");
      setResult("accepted");
    }
    setTimeout(() => setToast(""), 3500);
  }
  async function confirmAndPay() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy("confirm");
    track("payment_started", { capture: "after_accept" });
    await sleep(900);
    setBusy(""); inFlight.current = false;
    setResult("confirmed"); track("payment_success", { total }); track("booking_completed", { mode: "request" });
  }
  function restart() {
    setResult(null); setStep("date"); setAttempts(0); setFailed(false); setHoldUntil(null); setPaidWith("");
  }

  if (!mounted) return <div className="fixed inset-0 z-50 bg-white" />;

  const priceBox = (
    <div className="space-y-2 text-[15px]">
      <Row l={`${days} ${days === 1 ? "giorno" : "giorni"} × ${eur(s.dayCents)}`} r={eur(rental)} />
      {deliveryCents > 0 && <Row l="Consegna" r={eur(deliveryCents)} />}
      {extraLines.map((x) => <Row key={x.id} l={x.per === "day" ? `${x.name} (${days} gg)` : x.name} r={eur(x.total)} />)}
      <div className="flex items-baseline justify-between border-t border-line pt-3">
        <span className="font-semibold">Totale</span><span className="text-2xl font-bold tracking-tight">{eur(total)}</span>
      </div>
      <p className="text-xs text-mute">Prezzo finale, tasse e commissioni incluse. Niente costi dopo il pagamento.</p>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-white text-ink">
      {/* barra preview */}
      <div className="sticky top-0 z-[80] flex items-center justify-between gap-2 bg-navy-950 px-4 py-2 text-xs text-white">
        <span className="font-semibold tracking-wide">PREVIEW · dati di prova</span>
        <span className="flex gap-3">
          <Link href="/preview/booking-v2" className="underline-offset-2 hover:underline">Scenari</Link>
          <button type="button" onClick={() => setPanel((p) => !p)} className="font-semibold text-teal-400">{panel ? "Chiudi" : "Prove"}</button>
        </span>
      </div>
      {panel && (
        <div className="fixed inset-x-3 top-10 z-[90] mx-auto max-w-md space-y-3 rounded-2xl border border-line bg-white p-4 text-sm shadow-2xl">
          <Opt label="Portafoglio" value={settings.wallet} onChange={(v) => setSettings({ ...settings, wallet: v as Settings["wallet"] })}
            options={[["auto", `Automatico (${detected === "apple" ? "Apple Pay" : detected === "google" ? "Google Pay" : "nessuno"})`], ["apple", "Apple Pay"], ["google", "Google Pay"], ["none", "Nessuno"]]} />
          <Opt label="Esito pagamento" value={settings.failFirst ? "fail" : "ok"} onChange={(v) => setSettings({ ...settings, failFirst: v === "fail" })}
            options={[["ok", "Riuscito"], ["fail", "Rifiutato al primo tentativo"]]} />
          {s.mode === "request" && (
            <Opt label="Dopo l'accettazione" value={settings.afterAccept} onChange={(v) => setSettings({ ...settings, afterAccept: v as Settings["afterAccept"] })}
              options={[["pay", "Il cliente preme Conferma e paga"], ["auto", "Addebito automatico (come oggi)"]]} />
          )}
          <div>
            <p className="label">Eventi registrati</p>
            <ol className="max-h-40 space-y-0.5 overflow-y-auto font-mono text-[11px] text-mute">
              {events.length ? events.map((e, i) => <li key={i}>{e.t} · {e.name}</li>) : <li>Nessun evento ancora</li>}
            </ol>
          </div>
          <button type="button" onClick={() => { try { sessionStorage.removeItem(storeKey); } catch { /* niente */ } window.location.reload(); }} className="btn-ghost w-full">Ricomincia lo scenario</button>
        </div>
      )}
      {toast && (
        <div role="status" className="fixed inset-x-3 top-12 z-[85] mx-auto max-w-md animate-[kr-drop_.35s_ease-out] rounded-2xl bg-navy-900 px-4 py-3 text-sm font-medium text-white shadow-xl">
          <span className="block text-[11px] font-semibold uppercase tracking-wide text-teal-400">KeyRent · ora</span>{toast}
        </div>
      )}

      {result ? (
        <ResultScreen s={s} result={result} days={days} from={from} to={to} tFrom={tFrom} tTo={tTo} total={total} who={who} org={org}
          delivery={delivery} addrLine={addrLine} paidWith={paidWith} busy={busy} onAccept={providerAccepts} onPay={confirmAndPay} onRestart={restart} />
      ) : (
        <>
          {/* scheda mezzo (versione leggera) */}
          <div className="mx-auto max-w-xl pb-[calc(7rem+env(safe-area-inset-bottom))]">
            <div className="grid aspect-[4/3] place-items-center bg-gradient-to-br from-navy-50 to-navy-100 text-navy-700/40 sm:rounded-b-3xl">
              <CategoryIcon slug={s.category} className="h-20 w-20" />
            </div>
            <div className="space-y-4 px-5 pt-5">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">{s.title}</h1>
                <p className="mt-1 text-[15px] text-mute">Noleggiatore professionale verificato · {s.city}</p>
              </div>
              <p className={`inline-flex rounded-full px-3 py-1.5 text-sm font-semibold ${s.mode === "instant" ? "bg-teal-50 text-teal-600" : "bg-navy-50 text-navy-800"}`}>
                {s.mode === "instant" ? "⚡ Prenotazione immediata" : "Su richiesta · il noleggiatore conferma entro 24 ore"}
              </p>
              <ul className="space-y-2 border-t border-line pt-4 text-[15px]">{s.facts.map((f) => <li key={f}>{f}</li>)}</ul>
              <p className="border-t border-line pt-4 text-[15px] text-mute">{s.cancel}.</p>
              <p className="rounded-xl bg-canvas p-3 text-xs text-mute">Il resto della scheda (foto, mappa, descrizione completa) resta quello del sito: qui proviamo solo la prenotazione.</p>
            </div>
          </div>

          {/* barra fissa in basso: prezzo + Prenota */}
          <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 backdrop-blur-xl">
            <div className="mx-auto flex max-w-xl items-center justify-between gap-4 px-5 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3">
              <div>
                <p className="text-lg font-bold tracking-tight">{eur(s.dayCents)} <span className="text-sm font-medium text-mute">/ giorno</span></p>
                {step !== "date" && datesOk
                  ? <p className="text-xs text-mute">{dayLabel(from)}{from !== to ? ` → ${dayLabel(to)}` : ""} · {eur(total)}</p>
                  : <p className="text-xs text-mute">{s.mode === "instant" ? "⚡ Conferma immediata" : "Conferma del noleggiatore"}</p>}
              </div>
              <button type="button" onClick={openSheet} className="btn-primary h-12 min-w-[9.5rem] rounded-2xl text-base">
                {idx > 0 ? "Continua" : "Prenota"}
              </button>
            </div>
          </div>
        </>
      )}

      {/* foglio dal basso */}
      {open && !result && (
        <div className="fixed inset-0 z-[60]">
          <button type="button" aria-label="Chiudi" onClick={closeSheet} className="absolute inset-0 animate-[kr-fade_.2s_ease-out] bg-navy-950/40" />
          <div role="dialog" aria-modal="true" aria-label={STEP_TITLE[step]}
            className="absolute inset-x-0 bottom-0 mx-auto flex max-h-[92dvh] max-w-xl animate-[kr-up_.28s_cubic-bezier(.2,.8,.2,1)] flex-col rounded-t-3xl bg-white shadow-2xl">
            <div className="flex flex-none items-center gap-2 px-3 pb-2 pt-3">
              <button type="button" onClick={back} disabled={idx === 0} aria-label="Passo precedente"
                className="grid h-11 w-11 place-items-center rounded-full text-xl text-navy-900 hover:bg-navy-50 disabled:invisible">‹</button>
              <div className="min-w-0 flex-1 text-center">
                <p className="font-semibold">{STEP_TITLE[step]}</p>
                <div className="mt-1.5 flex justify-center gap-1.5" aria-label={`Passo ${idx + 1} di ${steps.length}`}>
                  {steps.map((x, i) => <span key={x} className={`h-1.5 rounded-full transition-all ${i <= idx ? "w-6 bg-teal-500" : "w-3 bg-navy-100"}`} />)}
                </div>
              </div>
              <button type="button" onClick={closeSheet} aria-label="Chiudi" className="grid h-11 w-11 place-items-center rounded-full text-lg text-mute hover:bg-navy-50">✕</button>
            </div>

            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 pb-4 pt-2">
              {step === "date" && (
                <>
                  <div className="flex flex-wrap gap-2">
                    {(["oggi", "domani", "weekend"] as const).map((k) => (
                      <button key={k} type="button" onClick={() => quick(k)} className="chip h-10">{k === "oggi" ? "Oggi" : k === "domani" ? "Domani" : "Weekend"}</button>
                    ))}
                  </div>
                  <DateTime label="Ritiro" date={from} time={tFrom} hours={hours} min={plus(0)}
                    onDate={(v) => { setFrom(v); if (!to || to < v) setTo(v); track("dates_selected"); }} onTime={setTFrom} />
                  <DateTime label="Riconsegna" date={to} time={tTo} hours={hours} min={from || plus(0)}
                    onDate={(v) => { setTo(v); track("dates_selected"); }} onTime={setTTo} />
                  <p className="text-xs text-mute">Orari del noleggiatore: {s.hours[0]}:00 – {s.hours[1]}:00.</p>
                  {!datesOk && from && to && <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">Nello stesso giorno la riconsegna deve essere dopo l&apos;ora di ritiro.</p>}
                </>
              )}

              {step === "opzioni" && (
                <>
                  {!!s.deliveryCents && (
                    <section className="space-y-3">
                      <h3 className="text-lg font-semibold">Come vuoi ricevere il mezzo?</h3>
                      <div className="grid gap-2">
                        <Choice on={!delivery} onClick={() => setDelivery(false)} title="Ritiro presso la sede" sub={`${s.city} · indirizzo esatto dopo il pagamento`} right="Gratis" />
                        <Choice on={delivery} onClick={() => setDelivery(true)} title="Consegnamelo" sub="Il noleggiatore lo porta all'indirizzo che scegli" right={`+ ${eur(s.deliveryCents)}`} />
                      </div>
                      {delivery && (
                        <div className="space-y-2 pt-1">
                          {addresses.map((a) => (
                            <Choice key={a.id} on={address === a.id} onClick={() => setAddress(a.id)} title={a.label} sub={a.line} />
                          ))}
                          <Choice on={address === "new"} onClick={() => setAddress("new")} title="Aggiungi indirizzo" sub={address === "new" ? "" : "Via, numero, città"} />
                          {address === "new" && (
                            <input autoFocus value={newAddr} onChange={(e) => setNewAddr(e.target.value)} placeholder="Via, numero civico, città"
                              className="field h-12 text-base" autoComplete="street-address" />
                          )}
                        </div>
                      )}
                    </section>
                  )}
                  {s.extras.length > 0 && (
                    <section className="space-y-3">
                      <h3 className="text-lg font-semibold">Aggiungi extra <span className="text-sm font-normal text-mute">(facoltativi)</span></h3>
                      {s.extras.map((x) => {
                        const on = extras.includes(x.id);
                        return (
                          <button key={x.id} type="button" role="switch" aria-checked={on}
                            onClick={() => setExtras((e) => on ? e.filter((y) => y !== x.id) : [...e, x.id])}
                            className="flex w-full items-center justify-between gap-3 rounded-2xl border border-line px-4 py-3.5 text-left">
                            <span><span className="block font-medium">{x.name}</span><span className="text-sm text-mute">{eur(x.cents)}{x.per === "day" ? " al giorno" : " una volta"}</span></span>
                            <span className={`relative h-7 w-12 flex-none rounded-full transition ${on ? "bg-teal-500" : "bg-navy-100"}`}>
                              <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
                            </span>
                          </button>
                        );
                      })}
                    </section>
                  )}
                </>
              )}

              {step === "requisiti" && (
                <>
                  {needPhone && (
                    <section className="space-y-2">
                      <h3 className="text-lg font-semibold">Manca il tuo numero di telefono</h3>
                      <p className="text-sm text-mute">Serve al noleggiatore per il ritiro. Lo salviamo nel tuo profilo.</p>
                      <input type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                        placeholder="+39 333 123 4567" className="field h-12 text-base" aria-label="Numero di telefono" />
                    </section>
                  )}
                  {needLicense && (
                    <section className="space-y-3">
                      <h3 className="text-lg font-semibold">Verifichiamo la tua patente</h3>
                      <p className="text-sm text-mute">Per noleggiare questa auto serve la {s.license}. La carichi una volta sola: dalla prossima prenotazione risulta già verificata.</p>
                      {license === "done" ? (
                        <p className="rounded-2xl bg-teal-50 px-4 py-3 text-sm font-medium text-navy-900">✓ Patente caricata · la verifichiamo prima del ritiro</p>
                      ) : (
                        <label className={`btn-ghost h-12 w-full cursor-pointer text-base ${license === "uploading" ? "pointer-events-none opacity-60" : ""}`}>
                          {license === "uploading" ? "Caricamento…" : "Carica foto della patente"}
                          <input type="file" accept="image/*" capture="environment" className="sr-only"
                            onChange={async () => { setLicense("uploading"); await sleep(1000); setLicense("done"); track("license_uploaded"); }} />
                        </label>
                      )}
                      <p className="text-xs text-mute">Simulazione: nella preview il file non viene inviato da nessuna parte.</p>
                    </section>
                  )}
                </>
              )}

              {step === "paga" && (
                <>
                  {failed && (
                    <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4">
                      <p className="font-semibold text-red-900">Il pagamento non è andato a buon fine.</p>
                      <p className="mt-1 text-sm text-red-900/80">Non ti è stato addebitato nulla. Date e riepilogo sono ancora qui.</p>
                    </div>
                  )}

                  {s.mode === "request" && (
                    <p className="rounded-2xl bg-navy-50 px-4 py-3 text-navy-900">
                        <span className="font-semibold">Il noleggiatore deve confermare la disponibilità</span> (entro 24 ore). Ora autorizzi soltanto l&apos;importo: {settings.afterAccept === "pay" ? "paghi quando confermi tu, dopo la sua risposta." : "viene addebitato solo se il noleggiatore accetta."} Se rifiuta, l&apos;autorizzazione si annulla.
                      </p>
                  )}
                  <section>
                    <p className="label">{s.user.orgs.length ? "Prenota come" : "Prenotazione per"}</p>
                    <div className="flex items-center justify-between gap-3 rounded-2xl border border-line px-4 py-3">
                      <span className="min-w-0">
                        <span className="block truncate font-semibold">{who}</span>
                        <span className="text-sm text-mute">{org ? `Fattura all'azienda · P.IVA ${org.vat}` : "Personale"}</span>
                      </span>
                      {s.user.orgs.length > 0 && <button type="button" onClick={() => setCtxOpen((o) => !o)} className="h-11 px-2 text-sm font-semibold text-teal-600">Cambia</button>}
                    </div>
                    {ctxOpen && (
                      <div className="mt-2 grid gap-2">
                        {[{ id: "", name: `${s.user.first} ${s.user.last}`, sub: "Personale" }, ...s.user.orgs.map((o) => ({ id: o.id, name: o.name, sub: "Azienda" }))].map((o) => (
                          <Choice key={o.id || "p"} on={ctx === o.id} onClick={() => { setCtx(o.id); setCtxOpen(false); track("context_changed", { ctx: o.id || "personal" }); }} title={o.name} sub={o.sub} />
                        ))}
                      </div>
                    )}
                  </section>

                  <section className="space-y-3">
                    <div className="flex gap-3">
                      <div className="grid h-14 w-14 flex-none place-items-center rounded-xl bg-navy-50 text-navy-700/50"><CategoryIcon slug={s.category} className="h-7 w-7" /></div>
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{s.title}</p>
                        <p className="text-sm text-mute">{dayLabel(from)} {tFrom} → {from === to ? "" : `${dayLabel(to)} `}{tTo}</p>
                        <p className="text-sm text-mute">{delivery ? `Consegna: ${addrLine}` : `Ritiro a ${s.city}`}</p>
                      </div>
                    </div>
                    {priceBox}
                  </section>

                  {s.depositCents > 0 && (
                    <section className="rounded-2xl bg-canvas px-4 py-3 text-sm">
                      <div className="flex justify-between font-medium"><span>Cauzione</span><span>{eur(s.depositCents)}</span></div>
                      <p className="mt-0.5 text-mute">Gestita dal noleggiatore al ritiro. Non è inclusa nel totale.</p>
                    </section>
                  )}

                  <section className="space-y-1.5 text-sm">
                    {s.license && license === "done" && s.user.licenseVerified && <p className="font-medium text-teal-600">✓ Patente verificata</p>}
                    <p className="text-mute">{s.cancel}. <button type="button" onClick={() => setShowCancel((v) => !v)} className="font-semibold text-teal-600">Vedi condizioni</button></p>
                    {showCancel && <p className="text-mute">{s.cancelDetail}</p>}
                  </section>

                  <section className="space-y-2">
                    {(wallet !== "none") && <p className="label">Paga rapidamente</p>}
                    {wallet !== "none" && <Choice on={method === "wallet"} onClick={() => setMethod("wallet")} title={walletName} sub="Con Face ID o impronta, in pochi secondi" />}
                    <Choice on={method === "link"} onClick={() => setMethod("link")} title="Link" sub="Paga con la carta salvata nel tuo account Link" />
                    <p className="label pt-2">Altri metodi</p>
                    <Choice on={method === "card"} onClick={() => setMethod("card")} title="Carta di credito o debito" sub="Visa, Mastercard, American Express" />
                    {method === "card" && (
                      <div className="space-y-2 rounded-2xl border border-line p-3">
                        <input inputMode="numeric" autoComplete="cc-number" placeholder="Numero carta" value={card.n} aria-label="Numero carta"
                          onChange={(e) => setCard({ ...card, n: e.target.value.replace(/[^\d ]/g, "").slice(0, 19) })} className="field h-12 text-base" />
                        <div className="grid grid-cols-2 gap-2">
                          <input inputMode="numeric" autoComplete="cc-exp" placeholder="MM / AA" value={card.e} aria-label="Scadenza"
                            onChange={(e) => setCard({ ...card, e: e.target.value.slice(0, 7) })} className="field h-12 text-base" />
                          <input inputMode="numeric" autoComplete="cc-csc" placeholder="CVC" value={card.c} aria-label="CVC"
                            onChange={(e) => setCard({ ...card, c: e.target.value.replace(/\D/g, "").slice(0, 4) })} className="field h-12 text-base" />
                        </div>
                        <label className="flex items-center gap-2 px-1 py-1 text-sm"><input type="checkbox" checked={saveCard} onChange={(e) => setSaveCard(e.target.checked)} className="h-4 w-4 accent-teal-600" /> Salva la carta per i prossimi noleggi (custodita da Stripe)</label>
                        <p className="px-1 text-xs text-mute">Nella preview i campi sono finti: prova con 4242 4242 4242 4242, 12 / 30, 123. Nel sito vero li gestisce il modulo sicuro di Stripe.</p>
                      </div>
                    )}
                  </section>
                </>
              )}
            </div>

            {/* fondo del foglio: totale + pulsante principale, sempre a portata di pollice */}
            <div className="flex-none space-y-2 border-t border-line px-5 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3">
              {step !== "paga" ? (
                <>
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="text-mute">{datesOk ? `${days} ${days === 1 ? "giorno" : "giorni"}` : "Scegli le date"}</span>
                    <span className="text-lg font-bold">{datesOk ? eur(total) : ""}</span>
                  </div>
                  <button type="button" onClick={nextStep}
                    disabled={(step === "date" && !datesOk) || (step === "requisiti" && !reqOk) || (step === "opzioni" && !optOk)}
                    className="btn-primary h-14 w-full rounded-2xl text-base disabled:opacity-40">Continua</button>
                </>
              ) : failed ? (
                <div className="grid gap-2">
                  <button type="button" onClick={pay} className="btn-primary h-14 w-full rounded-2xl text-base">Riprova</button>
                  <button type="button" onClick={() => { setFailed(false); setMethod(method === "card" ? (wallet !== "none" ? "wallet" : "link") : "card"); }}
                    className="btn-ghost h-12 w-full rounded-2xl text-base">Usa un altro metodo</button>
                </div>
              ) : (
                <>
                  <PayButton method={method} wallet={wallet} busy={busy} mode={s.mode} total={total} disabled={method === "card" && !cardOk} onClick={pay} />
                  <p className="text-center text-xs text-mute">
                    Pagamento sicuro con Stripe · Noleggiatore verificato · Assistenza KeyRent
                    {left !== null && left > 0 && left < 180 && <span className="block font-medium text-navy-900">Mezzo riservato per te ancora {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}</span>}
                    {left !== null && left >= 180 && s.mode === "instant" && <span className="block">Ti teniamo il mezzo per 10 minuti</span>}
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {sheet && <WalletSheet kind={method === "link" ? "link" : wallet} total={total} title={s.title} mode={s.mode} onOk={walletApproved} onCancel={walletCanceled} />}
    </div>
  );
}

function Row({ l, r }: { l: string; r: string }) {
  return <div className="flex justify-between gap-3"><span className="text-mute">{l}</span><span>{r}</span></div>;
}

function Choice({ on, onClick, title, sub, right }: { on: boolean; onClick: () => void; title: string; sub?: string; right?: string }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on}
      className={`flex min-h-14 w-full min-w-0 items-center gap-3 rounded-2xl border px-4 py-3 text-left transition ${on ? "border-navy-900 bg-navy-50 ring-1 ring-navy-900" : "border-line bg-white"}`}>
      <span className={`grid h-5 w-5 flex-none place-items-center rounded-full border-2 ${on ? "border-navy-900" : "border-navy-100"}`}>{on && <span className="h-2.5 w-2.5 rounded-full bg-navy-900" />}</span>
      <span className="min-w-0 flex-1"><span className="block font-medium">{title}</span>{sub && <span className="block truncate text-sm text-mute">{sub}</span>}</span>
      {right && <span className="flex-none whitespace-nowrap text-sm font-semibold">{right}</span>}
    </button>
  );
}

function DateTime({ label, date, time, hours, min, onDate, onTime }: {
  label: string; date: string; time: string; hours: string[]; min: string; onDate: (v: string) => void; onTime: (v: string) => void;
}) {
  return (
    <div>
      <p className="label">{label}</p>
      <div className="grid grid-cols-[1fr_7rem] gap-2">
        <label className="relative flex h-14 items-center rounded-2xl border border-line px-4 focus-within:border-teal-500 focus-within:ring-4 focus-within:ring-teal-500/15">
          <span className="text-base font-semibold">{date ? dayLabel(date) : "Scegli"}</span>
          <input type="date" value={date} min={min} onChange={(e) => e.target.value && onDate(e.target.value)} aria-label={`Data di ${label.toLowerCase()}`}
            onClick={(e) => { try { e.currentTarget.showPicker?.(); } catch { /* non supportato */ } }}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
        </label>
        <select value={time} onChange={(e) => onTime(e.target.value)} aria-label={`Ora di ${label.toLowerCase()}`}
          className="h-14 rounded-2xl border border-line bg-white px-3 text-base font-semibold outline-none focus:border-teal-500">
          {hours.map((h) => <option key={h}>{h}</option>)}
        </select>
      </div>
    </div>
  );
}

function Spinner({ dark }: { dark?: boolean }) {
  return <span aria-hidden className={`h-5 w-5 animate-spin rounded-full border-2 ${dark ? "border-white/30 border-t-white" : "border-navy-900/20 border-t-navy-900"}`} />;
}

function PayButton({ method, wallet, busy, mode, total, disabled, onClick }: {
  method: Method; wallet: Wallet; busy: "" | "prep" | "confirm"; mode: Scenario["mode"]; total: number; disabled: boolean; onClick: () => void;
}) {
  const verb = mode === "instant" ? "Paga" : "Autorizza";
  if (busy) {
    return (
      <button type="button" disabled aria-live="polite" className="flex h-14 w-full items-center justify-center gap-3 rounded-2xl bg-navy-900 text-base font-semibold text-white">
        <Spinner dark />{busy === "prep" ? "Sto preparando il pagamento…" : mode === "instant" ? "Sto confermando la prenotazione…" : "Sto inviando la richiesta…"}
      </button>
    );
  }
  if (method === "wallet") {
    const apple = wallet === "apple";
    return (
      <button type="button" onClick={onClick}
        className={`flex h-14 w-full items-center justify-center rounded-2xl text-[17px] font-semibold ${apple ? "bg-black text-white" : "border border-navy-900/20 bg-white text-ink"}`}>
        {verb} con {apple ? "Apple Pay" : "Google Pay"}
      </button>
    );
  }
  if (method === "link") {
    return <button type="button" onClick={onClick} className="flex h-14 w-full items-center justify-center rounded-2xl bg-[#00D66F] text-[17px] font-semibold text-[#011E0F]">{verb} con Link</button>;
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="btn-primary h-14 w-full rounded-2xl text-base disabled:opacity-40">
      {mode === "instant" ? `Paga ${eur(total)}` : `Invia richiesta · autorizza ${eur(total)}`}
    </button>
  );
}

/* Simulazione del foglio di Apple Pay / Google Pay / Link: nel sito vero lo apre il telefono tramite Stripe. */
function WalletSheet({ kind, total, title, mode, onOk, onCancel }: {
  kind: Wallet | "link"; total: number; title: string; mode: Scenario["mode"]; onOk: () => void; onCancel: () => void;
}) {
  const [phase, setPhase] = useState<"ready" | "auth" | "done">("ready");
  const apple = kind === "apple";
  const name = kind === "apple" ? "Apple Pay" : kind === "google" ? "Google Pay" : "Link";
  async function approve() {
    setPhase("auth"); await sleep(1100); setPhase("done"); await sleep(450); onOk();
  }
  return (
    <div className="fixed inset-0 z-[95]">
      <div className="absolute inset-0 bg-black/45" />
      <div className={`absolute inset-x-0 bottom-0 mx-auto max-w-xl animate-[kr-up_.3s_cubic-bezier(.2,.8,.2,1)] rounded-t-[28px] px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-4 ${apple ? "bg-[#1c1c1e] text-white" : "bg-white text-ink"}`}>
        <div className="flex items-center justify-between">
          <span className="text-lg font-semibold">{name}</span>
          <button type="button" onClick={onCancel} disabled={phase !== "ready"} className={`h-10 px-2 text-[15px] ${apple ? "text-[#0a84ff]" : "text-teal-600"}`}>Annulla</button>
        </div>
        <p className={`mt-1 text-[11px] uppercase tracking-wide ${apple ? "text-white/50" : "text-mute"}`}>Simulazione · nessun addebito</p>
        <div className={`mt-4 space-y-3 border-y py-4 text-[15px] ${apple ? "border-white/10" : "border-line"}`}>
          <div className="flex justify-between"><span className={apple ? "text-white/60" : "text-mute"}>Carta</span><span>Visa •••• 4242</span></div>
          <div className="flex justify-between gap-4"><span className={apple ? "text-white/60" : "text-mute"}>Per</span><span className="truncate">{title}</span></div>
        </div>
        <div className="flex items-baseline justify-between py-4">
          <span className="text-sm font-semibold uppercase tracking-wide">{mode === "instant" ? "Paga KeyRent" : "Autorizza KeyRent"}</span>
          <span className="text-2xl font-semibold">{eur(total)}</span>
        </div>
        <button type="button" onClick={approve} disabled={phase !== "ready"}
          className={`flex h-14 w-full items-center justify-center gap-3 rounded-2xl text-[17px] font-semibold ${apple ? "bg-white text-black" : kind === "link" ? "bg-[#00D66F] text-[#011E0F]" : "bg-navy-900 text-white"}`}>
          {phase === "ready" && (apple ? "Conferma con Face ID" : kind === "google" ? "Continua" : "Paga con Link")}
          {phase === "auth" && <><span className="h-6 w-6 animate-pulse rounded-lg border-2 border-current" />{apple ? "Face ID…" : "Verifica…"}</>}
          {phase === "done" && "✓ Fatto"}
        </button>
      </div>
    </div>
  );
}

function ResultScreen({ s, result, days, from, to, tFrom, tTo, total, who, org, delivery, addrLine, paidWith, busy, onAccept, onPay, onRestart }: {
  s: Scenario; result: Exclude<Result, null>; days: number; from: string; to: string; tFrom: string; tTo: string; total: number; who: string;
  org?: { name: string }; delivery: boolean; addrLine: string; paidWith: string; busy: string; onAccept: () => void; onPay: () => void; onRestart: () => void;
}) {
  const confirmed = result === "confirmed";
  const [note, setNote] = useState(false);
  const place = confirmed ? (delivery ? `Consegna: ${addrLine}` : `Ritiro: ${s.addressAfter}`) : (delivery ? `Consegna: ${addrLine}` : `${s.city} · indirizzo esatto dopo il pagamento`);
  return (
    <div className="mx-auto flex min-h-[calc(100dvh-2rem)] max-w-xl flex-col px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-10">
      <div className="flex-1 space-y-6">
        <div className="text-center">
          {confirmed ? <CheckMark /> : <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-navy-50 text-2xl text-navy-900">✓</div>}
          <h1 className="mt-4 text-2xl font-bold tracking-tight">
            {confirmed ? "Prenotazione confermata" : result === "sent" ? "Richiesta inviata" : "Disponibilità confermata"}
          </h1>
          <p className="mt-1 text-[15px] text-mute">
            {confirmed ? "Ti abbiamo mandato tutti i dettagli via email." : result === "sent" ? "Ti avviseremo appena il noleggiatore conferma." : "Il noleggiatore ha confermato: completa la prenotazione."}
          </p>
        </div>

        <div className="animate-[kr-rise_.5s_.15s_ease-out_both] space-y-3 rounded-3xl border border-line p-5">
          {result === "sent" && <p className="inline-flex rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900">In attesa del noleggiatore · risponde entro 24 ore</p>}
          <div className="flex gap-3">
            <div className="grid h-14 w-14 flex-none place-items-center rounded-xl bg-navy-50 text-navy-700/50"><CategoryIcon slug={s.category} className="h-7 w-7" /></div>
            <div className="min-w-0">
              <p className="font-semibold">{s.title}</p>
              <p className="text-sm text-mute">{dayLabel(from)} {tFrom} → {from === to ? "" : `${dayLabel(to)} `}{tTo}</p>
            </div>
          </div>
          <p className="text-sm">{place}</p>
          <div className="space-y-1 border-t border-line pt-3 text-sm">
            <div className="flex justify-between"><span className="text-mute">{days} {days === 1 ? "giorno" : "giorni"} · {org ? `fattura a ${org.name}` : who}</span><span className="font-semibold">{eur(total)}</span></div>
            {confirmed && <p className="text-mute">Pagato con {paidWith || "il metodo autorizzato"}</p>}
            {result === "sent" && <p className="text-mute">Importo autorizzato su {paidWith}: nessun addebito finché la prenotazione non è confermata.</p>}
            {result === "accepted" && <p className="text-mute">Paghi con {paidWith}, già autorizzato. Un tocco e hai finito.</p>}
          </div>
        </div>

        {result === "sent" && (
          <div className="rounded-2xl border border-dashed border-navy-700/30 p-4 text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-mute">Solo preview</p>
            <button type="button" onClick={onAccept} className="btn-ghost mt-2">Simula: il noleggiatore accetta</button>
          </div>
        )}
      </div>

      <div className="mt-8 grid gap-2">
        {result === "accepted" ? (
          <button type="button" onClick={onPay} disabled={!!busy} className="flex h-14 w-full items-center justify-center gap-3 rounded-2xl bg-teal-500 text-base font-semibold text-navy-950">
            {busy ? <><Spinner />Sto confermando la prenotazione…</> : `Conferma e paga ${eur(total)}`}
          </button>
        ) : (
          <>
            <button type="button" onClick={() => setNote(true)} className="btn-primary h-14 w-full rounded-2xl text-base">
              {confirmed ? "Vedi il mio noleggio" : "Vedi la richiesta"}
            </button>
            {note && <p className="text-center text-xs text-mute">Nel sito vero qui si apre la pagina del noleggio in I miei noleggi.</p>}
            {confirmed && !delivery && (
              <a href={`https://maps.apple.com/?q=${encodeURIComponent(s.addressAfter)}`} target="_blank" rel="noreferrer" className="btn-ghost h-12 w-full rounded-2xl text-base">Indicazioni</a>
            )}
          </>
        )}
        <button type="button" onClick={onRestart} className="h-11 text-sm font-semibold text-mute">Torna alla home (riprova lo scenario)</button>
      </div>
    </div>
  );
}

function CheckMark() {
  return (
    <svg viewBox="0 0 64 64" className="mx-auto h-16 w-16" role="img" aria-label="Confermato">
      <circle cx="32" cy="32" r="30" fill="#e6f6f6" />
      <circle cx="32" cy="32" r="30" fill="none" stroke="#02a8a9" strokeWidth="3" strokeDasharray="189" strokeDashoffset="189" className="animate-[kr-draw_.55s_ease-out_forwards]" />
      <path d="M20 33l8 8 16-17" fill="none" stroke="#011938" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="40" strokeDashoffset="40" className="animate-[kr-draw_.35s_.45s_ease-out_forwards]" />
    </svg>
  );
}

function Opt({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="field">{options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
    </label>
  );
}
