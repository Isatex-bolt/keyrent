import { Suspense } from "react";
import { previewFleet, keep } from "@/lib/v2/context";
import { dayList, monthRange, shiftMonth } from "@/lib/v2/fleet";
import { ProviderShellV2 } from "@/components/v2/Shell";
import { FleetCatalog } from "@/components/v2/FleetCatalog";
import { DemoNote } from "@/components/v2/ui";

export const metadata = { title: "I miei mezzi V2 · anteprima" };
type SP = Promise<Record<string, string | string[] | undefined>>;

export default function Page({ searchParams }: { searchParams: SP }) {
  return <Suspense fallback={<div className="mx-auto h-96 max-w-6xl animate-pulse rounded-2xl bg-white" />}><Fleet searchParams={searchParams} /></Suspense>;
}

async function Fleet({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const { from, to: monthEnd } = monthRange(typeof sp.mese === "string" ? sp.mese : undefined);
  // 4 mesi di disponibilità per il filtro "Dal / Al"; la vista calendario mostra il mese corrente
  const to = monthRange(shiftMonth(from.slice(0, 7), 3)).to;
  const { data, all, sede, reason } = await previewFleet(sp, from, to);
  return (
    <ProviderShellV2 orgName={all.orgName} locations={all.locations} sede={sede}>
      {reason && <DemoNote reason={reason} />}
      <header>
        <h1 className="text-3xl font-bold tracking-tight">I miei mezzi</h1>
        <p className="text-mute">La tua flotta: stato degli annunci, disponibilità di oggi e prossime prenotazioni.</p>
      </header>
      <FleetCatalog vehicles={data.vehicles} days={dayList(from, monthEnd)} bookings={[...data.bookings, ...data.requests]} today={data.today}
        locations={all.locations} vehicleBase="/preview/provider-vehicle-v2" qs={keep(sp)} addHref="/pro/mezzi/nuovo" />
    </ProviderShellV2>
  );
}
