import Link from "next/link";

export function InfoPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
      <div className="mt-4 space-y-4 leading-relaxed text-ink/90">{children}</div>
      <Link href="/" className="btn-ghost mt-8">← Torna alla home</Link>
    </div>
  );
}
