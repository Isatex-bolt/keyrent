import { Suspense } from "react";
import { getBadges } from "@/lib/badges";
import { ProNav } from "@/components/ProNav";

export default function ProLayout({ children }: LayoutProps<"/pro">) {
  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">
      <div className="grid gap-6 lg:grid-cols-[230px_1fr]">
        <Suspense fallback={<div className="hidden lg:block" />}><NavWithBadges /></Suspense>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}

async function NavWithBadges() {
  return <ProNav badges={await getBadges()} />;
}
