/** Technical listing schemas for the Maritime Exchange (stored in `specifications` jsonb). */
export type SpecField = { k: string; label: string; ph?: string; req?: boolean; opts?: string[]; type?: "date" | "number" };
export type SpecGroup = { title: string; fields: SpecField[] };
export type PhotoSlot = { k: string; label: string; req?: boolean };

const CLASS = ["DNV", "Lloyd's Register", "ABS", "Bureau Veritas", "ClassNK", "KR", "RINA", "CCS", "IRS", "Workshop / maker test only", "None"];

export const SPARE_SPEC: SpecGroup[] = [
  { title: "Machine & system", fields: [
    { k: "system", label: "System", req: true, opts: ["Main engine", "Auxiliary engine / generator", "Boiler & steam", "Purifier / separator", "Pumps", "Compressors", "Heat exchanger", "Turbocharger", "Deck machinery", "Steering gear", "Electrical & automation", "Navigation / bridge", "LSA / FFA safety", "Cargo system (tanks / gas)", "Hull & piping", "Other"] },
    { k: "machine_model", label: "Machine model / series", ph: "e.g. Yanmar 6EY18AL, MAN 6S50ME-C8.2", req: true },
    { k: "part_name", label: "Part name", ph: "e.g. Exhaust valve spindle", req: true },
    { k: "drawing_no", label: "Drawing / plate / item no.", ph: "e.g. Plate 012, item 04" },
    { k: "serial_no", label: "Serial / heat number", ph: "If reconditioned or forged" },
  ]},
  { title: "Dimensions & material", fields: [
    { k: "od_mm", label: "Outside dia. (mm)", type: "number", ph: "180.00" },
    { k: "id_mm", label: "Inside dia. (mm)", type: "number" },
    { k: "length_mm", label: "Length / height (mm)", type: "number" },
    { k: "thickness_mm", label: "Thickness (mm)", type: "number", ph: "0.5" },
    { k: "tolerance", label: "Tolerance", ph: "± 0.02 mm" },
    { k: "weight_kg", label: "Weight (kg)", type: "number" },
    { k: "material", label: "Material grade", ph: "Nimonic 80A, SUS316L, bronze…" },
    { k: "thread_flange", label: "Thread / flange / seat", ph: "M24x2, DN100 PN16, seat 30°" },
  ]},
  { title: "Electrical (if applicable)", fields: [
    { k: "voltage", label: "Voltage", opts: ["", "24V DC", "110V AC", "220V AC", "380V AC", "440V AC", "690V AC", "6.6 kV"] },
    { k: "frequency", label: "Frequency / phase", opts: ["", "50 Hz 1-ph", "50 Hz 3-ph", "60 Hz 1-ph", "60 Hz 3-ph", "DC"] },
    { k: "power_kw", label: "Power (kW)", type: "number" },
    { k: "ip_rating", label: "IP / Ex rating", ph: "IP56, Ex d IIB T4" },
  ]},
  { title: "Certification & stock", fields: [
    { k: "class_cert", label: "Class / test certificate", opts: CLASS, req: true },
    { k: "quantity", label: "Quantity in stock", type: "number" },
    { k: "lead_time", label: "Lead time", opts: ["Immediate", "24 hours", "2–3 days", "1 week", "2+ weeks"] },
    { k: "packing", label: "Packing", opts: ["", "Original maker crate", "Wooden box", "Carton", "Preserved / greased", "Pallet"] },
  ]},
];

export const YARD_SPEC: SpecGroup[] = [
  { title: "Dock capacity", fields: [
    { k: "dock_type", label: "Dock type", req: true, opts: ["Graving dock", "Floating dock", "Slipway / shiplift", "Afloat repair only", "Workshop only"] },
    { k: "max_loa_m", label: "Max LOA (m)", type: "number" },
    { k: "max_beam_m", label: "Clear breadth (m)", type: "number" },
    { k: "max_draft_m", label: "Draft over blocks (m)", type: "number" },
    { k: "max_dwt", label: "Max DWT / lifting (t)", type: "number" },
    { k: "crane_swl_t", label: "Largest crane SWL (t)", type: "number" },
  ]},
  { title: "Capabilities", fields: [
    { k: "steel_t_day", label: "Steel renewal (t/day)", type: "number" },
    { k: "services", label: "Services", ph: "Blasting, painting, pipe, ME overhaul, BWTS retrofit, riding squad" },
    { k: "accreditation", label: "Class / ISO approvals", ph: "DNV-approved welding, ISO 9001…", req: true },
    { k: "coverage_ports", label: "Ports / anchorages covered", ph: "Mumbai, Kandla OPL, Fujairah" },
  ]},
];

export const TECH_SPEC: SpecGroup[] = [
  { title: "Product details", fields: [
    { k: "product_type", label: "Type", req: true, opts: ["PPE", "LSA", "FFA", "Navigation / electronics", "Chemicals / lubes", "Provisions & stores", "Tools", "Software / service", "Other"] },
    { k: "model", label: "Model / size", ph: "e.g. EN ISO 20345 S3, size 42" },
    { k: "standard", label: "Approval / standard", ph: "SOLAS, MED wheelmark, USCG, EN…", req: true },
    { k: "expiry", label: "Expiry / service due", type: "date" },
    { k: "quantity", label: "Quantity in stock", type: "number" },
  ]},
];

export const SHIP_SPEC: SpecGroup[] = [
  { title: "Identity & class", fields: [
    { k: "ex_names", label: "Ex-names" }, { k: "port_registry", label: "Port of registry" },
    { k: "class_notation", label: "Class notation", ph: "+100A1 Bulk Carrier, ESP, CSR, UMS" },
    { k: "ihm", label: "IHM (Hong Kong / EU SRR)", opts: ["", "Valid", "In preparation", "None"] },
    { k: "cap_rating", label: "CAP rating", opts: ["", "CAP 1", "CAP 2", "CAP 3", "None"] },
  ]},
  { title: "Dimensions & tonnage", fields: [
    { k: "lbp_m", label: "LBP (m)", type: "number" }, { k: "depth_m", label: "Depth moulded (m)", type: "number" },
    { k: "draft_m", label: "Summer draft (m)", type: "number", req: true }, { k: "nt", label: "NT", type: "number" },
    { k: "ldt", label: "Lightweight LDT (t)", type: "number", req: true }, { k: "tpc", label: "TPC (t/cm)", type: "number" },
    { k: "air_draft_m", label: "Keel-to-mast / air draft (m)", type: "number" },
    { k: "canal", label: "Canal fitted", ph: "Suez / Panama / none" },
  ]},
  { title: "Surveys (buyers check first)", fields: [
    { k: "last_ss", label: "Last special survey", type: "date", req: true }, { k: "next_ss", label: "Next special survey due", type: "date", req: true },
    { k: "last_dd", label: "Last drydock", type: "date", req: true }, { k: "next_dd", label: "Next drydock due", type: "date", req: true },
    { k: "coc", label: "Conditions of class", opts: ["None", "Minor (disclosed)", "Outstanding (listed in description)"], req: true },
  ]},
  { title: "Machinery", fields: [
    { k: "me_mcr", label: "Main engine MCR (kW @ rpm)", ph: "8,400 kW @ 127 rpm" },
    { k: "nox_tier", label: "NOx tier", opts: ["", "Tier I", "Tier II", "Tier III"] },
    { k: "aux_engines", label: "Generators", ph: "3 x Yanmar 6EY18AL 600 kW 440V/60Hz" },
    { k: "boiler", label: "Aux boiler", ph: "Bar / kg/h" },
    { k: "propeller", label: "Propeller / thrusters", ph: "FPP, bow thruster 800 kW" },
  ]},
  { title: "Speed, consumption & bunkers", fields: [
    { k: "speed_laden", label: "Laden speed / cons.", ph: "12.5 kn on 24 t VLSFO", req: true },
    { k: "speed_ballast", label: "Ballast speed / cons.", ph: "13 kn on 22 t VLSFO" },
    { k: "port_cons", label: "Port idle / working cons.", ph: "2.5 / 4 t MGO" },
    { k: "bunker_cap", label: "Bunker capacity (m³)", ph: "VLSFO 1,800 / MGO 200" },
  ]},
  { title: "Cargo particulars", fields: [
    { k: "holds", label: "Holds / hatches or tanks", ph: "5/5 or 12 + 2 slops" },
    { k: "grain_bale", label: "Grain / bale or 98% cap.", ph: "72,000 / 69,500 m³" },
    { k: "hatch_type", label: "Hatch covers / coating", ph: "MacGregor folding / epoxy" },
    { k: "pumps", label: "Cargo pumps / reefer plugs", ph: "Framo 12 x 300 m³/h" },
    { k: "tank_top", label: "Tank-top strength / TEU", ph: "18 t/m² or 1,700 TEU" },
  ]},
];

export const SHIP_PHOTO_SLOTS: PhotoSlot[] = [
  { k: "profile", label: "Exterior profile", req: true }, { k: "bow", label: "Bow / forecastle" }, { k: "stern", label: "Stern / aft mooring" },
  { k: "bridge", label: "Navigation bridge", req: true }, { k: "ecdis", label: "ECDIS / radar / GMDSS" },
  { k: "er_top", label: "Engine room top", req: true }, { k: "er_bottom", label: "Engine room bottom" }, { k: "ecr", label: "Engine control room" },
  { k: "gens", label: "Generators" }, { k: "purifiers", label: "Purifiers / pumps" },
  { k: "holds", label: "Holds / tanks", req: true }, { k: "deck", label: "Main deck / hatch covers", req: true },
  { k: "gear", label: "Cranes / manifold" }, { k: "steering", label: "Steering gear" },
  { k: "accommodation", label: "Accommodation" }, { k: "galley", label: "Galley" },
  { k: "lsa", label: "Lifeboats / LSA" }, { k: "extra", label: "Other" },
];

export const SPARE_PHOTO_SLOTS: PhotoSlot[] = [
  { k: "nameplate", label: "Maker nameplate / stamping", req: true },
  { k: "surface", label: "Working surfaces / seats", req: true },
  { k: "scale", label: "With measuring scale" },
  { k: "overall", label: "Overall view" },
  { k: "packing", label: "Packing / crate" },
  { k: "cert", label: "Certificate photo" },
];
export const YARD_PHOTO_SLOTS: PhotoSlot[] = [
  { k: "dock", label: "Dock / berth", req: true }, { k: "workshop", label: "Workshop", req: true },
  { k: "cranes", label: "Cranes" }, { k: "project", label: "Recent project" }, { k: "aerial", label: "Aerial / site" }, { k: "cert", label: "Approval certificate" },
];
export const TECH_PHOTO_SLOTS: PhotoSlot[] = [
  { k: "product", label: "Product", req: true }, { k: "label", label: "Approval label / marking", req: true },
  { k: "pack", label: "Packing" }, { k: "cert", label: "Certificate" },
];

export const MAX_DOCS = 3;
export const MAX_DOC_BYTES = 10 * 1024 * 1024;

export function specFor(category: "spares" | "yards" | "tech") {
  if (category === "yards") return { groups: YARD_SPEC, slots: YARD_PHOTO_SLOTS };
  if (category === "tech") return { groups: TECH_SPEC, slots: TECH_PHOTO_SLOTS };
  return { groups: SPARE_SPEC, slots: SPARE_PHOTO_SLOTS };
}

/** Returns labels of missing required fields / photos. */
export function missingRequired(groups: SpecGroup[], spec: Record<string, string>, slots: PhotoSlot[], photos: Record<string, unknown>): string[] {
  const out: string[] = [];
  for (const g of groups) for (const f of g.fields) if (f.req && !String(spec[f.k] ?? "").trim()) out.push(f.label);
  for (const s of slots) if (s.req && !photos[s.k]) out.push(`Photo: ${s.label}`);
  return out;
}

/** Listing fee in credits for a category, from wallet pricing. */
export function listingCost(kind: "ship" | "spares" | "yards" | "tech", w: { ship: number; spare: number; service: number }) {
  return kind === "ship" ? w.ship : kind === "yards" ? w.service : w.spare;
}

export const CREDIT_USES = [
  { label: "List a vessel for sale (full S&P dossier, 18 photos, GA / survey PDFs)", key: "ship" as const },
  { label: "List a spare part / equipment (engineering specs, 6 photos, certificate)", key: "spare" as const },
  { label: "List a shipyard / workshop service (dock data, 6 photos)", key: "service" as const },
];
