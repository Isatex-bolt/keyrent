import { Suspense } from "react";
import Link from "next/link";
import { getBadges } from "@/lib/badges";
import { getMemberships } from "@/lib/auth";
import { ProNav } from "@/components/ProNav";
import { DemoBanner } from "@/components/DemoBanner";

export default function ProLayout({ children }: LayoutProps<"/pro">) {
  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">
      <Suspense fallback={null}><DemoBanner /></Suspense>
      {/* senza attività registrata: niente menu dell'area noleggiatore, solo il ritorno al profilo */}
      <div className="grid gap-6 lg:grid-cols-[230px_1fr] lg:[&:has([data-nonav])]:grid-cols-1">
        <Suspense fallback={<div className="hidden lg:block" />}><NavWithBadges /></Suspense>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}

async function NavWithBadges() {
  const memberships = await getMemberships().catch(() => []);
  if (!memberships.length) {
    return (
      <div data-nonav className="mx-auto w-full max-w-4xl">
        <Link href="/account/profilo" className="inline-flex min-h-11 items-center gap-2 rounded-xl px-1 text-sm font-semibold text-navy-900 hover:text-teal-600">
          <span aria-hidden>←</span> Torna al mio profilo
        </Link>
      </div>
    );
  }
  return <ProNav badges={await getBadges()} />;
}
