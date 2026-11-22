/**
 * Catalogo KeyRent: marche e modelli più diffusi nel noleggio in Italia, per categoria.
 * Formato compatto: "Modello:tipologia" separati da "|". La tipologia è lo slug della sottocategoria.
 * Le caratteristiche precompilate sono solo quelle certe (es. e-bike = pedalata assistita);
 * tutto il resto lo inserisce il noleggiatore. Si sincronizza nel database da Admin → Catalogo,
 * e un modello viene comunque creato al volo la prima volta che un noleggiatore lo usa.
 */

type MakeDef = [name: string, models: string, aliases?: string[]];

export const EXTRA_SUBCATEGORIES: Record<string, { slug: string; name: string; sort: number }[]> = {
  moto: [
    { slug: "adventure", name: "Enduro e adventure", sort: 40 },
    { slug: "sportiva", name: "Sportiva", sort: 50 },
    { slug: "custom", name: "Custom e cruiser", sort: 60 },
  ],
};

const RAW: Record<string, MakeDef[]> = {
  auto: [
    ["Fiat", "500:city-car|500e:city-car|Panda:city-car|Grande Panda:suv|600:suv|500X:suv|Tipo:berlina"],
    ["Abarth", "595:sportiva|695:sportiva|500e:sportiva|600e:sportiva"],
    ["Alfa Romeo", "Junior:suv|Tonale:suv|Stelvio:suv|Giulia:berlina", ["alfa"]],
    ["Lancia", "Ypsilon:city-car"],
    ["Jeep", "Avenger:suv|Renegade:suv|Compass:suv|Wrangler:suv|Grand Cherokee:suv"],
    ["Volkswagen", "Up!:city-car|Polo:city-car|Golf:berlina|T-Cross:suv|Taigo:suv|T-Roc:suv|T-Roc Cabriolet:cabrio|Tiguan:suv|Touareg:suv|Passat:berlina|ID.3:berlina|ID.4:suv|ID.7:berlina", ["vw"]],
    ["Audi", "A1:city-car|A3:berlina|A4:berlina|A5:berlina|A5 Cabriolet:cabrio|A6:berlina|Q2:suv|Q3:suv|Q4 e-tron:suv|Q5:suv|Q7:suv|Q8:suv|TT:sportiva|R8:sportiva|e-tron GT:sportiva"],
    ["BMW", "Serie 1:berlina|Serie 2:berlina|Serie 3:berlina|Serie 4 Cabrio:cabrio|Serie 5:berlina|X1:suv|X2:suv|X3:suv|X5:suv|X6:suv|X7:suv|i4:berlina|iX1:suv|iX:suv|Z4:cabrio|M2:sportiva|M3:sportiva|M4:sportiva"],
    ["Mercedes-Benz", "Classe A:berlina|Classe B:berlina|Classe C:berlina|Classe E:berlina|Classe S:berlina|CLA:berlina|CLE Cabrio:cabrio|GLA:suv|GLB:suv|GLC:suv|GLE:suv|GLS:suv|Classe G:suv|EQA:suv|EQB:suv|EQE:berlina|SL:cabrio|AMG GT:sportiva", ["mercedes", "mb"]],
    ["Toyota", "Aygo X:city-car|Yaris:city-car|Yaris Cross:suv|Corolla:berlina|Corolla Cross:suv|C-HR:suv|RAV4:suv|Land Cruiser:suv|bZ4X:suv|GR Yaris:sportiva|GR86:sportiva|GR Supra:sportiva"],
    ["Renault", "Twingo:city-car|Clio:city-car|Renault 5 E-Tech:city-car|Captur:suv|Symbioz:suv|Arkana:suv|Austral:suv|Rafale:suv|Megane E-Tech:berlina|Scenic E-Tech:suv"],
    ["Dacia", "Spring:city-car|Sandero:city-car|Sandero Stepway:city-car|Duster:suv|Bigster:suv|Jogger:berlina"],
    ["Peugeot", "208:city-car|2008:suv|308:berlina|408:berlina|3008:suv|5008:suv"],
    ["Citroën", "Ami:city-car|C3:city-car|C3 Aircross:suv|C4:berlina|C5 Aircross:suv|C5 X:berlina", ["citroen"]],
    ["Opel", "Corsa:city-car|Mokka:suv|Frontera:suv|Astra:berlina|Grandland:suv"],
    ["DS", "DS 3:suv|DS 4:berlina|DS 7:suv"],
    ["Ford", "Fiesta:city-car|Puma:suv|Focus:berlina|Kuga:suv|Explorer:suv|Ranger:suv|Mustang:sportiva|Mustang Convertible:cabrio|Mustang Mach-E:suv"],
    ["Hyundai", "i10:city-car|Inster:city-car|i20:city-car|Bayon:suv|i30:berlina|Kona:suv|Tucson:suv|Santa Fe:suv|Ioniq 5:suv|Ioniq 6:berlina"],
    ["Kia", "Picanto:city-car|Stonic:suv|Ceed:berlina|XCeed:suv|Niro:suv|Sportage:suv|Sorento:suv|EV3:suv|EV6:suv|EV9:suv"],
    ["Nissan", "Micra:city-car|Juke:suv|Qashqai:suv|X-Trail:suv|Leaf:berlina|Ariya:suv"],
    ["Mazda", "Mazda2:city-car|Mazda3:berlina|CX-30:suv|CX-5:suv|CX-60:suv|MX-5:cabrio"],
    ["Honda", "Jazz:city-car|Civic:berlina|HR-V:suv|ZR-V:suv|CR-V:suv"],
    ["Suzuki", "Ignis:city-car|Swift:city-car|Vitara:suv|S-Cross:suv|Jimny:suv"],
    ["Skoda", "Fabia:city-car|Scala:berlina|Octavia:berlina|Superb:berlina|Kamiq:suv|Karoq:suv|Kodiaq:suv|Elroq:suv|Enyaq:suv", ["škoda"]],
    ["Seat", "Ibiza:city-car|Leon:berlina|Arona:suv|Ateca:suv|Tarraco:suv"],
    ["Cupra", "Born:berlina|Leon:berlina|Formentor:suv|Terramar:suv|Tavascan:suv"],
    ["Volvo", "EX30:suv|XC40:suv|XC60:suv|XC90:suv|V60:berlina|V90:berlina"],
    ["Tesla", "Model 3:berlina|Model Y:suv|Model S:berlina|Model X:suv"],
    ["MG", "MG3:city-car|MG4:berlina|ZS:suv|HS:suv|Cyberster:cabrio"],
    ["BYD", "Dolphin Surf:city-car|Dolphin:berlina|Atto 2:suv|Atto 3:suv|Seal:berlina|Seal U:suv"],
    ["Mini", "Cooper:city-car|Cabrio:cabrio|Aceman:suv|Countryman:suv"],
    ["Smart", "fortwo:city-car|#1:suv|#3:suv"],
    ["Porsche", "911:sportiva|911 Cabriolet:cabrio|718 Cayman:sportiva|718 Boxster:cabrio|Taycan:sportiva|Panamera:berlina|Macan:suv|Cayenne:suv"],
    ["Land Rover", "Defender:suv|Discovery:suv|Discovery Sport:suv|Range Rover:suv|Range Rover Sport:suv|Range Rover Evoque:suv|Range Rover Velar:suv"],
    ["Lexus", "LBX:suv|UX:suv|NX:suv|RX:suv|ES:berlina"],
    ["Maserati", "Grecale:suv|Levante:suv|GranTurismo:sportiva|GranCabrio:cabrio|MC20:sportiva"],
    ["Ferrari", "Roma:sportiva|Portofino M:cabrio|296 GTB:sportiva|SF90 Stradale:sportiva|12Cilindri:sportiva|Purosangue:suv"],
    ["Lamborghini", "Huracán:sportiva|Temerario:sportiva|Revuelto:sportiva|Urus:suv"],
    ["Polestar", "Polestar 2:berlina|Polestar 3:suv|Polestar 4:suv"],
    ["Leapmotor", "T03:city-car|B10:suv|C10:suv"],
    ["Mitsubishi", "Space Star:city-car|ASX:suv|Eclipse Cross:suv|Outlander:suv"],
    ["Subaru", "Crosstrek:suv|Forester:suv|Outback:suv"],
    ["Alpine", "A110:sportiva|A290:city-car"],
  ],

  moto: [
    ["Piaggio", "Liberty 50:scooter|Liberty 125:scooter|Medley 125:scooter|Beverly 300:scooter|Beverly 400:scooter|MP3 400:scooter|MP3 530:scooter|Piaggio 1:scooter"],
    ["Vespa", "Primavera 50:scooter|Primavera 125:scooter|Sprint 125:scooter|GTS 125:scooter|GTS 300:scooter|GTV 300:scooter|Elettrica:scooter"],
    ["Honda", "SH 125:scooter|SH 150:scooter|SH 350:scooter|PCX 125:scooter|Forza 125:scooter|Forza 350:scooter|ADV350:scooter|X-ADV:scooter|CB500 Hornet:naked|CB650R:naked|CB750 Hornet:naked|NC750X:touring|XL750 Transalp:adventure|CRF1100L Africa Twin:adventure|Gold Wing:touring|Rebel 500:custom|CBR650R:sportiva|CBR1000RR-R Fireblade:sportiva"],
    ["Yamaha", "NMAX 125:scooter|XMAX 125:scooter|XMAX 300:scooter|Tricity 125:scooter|TMAX:scooter|MT-03:naked|MT-07:naked|MT-09:naked|XSR700:naked|XSR900:naked|Tracer 7:touring|Tracer 9:touring|Ténéré 700:adventure|R7:sportiva|R1:sportiva"],
    ["Kymco", "Agility 125:scooter|People S 125:scooter|X-Town 125:scooter|DT X360:scooter|AK 550:scooter"],
    ["SYM", "Symphony 125:scooter|Jet 14 125:scooter|ADX 125:scooter|Maxsym TL 508:scooter"],
    ["BMW", "C 400 X:scooter|C 400 GT:scooter|CE 04:scooter|G 310 GS:adventure|F 800 GS:adventure|F 900 GS:adventure|R 1250 GS:adventure|R 1300 GS:adventure|R 1250 RT:touring|K 1600 GT:touring|F 900 R:naked|S 1000 R:naked|R nineT:naked|R 18:custom|S 1000 RR:sportiva"],
    ["Ducati", "Scrambler Icon:naked|Monster:naked|Streetfighter V4:naked|Hypermotard 698 Mono:naked|Multistrada V2:adventure|Multistrada V4:adventure|DesertX:adventure|Diavel V4:custom|Panigale V2:sportiva|Panigale V4:sportiva"],
    ["Triumph", "Speed 400:naked|Scrambler 400 X:naked|Trident 660:naked|Street Triple 765:naked|Speed Triple 1200 RS:naked|Bonneville T120:naked|Tiger Sport 660:touring|Tiger 900:adventure|Tiger 1200:adventure|Rocket 3:custom"],
    ["KTM", "390 Duke:naked|790 Duke:naked|990 Duke:naked|1390 Super Duke R:naked|390 Adventure:adventure|890 Adventure:adventure|1290 Super Adventure:adventure"],
    ["Kawasaki", "Z500:naked|Z650:naked|Z900:naked|Ninja 650:sportiva|Ninja ZX-6R:sportiva|Versys 650:touring|Versys 1000:touring|Vulcan S:custom|Eliminator 500:custom"],
    ["Suzuki", "Burgman 400:scooter|GSX-8S:naked|GSX-S1000:naked|V-Strom 800DE:adventure|V-Strom 1050:adventure|Hayabusa:sportiva"],
    ["Harley-Davidson", "Nightster:custom|Sportster S:custom|Street Bob:custom|Fat Boy:custom|Street Glide:touring|Road Glide:touring|Pan America 1250:adventure", ["harley", "hd"]],
    ["Moto Guzzi", "V7:naked|V85 TT:adventure|Stelvio:adventure|V100 Mandello:touring", ["guzzi"]],
    ["Aprilia", "SR GT 125:scooter|Tuono 660:naked|RS 660:sportiva|RSV4:sportiva|Tuareg 660:adventure"],
    ["Benelli", "Leoncino 500:naked|752S:naked|TRK 502:adventure"],
    ["Royal Enfield", "Classic 350:naked|Interceptor 650:naked|Meteor 350:custom|Himalayan 450:adventure"],
    ["MV Agusta", "Brutale:naked|Dragster:naked|Enduro Veloce:adventure"],
    ["Voge", "525DSX:adventure|300Rally:adventure"],
    ["CFMoto", "450NK:naked|800MT:adventure"],
  ],

  bici: [
    ["Trek", "Rail:e-bike|Powerfly:e-bike|Fuel EXe:e-bike|Allant+:e-bike|Marlin:mtb|Fuel EX:mtb|Checkpoint:gravel|Domane:gravel|Émonda:gravel|FX:city"],
    ["Specialized", "Turbo Levo:e-bike|Turbo Vado:e-bike|Turbo Como:e-bike|Turbo Creo:e-bike|Stumpjumper:mtb|Rockhopper:mtb|Diverge:gravel|Tarmac:gravel|Sirrus:city"],
    ["Cannondale", "Moterra:e-bike|Tesoro Neo:e-bike|Trail:mtb|Topstone:gravel|Synapse:gravel|Quick:city"],
    ["Giant", "Trance X E+:e-bike|Explore E+:e-bike|Talon:mtb|Revolt:gravel|TCR:gravel|Escape:city"],
    ["Cube", "Stereo Hybrid:e-bike|Reaction Hybrid:e-bike|Kathmandu Hybrid:e-bike|Aim:mtb|Nuroad:gravel|Attain:gravel"],
    ["Haibike", "AllMtn:e-bike|AllTrail:e-bike|Trekking:e-bike"],
    ["Scott", "Patron:e-bike|Strike eRide:e-bike|Spark:mtb|Scale:mtb|Addict Gravel:gravel"],
    ["Bianchi", "E-Omnia:e-bike|e-Vertic:e-bike|Arcadex:gravel|Oltre:gravel|Specialissima:gravel"],
    ["Orbea", "Rise:e-bike|Wild:e-bike|Kemen:e-bike|Occam:mtb|Terra:gravel|Orca:gravel"],
    ["Focus", "Jam²:e-bike|Thron²:e-bike|Atlas:gravel"],
    ["Merida", "eONE-SIXTY:e-bike|eBIG.NINE:e-bike|Big.Nine:mtb|Silex:gravel"],
    ["Thok", "MIG:e-bike|TP4:e-bike|Gram:e-bike"],
    ["Fantic", "Integra XTF:e-bike|XF1 Integra:e-bike"],
    ["Lapierre", "Overvolt:e-bike"],
    ["Kalkhoff", "Endeavour:e-bike|Image:e-bike"],
    ["Moustache", "Samedi:e-bike"],
    ["Pinarello", "Dogma F:gravel|Grevil:gravel"],
    ["Brompton", "C Line:city|Electric C Line:e-bike"],
  ],

  camper: [
    ["Laika", "Kosmo:semintegrale|Ecovip:motorhome|Kreos:motorhome"],
    ["Rimor", "Katamarano:mansardato|Seal:semintegrale|Evo:semintegrale"],
    ["Elnagh", "Baron:mansardato|T-Loft:semintegrale"],
    ["Mobilvetta", "Admiral:semintegrale|K-Yacht:semintegrale"],
    ["McLouis", "Fusion:semintegrale|Nevis:semintegrale", ["mc louis"]],
    ["Roller Team", "Kronos:semintegrale|Zefiro:semintegrale|Livingstone:van"],
    ["Giottiline", "Siena:semintegrale|Therry:semintegrale"],
    ["Wingamm", "Oasi:semintegrale"],
    ["Adria", "Twin:van|Compact:semintegrale|Coral:semintegrale|Matrix:semintegrale|Sonic:motorhome"],
    ["Hymer", "Free:van|Grand Canyon S:van|Tramp:semintegrale|Exsis-t:semintegrale|B-Klasse:motorhome"],
    ["Knaus", "BoxStar:van|Van TI:semintegrale|Sky TI:semintegrale|Sun TI:semintegrale|L!VE TI:semintegrale"],
    ["Dethleffs", "Globebus:semintegrale|Trend:semintegrale|Pulse:semintegrale|Advantage:semintegrale"],
    ["Bürstner", "Campeo:van|Lyseo:semintegrale", ["burstner"]],
    ["Carado", "Camper Van:van|Serie T:semintegrale|Serie A:mansardato"],
    ["Sunlight", "Cliff:van|Serie T:semintegrale|Serie A:mansardato"],
    ["Chausson", "First Line:semintegrale|Flash:semintegrale|Titanium:semintegrale"],
    ["Benimar", "Mileo:semintegrale|Tessoro:semintegrale"],
    ["Weinsberg", "CaraBus:van|CaraCompact:semintegrale|CaraHome:mansardato"],
    ["Pössl", "2Win:van|Roadcar:van|Summit:van", ["possl", "poessl"]],
    ["Westfalia", "Club Joker:van|Kepler:van|Columbus:van"],
    ["Malibu", "Van:van"],
    ["Volkswagen", "California:van|Grand California:van", ["vw"]],
    ["Mercedes-Benz", "Marco Polo:van", ["mercedes"]],
    ["Ford", "Transit Nugget:van"],
  ],

  barche: [
    ["Zodiac", "Cadet:gommone|Open:gommone|Medline:gommone"],
    ["Joker Boat", "Coaster:gommone|Clubman:gommone"],
    ["Capelli", "Tempest:gommone"],
    ["Lomac", "IN:gommone|Adrenalina:gommone"],
    ["Sacs", "Strider:gommone|Marlin:gommone"],
    ["Nuova Jolly", "Prince:gommone|King:gommone"],
    ["Italboats", "Predator:gommone"],
    ["Ranieri", "Next:barca-a-motore|Voyager:barca-a-motore|Cayman:barca-a-motore"],
    ["Saver", "Manta:barca-a-motore|Riviera:barca-a-motore"],
    ["Apreamare", "Smeraldo:barca-a-motore"],
    ["Mimì", "Libeccio:barca-a-motore", ["mimi"]],
    ["Quicksilver", "Activ:barca-a-motore"],
    ["Bayliner", "Element:barca-a-motore"],
    ["Jeanneau", "Cap Camarat:barca-a-motore|Merry Fisher:barca-a-motore|Sun Odyssey:barca-a-vela"],
    ["Beneteau", "Flyer:barca-a-motore|Antares:barca-a-motore|Oceanis:barca-a-vela|First:barca-a-vela", ["bénéteau"]],
    ["Bavaria", "Cruiser:barca-a-vela"],
    ["Dufour", "Grand Large:barca-a-vela"],
    ["Elan", "Impression:barca-a-vela"],
    ["Lagoon", "40:barca-a-vela|42:barca-a-vela|46:barca-a-vela"],
    ["Fountaine Pajot", "Isla 40:barca-a-vela|Astrea 42:barca-a-vela|Elba 45:barca-a-vela"],
  ],

  furgoni: [
    ["Fiat", "Fiorino:van-merci|Doblò:van-merci|Scudo:van-merci|Ducato:van-merci|E-Ducato:van-merci", ["fiat professional"]],
    ["Ford", "Transit Courier:van-merci|Transit Connect:van-merci|Transit Custom:van-merci|Transit:van-merci|E-Transit:van-merci|Tourneo Custom:minibus"],
    ["Renault", "Kangoo Van:van-merci|Trafic:van-merci|Master:van-merci|Trafic Combi:minibus"],
    ["Volkswagen", "Caddy Cargo:van-merci|Transporter:van-merci|Crafter:van-merci|Caravelle:minibus|Multivan:minibus|ID. Buzz:minibus", ["vw"]],
    ["Mercedes-Benz", "Citan:van-merci|Vito:van-merci|Sprinter:van-merci|eSprinter:van-merci|Vito Tourer:minibus|Classe V:minibus", ["mercedes"]],
    ["Iveco", "Daily:van-merci|eDaily:van-merci"],
    ["Peugeot", "Partner:van-merci|Expert:van-merci|Boxer:van-merci|Traveller:minibus"],
    ["Citroën", "Berlingo Van:van-merci|Jumpy:van-merci|Jumper:van-merci|SpaceTourer:minibus", ["citroen"]],
    ["Opel", "Combo Cargo:van-merci|Vivaro:van-merci|Movano:van-merci|Zafira Life:minibus"],
    ["Toyota", "Proace City:van-merci|Proace:van-merci|Proace Verso:minibus"],
    ["Nissan", "Townstar:van-merci|Primastar:van-merci|Interstar:van-merci"],
    ["Maxus", "eDeliver 3:van-merci|Deliver 9:van-merci"],
    ["Hyundai", "Staria:minibus"],
  ],

  "quad-motoslitte": [
    ["Polaris", "Sportsman 570:quad|Sportsman XP 1000:quad|INDY:motoslitta|RMK:motoslitta|Switchback:motoslitta"],
    ["Can-Am", "Outlander:quad|Renegade:quad", ["canam"]],
    ["CFMoto", "CFORCE 450:quad|CFORCE 625:quad|CFORCE 1000:quad"],
    ["Yamaha", "Kodiak 450:quad|Grizzly 700:quad|YFZ450R:quad|Sidewinder:motoslitta"],
    ["Kymco", "MXU 550:quad|MXU 700:quad"],
    ["Segway", "Snarler AT6:quad"],
    ["TGB", "Blade 1000:quad"],
    ["Ski-Doo", "Tundra:motoslitta|Skandic:motoslitta|Expedition:motoslitta|Renegade:motoslitta|MXZ:motoslitta|Summit:motoslitta", ["skidoo"]],
    ["Lynx", "Rave:motoslitta|Commander:motoslitta|49 Ranger:motoslitta|Xterrain:motoslitta"],
    ["Arctic Cat", "ZR:motoslitta|Riot:motoslitta|Norseman:motoslitta"],
  ],
};

export type CatalogEntry = {
  category: string; sub: string; make: string; makeSlug: string; model: string; modelSlug: string;
  specs: Record<string, string | number | boolean>; search: string;
};

export function slug(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[²]/g, "2").replace(/\+/g, "-plus").replace(/#/g, "n").replace(/!/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function norm(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "");
}

/** Caratteristiche certe, ricavate dal tipo di mezzo o dal nome (mai inventate). */
function specsFor(category: string, sub: string, model: string): CatalogEntry["specs"] {
  const s: CatalogEntry["specs"] = {};
  if (category === "bici") s.electric = sub === "e-bike";
  if (category === "moto" && sub === "scooter") {
    const cc = Number(model.match(/\b(50|125|150)\b/)?.[1]);
    if (cc === 50) { s.license = "AM"; s.displacement_cc = 50; }
    else if (cc === 125) { s.license = "A1"; s.displacement_cc = 125; }
  }
  return s;
}

export const CATALOG: CatalogEntry[] = Object.entries(RAW).flatMap(([category, makes]) =>
  makes.flatMap(([make, models, aliases = []]) =>
    models.split("|").map((pair) => {
      const i = pair.lastIndexOf(":");
      const model = pair.slice(0, i), sub = pair.slice(i + 1);
      return {
        category, sub, make, makeSlug: slug(make), model, modelSlug: slug(model),
        specs: specsFor(category, sub, model),
        search: [norm(`${make}${model}`), norm(`${model}`), ...aliases.map((a) => norm(`${a}${model}`)), norm(sub), norm(category)].join(" "),
      };
    }),
  ),
);

/** Ricerca "mentre scrivi": "duc" → Fiat Ducato, "golf" → Volkswagen Golf, "vw t-roc" → Volkswagen T-Roc. */
export function searchCatalog(q: string, category?: string, limit = 8): CatalogEntry[] {
  const words = q.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").split(/[^a-z0-9]+/).filter(Boolean);
  if (words.length === 0) return [];
  const pool = category ? CATALOG.filter((e) => e.category === category) : CATALOG;
  const scored: { e: CatalogEntry; score: number }[] = [];
  for (const e of pool) {
    const model = norm(e.model), make = norm(e.make), joined = norm(words.join(""));
    let score = 0;
    if (model === joined || norm(e.make + e.model) === joined) score = 100;
    else if (model.startsWith(joined)) score = 80;
    else if (norm(e.make + e.model).startsWith(joined) || e.search.split(" ").some((t) => t.startsWith(joined))) score = 70;
    else if (words.every((w) => e.search.includes(w))) score = 50 - (make.startsWith(words[0]) ? 0 : 5);
    if (score > 0) scored.push({ e, score });
  }
  if (scored.length === 0 && words.length > 1) return searchCatalog(words.slice(0, -1).join(" "), category, limit);
  return scored.sort((a, b) => b.score - a.score || a.e.make.localeCompare(b.e.make) || a.e.model.localeCompare(b.e.model))
    .slice(0, limit).map((x) => x.e);
}

export function findCatalog(category: string, makeSlug: string, modelSlug: string) {
  return CATALOG.find((e) => e.category === category && e.makeSlug === makeSlug && e.modelSlug === modelSlug);
}
