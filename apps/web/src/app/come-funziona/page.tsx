import { InfoPage } from "@/components/InfoPage";
export const metadata = { title: "Come funziona" };
export default function Page() {
  return (
    <InfoPage title="Come funziona">
      <p><strong>1. Cerca.</strong> Indica località, date e tipo di mezzo: vedi solo ciò che è disponibile.</p>
      <p><strong>2. Richiedi.</strong> Inserisci la carta: l&apos;importo viene solo preautorizzato. Il noleggiatore conferma entro 24 ore.</p>
      <p><strong>3. Conferma e paga.</strong> Vedi i dati del noleggiatore e il riepilogo, poi confermi. Il pagamento avviene su KeyRent.</p>
      <p><strong>4. Ritira.</strong> Ricevi indirizzo, contatti e istruzioni. La cauzione si gestisce al ritiro con il noleggiatore.</p>
    </InfoPage>
  );
}
