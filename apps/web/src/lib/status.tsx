export const listingStatus: Record<string, { label: string; tone: string }> = {
  draft: { label: "Bozza", tone: "bg-navy-50 text-navy-800" },
  pending_review: { label: "In revisione", tone: "bg-amber-50 text-amber-800" },
  changes_required: { label: "Modifiche richieste", tone: "bg-orange-50 text-orange-800" },
  approved: { label: "Approvato", tone: "bg-teal-50 text-teal-700" },
  published: { label: "Pubblicato", tone: "bg-teal-500 text-navy-950" },
  rejected: { label: "Rifiutato", tone: "bg-red-50 text-red-800" },
  suspended: { label: "Sospeso", tone: "bg-red-50 text-red-800" },
  unpublished: { label: "Non pubblicato", tone: "bg-navy-50 text-mute" },
};

export const orgStatus: Record<string, { label: string; tone: string }> = {
  pending: { label: "In attesa di verifica", tone: "bg-amber-50 text-amber-800" },
  verified: { label: "Verificata", tone: "bg-teal-50 text-teal-700" },
  rejected: { label: "Rifiutata", tone: "bg-red-50 text-red-800" },
  suspended: { label: "Sospesa", tone: "bg-red-50 text-red-800" },
};

export function Badge({ map, value }: { map: Record<string, { label: string; tone: string }>; value: string }) {
  const s = map[value] ?? { label: value, tone: "bg-navy-50 text-mute" };
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${s.tone}`}>{s.label}</span>;
}

/** Messaggi d'errore del database tradotti per l'utente */
export function dbMessage(msg: string) {
  if (msg.includes("DEMO_PROTECTED")) return "Account di prova: i 10 annunci di esempio non si modificano. Crea un annuncio nuovo per provare tutto il percorso.";
  if (msg.includes("LISTING_INCOMPLETE")) return "Per inviare l'annuncio manca: " + msg.split("LISTING_INCOMPLETE:")[1].trim();
  if (msg.includes("USE_REVISION")) return "Su un annuncio pubblicato questa modifica passa dalla revisione.";
  if (msg.includes("REVISION_ALREADY_PENDING")) return "C'è già una modifica in attesa di revisione.";
  if (msg.includes("FORBIDDEN")) return "Non hai i permessi per questa operazione.";
  if (msg.includes("REASON_REQUIRED")) return "Scrivi il motivo.";
  if (msg.includes("organizations_vat_number_key") || msg.includes("organizations_kind_vat_key")) return "Esiste già un'attività con questa partita IVA.";
  if (msg.includes("vat_number_check")) return "Partita IVA non valida (es. IT01234567890).";
  if (msg.includes("row-level security")) return "Operazione non consentita.";
  return "Operazione non riuscita: " + msg;
}
