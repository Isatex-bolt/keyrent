import Link from "next/link";
import { Logo } from "./Logo";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-line/80 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" aria-label="KeyRent, home"><Logo /></Link>
        <nav className="flex items-center gap-2 text-sm">
          <Link href="/diventa-partner" className="hidden rounded-lg px-3 py-2 font-medium text-mute hover:text-navy-900 sm:block">
            Sei un noleggiatore?
          </Link>
          <Link href="/accedi" className="btn-ghost">Accedi</Link>
        </nav>
      </div>
    </header>
  );
}
