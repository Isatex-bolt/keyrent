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
      <p>L&apos;area partner apre a breve.</p>
    </InfoPage>
  );
}
