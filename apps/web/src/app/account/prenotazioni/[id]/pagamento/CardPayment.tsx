"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { completeCardPayment } from "./actions";

/* Stripe.js caricato dal sito di Stripe: i dati della carta non passano mai dai server KeyRent. */
type StripeElements = { create: (t: string, o?: object) => { mount: (el: HTMLElement) => void; on: (e: string, cb: (ev: { complete?: boolean }) => void) => void }; submit: () => Promise<{ error?: { message?: string } }> };
type StripeJs = {
  elements: (o: object) => StripeElements;
  confirmPayment: (o: object) => Promise<{ error?: { message?: string }; paymentIntent?: { status: string } }>;
};
declare global { interface Window { Stripe?: (key: string, o?: object) => StripeJs } }

function loadStripe(): Promise<void> {
  if (window.Stripe) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://js.stripe.com/v3/";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("load"));
    document.head.appendChild(s);
  });
}

export function CardPayment({ bookingId, clientSecret, publishableKey, amountLabel, deadline }: {
  bookingId: string; clientSecret: string; publishableKey: string; amountLabel: string; deadline: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const stripe = useRef<StripeJs | null>(null);
  const elements = useRef<StripeElements | null>(null);
  const [ready, setReady] = useState(false);
  const [complete, setComplete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [left, setLeft] = useState<number | null>(null);
  const router = useRouter();

  useEffect(() => {
    let off = false;
    loadStripe().then(() => {
      if (off || !box.current || !window.Stripe) return;
      stripe.current = window.Stripe(publishableKey, { locale: "it" });
      elements.current = stripe.current.elements({
        clientSecret,
        appearance: { theme: "stripe", variables: { colorPrimary: "#02A8A9", colorText: "#0F1A2B", borderRadius: "12px", fontFamily: "system-ui, sans-serif" } },
      });
      const el = elements.current.create("payment", { layout: "tabs" });
      el.mount(box.current);
      el.on("ready", () => setReady(true));
      el.on("change", (ev) => setComplete(!!ev.complete));
    }).catch(() => setError("Non riusciamo a caricare il modulo di pagamento: controlla la connessione e ricarica la pagina."));
    return () => { off = true; };
  }, [clientSecret, publishableKey]);

  useEffect(() => {
    const tick = () => setLeft(Math.max(0, Math.floor((new Date(deadline).getTime() - Date.now()) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [deadline]);

  async function pay() {
    if (!stripe.current || !elements.current) return;
    setBusy(true); setError("");
    const sub = await elements.current.submit();
    if (sub.error) { setError(sub.error.message ?? "Controlla i dati della carta."); setBusy(false); return; }
    // niente pagine esterne: solo carte e portafogli (Apple Pay, Google Pay)
    const res = await stripe.current.confirmPayment({ elements: elements.current, redirect: "if_required" });
    if (res.error) { setError(res.error.message ?? "Pagamento non riuscito: riprova."); setBusy(false); return; }
    const out = await completeCardPayment(bookingId);
    if ("error" in out) { setError(out.error); setBusy(false); return; }
    router.replace(`/account/prenotazioni/${bookingId}?ok=richiesta`);
  }

  const expired = left === 0;
  return (
    <div className="card space-y-4 p-5">
      <div ref={box} className="min-h-[180px]">{!ready && !error && <div className="h-[180px] animate-pulse rounded-xl bg-navy-50" />}</div>
      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
      <button type="button" onClick={pay} disabled={!ready || !complete || busy || expired} className="btn-primary w-full disabled:opacity-50">
        {busy ? "Verifica in corso…" : `Blocca ${amountLabel} e invia la richiesta`}
      </button>
      <p className="text-center text-xs text-mute">
        {expired ? "Tempo scaduto: torna all'annuncio e rifai la richiesta."
          : left !== null ? `Date bloccate per te ancora ${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")} minuti.` : ""}
        {" "}Pagamento sicuro con Stripe.
        {publishableKey.startsWith("pk_test_") && " Modalità prova: usa la carta 4242 4242 4242 4242, una data futura e un CVC qualsiasi."}
      </p>
    </div>
  );
}
