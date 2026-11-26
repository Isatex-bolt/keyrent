import { FormError, FormNotice } from "./AuthCard";

export function ProHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-mute">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Flash({ sp, ok }: { sp: Record<string, string | string[] | undefined>; ok?: Record<string, string> }) {
  const e = typeof sp.errore === "string" ? sp.errore : undefined;
  const o = typeof sp.ok === "string" ? (ok?.[sp.ok] ?? (sp.ok.includes(" ") ? sp.ok : "Salvato.")) : undefined;
  return <><FormError message={e} /><FormNotice message={o} /></>;
}

export const Skeleton = () => <div className="h-96 animate-pulse rounded-2xl bg-white" />;
export type SP = Promise<Record<string, string | string[] | undefined>>;
