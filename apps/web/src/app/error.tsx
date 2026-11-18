"use client";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight">Qualcosa non ha funzionato</h1>
      <p className="mt-3 text-mute">Riprova tra un attimo. Se il problema continua, manda questo codice all&apos;assistenza:</p>
      <pre className="mt-3 overflow-x-auto rounded-xl bg-white p-3 text-xs ring-1 ring-line">{error.digest ?? error.message}</pre>
      <button onClick={reset} className="btn-primary mt-6">Riprova</button>
    </div>
  );
}
