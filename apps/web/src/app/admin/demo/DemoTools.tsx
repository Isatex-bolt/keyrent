"use client";

import { useState } from "react";
import { demoPhotoJobs, generateDemoPhoto, resetDemoNow } from "./actions";

export function DemoTools() {
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const say = (m: string) => setLog((l) => [m, ...l].slice(0, 40));

  async function photos() {
    setBusy(true); setLog([]);
    const jobs = await demoPhotoJobs();
    if (!jobs.length) { say("Tutte le foto ci sono già."); setBusy(false); return; }
    setProgress({ done: 0, total: jobs.length });
    for (let i = 0; i < jobs.length; i++) {
      const j = jobs[i];
      say(`Creo la foto ${j.idx + 1} di ${j.title}…`);
      let r = await generateDemoPhoto(j.id, j.idx);
      if ("error" in r) { say(`${r.error}: riprovo tra 20 secondi`); await new Promise((x) => setTimeout(x, 20_000)); r = await generateDemoPhoto(j.id, j.idx); }
      say("error" in r ? `✗ ${j.title} (foto ${j.idx + 1}): ${r.error}` : `✓ ${j.title} · foto ${j.idx + 1}`);
      setProgress({ done: i + 1, total: jobs.length });
    }
    say("Fatto. Se qualche foto manca, premi di nuovo: crea solo quelle mancanti.");
    setBusy(false);
  }

  async function reset() {
    setBusy(true);
    const r = await resetDemoNow();
    say("error" in r ? `✗ ${r.error}` : `✓ ${r.info}`);
    setBusy(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={photos} disabled={busy} className="btn-primary disabled:opacity-60">Genera foto mancanti</button>
        <button type="button" onClick={reset} disabled={busy} className="btn-ghost disabled:opacity-60">Ripristina demo adesso</button>
      </div>
      {progress && (
        <div>
          <div className="h-2 overflow-hidden rounded-full bg-navy-50"><div className="h-full bg-teal-500 transition-all" style={{ width: `${(progress.done / progress.total) * 100}%` }} /></div>
          <p className="mt-1 text-xs text-mute">{progress.done} di {progress.total} foto · tieni aperta questa pagina (circa 30 secondi a foto)</p>
        </div>
      )}
      {log.length > 0 && <ul className="max-h-72 space-y-1 overflow-y-auto rounded-xl bg-navy-50/60 p-3 font-mono text-xs">{log.map((m, i) => <li key={i}>{m}</li>)}</ul>}
    </div>
  );
}
