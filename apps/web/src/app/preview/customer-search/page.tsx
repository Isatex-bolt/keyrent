import { QuickSearch } from "@/components/v2/customer/QuickSearch";

export const metadata = { title: "Cerca · anteprima" };

export default function Page() {
  return (
    <div className="mx-auto max-w-md space-y-4">
      <h1 className="text-[28px] font-bold tracking-tight">Cerca un mezzo</h1>
      <p className="text-sm text-mute">Tre domande, poi i risultati sulla mappa. I filtri avanzati arrivano solo dopo.</p>
      <QuickSearch steps />
    </div>
  );
}
