import Link from "next/link";

export const metadata = { robots: { index: false, follow: false } };

/** ANTEPRIMA V2: pagine di prova, separate da quelle attuali. Nessun dato viene modificato. */
export default function PreviewLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="border-b border-amber-200 bg-amber-50">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 text-xs text-amber-950 sm:px-6">
          <span className="rounded-full bg-amber-400 px-2 py-0.5 font-bold uppercase tracking-wide">Anteprima V2</span>
          <span>Proposta in prova: non sostituisce le pagine attuali e non modifica nessun dato.</span>
          <Link href="/preview" className="ml-auto font-semibold underline">Tutte le anteprime</Link>
        </div>
      </div>
      {children}
    </>
  );
}
