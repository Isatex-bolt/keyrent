import { QuickSearch } from "@/components/v2/customer/QuickSearch";

export const metadata = { title: "Cerca un mezzo" };

export default function Page() {
  return (
    <div className="mx-auto max-w-md px-4 py-6 sm:py-10 lg:max-w-2xl space-y-4">
      <h1 className="text-[28px] font-bold tracking-tight">Cerca un mezzo</h1>
      <p className="text-sm text-mute">Dove, quando e cosa: poi i risultati sulla mappa. I filtri arrivano dopo.</p>
      <QuickSearch steps />
    </div>
  );
}
