// Maritime English Lab: original SeaMinds scenarios + deterministic scoring (no AI cost).
export type Domain = "Bridge & VHF" | "Engine Room" | "Safety & Emergency" | "PSC & Vetting";
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
];

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
export const dailyScenario = (d = today()) => SCENARIOS[[...d].reduce((n, c) => n + c.charCodeAt(0), 0) % SCENARIOS.length];
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
