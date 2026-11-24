import { InfoPage } from "@/components/InfoPage";
export const metadata = { title: "Come funziona" };
export default function Page() {
  return (
    <InfoPage title="Come funziona">
      <p><strong>1. Cerca.</strong> Indica località, date e tipo di mezzo: vedi solo ciò che è disponibile.</p>
      <p><strong>2. Richiedi.</strong> Scegli le date e inserisci la carta: l&apos;importo viene solo bloccato, non addebitato.</p>
      <p><strong>3. Il noleggiatore conferma.</strong> Risponde entro 24 ore. Se accetta, la prenotazione è confermata e l&apos;importo viene addebitato; se rifiuta o non risponde, il blocco sulla carta si annulla.</p>
      <p><strong>4. Ritira.</strong> Dopo la conferma ricevi indirizzo, contatti e istruzioni. La cauzione si gestisce al ritiro con il noleggiatore.</p>
    </InfoPage>
  );
}
