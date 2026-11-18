import { slugify } from "./format";

/** Località per la ricerca (coordinate del centro, approssimate). Da sostituire con geocoding quando servirà. */
const RAW: [string, string, number, number][] = [
  ["Roma", "RM", 41.9028, 12.4964], ["Milano", "MI", 45.4642, 9.19], ["Napoli", "NA", 40.8518, 14.2681],
  ["Torino", "TO", 45.0703, 7.6869], ["Palermo", "PA", 38.1157, 13.3615], ["Genova", "GE", 44.4056, 8.9463],
  ["Bologna", "BO", 44.4949, 11.3426], ["Firenze", "FI", 43.7696, 11.2558], ["Bari", "BA", 41.1171, 16.8719],
  ["Catania", "CT", 37.5079, 15.083], ["Venezia", "VE", 45.4408, 12.3155], ["Verona", "VR", 45.4384, 10.9916],
  ["Messina", "ME", 38.1938, 15.554], ["Padova", "PD", 45.4064, 11.8768], ["Trieste", "TS", 45.6495, 13.7768],
  ["Brescia", "BS", 45.5416, 10.2118], ["Parma", "PR", 44.8015, 10.3279], ["Modena", "MO", 44.6471, 10.9252],
  ["Reggio Emilia", "RE", 44.6989, 10.6297], ["Reggio Calabria", "RC", 38.1113, 15.6473],
  ["Perugia", "PG", 43.1107, 12.3908], ["Livorno", "LI", 43.5485, 10.3106], ["Ravenna", "RA", 44.4184, 12.2035],
  ["Cagliari", "CA", 39.2238, 9.1217], ["Rimini", "RN", 44.0678, 12.5695], ["Salerno", "SA", 40.6824, 14.7681],
  ["Ferrara", "FE", 44.8381, 11.6198], ["Sassari", "SS", 40.7259, 8.5557], ["Olbia", "SS", 40.9233, 9.4964],
  ["Alghero", "SS", 40.5589, 8.3181], ["Latina", "LT", 41.4676, 12.9037], ["Bergamo", "BG", 45.6983, 9.6773],
  ["Como", "CO", 45.8081, 9.0852], ["Trento", "TN", 46.0748, 11.1217], ["Riva del Garda", "TN", 45.8858, 10.8411],
  ["Bolzano", "BZ", 46.4983, 11.3548], ["Vicenza", "VI", 45.5455, 11.5354], ["Bassano del Grappa", "VI", 45.7656, 11.7344],
  ["Cassola", "VI", 45.7333, 11.8], ["Treviso", "TV", 45.6669, 12.243], ["Belluno", "BL", 46.1425, 12.2167],
  ["Cortina d'Ampezzo", "BL", 46.5405, 12.1357], ["Rovigo", "RO", 45.0703, 11.79], ["Udine", "UD", 46.0711, 13.2346],
  ["Desenzano del Garda", "BS", 45.4712, 10.5375], ["Ancona", "AN", 43.6158, 13.5189], ["Pescara", "PE", 42.4618, 14.2161],
  ["L'Aquila", "AQ", 42.3498, 13.3995], ["Lecce", "LE", 40.3515, 18.175], ["Matera", "MT", 40.6664, 16.6043],
  ["Potenza", "PZ", 40.6404, 15.8056], ["Pisa", "PI", 43.7228, 10.4017], ["Siena", "SI", 43.3188, 11.3308],
  ["Lucca", "LU", 43.8429, 10.5027], ["Sorrento", "NA", 40.6263, 14.3757], ["Amalfi", "SA", 40.634, 14.6027],
  ["Taormina", "ME", 37.8516, 15.2853], ["Aosta", "AO", 45.7372, 7.3206], ["Campobasso", "CB", 41.5603, 14.6627],
];

export type Place = { slug: string; name: string; province: string; lat: number; lng: number };

export const PLACES: Place[] = RAW.map(([name, province, lat, lng]) => ({ slug: slugify(name), name, province, lat, lng }))
  .sort((a, b) => a.name.localeCompare(b.name, "it"));

export function findPlace(input?: string | null): Place | undefined {
  if (!input) return undefined;
  const s = slugify(input);
  return PLACES.find((p) => p.slug === s) ?? PLACES.find((p) => p.slug.startsWith(s));
}
