import Link from "next/link";

export function AuthCard({ title, subtitle, children, wide = false, backHome = false }: { title: string; subtitle?: string; children: React.ReactNode; wide?: boolean; backHome?: boolean }) {
  return (
    <div className={`mx-auto ${wide ? "max-w-2xl" : "max-w-md"} px-4 py-12 sm:py-16`}>
      <div className="card p-6 sm:p-8">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-mute">{subtitle}</p>}
        <div className="mt-6">{children}</div>
      </div>
      {backHome && (
        <p className="mt-5 text-center">
          <Link href="/" className="text-sm font-medium text-mute hover:text-navy-900 hover:underline">← Torna al sito</Link>
        </p>
      )}
    </div>
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return <p role="alert" className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{message}</p>;
}

export function FormNotice({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mb-4 rounded-xl bg-teal-50 px-4 py-3 text-sm text-navy-900">{message}</p>;
}
