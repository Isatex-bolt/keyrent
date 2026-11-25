"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DemoNudge } from "./DemoNudge";

export function DemoBarClient({ register }: { register: () => Promise<void> }) {
  const path = usePathname();
  if (path === "/demo") return null;
  const inPro = path === "/pro" || path.startsWith("/pro/");
  return (
    <>
      {!inPro && (
        <div className="sticky top-16 z-20 bg-navy-900 text-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2 text-sm sm:px-6">
            <p className="min-w-0 truncate"><span className="font-semibold text-teal-300">Demo</span> · stai vedendo il sito come lo vedono i clienti</p>
            <Link href="/pro" className="flex-none rounded-full bg-teal-400 px-3 py-1 font-semibold text-navy-950">Torna alla tua area</Link>
          </div>
        </div>
      )}
      <DemoNudge register={register} />
    </>
  );
}
