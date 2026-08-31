/** Shared helpers for indexable job URLs, rank hubs and country hubs. */

export const slugify = (s: string | null | undefined): string =>
  (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

/** /jobs/{rank}-{vessel}-{port}-{id} */
export const jobPath = (v: {
  id: string;
  rank?: string | null;
  vessel?: string | null;
  port?: string | null;
}): string => {
  const parts = [slugify(v.rank) || "seafarer", slugify(v.vessel) || "vessel", slugify(v.port) || "worldwide", v.id];
  return `/jobs/${parts.filter(Boolean).join("-")}`;
};

/** The trailing uuid of a job slug. */
export const idFromSlug = (slug: string | undefined): string | null => {
  const m = (slug || "").match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  return m ? m[0] : null;
};

export interface RankHub {
  slug: string;
  name: string;
  /** lowercase keywords matched against rank_required */
  keys: string[];
  blurb: string;
}

export const RANK_HUBS: RankHub[] = [
  { slug: "master", name: "Master", keys: ["master", "captain"], blurb: "The Master holds command of the vessel — overall responsibility for safety of life, cargo, the ship and compliance with SOLAS, MARPOL and the ISM Code. Employers look for unlimited CoC, strong port state control record and vetting experience." },
  { slug: "chief-officer", name: "Chief Officer", keys: ["chief officer", "chief mate", "c/o"], blurb: "The Chief Officer runs cargo operations, stability, deck maintenance and the deck crew. Tanker owners weight cargo handling, ballast management and vetting (SIRE 2.0 / CDI) experience heavily." },
  { slug: "2nd-officer", name: "2nd Officer", keys: ["2nd officer", "second officer", "2/o"], blurb: "The 2nd Officer is the navigation officer — passage planning, chart and ECDIS corrections, and usually the medical officer on board." },
  { slug: "3rd-officer", name: "3rd Officer", keys: ["3rd officer", "third officer", "3/o"], blurb: "The 3rd Officer keeps a bridge watch and maintains LSA/FFE equipment — often the first officer rank after cadetship." },
  { slug: "chief-engineer", name: "Chief Engineer", keys: ["chief engineer", "c/e"], blurb: "The Chief Engineer is head of the engine department — machinery reliability, planned maintenance, bunkering, budgets and compliance with MARPOL Annex VI." },
  { slug: "2nd-engineer", name: "2nd Engineer", keys: ["2nd engineer", "second engineer", "2/e"], blurb: "The 2nd Engineer runs day-to-day engine room operations, the maintenance plan and the engine ratings." },
  { slug: "3rd-engineer", name: "3rd Engineer", keys: ["3rd engineer", "third engineer", "3/e"], blurb: "The 3rd Engineer typically handles generators, boilers and fuel systems under the 2nd Engineer." },
  { slug: "4th-engineer", name: "4th Engineer", keys: ["4th engineer", "fourth engineer", "4/e"], blurb: "The 4th Engineer looks after purifiers, pumps and auxiliary machinery — a common first engineer rank at sea." },
  { slug: "eto", name: "ETO", keys: ["eto", "electro", "electrical officer"], blurb: "The Electro-Technical Officer maintains automation, power management, navigation electronics and increasingly cyber-exposed systems." },
  { slug: "bosun", name: "Bosun", keys: ["bosun", "boatswain"], blurb: "The Bosun leads the deck ratings, planning day work, mooring stations and deck maintenance." },
  { slug: "ab", name: "AB", keys: ["ab", "able seaman", "able bodied"], blurb: "The Able Seafarer Deck keeps a lookout watch, handles mooring and carries out deck maintenance under the Bosun." },
  { slug: "os", name: "OS", keys: ["os", "ordinary seaman"], blurb: "Ordinary Seaman is an entry deck rating — the usual first sea-going rating position." },
  { slug: "fitter", name: "Fitter", keys: ["fitter", "welder"], blurb: "The Fitter carries out welding, machining and mechanical repairs in the engine department." },
  { slug: "oiler", name: "Oiler", keys: ["oiler", "motorman", "wiper"], blurb: "The Oiler / Motorman supports engine watchkeeping, lubrication and machinery cleaning." },
  { slug: "cook", name: "Cook", keys: ["cook", "chef"], blurb: "The Ship's Cook is responsible for crew catering, provisions and galley hygiene under MLC 2006 requirements." },
  { slug: "messman", name: "Messman", keys: ["messman", "steward", "mess boy"], blurb: "The Messman supports the galley and accommodation — an entry route into the catering department." },
];

export const rankHubBySlug = (slug: string | undefined) =>
  RANK_HUBS.find((r) => r.slug === (slug || "").toLowerCase()) || null;

export const rankMatches = (hub: RankHub, rank: string | null | undefined): boolean => {
  const r = (rank || "").toLowerCase();
  if (!r) return false;
  return hub.keys.some((k) => new RegExp(`(^|[^a-z])${k.replace(/[/]/g, "\\/")}([^a-z]|$)`, "i").test(r) || r.includes(k));
};

export interface CountryHub {
  slug: string;
  name: string;
  ports: string[];
  blurb: string;
}

export const COUNTRY_HUBS: CountryHub[] = [
  { slug: "india", name: "India", ports: ["india", "mumbai", "chennai", "kochi", "cochin", "kolkata", "kandla", "vizag", "visakhapatnam", "goa", "haldia", "tuticorin", "mundra"], blurb: "Indian seafarers crew a large share of the world merchant fleet. Vacancies below join from Indian ports or are offered by companies recruiting Indian crew directly." },
  { slug: "philippines", name: "Philippines", ports: ["philippines", "manila", "cebu", "batangas", "subic", "davao", "iloilo"], blurb: "The Philippines supplies more seafarers than any other nation. These vacancies join from Philippine ports or come from principals hiring Filipino crew." },
  { slug: "indonesia", name: "Indonesia", ports: ["indonesia", "jakarta", "surabaya", "batam", "semarang", "balikpapan"], blurb: "Indonesian crewing demand is strongest on bulkers, tugs and offshore units. These openings join from Indonesian ports or target Indonesian crew." },
  { slug: "vietnam", name: "Vietnam", ports: ["vietnam", "haiphong", "ho chi minh", "saigon", "danang", "da nang", "vung tau"], blurb: "Vietnamese seafarers are increasingly recruited for container and bulk fleets. Live openings joining from Vietnamese ports are listed here." },
  { slug: "ukraine", name: "Ukraine", ports: ["ukraine", "odessa", "odesa", "mariupol", "kherson", "izmail"], blurb: "Ukrainian officers remain in high demand across tanker and container fleets, joining worldwide." },
  { slug: "bangladesh", name: "Bangladesh", ports: ["bangladesh", "chittagong", "chattogram", "dhaka", "mongla"], blurb: "Bangladeshi officers and ratings sail mainly on bulk carriers and container ships." },
  { slug: "myanmar", name: "Myanmar", ports: ["myanmar", "burma", "yangon", "rangoon"], blurb: "Myanmar crew are widely employed as ratings and junior officers on bulk and container tonnage." },
  { slug: "sri-lanka", name: "Sri Lanka", ports: ["sri lanka", "colombo", "galle", "hambantota"], blurb: "Sri Lankan seafarers join worldwide, with Colombo a major crew change hub." },
  { slug: "greece", name: "Greece", ports: ["greece", "piraeus", "athens", "thessaloniki"], blurb: "Greek owners operate one of the largest fleets in the world; Piraeus remains the centre of European ship management." },
  { slug: "uae", name: "UAE", ports: ["uae", "dubai", "abu dhabi", "sharjah", "fujairah", "jebel ali", "emirates"], blurb: "Fujairah and Jebel Ali are among the busiest crew change and bunkering hubs in the Gulf." },
  { slug: "singapore", name: "Singapore", ports: ["singapore"], blurb: "Singapore is the world's busiest bunkering port and a leading crew change hub for tankers, bulkers and container ships." },
];

export const countryHubBySlug = (slug: string | undefined) =>
  COUNTRY_HUBS.find((c) => c.slug === (slug || "").toLowerCase()) || null;

export const portMatches = (hub: CountryHub, port: string | null | undefined): boolean => {
  const p = (port || "").toLowerCase();
  if (!p) return false;
  return hub.ports.some((k) => p.includes(k));
};
