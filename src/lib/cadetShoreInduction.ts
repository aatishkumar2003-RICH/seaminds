/** Part 1 — Pre-joining shore induction (modules 1–4): full study manual per track. Practice drills only; the official module check stays server-graded (cadet_submit_week). */
import type { CadetTrack } from "./cadetCurriculum";

export const SHORE_WEEKS = 4;
export const isShoreWeek = (w: number) => w >= 1 && w <= SHORE_WEEKS;

export type Drill = { q: string; o: string[]; a: number; why: string };
export type ShoreModule = {
  competence: string; minutes: number; objectives: string[];
  sections: { h: string; p?: string; li?: string[] }[];
  params?: [string, string][];
  failures: { what: string; action: string }[];
  scenario: { situation: string; choices: { c: string; ok: boolean; fb: string }[] };
  english: [string, string][];
  oral: { q: string; a: string }[];
  drills: Drill[];
};

const ENGLISH: ShoreModule = {
  competence: "STCW A-II/1 & A-III/1 — Use of English, written and spoken; IMO SMCP (Res. A.918(22))", minutes: 45,
  objectives: ["Use closed-loop communication for every order", "Use the 8 SMCP message markers correctly", "Spell names and numbers with the phonetic alphabet", "Report on board, an alarm and a completed job in standard phrases"],
  sections: [
    { h: "Why English decides safety", p: "Investigations (MAIB, NTSB, AMSA) repeatedly list miscommunication among the causes of collisions, groundings and engine-room injuries. A multinational crew shares only one working language. SMCP removes ambiguity by giving one fixed phrase for each situation." },
    { h: "Closed-loop communication — 4 steps", li: ["SENDER gives the order clearly, using the receiver's rank or name", "RECEIVER reads back the order word for word", "SENDER confirms: 'Correct' — or corrects it", "RECEIVER reports when done: 'Valve open, Second'"] },
    { h: "The 8 SMCP message markers", p: "Say the marker first so the listener knows what kind of message follows.", li: ["INSTRUCTION — 'Instruction: keep clear of the fairway'", "ADVICE — 'Advice: stand by on channel 16'", "WARNING — 'Warning: dangerous wreck in position…'", "INFORMATION — 'Information: my speed is 12 knots'", "QUESTION — 'Question: what is your ETA?'", "ANSWER — 'Answer: my ETA is 0800 UTC'", "REQUEST — 'Request: I require a pilot'", "INTENTION — 'Intention: I will alter course to starboard'"] },
    { h: "Phonetic alphabet & numbers", p: "Letters: Alfa, Bravo, Charlie, Delta, Echo, Foxtrot, Golf, Hotel, India, Juliett, Kilo, Lima, Mike, November, Oscar, Papa, Quebec, Romeo, Sierra, Tango, Uniform, Victor, Whiskey, X-ray, Yankee, Zulu. Say numbers digit by digit: 'one-five-zero' not 'one hundred fifty'. Say 'decimal' for the point. Times are 4-digit 24-hour UTC/LT: 'zero-eight-three-zero'." },
    { h: "Correcting yourself and asking", li: ["Made a mistake? Say 'Mistake… correction: …' — never 'sorry'", "Did not hear? Say 'Say again' — never guess", "Need time? 'Stand by'", "Do not understand a word? 'Please explain the word …'"] },
    { h: "First day on board — reporting", p: "Report to the officer on duty at the gangway: 'Good morning, sir. I am Deck/Engine Cadet [name], from [country], joining today.' Hand over passport, CDC, certificates and medical. Listen to your familiarisation; write names of Master, Chief Officer, Chief Engineer, Second Engineer and Safety Officer in your notebook." },
  ],
  failures: [
    { what: "You heard only half of an order in a noisy engine room / on deck in wind", action: "Move closer or use the phone/hand signal; say 'Say again'. Never act on a half order." },
    { what: "Two people give you different orders", action: "Stop, inform both politely: 'Sir, the Chief Officer asked me to … — which first?' The senior decides." },
    { what: "Radio message not acknowledged", action: "Repeat once with the station name; if still silent, report to your officer — do not assume it was received." },
  ],
  scenario: { situation: "Mooring stations. Wind is strong. On the radio the Chief Officer says something like '…slack…forward spring…'. You are not sure.", choices: [
    { c: "Slack the forward spring — it sounded right", ok: false, fb: "Wrong. Acting on a guess at mooring can part a line under tension — snap-back kills." },
    { c: "'Chief Officer, say again for forward station, over.'", ok: true, fb: "Correct. Closed loop: ask, wait for the full order, read it back, then act." },
    { c: "Wait silently until he calls again", ok: false, fb: "Wrong. Silence leaves the bridge thinking you are acting. Always respond." },
  ] },
  english: [["Say again, please", "Asking for repetition"], ["Mistake… correction: …", "Correcting yourself"], ["Stand by", "Wait / need time"], ["I read back: …", "Confirming an order"], ["Job completed, sir", "Closing the loop"], ["Fire, fire, fire in …", "Raising a fire alarm by phone"]],
  oral: [
    { q: "What is closed-loop communication and why is it used?", a: "Order given, receiver reads it back, sender confirms 'correct', receiver reports completion. It catches misunderstanding before action — a main cause of accidents." },
    { q: "Spell your surname using the phonetic alphabet.", a: "Each letter in NATO phonetics, steadily, e.g. 'K-Kilo, U-Uniform, M-Mike…'." },
    { q: "How do you correct a wrong word on VHF?", a: "Say 'Mistake', then 'Correction:' followed by the right message." },
  ],
  drills: [
    { q: "Correct way to say the course 095°?", o: ["Ninety-five", "Zero-nine-five degrees", "Nine-five", "Ninety and five"], a: 1, why: "Courses are three digits, spoken digit by digit." },
    { q: "Which SMCP marker announces that you will alter course?", o: ["ADVICE", "INFORMATION", "INTENTION", "REQUEST"], a: 2, why: "INTENTION tells others about your own action." },
    { q: "The 2/E says 'Start No.2 FO transfer pump.' Your first reply?", o: ["'OK'", "'Start No.2 FO transfer pump, Second'", "Start it silently", "'Yes'"], a: 1, why: "Read back the full order before acting." },
    { q: "Phonetic word for the letter J?", o: ["Jack", "Juliett", "Julia", "Jungle"], a: 1, why: "J = Juliett." },
    { q: "You did not understand a technical word. You say:", o: ["Nod and continue", "'Please explain the word …'", "Ask the cook", "Search later"], a: 1, why: "Never guess; asking is professional." },
    { q: "Time 14:30 in SMCP:", o: ["Half past two", "One-four-three-zero", "Fourteen thirty pm", "Two thirty"], a: 1, why: "4-digit, 24-hour, digit by digit." },
  ],
};

const SAFETY: ShoreModule = {
  competence: "ISM Code §5–6 (Master's authority, resources & personnel); SOLAS Ch. IX; STCW A-VI/1 Personal Safety & Social Responsibility", minutes: 50,
  objectives: ["Explain the ISM Code and the company Safety Management System (SMS)", "Use stop-work authority respectfully", "Select and inspect PPE for each job", "Understand permit-to-work, risk assessment and lock-out/tag-out"],
  sections: [
    { h: "ISM Code in plain words", p: "SOLAS Chapter IX makes the ISM Code mandatory. Every company has an SMS: procedures, checklists, forms and a Designated Person Ashore (DPA) who links ship and top management. Every crew member can contact the DPA directly about safety or pollution." },
    { h: "Stop-work authority (SWA)", li: ["Anyone, including a cadet, may stop a job that is unsafe", "Use the respectful ladder: Ask → Refer to procedure → STOP → Report", "Phrase: 'Sir, for my understanding, is the permit for this job signed?'", "If life is in immediate danger say STOP clearly, then inform the OOW/Chief", "The company SMS protects you from blame for a stop made in good faith"] },
    { h: "PPE — minimum and job-specific", li: ["Always: safety helmet with chin strap, safety boots (toe cap), boiler suit, gloves", "Grinding/chipping: goggles or face shield, ear protection", "Engine room: ear defenders (noise > 85 dB(A)), heat gloves near exhausts", "Chemicals: chemical goggles, nitrile/PVC gloves, apron — read the SDS first", "Working aloft/overside (> 2 m): full-body harness + independent lifeline, lifejacket overside", "Inspect before use: cracks in helmet, worn harness webbing, torn gloves → replace"] },
    { h: "Permit-to-work (PTW) and risk assessment", p: "High-risk jobs need a signed permit: enclosed space entry, hot work, working aloft/overside, electrical work, cold work on pressurised systems. Before the job a risk assessment lists hazards, likelihood × severity, and controls. The toolbox meeting (TBM) explains it to everyone doing the job." },
    { h: "Lock-out / Tag-out (LOTO)", li: ["Stop the equipment and isolate the energy (electrical breaker, valve, air)", "Lock and tag with your name and date", "Release stored energy: pressure, spring, gravity, heat", "Test it is dead — try to start", "Only the person who locked removes the lock"] },
    { h: "Social responsibility & wellbeing", p: "Zero tolerance for harassment and bullying (ILO MLC 2006). Alcohol and drug policies are strict — breath tests can be random. Report concerns through the Master or DPA; MLC on-board complaint procedures protect you." },
  ],
  params: [["Noise requiring ear protection", "≥ 85 dB(A)"], ["Height requiring harness", "> 2 m above deck / overside"], ["Typical blood alcohol limit (company)", "0.04% BAC or zero"], ["Safe oxygen for entry", "20.9% (19.5–23.5% band)"]],
  failures: [
    { what: "Senior tells you to skip the permit 'to save time'", action: "Ask respectfully, refer to SMS. If he continues, do not take part and inform the OOW/Chief Officer/Chief Engineer." },
    { what: "Your PPE is damaged", action: "Do not start; ask the bosun/storekeeper for a replacement and report." },
    { what: "Someone removed a LOTO tag that was not theirs", action: "Stop the job, re-isolate, inform the officer in charge immediately — it is a near miss to report." },
  ],
  scenario: { situation: "The bosun goes aloft on the foremast without clipping his harness and asks you to pass tools up.", choices: [
    { c: "Pass the tools — he is experienced", ok: false, fb: "Wrong. Falls from height are a leading cause of death at sea. Silence makes you part of it." },
    { c: "'Bosun, for my understanding — should we clip on first? The permit says harness attached.'", ok: true, fb: "Correct. Respectful question, referring to the permit. If he refuses, stop passing tools and inform the Chief Officer." },
    { c: "Shout at him in front of the crew", ok: false, fb: "Wrong. Humiliation creates conflict and does not fix the hazard. Ask, refer, then escalate." },
  ] },
  english: [["For my understanding, sir…", "Questioning respectfully"], ["Is the permit signed?", "Checking PTW"], ["Stop the job — danger", "Using SWA"], ["Equipment is isolated and tagged", "Confirming LOTO"]],
  oral: [
    { q: "Who is the DPA and when would you contact him?", a: "Designated Person Ashore under ISM §4; direct link to top management for any safety or pollution concern not resolved on board." },
    { q: "Name four jobs that need a permit-to-work.", a: "Enclosed space entry, hot work, working aloft/overside, electrical isolation work (also cold work on pressurised lines)." },
    { q: "What is the hierarchy of controls?", a: "Elimination, substitution, engineering controls, administrative controls (procedures/permits), PPE last." },
  ],
  drills: [
    { q: "Which SOLAS chapter makes the ISM Code mandatory?", o: ["Ch. II-2", "Ch. V", "Ch. IX", "Ch. XI-2"], a: 2, why: "SOLAS Ch. IX — Management for the Safe Operation of Ships." },
    { q: "Ear protection is required from:", o: ["60 dB(A)", "70 dB(A)", "85 dB(A)", "120 dB(A)"], a: 2, why: "85 dB(A) is the common action level in the IMO Noise Code." },
    { q: "Who removes a LOTO padlock?", o: ["Anyone in charge", "The person who fitted it", "The cadet", "The electrician only"], a: 1, why: "Only the person who locked it, or a formal procedure with the Chief." },
    { q: "PPE in the hierarchy of controls is:", o: ["First", "Second", "Last line of defence", "Not part of it"], a: 2, why: "PPE protects only when other controls fail." },
    { q: "A harness is required when working:", o: ["Above 0.5 m", "Above 2 m / overside", "Only on masts", "Never in port"], a: 1, why: "Industry standard (COSWP) — more than 2 m or overside." },
    { q: "You stop a job in good faith. The SMS:", o: ["Allows the company to fine you", "Protects you from blame", "Requires Master's prior approval", "Says cadets cannot stop jobs"], a: 1, why: "Stop-work authority is protected under the SMS." },
  ],
};

const READY = (t: CadetTrack): ShoreModule => ({
  competence: "STCW Reg. I/2, I/9, VI/1; MLC 2006 Reg. 1.2 (medical), 2.1 (SEA); company joining procedure", minutes: 40,
  objectives: ["Verify every document before travel", "Pack correct PPE and tools for your department", "Understand your Seafarer Employment Agreement (SEA)", "Revise the core knowledge your officers will test on day one"],
  sections: [
    { h: "Document wallet — originals + 2 copies", li: ["Passport (valid ≥ 6 months beyond contract end)", "CDC / Seaman's book", "STCW basic training: PST, FPFF, EFA, PSSR (Reg. VI/1) + Security Awareness (VI/6)", "Medical fitness certificate (ENG1 / DG-approved; max 2 years, check the expiry date)", "Yellow fever / COVID or other vaccinations as the trading area requires", "Visa (e.g. C1/D for USA, Schengen) and Letter of Guarantee from the agent", "Cadet training agreement / college letter, TRB book if your college issues one"] },
    { h: "Your Seafarer Employment Agreement (MLC 2.1)", p: "Read before signing: wage and allowances, contract period, leave, repatriation at the company's cost, medical care. You keep a signed copy. Never sign a blank or different-language contract you do not understand." },
    { h: t === "deck" ? "Deck kit list" : "Engine kit list", li: t === "deck"
      ? ["2–3 boiler suits, safety boots, helmet, gloves (rigger + cotton)", "Notebook, pencil, ruler, divider, parallel ruler or Portland plotter", "Basic calculator (scientific), torch, watch", "Rules of the Road (COLREG) pocket book", "Warm clothes for cold trading; sunscreen for tropics"]
      : ["2–3 boiler suits (cotton, flame-retardant if possible), safety boots, helmet", "Leather + heat-resistant gloves, ear defenders, goggles", "Notebook, pencil, small torch, pocket multimeter (optional)", "Engine notes: 2-stroke/4-stroke cycle, pumps, purifiers", "Personal medicines with prescription"] },
    { h: "Day-one knowledge your officers check", li: t === "deck"
      ? ["COLREG Rules 5 (lookout), 7 (risk of collision), 13–17 (overtaking, head-on, crossing, give-way/stand-on)", "Navigation lights of a power-driven vessel and vessel at anchor", "Parts of a mooring line arrangement: head/stern lines, springs, breast lines", "Reading draft marks (metric: 10 cm figures)"]
      : ["4-stroke cycle: induction, compression, power, exhaust; 2-stroke: scavenge + compression, power + exhaust", "Centrifugal pump: needs priming, never run dry; positive displacement pump: never against a closed discharge (relief valve)", "Engine room fluids: FO, LO, cooling FW/SW, compressed air (start air 25–30 bar)", "Location of the emergency stops and quick-closing valves (in drawings)"] },
    { h: "Travel and joining", p: "Keep agent's 24-hour number offline. At the airport carry documents in hand luggage. If a flight is delayed or a document is challenged, call the agent before leaving the airport. Do not carry parcels for anybody — drug smuggling penalties fall on the carrier." },
  ],
  params: [["Medical certificate max validity", "2 years (STCW I/9)"], ["Passport validity", "≥ 6 months after contract end"], ["Basic training revalidation", "Every 5 years (PST & FPFF)"], [t === "deck" ? "Draft mark figure height" : "Starting air pressure", t === "deck" ? "10 cm (metric)" : "25–30 bar"]],
  failures: [
    { what: "Medical expires during the contract", action: "Tell your crewing office before travel — an expired medical can stop you joining or force sign-off." },
    { what: "Immigration questions your visa / LOG", action: "Stay calm, show the Letter of Guarantee and call the agent; do not argue." },
    { what: "Someone asks you to carry a parcel", action: "Refuse politely. You are responsible for everything in your luggage." },
  ],
  scenario: { situation: "Two days before flying you notice your medical certificate expires in 3 weeks; your contract is 6 months.", choices: [
    { c: "Fly and renew later in some port", ok: false, fb: "Wrong. Port renewal is not guaranteed; PSC can detain the ship for an invalid medical." },
    { c: "Inform your crewing office today and renew before joining", ok: true, fb: "Correct. Offices can rebook travel — they cannot fix an expired certificate on board." },
    { c: "Change the date on a copy", ok: false, fb: "Never. Forged documents end careers and are a criminal offence." },
  ] },
  english: [["Good morning, I am the new cadet joining today", "Reporting at gangway"], ["These are my original documents", "Handing over papers"], ["My flight is delayed, please advise", "Calling the agent"]],
  oral: [
    { q: "List your STCW basic training certificates.", a: "Personal Survival Techniques, Fire Prevention & Fire Fighting, Elementary First Aid, Personal Safety & Social Responsibilities (A-VI/1), plus Security Awareness (A-VI/6)." },
    { q: "What does MLC guarantee you about repatriation?", a: "Repatriation at no cost to the seafarer at contract end, on illness/injury, shipwreck or if the shipowner cannot fulfil obligations (Reg. 2.5)." },
    { q: t === "deck" ? "What does Rule 5 of COLREG require?" : "Why must a centrifugal pump never run dry?", a: t === "deck" ? "Proper lookout at all times by sight and hearing and all available means." : "The mechanical seal and impeller are cooled/lubricated by the liquid; running dry overheats and destroys the seal." },
  ],
  drills: [
    { q: "Maximum validity of a seafarer medical certificate (STCW)?", o: ["1 year", "2 years", "5 years", "Lifetime"], a: 1, why: "STCW Reg. I/9 — max 2 years (1 year under 18)." },
    { q: "Who pays repatriation at contract end under MLC?", o: ["The seafarer", "The shipowner", "The agent", "The flag state"], a: 1, why: "MLC Reg. 2.5 — at no cost to the seafarer." },
    { q: "Which is NOT basic STCW training?", o: ["PST", "FPFF", "ECDIS", "EFA"], a: 2, why: "ECDIS is an officer course, not basic training." },
    t === "deck"
      ? { q: "Head-on situation, both power-driven. Each alters to:", o: ["Port", "Starboard", "Stand on", "Stop"], a: 1, why: "COLREG Rule 14 — both alter to starboard." }
      : { q: "Positive displacement pump against a closed discharge:", o: ["Is safe", "Builds pressure until the relief valve lifts or something fails", "Stops itself", "Reverses"], a: 1, why: "Always open discharge; relief valve is the last protection." },
    t === "deck"
      ? { q: "Metric draft figures are:", o: ["5 cm high", "10 cm high", "1 ft high", "20 cm high"], a: 1, why: "Figures and spacing are 10 cm each." }
      : { q: "Typical main starting air pressure?", o: ["7 bar", "15 bar", "25–30 bar", "100 bar"], a: 2, why: "Main air receivers are usually 25–30 bar." },
  ],
});

const FAMIL: ShoreModule = {
  competence: "SOLAS Reg. III/19 & III/37 (muster list, drills, familiarisation); STCW Reg. I/14 & A-VI/1-1 (safety familiarisation before duty)", minutes: 45,
  objectives: ["Complete safety familiarisation before any duty", "Find your muster/lifeboat station blindly", "Recognise each alarm signal", "Locate fire-fighting, life-saving and emergency-stop equipment"],
  sections: [
    { h: "The first hours on board", p: "STCW requires safety familiarisation before you are assigned duties: an officer walks you round, shows alarms, escape routes, muster station and your emergency duty. You sign the familiarisation checklist — sign only for what was really shown." },
    { h: "Muster list (SOLAS III/37)", li: ["Posted on the bridge, engine room and accommodation", "Shows your emergency station, lifeboat/liferaft number and duty for fire, abandon ship and MOB", "Your lifejacket and immersion suit are in your cabin — check size and the light/whistle", "Cabin card summarises your duties"] },
    { h: "Alarm signals", li: ["General emergency: 7 or more short blasts + 1 long blast on whistle and alarm bells → go to muster station with lifejacket", "Fire: continuous ringing of alarm bells (check the ship's muster list — some ships use specific signals)", "Abandon ship: given ONLY verbally by the Master", "CO₂ release alarm: siren/rotating light in the protected space → leave immediately, do not enter", "Engine room: alarm + flashing light; 'dead man' alarm for single-person watch"] },
    { h: "Escape routes", p: "Walk the primary and secondary escape route from your cabin and from your workplace in daylight, then once with eyes half-closed. In smoke, keep low and follow the low-location lighting. Know where the Emergency Escape Breathing Devices (EEBD, ~10–15 min of air — for escape only, never for fire-fighting) are kept." },
    { h: "Equipment to locate and name", li: ["Fire extinguishers: water (red), foam (cream), CO₂ (black), dry powder (blue) — colour codes vary by flag, read the label", "Fire hydrants, hoses, nozzles, international shore connection", "SCBA sets and fireman's outfits", "Lifeboat, liferafts, HRU, lifebuoys with light/smoke", "Emergency stops: fuel pumps, ventilation fans, quick-closing valves remote station", "Emergency generator room, emergency fire pump"] },
    { h: "Drills", p: "SOLAS III/19: abandon-ship and fire drills monthly; within 24 h of leaving port if more than 25% of the crew has changed. New crew get instruction on the ship's LSA within two weeks. Treat every drill as real." },
  ],
  params: [["General alarm", "7+ short blasts + 1 long"], ["EEBD duration", "≥ 10 min (escape only)"], ["Abandon-ship & fire drill", "At least monthly"], ["Drill after crew change > 25%", "Within 24 h of departure"]],
  failures: [
    { what: "Alarm at night, corridor full of smoke", action: "Wake neighbours, take lifejacket, keep low, use the escape route you walked, report at muster station." },
    { what: "Your lifejacket light does not work", action: "Report to the Safety Officer/Third Officer immediately for replacement." },
    { what: "You were not familiarised but are told to start work", action: "Politely ask for familiarisation first — it is a legal requirement before duty." },
  ],
  scenario: { situation: "Day two, 0300 hrs. The general alarm sounds: 7 short + 1 long. You smell smoke in the corridor.", choices: [
    { c: "Go back for your phone and passport", ok: false, fb: "Wrong. Seconds matter. Documents are replaceable." },
    { c: "Take lifejacket, keep low, secondary route if the primary is smoky, report at muster station", ok: true, fb: "Correct. That is exactly why you walked both routes on day one." },
    { c: "Open the cabin door wide and look for the fire", ok: false, fb: "Wrong. Feel the door first; never investigate alone. Muster and report." },
  ] },
  english: [["Cadet … reporting at muster station", "At muster"], ["Smoke in accommodation, deck …", "Reporting a fire"], ["All present from my cabin area", "Headcount"]],
  oral: [
    { q: "What is the general emergency alarm?", a: "Seven or more short blasts followed by one long blast on the whistle and the general alarm bells." },
    { q: "Can an EEBD be used for fire-fighting?", a: "No. It is for escape only, about 10–15 minutes; fire-fighting needs SCBA." },
    { q: "How often are abandon-ship drills held?", a: "At least monthly, and within 24 h of departure if more than 25% of crew changed (SOLAS III/19)." },
  ],
  drills: [
    { q: "General emergency alarm signal?", o: ["3 long", "7+ short + 1 long", "Continuous bell", "1 short"], a: 1, why: "SOLAS / LSA Code general alarm." },
    { q: "Who gives the order to abandon ship?", o: ["Chief Officer", "Bosun", "Master, verbally", "Any officer"], a: 2, why: "Only the Master, by voice." },
    { q: "EEBD is for:", o: ["Fire-fighting", "Escape only", "Enclosed space entry", "Painting"], a: 1, why: "Short-duration escape device." },
    { q: "CO₂ release alarm sounds in the engine room. You:", o: ["Finish your job", "Leave immediately", "Close the CO₂ bottles", "Look for the fire"], a: 1, why: "CO₂ is lethal — evacuate at once." },
    { q: "Safety familiarisation must be done:", o: ["Within one month", "Before any duty", "Only in port", "After the first drill"], a: 1, why: "STCW Reg. I/14 & A-VI/1-1." },
    { q: "Fire drills are held at least:", o: ["Weekly", "Monthly", "Every 3 months", "Yearly"], a: 1, why: "SOLAS III/19." },
  ],
};

/** Full shore study manual for module 1–4, or null for onboard modules. */
export function shoreModule(track: CadetTrack, week: number): ShoreModule | null {
  return week === 1 ? ENGLISH : week === 2 ? SAFETY : week === 3 ? (track === "deck" ? { ...READY("deck"), competence: READY("deck").competence } : READY("engine")) : week === 4 ? FAMIL : null;
}

/** Part 1 is cleared when all four shore modules have a passing result (≥60%). */
export function shoreCleared(results: { week: number; score: number }[]) {
  const ok = new Set(results.filter((r) => r.score >= 60).map((r) => r.week));
  return [1, 2, 3, 4].every((w) => ok.has(w));
}
