import { Suspense } from "react";
import { AuthCard } from "@/components/AuthCard";

export const metadata = { title: "Controlla la tua email" };

export default function Page({ searchParams }: PageProps<"/registrati/controlla-email">) {
  return <AuthCard title="Controlla la tua email"><Suspense><Body searchParams={searchParams} /></Suspense></AuthCard>;
}

async function Body({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const email = typeof sp.email === "string" ? sp.email : "la tua casella";
  return (
    <div className="space-y-3 text-sm leading-relaxed">
      <p>Ti abbiamo inviato un&apos;email a <strong>{email}</strong>.</p>
      <p>{sp.tipo === "link" ? "Apri il link per accedere." : "Apri il link per confermare l'account: dopo sarai già dentro."}</p>
      <p className="text-mute">Non la trovi? Controlla anche nello spam. L&apos;email può impiegare qualche minuto.</p>
    </div>
  );
}
