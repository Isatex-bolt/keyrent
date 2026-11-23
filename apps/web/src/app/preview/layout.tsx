import { Suspense } from "react";
import Link from "next/link";
import { BottomNav, TopTabs } from "@/components/v2/customer/BottomNav";

export const metadata = { robots: { index: false, follow: false } };

/** ANTEPRIMA esperienza cliente: pagine di prova, separate da quelle attuali. Nessun dato viene modificato. */
export default function PreviewLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="border-b border-amber-200 bg-amber-50">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-xs text-amber-950">
          <span className="rounded-full bg-amber-400 px-2 py-0.5 font-bold uppercase tracking-wide">Anteprima cliente</span>
          <span className="hidden sm:inline">Proposta in prova: non sostituisce le pagine attuali e non modifica dati.</span>
          <Link href="/preview" className="ml-auto font-semibold underline">Tutte le anteprime</Link>
        </div>
      </div>
      <div className="mx-auto max-w-5xl px-4 pb-28 pt-5 lg:pb-10">
        <div className="mb-5 hidden justify-center lg:flex"><Suspense><TopTabs /></Suspense></div>
        {children}
      </div>
      <Suspense><BottomNav /></Suspense>
    </>
  );
}
