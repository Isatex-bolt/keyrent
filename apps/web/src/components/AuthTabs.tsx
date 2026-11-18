import Link from "next/link";

/** Scelta del tipo di accesso: chi vuole noleggiare / chi noleggia i propri mezzi. */
export function AuthTabs({ base, tipo }: { base: "/accedi" | "/registrati"; tipo: "cliente" | "noleggiatore" }) {
  const tabs = [
    { k: "cliente", label: "Voglio noleggiare", sub: "Privati e aziende" },
    { k: "noleggiatore", label: "Sono un noleggiatore", sub: "Pubblico i miei mezzi" },
  ] as const;
  return (
    <div className="mb-6 grid grid-cols-2 gap-2 rounded-2xl bg-navy-50 p-1.5">
      {tabs.map((t) => (
        <Link key={t.k} href={t.k === "cliente" ? base : `${base}?tipo=noleggiatore`} replace
          className={`rounded-xl px-3 py-2.5 text-center transition ${tipo === t.k ? "bg-white shadow-sm" : "hover:bg-white/60"}`}>
          <span className={`block text-sm font-semibold ${tipo === t.k ? "text-navy-900" : "text-mute"}`}>{t.label}</span>
          <span className="block text-[11px] text-mute">{t.sub}</span>
        </Link>
      ))}
    </div>
  );
}
