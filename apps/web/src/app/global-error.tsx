"use client";

import { useEffect } from "react";

/**
 * Errore fuori dal layout (di solito: il sito è stato aggiornato mentre la pagina era aperta).
 * Ricarica da solo una volta; se l'errore si ripete mostra il messaggio.
 */
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    try {
      const last = Number(sessionStorage.getItem("kr_reload") ?? 0);
      if (Date.now() - last > 30_000) {
        sessionStorage.setItem("kr_reload", String(Date.now()));
        window.location.reload();
      }
    } catch { /* storage non disponibile */ }
  }, []);
  return (
    <html lang="it">
      <body style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", margin: 0, color: "#0F1A2B" }}>
        <div style={{ maxWidth: 520, margin: "15vh auto", padding: "0 20px" }}>
          <h1 style={{ fontSize: 24, margin: "0 0 12px" }}>Pagina non caricata</h1>
          <p style={{ color: "#5B6676", lineHeight: 1.5 }}>Probabilmente il sito è stato appena aggiornato. Ricarica la pagina per continuare.</p>
          <button onClick={() => window.location.reload()}
            style={{ marginTop: 16, background: "#02A8A9", color: "#010E20", border: 0, borderRadius: 12, padding: "12px 20px", fontWeight: 700, fontSize: 16, cursor: "pointer" }}>
            Ricarica
          </button>
          {error.digest && <p style={{ marginTop: 24, fontSize: 12, color: "#8A94A3" }}>Codice: {error.digest}</p>}
        </div>
      </body>
    </html>
  );
}
