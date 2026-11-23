"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/** Suggerimento leggero mostrato solo la prima volta; si chiude con un tocco e non torna più. */
export function Hint({ id, text, link }: { id: string; text: string; link?: { href: string; label: string } }) {
  const key = `kr-hint-${id}`;
  const [show, setShow] = useState(false);
  useEffect(() => {
    let seen = true;
    try { seen = localStorage.getItem(key) === "1"; } catch { /* niente */ }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- dipende da una preferenza salvata nel browser
    setShow(!seen);
  }, [key]);
  if (!show) return null;
  const close = () => { setShow(false); try { localStorage.setItem(key, "1"); } catch { /* niente */ } };
  return (
    <div role="note" className="flex animate-[kr-rise_.35s_ease-out_both] items-center gap-3 rounded-2xl bg-teal-50 px-4 py-3 text-sm text-navy-900">
      <p className="min-w-0 flex-1">{text}{link && <> <Link href={link.href} className="font-semibold text-teal-600">{link.label}</Link></>}</p>
      <button type="button" onClick={close} aria-label="Chiudi suggerimento" className="grid h-8 w-8 flex-none place-items-center rounded-full text-mute hover:bg-white">✕</button>
    </div>
  );
}
