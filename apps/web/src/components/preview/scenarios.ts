/* PREVIEW checkout V2: dati di prova (MOCK). Nessun dato reale, nessun pagamento reale. */

export type Extra = { id: string; name: string; cents: number; per: "day" | "once" };
export type Addr = { id: string; label: string; line: string };
export type Org = { id: string; name: string; vat: string };

export type Scenario = {
  key: "instant" | "auto" | "request" | "business";
  label: string;
  blurb: string;
  mode: "instant" | "request";
  title: string;
  category: string;
  city: string;
  addressAfter: string;
  dayCents: number;
  depositCents: number;
  deliveryCents?: number;
  extras: Extra[];
  facts: string[];
  license?: string;
  hours: [number, number];
  cancel: string;
  cancelDetail: string;
  user: { first: string; last: string; phone: string | null; licenseVerified: boolean; orgs: Org[]; addresses: Addr[] };
  defaults: { ctx: string; delivery: boolean; address: string; from: number; to: number };
};

const ISATEX: Org = { id: "isatex", name: "ISATEX S.r.l.", vat: "00038630281" };
const HOME: Addr = { id: "casa", label: "Casa", line: "Via Garibaldi 12, Cittadella (PD)" };
const WORK: Addr = { id: "isatex", label: "ISATEX S.r.l.", line: "Via Vittorio Veneto 95, Tombolo (PD)" };

export const SCENARIOS: Record<Scenario["key"], Scenario> = {
  instant: {
    key: "instant", label: "A · E-bike, prenotazione immediata",
    blurb: "Date → Paga con Apple Pay → Confermata. Nessun dato da inserire.",
    mode: "instant", title: "E-bike Specialized Turbo Levo", category: "bici", city: "Tombolo (PD)",
    addressAfter: "Via Roma 12, Tombolo (PD)", dayCents: 4500, depositCents: 0, extras: [],
    facts: ["Batteria carica al ritiro", "Casco e lucchetto inclusi", "Taglia M, adatta da 165 a 185 cm"],
    hours: [8, 19], cancel: "Cancellazione gratuita fino a 24 ore prima del ritiro",
    cancelDetail: "Dopo, fino al ritiro, ti rimborsiamo il 50%. Se non ti presenti non è previsto rimborso.",
    user: { first: "Filippo", last: "Antonello", phone: "+39 347 000 0000", licenseVerified: false, orgs: [], addresses: [HOME] },
    defaults: { ctx: "", delivery: false, address: "casa", from: 1, to: 1 },
  },
  auto: {
    key: "auto", label: "B · Auto, immediata, patente già verificata",
    blurb: "Date → Consegna ed extra → Paga. La patente non viene richiesta di nuovo.",
    mode: "instant", title: "Fiat 500 Hybrid", category: "auto", city: "Padova",
    addressAfter: "Via Venezia 40, Padova", dayCents: 4500, depositCents: 50000, deliveryCents: 1500,
    extras: [{ id: "seat", name: "Seggiolino bimbo", cents: 500, per: "day" }],
    facts: ["Cambio manuale, 4 posti", "200 km al giorno inclusi", "Assicurazione RCA e kasko incluse"],
    license: "patente B", hours: [8, 19], cancel: "Cancellazione gratuita fino a 48 ore prima del ritiro",
    cancelDetail: "Dopo, fino a 24 ore prima, ti rimborsiamo il 50%. Nelle ultime 24 ore non è previsto rimborso.",
    user: { first: "Filippo", last: "Antonello", phone: "+39 347 000 0000", licenseVerified: true, orgs: [ISATEX], addresses: [HOME, WORK] },
    defaults: { ctx: "", delivery: true, address: "casa", from: 1, to: 3 },
  },
  request: {
    key: "request", label: "C · Auto su richiesta",
    blurb: "Il noleggiatore conferma. Mancano telefono e patente: li chiediamo qui, senza mandarti nel profilo.",
    mode: "request", title: "Alfa Romeo Giulia Veloce", category: "auto", city: "Verona",
    addressAfter: "Viale del Lavoro 8, Verona", dayCents: 12900, depositCents: 150000,
    extras: [{ id: "km", name: "Pacchetto 300 km in più", cents: 4000, per: "once" }],
    facts: ["280 CV, cambio automatico", "250 km al giorno inclusi", "Età minima 25 anni, patente da 3 anni"],
    license: "patente B", hours: [9, 18], cancel: "Cancellazione gratuita fino a 7 giorni prima del ritiro",
    cancelDetail: "Prima della conferma del noleggiatore puoi annullare sempre gratis. Dopo: 50% fino a 48 ore prima, poi nessun rimborso.",
    user: { first: "Filippo", last: "Antonello", phone: null, licenseVerified: false, orgs: [], addresses: [HOME] },
    defaults: { ctx: "", delivery: false, address: "casa", from: 5, to: 7 },
  },
  business: {
    key: "business", label: "D · Furgone per l'azienda, consegna in sede",
    blurb: "Prenoti come ISATEX S.r.l., fattura all'azienda, consegna all'indirizzo aziendale già salvato.",
    mode: "instant", title: "Fiat Ducato furgone 12 m³", category: "furgoni", city: "Padova",
    addressAfter: "Via Venezia 40, Padova", dayCents: 8900, depositCents: 80000, deliveryCents: 2500,
    extras: [{ id: "straps", name: "Cinghie e coperte", cents: 1000, per: "once" }, { id: "trolley", name: "Carrello portapacchi", cents: 800, per: "day" }],
    facts: ["Portata 1.400 kg, 3 posti", "Patente B (fino a 3,5 t)", "300 km al giorno inclusi"],
    license: "patente B", hours: [7, 19], cancel: "Cancellazione gratuita fino a 24 ore prima del ritiro",
    cancelDetail: "Dopo, fino al ritiro, ti rimborsiamo il 50%. Se non ti presenti non è previsto rimborso.",
    user: { first: "Filippo", last: "Antonello", phone: "+39 347 000 0000", licenseVerified: true, orgs: [ISATEX], addresses: [HOME, WORK] },
    defaults: { ctx: "isatex", delivery: true, address: "isatex", from: 1, to: 4 },
  },
};
