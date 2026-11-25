"use client";

import { useState } from "react";
import { resetDemoNow } from "./actions";

export function DemoTools() {
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const say = (m: string) => setLog((l) => [m, ...l].slice(0, 40));

  async function reset() {
    setBusy(true);
    const r = await resetDemoNow();
    say("error" in r ? `✗ ${r.error}` : `✓ ${r.info}`);
    setBusy(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={reset} disabled={busy} className="btn-ghost disabled:opacity-60">Ripristina demo adesso</button>
      </div>
      {log.length > 0 && <ul className="max-h-72 space-y-1 overflow-y-auto rounded-xl bg-navy-50/60 p-3 font-mono text-xs">{log.map((m, i) => <li key={i}>{m}</li>)}</ul>}
    </div>
  );
}
