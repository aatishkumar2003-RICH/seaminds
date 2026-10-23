// Expands agency rank shorthand (MSTR, CO, 2O, J.OFF…) into full maritime rank titles.
const RANK_CODES: Record<string, string> = {
  MSTR: "Master", MASTER: "Master", CAPT: "Master", CPT: "Master", MST: "Master",
  CO: "Chief Officer", CHOFF: "Chief Officer", CHIEFOFFICER: "Chief Officer",
  "2O": "2nd Officer", "2NDO": "2nd Officer", "2OFF": "2nd Officer", SO: "2nd Officer",
  "3O": "3rd Officer", "3RDO": "3rd Officer", "3OFF": "3rd Officer", TO: "3rd Officer",
  JOFF: "Junior Officer", JO: "Junior Officer", "4O": "4th Officer",
  DCDT: "Deck Cadet", DC: "Deck Cadet", DECKCADET: "Deck Cadet",
  CE: "Chief Engineer", CHENG: "Chief Engineer", CENG: "Chief Engineer",
  "2E": "2nd Engineer", "2ENG": "2nd Engineer", "1AE": "2nd Engineer",
  "3E": "3rd Engineer", "3ENG": "3rd Engineer",
  "4E": "4th Engineer", "4ENG": "4th Engineer",
  JE: "Junior Engineer", JENG: "Junior Engineer",
  ECDT: "Engine Cadet", EC: "Engine Cadet",
  ETO: "Electro-Technical Officer", EO: "Electrical Officer", ELO: "Electrical Officer",
  BSN: "Bosun", BOSUN: "Bosun", AB: "Able Seaman", OS: "Ordinary Seaman",
  OLR: "Oiler", OILER: "Oiler", WPR: "Wiper", FTR: "Fitter", MM: "Motorman",
  CK: "Cook", CCK: "Chief Cook", MSM: "Messman", PMN: "Pumpman",
};

export function expandRank(raw?: string | null): string {
  const v = (raw || "").trim();
  if (!v) return "";
  const key = v.toUpperCase().replace(/[\s./\\_-]/g, "");
  return RANK_CODES[key] || v;
}
