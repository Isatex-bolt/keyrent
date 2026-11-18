import Link from "next/link";
import { InfoPage } from "@/components/InfoPage";
export const metadata = { title: "Diventa partner" };
export default function Page() {
  return (
    <InfoPage title="Diventa partner KeyRent">
      <p>KeyRent è riservato a noleggiatori professionali: concessionari, autonoleggi, noleggi di camper, bici e barche.</p>
      <ul className="list-disc space-y-1 pl-5">
        <li>Pubblicazione dei mezzi gratuita</li>
        <li>Commissione solo sulle prenotazioni concluse</li>
        <li>Pagamento al noleggiatore 24 ore dopo il ritiro del mezzo</li>
        <li>Gestione di più sedi e di più collaboratori</li>
      </ul>
      <div className="flex flex-wrap gap-3 pt-2">
        <Link href="/registrati?tipo=noleggiatore" className="btn-primary">Registra la tua attività</Link>
        <Link href="/accedi?tipo=noleggiatore" className="btn-ghost">Hai già un account? Accedi</Link>
      </div>
    </InfoPage>
  );
}
