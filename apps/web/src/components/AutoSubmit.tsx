"use client";

/** Invia il form padre quando cambia un filtro (senza JS il pulsante "Applica" resta disponibile). */
export function AutoSubmit({ children }: { children: React.ReactNode }) {
  return (
    <div
      onChange={(e) => {
        const form = (e.target as HTMLElement).closest("form");
        if (!form) return;
        const t = e.target as HTMLInputElement;
        // cambiando marca, il modello precedente non vale più
        if (t.name === "marca") {
          const model = form.querySelector<HTMLSelectElement>('select[name="modello"]');
          if (model) model.value = "";
        }
        if (form.checkValidity()) form.requestSubmit();
      }}
    >
      {children}
    </div>
  );
}
