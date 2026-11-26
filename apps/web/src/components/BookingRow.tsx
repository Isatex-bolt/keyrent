import { Badge } from "@/lib/status";
import { bookingStatus, fmtDateTime } from "@/lib/bookings";
import { euro } from "@/lib/format";

export type ProBooking = {
  id: string; code: string; status: string; pickup_at: string; return_at: string; total_cents: number;
  provider_net_cents: number; provider_response_due_at: string | null; driver: Record<string, string>;
  listings: { title: string } | null; locations: { name: string } | null;
  /** addebito partito ma esito Stripe non ancora certo */
  verifying?: boolean;
};

export function BookingSummary({ b }: { b: ProBooking }) {
  const d = b.driver ?? {};
  return (
    <div className="min-w-0 space-y-1 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-semibold">{b.listings?.title}</p><Badge map={bookingStatus} value={b.verifying ? "verifying" : b.status} />
      </div>
      <p className="text-mute">{b.code} · {b.locations?.name}</p>
      <p>{fmtDateTime(b.pickup_at)} → {fmtDateTime(b.return_at)}</p>
      <p><span className="text-mute">Conducente:</span> {[d.first_name, d.last_name].filter(Boolean).join(" ") || "—"}{d.birth_year ? ` · nato nel ${d.birth_year}` : ""}{d.license_year ? ` · patente dal ${d.license_year}` : ""}</p>
      {d.notes && <p className="text-mute">“{d.notes}”</p>}
      {b.verifying && <p className="rounded-lg bg-amber-50 px-2 py-1 text-amber-900">Stripe non ha ancora dato l&apos;esito dell&apos;addebito. Il mezzo resta bloccato: la prenotazione si conferma (o si annulla) da sola appena arriva la risposta.</p>}
      <p><span className="text-mute">Totale cliente</span> {euro(b.total_cents)} · <span className="text-mute">a te</span> <strong>{euro(b.provider_net_cents)}</strong></p>
    </div>
  );
}
