export const bookingStatus: Record<string, { label: string; tone: string }> = {
  requested: { label: "In attesa del noleggiatore", tone: "bg-amber-50 text-amber-800" },
  accepted: { label: "Accettata · da confermare", tone: "bg-teal-50 text-teal-700" },
  confirmed: { label: "Confermata", tone: "bg-teal-500 text-navy-950" },
  picked_up: { label: "In corso", tone: "bg-teal-500 text-navy-950" },
  completed: { label: "Completata", tone: "bg-navy-50 text-navy-800" },
  declined: { label: "Rifiutata", tone: "bg-red-50 text-red-800" },
  expired: { label: "Scaduta", tone: "bg-navy-50 text-mute" },
  cancelled: { label: "Cancellata", tone: "bg-navy-50 text-mute" },
  no_show: { label: "Mancato ritiro", tone: "bg-red-50 text-red-800" },
};

export function bookingError(msg: string) {
  const map: [string, string][] = [
    ["NOT_AVAILABLE", "Il mezzo non è più disponibile in queste date: prova date diverse."],
    ["DURATION_OUT_OF_RANGE", "La durata scelta non rispetta il minimo o il massimo previsto dal noleggiatore."],
    ["PICKUP_IN_PAST", "La data di ritiro è già passata."],
    ["TOO_LATE_TO_REQUEST", "Il ritiro è troppo vicino: il noleggiatore non farebbe in tempo a rispondere."],
    ["SELF_BOOKING", "Non puoi prenotare un mezzo della tua attività."],
    ["LISTING_NOT_AVAILABLE", "Questo annuncio non è più disponibile."],
    ["NO_PRICE", "Il noleggiatore non ha una tariffa per questa durata."],
    ["RESPONSE_WINDOW_EXPIRED", "Il tempo per rispondere è scaduto."],
    ["HOLD_LOST", "Le date non sono più bloccate per questa richiesta."],
    ["INVALID_TRANSITION", "Questa operazione non è possibile nello stato attuale."],
    ["FORBIDDEN", "Non hai i permessi per questa operazione."],
    ["PAYMENT_MISSING", "Il cliente non ha ancora inserito la carta per questa richiesta."],
  ];
  return map.find(([k]) => msg.includes(k))?.[1] ?? "Operazione non riuscita. Riprova.";
}

export function fmtDateTime(iso: string) {
  return new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
    .format(new Date(iso));
}
