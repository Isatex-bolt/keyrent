"use client";

import { useState } from "react";
import { demoRef } from "@/lib/demoRef";

/** Crea il link personale della demo da mettere nell'email (es. keyrent.it/demo?da=autonoleggio-rossi). */
export function DemoLinkMaker() {
  const [name, setName] = useState("");
  const [copied, setCopied] = useState(false);
  const ref = demoRef(name);
  const link = ref ? `https://keyrent.it/demo?da=${ref}` : "";
  return (
    <div className="space-y-2">
      <label className="label" htmlFor="demo-ref">Nome del noleggiatore a cui mandi l&apos;email</label>
      <div className="flex flex-wrap gap-2">
        <input id="demo-ref" value={name} onChange={(e) => { setName(e.target.value); setCopied(false); }} placeholder="Es. Autonoleggio Rossi"
          className="field min-w-56 flex-1" />
        <button type="button" disabled={!link} className="btn-primary px-4"
          onClick={() => { void navigator.clipboard?.writeText(link).then(() => setCopied(true)).catch(() => {}); }}>
          {copied ? "Copiato ✓" : "Copia link"}
        </button>
      </div>
      {link && <p className="break-all rounded-xl bg-navy-50/70 px-3 py-2 text-sm font-semibold text-navy-800">{link}</p>}
    </div>
  );
}
