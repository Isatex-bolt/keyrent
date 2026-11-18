import Link from "next/link";
import Image from "next/image";
import { CategoryIcon } from "./CategoryIcon";
import { euro } from "@/lib/format";
import type { SearchResult } from "@/lib/data";

export function ListingCard({ r, href }: { r: SearchResult; href: string }) {
  return (
    <Link href={href} className="card group overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lg">
      <div className="relative aspect-[4/3] bg-navy-50">
        {r.cover ? (
          <Image src={r.cover} alt={r.title} fill sizes="(max-width: 640px) 100vw, 33vw" className="object-cover" />
        ) : (
          <div className="grid h-full place-items-center text-navy-700/40"><CategoryIcon slug={r.category_slug} className="h-14 w-14" /></div>
        )}
        {r.available_units > 1 && (
          <span className="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-xs font-semibold text-navy-900">
            {r.available_units} disponibili
          </span>
        )}
      </div>
      <div className="space-y-1 p-4">
        <p className="line-clamp-1 font-semibold group-hover:text-navy-700">{r.title}</p>
        <p className="text-sm text-mute">
          {r.city} ({r.province}){r.distance_km != null ? ` · ${r.distance_km.toLocaleString("it-IT")} km` : ""}
        </p>
        <p className="pt-1 text-sm">
          {r.price_from_cents != null ? <>da <span className="text-base font-bold">{euro(r.price_from_cents)}</span></> : "Prezzo su richiesta"}
        </p>
      </div>
    </Link>
  );
}
