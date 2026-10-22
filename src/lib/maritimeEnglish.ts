// Maritime English Lab: original SeaMinds scenarios + deterministic scoring (no AI cost).
export type Domain = "Bridge & VHF" | "Engine Room" | "Safety & Emergency" | "PSC & Vetting" | "Deck & Ratings";
export interface Scenario {
  id: string;
  domain: Domain;
  title: string;
  task: "Read back" | "Respond" | "Report" | "Explain";
  incoming: string; // what the radio / officer says
  instruction: string;
  model: string; // a good example answer
  facts: string[][]; // each group: any synonym counts
  markers?: string[]; // SMCP markers expected
}

export const SCENARIOS: Scenario[] = [
  { id: "vhf-tss", domain: "Bridge & VHF", title: "VTS traffic report", task: "Read back",
    incoming: "Ocean Star, this is Singapore VTS. Instruction: proceed to anchorage A2. Keep clear of the eastbound lane. Over.",
    instruction: "Read back the VTS instruction using closed-loop communication.",
    model: "Singapore VTS, this is Ocean Star. Read back: proceed to anchorage A2, keep clear of the eastbound lane. Over.",
    facts: [["ocean star"], ["anchorage"], ["a2", "a 2", "alpha two"], ["eastbound"], ["keep clear", "clear"]], markers: ["read back", "over"] },
  { id: "vhf-crossing", domain: "Bridge & VHF", title: "Crossing situation", task: "Respond",
    incoming: "Vessel on my port bow, course 090, this is MV Delta. Advice: I intend to alter course to starboard. Over.",
    instruction: "Acknowledge and state your intention to keep course and speed.",
    model: "MV Delta, this is Ocean Star. Received your advice. I will keep my course and speed. Over.",
    facts: [["delta"], ["received", "understood"], ["course"], ["speed"]], markers: ["over"] },
  { id: "vhf-pilot", domain: "Bridge & VHF", title: "Pilot boarding", task: "Read back",
    incoming: "Ocean Star, pilot station. Pilot boards at 1430 hours, starboard side, ladder one metre above water. Over.",
    instruction: "Read back the pilot boarding arrangements.",
    model: "Pilot station, Ocean Star. Read back: pilot boards at 1430 hours, starboard side, ladder one metre above water. Over.",
    facts: [["1430", "14 30", "fourteen thirty", "one four three zero"], ["starboard"], ["ladder"], ["one metre", "1 metre", "one meter", "1 meter"]], markers: ["read back", "over"] },
  { id: "eng-handover", domain: "Engine Room", title: "Watch handover", task: "Report",
    incoming: "Second Engineer: I am taking over the watch. What is the status of the engine room?",
    instruction: "Report: main engine running normal, number 2 generator on load, bilge sounded at 20 centimetres.",
    model: "Main engine is running normal. Number two generator is on load. Bilge sounded at twenty centimetres. No alarms.",
    facts: [["main engine"], ["generator"], ["two", "2", "number 2"], ["bilge"], ["20", "twenty"]] },
  { id: "eng-alarm", domain: "Engine Room", title: "High temperature alarm", task: "Report",
    incoming: "Bridge to engine control room: we have a jacket cooling water high temperature alarm. Report.",
    instruction: "Report that you are reducing load and checking the cooling water pump.",
    model: "Bridge, engine control room. Information: jacket cooling water temperature high. We are reducing load and checking the cooling water pump. Will report back.",
    facts: [["jacket", "cooling water"], ["temperature"], ["reduc", "slow"], ["pump"]], markers: ["information"] },
  { id: "eng-bunker", domain: "Engine Room", title: "Bunkering confirmation", task: "Read back",
    incoming: "Barge to ship: start pumping at 150 cubic metres per hour. Confirm.",
    instruction: "Confirm the pumping rate by reading it back.",
    model: "Read back: start pumping at one hundred fifty cubic metres per hour. Confirmed.",
    facts: [["150", "one hundred fifty", "one five zero"], ["cubic"], ["hour"], ["start"]], markers: ["read back"] },
  { id: "safe-fire", domain: "Safety & Emergency", title: "Engine room fire", task: "Report",
    incoming: "Fire alarm activated. Master: report location and situation.",
    instruction: "Report a fire in the engine room near the purifier, crew mustering, fire team ready.",
    model: "Master, warning: fire in engine room near the purifier. Crew are mustering. Fire team is ready.",
    facts: [["fire"], ["engine room"], ["purifier"], ["muster"], ["fire team", "team"]], markers: ["warning"] },
  { id: "safe-mob", domain: "Safety & Emergency", title: "Man overboard", task: "Report",
    incoming: "Bridge, this is deck. What happened?",
    instruction: "Report man overboard on port side, lifebuoy thrown.",
    model: "Bridge, this is deck. Man overboard, port side. Lifebuoy thrown. Over.",
    facts: [["man overboard", "person overboard"], ["port"], ["lifebuoy", "life buoy", "lifering"]] },
  { id: "safe-mayday", domain: "Safety & Emergency", title: "Mayday relay", task: "Read back",
    incoming: "Mayday. Fishing vessel Sea Hope, position 05 degrees north, 106 degrees east. Taking water. Four persons on board.",
    instruction: "Read back the distress details.",
    model: "Sea Hope, Ocean Star. Read back: position 05 degrees north, 106 degrees east, taking water, four persons on board. Received Mayday.",
    facts: [["sea hope"], ["05", "five", "zero five"], ["106", "one zero six", "one hundred six"], ["water"], ["four", "4"]], markers: ["read back"] },
  { id: "psc-ows", domain: "PSC & Vetting", title: "Oily water separator", task: "Explain",
    incoming: "PSC Inspector: how do you test the 15 ppm alarm on the oily water separator?",
    instruction: "Explain that you test it before operation and record it in the Oil Record Book.",
    model: "We test the 15 ppm alarm before every operation and record the test in the Oil Record Book.",
    facts: [["15", "fifteen"], ["ppm"], ["test"], ["oil record book", "record book", "record"]] },
  { id: "psc-enclosed", domain: "PSC & Vetting", title: "Enclosed space entry", task: "Explain",
    incoming: "Vetting Inspector: what do you do before entering an enclosed space?",
    instruction: "Mention permit, ventilation, gas test and standby person.",
    model: "Before entry we issue a permit, ventilate the space, test the atmosphere for oxygen and gas, and keep a standby person at the entrance.",
    facts: [["permit"], ["ventilat"], ["test", "oxygen", "gas"], ["standby", "attendant"]] },
  { id: "psc-drill", domain: "PSC & Vetting", title: "Your drill role", task: "Explain",
    incoming: "PSC Inspector: what is your duty in an abandon ship drill?",
    instruction: "Explain your muster station and your duty clearly.",
    model: "My muster station is at lifeboat number one. My duty is to prepare the lifeboat and check all crew are wearing lifejackets.",
    facts: [["muster"], ["lifeboat", "life raft", "liferaft"], ["duty", "responsib"], ["lifejacket", "life jacket"]] },
  { id: "rat-helm", domain: "Deck & Ratings", title: "Helm order", task: "Read back",
    incoming: "Officer of the watch: Starboard ten. Steer course one two five.",
    instruction: "Repeat the helm order exactly, then report when steady.",
    model: "Starboard ten. Steer course one two five. Steady on one two five.",
    facts: [["starboard"], ["ten", "10"], ["one two five", "125"], ["steady", "course"]] },
  { id: "rat-lookout", domain: "Deck & Ratings", title: "Lookout report", task: "Report",
    incoming: "Bridge to lookout: report anything you see.",
    instruction: "Report a small fishing boat, two points on the port bow, about two miles.",
    model: "Bridge, lookout. Small fishing boat, two points on the port bow, distance about two miles.",
    facts: [["fishing"], ["two points", "2 points"], ["port bow", "port"], ["two miles", "2 miles"]] },
  { id: "rat-mooring", domain: "Deck & Ratings", title: "Mooring station", task: "Report",
    incoming: "Bridge to forward station: report status of lines.",
    instruction: "Report: two head lines and one spring line fast, tug made fast.",
    model: "Bridge, forward station. Two head lines and one spring line are fast. Tug is made fast.",
    facts: [["head line", "headline"], ["two", "2"], ["spring"], ["tug"], ["fast"]] },
  { id: "rat-gangway", domain: "Deck & Ratings", title: "Gangway watch visitor", task: "Respond",
    incoming: "Visitor at gangway: Hello, I am the surveyor. Can I come on board?",
    instruction: "Ask for ID, log the visitor and say you will call the duty officer.",
    model: "Good morning. Please show me your ID card. I will log your name and call the duty officer.",
    facts: [["id", "identification", "identity"], ["log", "record", "sign"], ["duty officer", "officer"]] },
  { id: "eng-sounding", domain: "Engine Room", title: "Tank sounding report", task: "Report",
    incoming: "Chief Engineer: what are the morning soundings?",
    instruction: "Report: fuel oil tank 3 port at 42 cubic metres, sludge tank 60 percent.",
    model: "Good morning Chief. Fuel oil tank number three port is forty two cubic metres. Sludge tank is sixty percent.",
    facts: [["fuel oil", "fuel"], ["three", "3"], ["42", "forty two"], ["sludge"], ["60", "sixty"]] },
  { id: "vhf-anchor", domain: "Bridge & VHF", title: "Anchoring report", task: "Report",
    incoming: "Port control: Ocean Star, report when anchored. Over.",
    instruction: "Report anchored at anchorage B, 5 shackles in water.",
    model: "Port control, Ocean Star. Information: we are anchored in anchorage B, five shackles in the water. Over.",
    facts: [["anchor"], ["b", "bravo"], ["five", "5"], ["shackle"]], markers: ["information", "over"] },
];

// Alternative versions so each attempt can show a different pattern (no memorising one answer).
type Variant = Pick<Scenario, "incoming" | "instruction" | "model" | "facts">;
const VARIANTS: Record<string, Variant[]> = {
  "vhf-tss": [{ incoming: "Nordic Star, this is Port Klang VTS. Instruction: proceed to anchorage B4. Keep clear of the westbound lane. Over.",
    instruction: "Read back the VTS instruction using closed-loop communication.",
    model: "Port Klang VTS, this is Nordic Star. Read back: proceed to anchorage B4, keep clear of the westbound lane. Over.",
    facts: [["nordic star"], ["anchorage"], ["b4", "b 4", "bravo four"], ["westbound"], ["keep clear", "clear"]] }],
  "vhf-pilot": [{ incoming: "Ocean Star, pilot station. Pilot boards at 0915 hours, port side, ladder two metres above water. Over.",
    instruction: "Read back the pilot boarding arrangements.",
    model: "Pilot station, Ocean Star. Read back: pilot boards at 0915 hours, port side, ladder two metres above water. Over.",
    facts: [["0915", "09 15", "zero nine one five", "nine fifteen"], ["port"], ["ladder"], ["two metre", "2 metre", "two meter", "2 meter"]] }],
  "eng-bunker": [{ incoming: "Barge to ship: reduce pumping to 80 cubic metres per hour for topping off. Confirm.",
    instruction: "Confirm the new pumping rate by reading it back.",
    model: "Read back: reduce pumping to eighty cubic metres per hour for topping off. Confirmed.",
    facts: [["80", "eighty", "eight zero"], ["cubic"], ["hour"], ["reduc"]] }],
  "safe-mob": [{ incoming: "Bridge, this is aft station. What happened?",
    instruction: "Report man overboard on starboard side, lifebuoy with light thrown.",
    model: "Bridge, aft station. Man overboard, starboard side. Lifebuoy with light thrown. Over.",
    facts: [["man overboard", "person overboard"], ["starboard"], ["lifebuoy", "life buoy", "lifering"], ["light"]] }],
  "rat-helm": [{ incoming: "Officer of the watch: Hard a port. Steer course zero four five.",
    instruction: "Repeat the helm order exactly, then report when steady.",
    model: "Hard a port. Steer course zero four five. Steady on zero four five.",
    facts: [["hard a port", "hard port"], ["zero four five", "045", "45"], ["steady", "course"]] }],
  "eng-handover": [{ incoming: "Third Engineer: I am taking over. Any problems?",
    instruction: "Report: number 1 purifier stopped for cleaning, boiler pressure 7 bar, no alarms.",
    model: "Number one purifier is stopped for cleaning. Boiler pressure is seven bar. No alarms.",
    facts: [["purifier"], ["one", "1"], ["boiler"], ["seven", "7"], ["no alarm"]] }],
};
export function pickVariant(sc: Scenario, rnd = Math.random): Scenario {
  const opts = [sc, ...(VARIANTS[sc.id] ?? []).map((v) => ({ ...sc, ...v }))];
  return opts[Math.floor(rnd() * opts.length) % opts.length];
}

// Department from profile rank so the most useful scenarios appear first.
export type Dept = "deck" | "engine" | "rating" | "all";
export function deptOf(rank?: string | null): Dept {
  const r = (rank || "").toLowerCase();
  if (!r) return "all";
  if (/engineer|eto|electric|fitter|oiler|wiper|motorman|engine/.test(r)) return /oiler|wiper|fitter|motorman/.test(r) ? "rating" : "engine";
  if (/bosun|ab |ab$|able|ordinary|os\b|seaman|cook|mess|steward|pumpman/.test(r)) return "rating";
  if (/master|captain|officer|mate|cadet/.test(r)) return "deck";
  return "all";
}
const DEPT_DOMAINS: Record<Dept, Domain[]> = {
  deck: ["Bridge & VHF", "Safety & Emergency", "PSC & Vetting"],
  engine: ["Engine Room", "Safety & Emergency", "PSC & Vetting"],
  rating: ["Deck & Ratings", "Safety & Emergency", "Engine Room"],
  all: [],
};
export function rankOrdered(dept: Dept, list = SCENARIOS): Scenario[] {
  const pri = DEPT_DOMAINS[dept];
  if (!pri.length) return list;
  return [...list].sort((a, b) => (pri.indexOf(a.domain) + 1 || 99) - (pri.indexOf(b.domain) + 1 || 99));
}
/** Smart next pick: weakest or never-tried scenario in the crew member's department. */
export function nextRecommended(dept: Dept, best: Record<string, number>): Scenario {
  const pool = rankOrdered(dept).slice(0, dept === "all" ? SCENARIOS.length : 12);
  return [...pool].sort((a, b) => (best[a.id] ?? -1) - (best[b.id] ?? -1))[0];
}

export interface ScoreResult { total: number; meaning: number; protocol: number; fluency: number; missed: string[]; tips: string[] }

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

// Scores safe meaning (60%), protocol/SMCP (25%), fluency (15%). Accent and minor grammar are not penalised.
export function scoreAnswer(sc: Scenario, answer: string): ScoreResult {
  const a = norm(answer);
  const words = a ? a.split(" ").length : 0;
  const hit = sc.facts.map((g) => g.some((k) => a.includes(norm(k))));
  const meaning = sc.facts.length ? hit.filter(Boolean).length / sc.facts.length : 1;
  const missed = sc.facts.filter((_, i) => !hit[i]).map((g) => g[0]);
  const markers = sc.markers ?? [];
  const mHit = markers.filter((m) => a.includes(m)).length;
  const protocol = markers.length ? mHit / markers.length : words >= 5 ? 1 : 0.5;
  const modelWords = norm(sc.model).split(" ").length;
  const fluency = words === 0 ? 0 : Math.min(1, words / Math.max(6, modelWords * 0.6));
  const total = Math.round((meaning * 60 + protocol * 25 + fluency * 15));
  const tips: string[] = [];
  if (missed.length) tips.push(`Include: ${missed.join(", ")}`);
  markers.filter((m) => !a.includes(m)).forEach((m) => tips.push(`Use the SMCP word “${m.toUpperCase()}”`));
  if (fluency < 0.7) tips.push("Speak a full sentence — short answers can be misunderstood on the radio.");
  return { total, meaning: Math.round(meaning * 100), protocol: Math.round(protocol * 100), fluency: Math.round(fluency * 100), missed, tips };
}

export const level = (avg: number) => avg >= 85 ? "Ready for sea" : avg >= 70 ? "Confident" : avg >= 50 ? "Developing" : "Starter";

// Local progress (per device). Daily challenge = deterministic scenario of the day.
export interface Progress { best: Record<string, number>; history: { d: string; s: number }[]; daily: Record<string, number>; streak: number; lastDaily?: string }
const KEY = "seaminds_english_progress_v1";
export const today = () => new Date().toISOString().slice(0, 10);
export const dailyScenario = (d = today(), dept: Dept = "all") => { const pool = dept === "all" ? SCENARIOS : SCENARIOS.filter((x) => DEPT_DOMAINS[dept].includes(x.domain)); return pool[[...d].reduce((n, c) => n + c.charCodeAt(0), 0) % pool.length]; };
export const _legacyDaily = (d = today()) => SCENARIOS[[...d].reduce((n, c) => n + c.charCodeAt(0), 0) % SCENARIOS.length];
export function loadProgress(): Progress {
  try { return { best: {}, history: [], daily: {}, streak: 0, ...JSON.parse(localStorage.getItem(KEY) || "{}") }; } catch { return { best: {}, history: [], daily: {}, streak: 0 }; }
}
export function recordAttempt(p: Progress, id: string, score: number, isDaily: boolean): Progress {
  const d = today();
  const next: Progress = { ...p, best: { ...p.best, [id]: Math.max(p.best[id] ?? 0, score) }, history: [...p.history, { d, s: score }].slice(-200), daily: { ...p.daily } };
  if (isDaily && next.daily[d] === undefined) {
    next.daily[d] = score;
    const y = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    next.streak = p.lastDaily === y ? p.streak + 1 : p.lastDaily === d ? p.streak : 1;
    next.lastDaily = d;
  }
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* ignore */ }
  return next;
}

// Vietnamese explanations (understand in Tiếng Việt, answer in English).
export const VI_HINTS: Record<string, string> = {
  "vhf-tss": "VTS yêu cầu tàu đến khu neo A2 và tránh xa luồng hướng đông. Hãy đọc lại (read back) đúng chỉ thị, kết thúc bằng \"Over\".",
  "vhf-crossing": "Tình huống cắt hướng. Trả lời tàu kia: bạn sẽ làm gì (đổi hướng sang phải / giảm tốc), dùng câu ngắn theo SMCP.",
  "vhf-pilot": "Hoa tiêu sắp lên tàu. Đọc lại vị trí, thời gian, mạn đặt thang hoa tiêu và độ cao thang.",
  "eng-handover": "Bàn giao ca máy. Báo cáo tình trạng máy chính, máy phát, bơm, báo động và việc còn tồn.",
  "eng-alarm": "Báo động nhiệt độ cao. Báo cáo cho buồng lái: thiết bị nào, giá trị bao nhiêu, bạn đang xử lý thế nào.",
  "eng-bunker": "Xác nhận nhận nhiên liệu. Đọc lại loại dầu, số lượng, két nhận và lưu lượng bơm.",
  "safe-fire": "Cháy buồng máy. Báo cáo ngay: vị trí đám cháy, người bị thương, hành động đã thực hiện.",
  "safe-mob": "Người rơi xuống biển. Hô báo: mạn nào, ném phao, giữ người trong tầm nhìn, báo buồng lái.",
  "safe-mayday": "Chuyển tiếp tín hiệu cấp cứu (Mayday Relay). Đọc lại tên tàu gặp nạn, vị trí, tình trạng và số người.",
  "psc-ows": "Thanh tra PSC hỏi về thiết bị phân ly dầu nước (OWS). Giải thích cách vận hành, giới hạn 15 ppm và sổ nhật ký dầu.",
  "psc-enclosed": "Giải thích quy trình vào không gian kín: giấy phép, thông gió, đo khí, người canh, thiết bị cứu hộ.",
  "psc-drill": "Giải thích nhiệm vụ của bạn trong diễn tập (cháy / bỏ tàu): vị trí tập trung và công việc cụ thể.",
};
