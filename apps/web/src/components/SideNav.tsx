import { Suspense } from "react";
import Link from "next/link";
import { getBadges, type Badges } from "@/lib/badges";
import { Count } from "./Count";

export type NavItem = { href: string; label: string; badge?: keyof Badges };

const cls = "flex items-center justify-between whitespace-nowrap rounded-xl px-3.5 py-2.5 text-sm font-medium text-ink/80 hover:bg-white hover:text-navy-900";

/** Menu laterale (orizzontale su mobile) con i contatori delle novità, caricati senza bloccare la pagina. */
export function SideNav({ items, footer }: { items: NavItem[]; footer?: string }) {
  const plain = items.map((i) => <Link key={i.href} href={i.href} className={cls}>{i.label}</Link>);
  return (
    <nav className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-col lg:px-0">
      <Suspense fallback={plain}><WithBadges items={items} /></Suspense>
      {footer && <span className="hidden px-3.5 pt-3 text-xs text-mute lg:block">{footer}</span>}
    </nav>
  );
}

async function WithBadges({ items }: { items: NavItem[] }) {
  const b = await getBadges();
  return items.map((i) => (
    <Link key={i.href} href={i.href} className={cls}>
      <span>{i.label}</span>{i.badge && <Count n={b[i.badge]} />}
    </Link>
  ));
}
