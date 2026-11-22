import Link from "next/link";
import { Suspense } from "react";
import { Logo } from "./Logo";
import { AccountButton } from "./AccountButton";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-line/80 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" aria-label="KeyRent, home"><Logo /></Link>
        <nav className="flex items-center gap-2 text-sm">
          <Suspense fallback={<span className="btn-ghost opacity-60">Accedi</span>}><AccountButton /></Suspense>
        </nav>
      </div>
    </header>
  );
}
