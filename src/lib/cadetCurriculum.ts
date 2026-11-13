/** Cadet Academy: 4-week shore induction + 28-week onboard programme (Deck / Engine). Answer keys live only on the server (cadet_submit_week). */
export type CadetTrack = "deck" | "engine";
export type CadetWeek = { week: number; stage: "shore" | "onboard"; t: string; f: string; eq: string[]; safe: string; ref: string; chk: string[]; q: { q: string; o: string[] }[] };
export const CADET_CURRICULUM: Record<CadetTrack, CadetWeek[]> = {
"deck": [
{
"t": "Maritime English, SMCP & first day onboard",
"f": "Speak clearly, report correctly and fit into a multinational crew.",
"eq": [
"VHF handset",
"Ship's PA / talk-back",
"Muster list"
],
"safe": "Always repeat back an order before acting on it (closed-loop communication).",
"ref": "STCW A-II/1 & A-III/1 English; IMO SMCP",
"chk": [
"Introduce yourself to the OOW/Duty Engineer using rank and name",
"Practise 5 SMCP phrases aloud (e.g. 'Say again', 'Correction')",
"Find your muster station on the muster list"
],
"q": [
{
"q": "An officer gives you an order. What is the correct first reply?",
"o": [
"Ask a friend",
"'OK'",
"Repeat the order back clearly",
"Start the job silently"
]
},
{
"q": "In SMCP, which word replaces 'I made a mistake' when correcting yourself?",
"o": [
"Sorry",
"Correction",
"Mistake",
"Cancel"
]
},
{
"q": "Where do you find your emergency duty and lifeboat number?",
"o": [
"Muster list",
"Logbook",
"Notice board menu",
"Crew contract"
]
}
],
"week": 1,
"stage": "shore"
},
{
"t": "Safety culture & stop-work authority",
"f": "Know you may stop unsafe work, and how to question a senior respectfully.",
"eq": [
"PPE: helmet, boots, gloves, goggles, ear muffs",
"Permit-to-work board",
"Emergency alarm points"
],
"safe": "If anyone (even a senior) is about to be hurt, say STOP clearly, then report to the OOW/Chief.",
"ref": "ISM Code 5 & 6; SOLAS Ch IX",
"chk": [
"Check your PPE is complete and in good condition",
"Locate the nearest fire alarm call point and emergency stop",
"Practise this line: 'Sir, may I check — is the permit for this job signed?'"
],
"q": [
{
"q": "You see a senior officer enter a tank without a gas test. What do you do?",
"o": [
"Post on social media",
"Wait until the voyage ends",
"Ignore it, he is senior",
"Politely stop him and ask about the gas test, then report"
]
},
{
"q": "Which code gives every crew member the right to stop unsafe work?",
"o": [
"Load Line",
"MARPOL",
"ISM Code / company SMS",
"COLREG"
]
},
{
"q": "Correct order to question a senior about a safety lapse?",
"o": [
"Shout in front of all",
"Respectful question, reason, then escalate if unsafe continues",
"Do nothing",
"Fix it secretly"
]
}
],
"week": 2,
"stage": "shore"
},
{
"t": "Deck basics: COLREG, mooring & draft",
"f": "The deck words and equipment you will meet on day one.",
"eq": [
"Mooring winch & windlass",
"Draft marks",
"Sounding pipes & tape"
],
"safe": "Never stand in a mooring line snap-back zone.",
"ref": "COLREG Rule 5; IMO MSC.1/Circ.1620 mooring",
"chk": [
"Name the 5 types of mooring line (head, stern, breast, spring)",
"Read a draft mark photo (metric 10 cm figures)",
"Identify sounding pipe caps on deck"
],
"q": [
{
"q": "COLREG Rule 5 is about…",
"o": [
"Lookout",
"Lights",
"Sound signals",
"Speed"
]
},
{
"q": "Metric draft figures are how high?",
"o": [
"20 cm",
"1 m",
"5 cm",
"10 cm"
]
},
{
"q": "A snap-back zone is…",
"o": [
"The bridge wing",
"Where a parted line can whip",
"A smoking area",
"The gangway"
]
}
],
"week": 3,
"stage": "shore"
},
{
"t": "Pre-joining readiness & milestone check",
"f": "Documents, sea bag and mindset ready before signing on.",
"eq": [
"Seaman's book & passport",
"STCW certificates (BST)",
"Medical certificate"
],
"safe": "Never sail with an expired medical or BST — you can be refused onboard.",
"ref": "STCW Reg I/9 (medical), A-VI/1 (BST)",
"chk": [
"Check expiry dates of passport, CDC, medical, BST",
"Pack overalls, safety shoes and a notebook for your record book",
"Save the company DPA / emergency contact on your phone"
],
"q": [
{
"q": "Which certificate proves you are medically fit for sea service?",
"o": [
"COC",
"STCW medical certificate",
"Visa",
"Yellow fever card only"
]
},
{
"q": "What does BST stand for?",
"o": [
"Bridge Ship Test",
"Boat Service Ticket",
"Bunker Safety Test",
"Basic Safety Training"
]
},
{
"q": "Who is the company contact for safety concerns ashore?",
"o": [
"Pilot",
"Chandler",
"Agent",
"Designated Person Ashore (DPA)"
]
}
],
"week": 4,
"stage": "shore"
},
{
"t": "Ship familiarisation & emergency routes",
"f": "Know your ship before anything else.",
"eq": [
"Fire plan",
"Escape routes",
"Muster stations"
],
"safe": "Walk your escape routes in daylight so you can do it in the dark.",
"ref": "SOLAS II-2 & III/19",
"chk": [
"Walk all escape routes from cabin to boat deck",
"Locate fire plan and fire control station",
"Sign familiarisation checklist with Chief Officer"
],
"q": [
{
"q": "Where is the fire control plan kept?",
"o": [
"Nowhere",
"Only in the Master's cabin",
"Posted at key locations and in a tube by the gangway",
"In the galley"
]
},
{
"q": "Familiarisation must be done…",
"o": [
"Within the first month",
"Before being assigned duties / soon after joining",
"At sign-off",
"Only in port"
]
}
],
"week": 5,
"stage": "onboard"
},
{
"t": "Bridge equipment I: steering & compass",
"f": "Hand steering and compass basics.",
"eq": [
"Steering stand / autopilot",
"Gyro & magnetic compass",
"Rudder angle indicator"
],
"safe": "Change autopilot to hand steering only on OOW order and report 'Hand steering'.",
"ref": "SOLAS V/19, V/26",
"chk": [
"Switch autopilot to hand and back with the OOW",
"Compare gyro vs magnetic heading",
"Steer a course for 15 minutes"
],
"q": [
{
"q": "When you take the wheel, what do you report?",
"o": [
"Weather",
"Speed",
"Nothing",
"Course to steer and 'hand steering engaged'"
]
},
{
"q": "Compass error is found by…",
"o": [
"AIS",
"Guessing",
"Azimuth / amplitude or transit",
"Echo sounder"
]
}
],
"week": 6,
"stage": "onboard"
},
{
"t": "Bridge equipment II: radar, ECDIS, AIS",
"f": "See what the OOW sees.",
"eq": [
"Radar/ARPA",
"ECDIS",
"AIS",
"Echo sounder"
],
"safe": "Never rely on one instrument only — confirm with visual lookout.",
"ref": "SOLAS V/19; COLREG Rule 7",
"chk": [
"Acquire a target on ARPA and read CPA/TCPA",
"Find safety contour setting on ECDIS",
"Read depth on echo sounder"
],
"q": [
{
"q": "CPA means…",
"o": [
"Course Plotted Ahead",
"Chart Position Accuracy",
"Cargo Plan Area",
"Closest Point of Approach"
]
},
{
"q": "ECDIS safety contour warns you about…",
"o": [
"Fuel",
"Speed",
"Weather",
"Shallow water"
]
}
],
"week": 7,
"stage": "onboard"
},
{
"t": "Lookout & watch routine",
"f": "Be a good lookout and report correctly.",
"eq": [
"Binoculars",
"Bridge logbook",
"Navigation lights panel"
],
"safe": "Report every light, vessel or object in relative bearing and distance.",
"ref": "COLREG Rule 5; STCW A-VIII/2",
"chk": [
"Report 3 targets using bearing (e.g. 'two points on starboard bow')",
"Check navigation lights panel",
"Observe OOW logbook entries"
],
"q": [
{
"q": "Correct lookout report?",
"o": [
"'Ship there'",
"'Vessel, 30° on starboard bow, about 5 miles'",
"'Look!'",
"Nothing"
]
},
{
"q": "Navigation lights are shown from…",
"o": [
"Sunset to sunrise and restricted visibility",
"Only in port",
"Only at anchor",
"Noon"
]
}
],
"week": 8,
"stage": "onboard"
},
{
"t": "Toolbox meeting & risk assessment",
"f": "Speak up in the morning meeting.",
"eq": [
"Toolbox talk form",
"Risk assessment",
"Permit-to-work"
],
"safe": "If a hazard was not discussed, ask before work starts.",
"ref": "ISM Code 7; Code of Safe Working Practices",
"chk": [
"Attend a toolbox talk and note 3 hazards",
"Read one deck risk assessment",
"Ask one question in the meeting"
],
"q": [
{
"q": "Purpose of a toolbox meeting?",
"o": [
"Inspect cabins",
"Breakfast",
"Plan the job and identify hazards",
"Pay wages"
]
},
{
"q": "A permit-to-work is needed for…",
"o": [
"Painting cabin door",
"Enclosed space entry / hot work / work aloft",
"Eating",
"Sounding"
]
}
],
"week": 9,
"stage": "onboard"
},
{
"t": "Enclosed space entry",
"f": "The most fatal job onboard — learn it right.",
"eq": [
"Gas detector (O2, LEL, H2S, CO)",
"Ventilation fan",
"Rescue tripod & SCBA"
],
"safe": "Never enter unless O2 is 20.9% and the permit is signed — never enter to rescue alone.",
"ref": "SOLAS XI-1/7; IMO Res A.1050(27)",
"chk": [
"Watch gas detector bump test",
"Read an enclosed space permit",
"Locate rescue equipment"
],
"q": [
{
"q": "Safe oxygen reading for entry?",
"o": [
"25%",
"10%",
"15%",
"20.9%"
]
},
{
"q": "If a man collapses inside a tank you should…",
"o": [
"Call home",
"Jump in",
"Raise alarm, do not enter without SCBA and team",
"Wait"
]
}
],
"week": 10,
"stage": "onboard"
},
{
"t": "Working aloft & overside",
"f": "Safe harness use.",
"eq": [
"Full-body harness",
"Lifeline & fall arrestor",
"Bosun's chair"
],
"safe": "Harness must be attached to a strong point before you leave the deck.",
"ref": "Code of Safe Working Practices ch.17",
"chk": [
"Inspect a harness for cuts and expiry",
"Fit the harness correctly",
"Identify strong points"
],
"q": [
{
"q": "Working aloft starts at roughly…",
"o": [
"2 m above deck",
"10 m",
"Never",
"0.5 m"
]
},
{
"q": "Before working overside you need…",
"o": [
"Nothing",
"Camera",
"Music",
"Lifebuoy with line ready and permit"
]
}
],
"week": 11,
"stage": "onboard"
},
{
"t": "Mooring operations",
"f": "Lines, winches and snap-back.",
"eq": [
"Mooring winch & brake",
"Rope stoppers",
"Heaving line"
],
"safe": "Stand clear of bights and snap-back zones; never stand on a line.",
"ref": "MSC.1/Circ.1620; OCIMF MEG4",
"chk": [
"Mark snap-back zones on station sketch",
"Watch brake test procedure",
"Make a stopper hitch under supervision"
],
"q": [
{
"q": "Never stand…",
"o": [
"Near the bridge",
"In a bight of rope",
"In the mess",
"On the gangway"
]
},
{
"q": "Winch brake holding is tested…",
"o": [
"Periodically per maker/SMS",
"Only in dry dock",
"Daily by cadet alone",
"Never"
]
}
],
"week": 12,
"stage": "onboard"
},
{
"t": "Anchoring & windlass",
"f": "Anchor gear and cable marks.",
"eq": [
"Windlass",
"Anchor chain & shackle marks",
"Devil's claw / bow stopper"
],
"safe": "Never stand in line with the chain while walking back or letting go.",
"ref": "SOLAS II-1/3-8; Class rules",
"chk": [
"Count shackle marks on deck",
"Locate bow stopper",
"Watch anchor clear-away procedure"
],
"q": [
{
"q": "One shackle of cable is…",
"o": [
"5 m",
"10 m",
"27.5 m (15 fathoms)",
"100 m"
]
},
{
"q": "Anchor secured for sea with…",
"o": [
"Nothing",
"Bow stopper and lashings",
"Rope only",
"Paint"
]
}
],
"week": 13,
"stage": "onboard"
},
{
"t": "Pilot ladder & accommodation ladder",
"f": "Rig it like a lifeline.",
"eq": [
"Pilot ladder",
"Man-ropes",
"Lifebuoy with light"
],
"safe": "Steps must be horizontal, spreaders every 9 steps max, lit at night.",
"ref": "SOLAS V/23; IMO Res A.1045(27)",
"chk": [
"Check ladder steps and spreaders",
"Prepare lifebuoy with self-igniting light",
"Rig under OOW supervision"
],
"q": [
{
"q": "Pilot ladder must have a spreader at least every…",
"o": [
"15 steps",
"20 steps",
"5 steps",
"9 steps"
]
},
{
"q": "At the ladder at night you need…",
"o": [
"Torch in pocket",
"Radio only",
"Lighting and lifebuoy with light",
"Nothing"
]
}
],
"week": 14,
"stage": "onboard"
},
{
"t": "Draft survey & soundings",
"f": "Read drafts and sound tanks.",
"eq": [
"Draft marks",
"Sounding tape & water paste",
"Tank tables"
],
"safe": "Close and secure sounding caps after use.",
"ref": "Load Line Convention; STCW A-II/1",
"chk": [
"Read all 6 draft marks",
"Sound a ballast tank and convert with tables",
"Record in sounding book"
],
"q": [
{
"q": "Water-finding paste changes colour when…",
"o": [
"Touching water",
"Hot",
"Oily only",
"Dry"
]
},
{
"q": "Mean draft accounts for…",
"o": [
"Speed",
"Crew",
"Weather",
"Trim, hog and sag"
]
}
],
"week": 15,
"stage": "onboard"
},
{
"t": "Ballast system & BWM",
"f": "Ballast water management.",
"eq": [
"Ballast pumps",
"Ballast Water Treatment System",
"BWRB"
],
"safe": "Every ballast operation must be logged in the Ballast Water Record Book.",
"ref": "BWM Convention D-2",
"chk": [
"Trace a ballast line on the plan",
"Observe BWTS start-up",
"Read one BWRB entry"
],
"q": [
{
"q": "BWM Convention D-2 is a…",
"o": [
"Exchange standard",
"Performance (treatment) standard",
"Fire rule",
"Crew rule"
]
},
{
"q": "Ballast operations are logged in…",
"o": [
"Ballast Water Record Book",
"Bell book",
"Garbage book",
"Oil record book"
]
}
],
"week": 16,
"stage": "onboard"
},
{
"t": "Cargo holds: cleaning & inspection",
"f": "Hold readiness on bulk carriers.",
"eq": [
"Hold bilge wells",
"Strum boxes",
"Ladders & hatch access"
],
"safe": "Never enter a hold after fumigation or with cargo that consumes oxygen without a gas test.",
"ref": "IMSBC Code; SOLAS XII",
"chk": [
"Check bilge well and non-return valve",
"Inspect hold for rust scale / residues",
"Report hold condition to Chief Officer"
],
"q": [
{
"q": "Bilge wells should be covered with…",
"o": [
"Paint",
"Plastic",
"Burlap/sackcloth for grain cargo",
"Nothing"
]
},
{
"q": "IMSBC Code covers…",
"o": [
"Containers",
"Solid bulk cargoes",
"Passengers",
"Tankers"
]
}
],
"week": 17,
"stage": "onboard"
},
{
"t": "Hatch covers & weathertightness",
"f": "Keep the cargo dry.",
"eq": [
"Hatch cover cleats",
"Rubber packing",
"Ultrasonic test kit"
],
"safe": "Keep hands clear of moving hatch covers and use the stop button.",
"ref": "Load Line Reg 16; Class",
"chk": [
"Inspect rubber packing for damage",
"Check cleats and drain channels",
"Assist ultrasonic tightness test"
],
"q": [
{
"q": "Hatch tightness is best verified by…",
"o": [
"Painting",
"Smell",
"Looking",
"Ultrasonic or hose test"
]
},
{
"q": "Damaged packing can cause…",
"o": [
"Nothing",
"Faster speed",
"Cargo wet damage",
"Better trim"
]
}
],
"week": 18,
"stage": "onboard"
},
{
"t": "Cargo operations & loading plan",
"f": "Watch cargo work safely.",
"eq": [
"Loading computer",
"Stowage plan",
"Draft readings"
],
"safe": "Stay clear of grabs and cranes; communicate with hand signals.",
"ref": "IMSBC; SOLAS VI & XII; BLU Code",
"chk": [
"Read the loading sequence",
"Take drafts during loading",
"Record hold quantities"
],
"q": [
{
"q": "BLU Code is about…",
"o": [
"Lifeboats",
"Pilots",
"Oil spills",
"Bulk loading & unloading safety"
]
},
{
"q": "Loading plan must avoid…",
"o": [
"Daylight",
"Rain only",
"Coffee breaks",
"Excess shear forces and bending moments"
]
}
],
"week": 19,
"stage": "onboard"
},
{
"t": "Lifeboat & launching",
"f": "Your way off the ship.",
"eq": [
"Lifeboat & davit",
"On-load release hook",
"Lifeboat engine"
],
"safe": "Never stay in the boat during hoisting unless required, and check hook reset.",
"ref": "SOLAS III; LSA Code; MSC.402(96)",
"chk": [
"Start lifeboat engine (weekly test)",
"Check hook is fully reset",
"Inspect lifeboat equipment list"
],
"q": [
{
"q": "Lifeboat engine is tested…",
"o": [
"Yearly",
"Weekly",
"Never",
"Monthly by shore only"
]
},
{
"q": "On-load release lets you…",
"o": [
"Lower faster",
"Fill fuel",
"Steer",
"Release while boat is under load"
]
}
],
"week": 20,
"stage": "onboard"
},
{
"t": "Liferafts & HRU",
"f": "Liferaft readiness.",
"eq": [
"Liferaft",
"Hydrostatic Release Unit",
"Weak link"
],
"safe": "Painter must be attached to the weak link, not to the ship directly.",
"ref": "SOLAS III/13 & 20",
"chk": [
"Check HRU expiry date",
"Check painter connection",
"Read raft servicing date"
],
"q": [
{
"q": "HRU releases the raft at about…",
"o": [
"Never",
"1–4 m depth",
"50 m",
"On deck"
]
},
{
"q": "The weak link…",
"o": [
"Holds the raft forever",
"Breaks so the raft floats free and inflates",
"Is decoration",
"Is a fuel line"
]
}
],
"week": 21,
"stage": "onboard"
},
{
"t": "Fire fighting equipment",
"f": "Fight fire safely.",
"eq": [
"Fire hydrants & hoses",
"Portable extinguishers",
"SCBA",
"Emergency fire pump"
],
"safe": "Check SCBA cylinder pressure before every use (approx. 200+ bar).",
"ref": "SOLAS II-2; FSS Code",
"chk": [
"Identify extinguisher types (water, foam, CO2, powder)",
"Start emergency fire pump with officer",
"Don SCBA under supervision"
],
"q": [
{
"q": "CO2 extinguisher is best for…",
"o": [
"Paper only",
"Oil tank",
"Wood",
"Electrical fires"
]
},
{
"q": "Emergency fire pump is located…",
"o": [
"Galley",
"Same space as main fire pumps",
"Outside the main machinery space",
"Bridge"
]
}
],
"week": 22,
"stage": "onboard"
},
{
"t": "Abandon ship & MOB drills",
"f": "Drill like it's real.",
"eq": [
"Lifebuoys",
"Immersion suits",
"EPIRB & SART"
],
"safe": "Know your own drill duty without asking.",
"ref": "SOLAS III/19",
"chk": [
"Don an immersion suit within 2 minutes",
"Locate EPIRB and SART",
"Report your drill duty"
],
"q": [
{
"q": "Immersion suit must be donned within…",
"o": [
"2 min",
"30 sec",
"1 hour",
"10 min"
]
},
{
"q": "MOB first action?",
"o": [
"Call home",
"Nothing",
"Shout 'man overboard', throw lifebuoy, keep watching",
"Go to cabin"
]
}
],
"week": 23,
"stage": "onboard"
},
{
"t": "GMDSS & distress",
"f": "Calling for help.",
"eq": [
"VHF DSC",
"MF/HF",
"Navtex",
"SART/EPIRB"
],
"safe": "Never transmit a false distress; if it happens, cancel immediately.",
"ref": "SOLAS IV",
"chk": [
"Find Ch 16 and Ch 70",
"Read a Navtex message",
"Watch daily GMDSS test log"
],
"q": [
{
"q": "VHF DSC channel is…",
"o": [
"16",
"70",
"13",
"6"
]
},
{
"q": "Navtex gives…",
"o": [
"Navigational & weather warnings",
"Cargo plans",
"Wages",
"Music"
]
}
],
"week": 24,
"stage": "onboard"
},
{
"t": "Collision, grounding & steering failure",
"f": "Bridge emergencies.",
"eq": [
"Emergency steering",
"Steering gear room",
"General alarm"
],
"safe": "In emergency steering, follow the bridge orders exactly and repeat back.",
"ref": "SOLAS V/26; II-1/29",
"chk": [
"Visit steering gear room and find local control",
"Read emergency steering instructions",
"Participate in steering drill"
],
"q": [
{
"q": "Emergency steering drills are held…",
"o": [
"Daily",
"Yearly",
"At least every 3 months",
"Never"
]
},
{
"q": "After grounding, first check…",
"o": [
"Menu",
"Soundings of tanks and hull integrity",
"Crew list",
"Cargo docs"
]
}
],
"week": 25,
"stage": "onboard"
},
{
"t": "MARPOL I & V: oil & garbage",
"f": "Protect the sea.",
"eq": [
"SOPEP locker",
"Garbage bins (colour coded)",
"Garbage Record Book"
],
"safe": "Plastic must never go overboard — anywhere.",
"ref": "MARPOL Annex I & V",
"chk": [
"Check SOPEP locker contents",
"Sort garbage correctly",
"Read Garbage Record Book entries"
],
"q": [
{
"q": "Plastics can be discharged at sea…",
"o": [
"At night",
"In port",
"Beyond 12 nm",
"Never"
]
},
{
"q": "SOPEP stands for…",
"o": [
"Sea Port Plan",
"Ship Oil Pollution Emergency Plan",
"Safe Operation Plan",
"Ship Pilot Plan"
]
}
],
"week": 26,
"stage": "onboard"
},
{
"t": "MARPOL VI & environmental logs",
"f": "Air pollution & ECA.",
"eq": [
"Fuel changeover log",
"ODS record",
"Incinerator"
],
"safe": "Fuel changeover must be completed before entering an ECA.",
"ref": "MARPOL Annex VI Reg 14",
"chk": [
"Read changeover log for last ECA",
"Find ODS record book",
"Note ECA areas on chart"
],
"q": [
{
"q": "ECA sulphur limit is…",
"o": [
"0.1%",
"0.5%",
"1%",
"3.5%"
]
},
{
"q": "Global sulphur limit outside ECA is…",
"o": [
"0%",
"5%",
"0.5%",
"3.5%"
]
}
],
"week": 27,
"stage": "onboard"
},
{
"t": "Port State & vetting inspections",
"f": "Look ready when inspectors board.",
"eq": [
"Certificates file",
"Drill records",
"Logbooks"
],
"safe": "Answer inspectors honestly and simply; say 'I will ask the officer' if unsure.",
"ref": "Paris/Tokyo MOU; SIRE 2.0; RightShip",
"chk": [
"Locate ship certificates file",
"Explain your drill duty to a mock inspector",
"Check your own documents are ready"
],
"q": [
{
"q": "If an inspector asks something you don't know…",
"o": [
"Guess",
"Say you'll ask the responsible officer",
"Ignore",
"Leave"
]
},
{
"q": "SIRE 2.0 focuses on…",
"o": [
"Human factors and actual practice",
"Food",
"Wages",
"Paint"
]
}
],
"week": 28,
"stage": "onboard"
},
{
"t": "Navigation watch: passage plan",
"f": "Plan the voyage.",
"eq": [
"Paper/ECDIS charts",
"Passage plan",
"Tide tables"
],
"safe": "No-go areas and safety margins must be clearly marked.",
"ref": "SOLAS V/34; IMO Res A.893(21)",
"chk": [
"Read the passage plan stages (appraisal, planning, execution, monitoring)",
"Plot a position fix",
"Check a waypoint"
],
"q": [
{
"q": "Passage plan stages are…",
"o": [
"None",
"Appraise, plan, execute, monitor",
"Buy, sell, go",
"Load, sail"
]
},
{
"q": "Fix intervals depend on…",
"o": [
"Mood",
"Proximity to danger",
"Food",
"Day of week"
]
}
],
"week": 29,
"stage": "onboard"
},
{
"t": "Watch handover & logbook",
"f": "Hand over a watch properly.",
"eq": [
"Bridge logbook",
"Night orders",
"Standing orders"
],
"safe": "Never take over the watch if the relieving officer is unfit or during a manoeuvre.",
"ref": "STCW A-VIII/2 Part 3-1",
"chk": [
"Observe a full watch handover",
"Read Master's standing orders",
"Make a draft logbook entry"
],
"q": [
{
"q": "Do not hand over watch if…",
"o": [
"Coffee is ready",
"It is night",
"It is raining",
"A manoeuvre is in progress"
]
},
{
"q": "Night orders are written by…",
"o": [
"Pilot",
"Cadet",
"Master",
"Cook"
]
}
],
"week": 30,
"stage": "onboard"
},
{
"t": "Weather & heavy weather preparation",
"f": "Prepare the ship for bad weather.",
"eq": [
"Barometer",
"Weather fax/Navtex",
"Lashing equipment"
],
"safe": "Secure all loose items and close weathertight doors before heavy weather.",
"ref": "SOLAS V/5; Load Line",
"chk": [
"Record barometer trend",
"Check deck lashings",
"Close and check weathertight doors"
],
"q": [
{
"q": "Rapidly falling barometer means…",
"o": [
"Approaching bad weather",
"Nothing",
"Port arrival",
"Good weather"
]
},
{
"q": "Before heavy weather you should…",
"o": [
"Sleep",
"Paint",
"Open doors",
"Secure loose gear and close weathertight doors"
]
}
],
"week": 31,
"stage": "onboard"
},
{
"t": "Final review & record book sign-off",
"f": "Show what you learned.",
"eq": [
"Training Record Book",
"Equipment passport"
],
"safe": "Your record book must be honest — only sign what you have done.",
"ref": "STCW Reg II/1, A-II/1",
"chk": [
"Review all completed weeks",
"Show passport to Master/Chief Officer",
"Get officer sign-off"
],
"q": [
{
"q": "Your record book should be signed…",
"o": [
"By yourself",
"By the supervising officer/Master after verification",
"By anyone",
"Never"
]
},
{
"q": "Falsifying a record book is…",
"o": [
"Serious misconduct and can cancel your certificate",
"Normal",
"Encouraged",
"Fine"
]
}
],
"week": 32,
"stage": "onboard"
}
],
"engine": [
{
"t": "Maritime English, SMCP & first day onboard",
"f": "Speak clearly, report correctly and fit into a multinational crew.",
"eq": [
"VHF handset",
"Ship's PA / talk-back",
"Muster list"
],
"safe": "Always repeat back an order before acting on it (closed-loop communication).",
"ref": "STCW A-II/1 & A-III/1 English; IMO SMCP",
"chk": [
"Introduce yourself to the OOW/Duty Engineer using rank and name",
"Practise 5 SMCP phrases aloud (e.g. 'Say again', 'Correction')",
"Find your muster station on the muster list"
],
"q": [
{
"q": "An officer gives you an order. What is the correct first reply?",
"o": [
"'OK'",
"Repeat the order back clearly",
"Start the job silently",
"Ask a friend"
]
},
{
"q": "In SMCP, which word replaces 'I made a mistake' when correcting yourself?",
"o": [
"Correction",
"Mistake",
"Cancel",
"Sorry"
]
},
{
"q": "Where do you find your emergency duty and lifeboat number?",
"o": [
"Logbook",
"Notice board menu",
"Crew contract",
"Muster list"
]
}
],
"week": 1,
"stage": "shore"
},
{
"t": "Safety culture & stop-work authority",
"f": "Know you may stop unsafe work, and how to question a senior respectfully.",
"eq": [
"PPE: helmet, boots, gloves, goggles, ear muffs",
"Permit-to-work board",
"Emergency alarm points"
],
"safe": "If anyone (even a senior) is about to be hurt, say STOP clearly, then report to the OOW/Chief.",
"ref": "ISM Code 5 & 6; SOLAS Ch IX",
"chk": [
"Check your PPE is complete and in good condition",
"Locate the nearest fire alarm call point and emergency stop",
"Practise this line: 'Sir, may I check — is the permit for this job signed?'"
],
"q": [
{
"q": "You see a senior officer enter a tank without a gas test. What do you do?",
"o": [
"Wait until the voyage ends",
"Ignore it, he is senior",
"Politely stop him and ask about the gas test, then report",
"Post on social media"
]
},
{
"q": "Which code gives every crew member the right to stop unsafe work?",
"o": [
"MARPOL",
"ISM Code / company SMS",
"COLREG",
"Load Line"
]
},
{
"q": "Correct order to question a senior about a safety lapse?",
"o": [
"Respectful question, reason, then escalate if unsafe continues",
"Do nothing",
"Fix it secretly",
"Shout in front of all"
]
}
],
"week": 2,
"stage": "shore"
},
{
"t": "Engine basics: 2-stroke, 4-stroke & pumps",
"f": "The machines and words you will meet in the engine room on day one.",
"eq": [
"Main engine (2-stroke)",
"Generators (4-stroke)",
"Centrifugal & gear pumps"
],
"safe": "Never touch rotating machinery or open a hot system without the engineer's permission.",
"ref": "STCW A-III/1",
"chk": [
"Explain 2-stroke vs 4-stroke in one sentence each",
"List 3 pumps you expect (FW, SW, LO)",
"Learn the engine room emergency escape route"
],
"q": [
{
"q": "A typical ship's main engine is a…",
"o": [
"Gas turbine",
"Steam only",
"4-stroke petrol",
"Slow-speed 2-stroke diesel"
]
},
{
"q": "Generators onboard are usually…",
"o": [
"Batteries",
"2-stroke slow speed",
"Medium/high-speed 4-stroke diesel",
"Electric motors"
]
},
{
"q": "A centrifugal pump must be ___ before starting.",
"o": [
"Dry",
"Primed (filled with liquid)",
"Hot",
"Locked"
]
}
],
"week": 3,
"stage": "shore"
},
{
"t": "Pre-joining readiness & milestone check",
"f": "Documents, sea bag and mindset ready before signing on.",
"eq": [
"Seaman's book & passport",
"STCW certificates (BST)",
"Medical certificate"
],
"safe": "Never sail with an expired medical or BST — you can be refused onboard.",
"ref": "STCW Reg I/9 (medical), A-VI/1 (BST)",
"chk": [
"Check expiry dates of passport, CDC, medical, BST",
"Pack overalls, safety shoes and a notebook for your record book",
"Save the company DPA / emergency contact on your phone"
],
"q": [
{
"q": "Which certificate proves you are medically fit for sea service?",
"o": [
"STCW medical certificate",
"Visa",
"Yellow fever card only",
"COC"
]
},
{
"q": "What does BST stand for?",
"o": [
"Boat Service Ticket",
"Bunker Safety Test",
"Basic Safety Training",
"Bridge Ship Test"
]
},
{
"q": "Who is the company contact for safety concerns ashore?",
"o": [
"Chandler",
"Agent",
"Designated Person Ashore (DPA)",
"Pilot"
]
}
],
"week": 4,
"stage": "shore"
},
{
"t": "Engine room familiarisation & escapes",
"f": "Know the engine room before anything else.",
"eq": [
"Engine control room",
"Emergency escape trunk",
"Fire alarm points"
],
"safe": "Learn the emergency escape trunk route on day one.",
"ref": "SOLAS II-2/13",
"chk": [
"Walk ER escape routes to deck",
"Locate quick-closing valve station",
"Sign familiarisation with 2nd Engineer"
],
"q": [
{
"q": "Engine room escape trunk leads to…",
"o": [
"Galley",
"Open deck/safe area",
"Cargo hold",
"Cabin"
]
},
{
"q": "Quick-closing valves stop…",
"o": [
"Fuel to machinery from outside the space",
"Air",
"Steam only",
"Water"
]
}
],
"week": 5,
"stage": "onboard"
},
{
"t": "Daily rounds & gauge reading",
"f": "Rounds the right way.",
"eq": [
"Pressure & temperature gauges",
"Round sheet",
"Bilge wells"
],
"safe": "Report any leak, smell or unusual noise immediately — do not fix alone.",
"ref": "STCW A-III/1",
"chk": [
"Complete a round sheet with the duty engineer",
"Check bilge levels",
"Report one abnormal reading"
],
"q": [
{
"q": "If a reading is outside the normal range you…",
"o": [
"Fix it alone",
"Ignore",
"Report to duty engineer immediately",
"Write it later"
]
},
{
"q": "Bilge high-level alarm means…",
"o": [
"Normal",
"Water/oil accumulating — check source",
"Fire",
"Engine stop"
]
}
],
"week": 6,
"stage": "onboard"
},
{
"t": "Soundings & fuel tanks",
"f": "Sound tanks safely.",
"eq": [
"Sounding tape",
"DB tank sounding pipes",
"Tank tables"
],
"safe": "Self-closing sounding cocks must be closed after use — never wedged open.",
"ref": "MARPOL I; SOLAS II-2/4",
"chk": [
"Sound a DB fuel tank",
"Convert with tank table",
"Record in sounding book"
],
"q": [
{
"q": "Self-closing sounding cock must be…",
"o": [
"Removed",
"Painted",
"Tied open",
"Closed after use"
]
},
{
"q": "Tank volume is corrected for…",
"o": [
"Crew",
"Colour",
"Trim and temperature",
"Weather"
]
}
],
"week": 7,
"stage": "onboard"
},
{
"t": "Toolbox meeting & risk assessment (ER)",
"f": "Speak up every morning.",
"eq": [
"TBM form",
"Lock-out/tag-out tags",
"Permit-to-work"
],
"safe": "No work on machinery without isolation and LOTO.",
"ref": "ISM Code 7; CSWP ch.20",
"chk": [
"Attend TBM and note 3 hazards",
"Apply a LOTO tag with the engineer",
"Ask one question"
],
"q": [
{
"q": "LOTO is used to…",
"o": [
"Isolate energy so machinery cannot start",
"Lock cabins",
"Track time",
"Decorate"
]
},
{
"q": "Who explains the job hazards in TBM?",
"o": [
"Cadet only",
"Nobody",
"Cook",
"Supervising engineer"
]
}
],
"week": 8,
"stage": "onboard"
},
{
"t": "Enclosed spaces & hot work",
"f": "Two high-risk permits.",
"eq": [
"Gas detector",
"Hot work permit",
"Fire watch extinguisher"
],
"safe": "Hot work needs a gas-free area, permit and a fire watch for at least 30 minutes after.",
"ref": "SOLAS XI-1/7; MSC.1/Circ.1321",
"chk": [
"Watch gas test before entry",
"Read hot work permit",
"Act as fire watch under supervision"
],
"q": [
{
"q": "Fire watch after hot work continues…",
"o": [
"0 min",
"At least 30 minutes",
"1 min",
"Never"
]
},
{
"q": "Safe O2 for entry?",
"o": [
"15%",
"10%",
"30%",
"20.9%"
]
}
],
"week": 9,
"stage": "onboard"
},
{
"t": "Main engine: structure & turning gear",
"f": "The heart of the ship.",
"eq": [
"Main engine",
"Turning gear with interlock",
"Indicator cocks"
],
"safe": "Turning gear engaged = engine must not start; never bypass the interlock.",
"ref": "STCW A-III/1",
"chk": [
"Locate turning gear and interlock",
"Observe blow-through with indicator cocks open",
"Name ME main parts"
],
"q": [
{
"q": "Turning gear interlock prevents…",
"o": [
"Cooling",
"Fuel",
"Engine starting while gear is engaged",
"Lubrication"
]
},
{
"q": "Blow-through before start removes…",
"o": [
"Paint",
"Water/oil from cylinders",
"Air",
"Noise"
]
}
],
"week": 10,
"stage": "onboard"
},
{
"t": "Main engine: cooling & lube oil",
"f": "Keep it cool and lubricated.",
"eq": [
"Jacket water system",
"LO pumps & coolers",
"Expansion tank"
],
"safe": "Low LO pressure = engine slowdown/shutdown; report instantly.",
"ref": "STCW A-III/1",
"chk": [
"Trace JCW circuit",
"Read LO inlet pressure",
"Check expansion tank level"
],
"q": [
{
"q": "Low LO pressure alarm needs…",
"o": [
"Wait an hour",
"Music",
"Ignore",
"Immediate report & action"
]
},
{
"q": "Jacket water outlet is typically around…",
"o": [
"0°C",
"20°C",
"80–90°C",
"200°C"
]
}
],
"week": 11,
"stage": "onboard"
},
{
"t": "Generators & power",
"f": "Electricity onboard.",
"eq": [
"Diesel generators",
"Main switchboard",
"Emergency generator"
],
"safe": "Never open switchboard panels — electrical work is for the ETO/engineer with LOTO.",
"ref": "SOLAS II-1/42-43",
"chk": [
"Pre-start check of a generator",
"Read kW, V, Hz at switchboard",
"Watch emergency generator weekly test"
],
"q": [
{
"q": "Ship frequency is usually…",
"o": [
"5 Hz",
"1000 Hz",
"0 Hz",
"50/60 Hz"
]
},
{
"q": "Emergency generator must start automatically within…",
"o": [
"1 hour",
"Never",
"45 seconds",
"10 minutes"
]
}
],
"week": 12,
"stage": "onboard"
},
{
"t": "Bunkering preparation",
"f": "Highest pollution risk.",
"eq": [
"Bunker manifold",
"Save-all trays & scupper plugs",
"SOPEP kit",
"Sampling point"
],
"safe": "Scupper plugs in, save-alls empty, SOPEP ready — before the first drop.",
"ref": "MARPOL Annex I & VI Reg 18",
"chk": [
"Check scupper plugs and save-alls",
"Locate SOPEP kit",
"Read bunker checklist"
],
"q": [
{
"q": "Before bunkering, scuppers must be…",
"o": [
"Open",
"Plugged",
"Painted",
"Removed"
]
},
{
"q": "Bunker sample is taken…",
"o": [
"Continuously at the manifold during bunkering",
"Never",
"From the tank top",
"After completion only"
]
}
],
"week": 13,
"stage": "onboard"
},
{
"t": "Bunkering operation & tank monitoring",
"f": "Control the flow.",
"eq": [
"Tank soundings",
"High-level alarm",
"Communication radio"
],
"safe": "Agree an emergency stop signal with the barge before starting.",
"ref": "MARPOL I; company bunker procedure",
"chk": [
"Monitor soundings every 15–30 min",
"Test high-level alarm",
"Practise stop signal communication"
],
"q": [
{
"q": "Tank should not be filled beyond about…",
"o": [
"110%",
"50%",
"85–90%",
"100%"
]
},
{
"q": "If overflow is suspected you first…",
"o": [
"Run",
"Stop pumping (emergency stop)",
"Take photo",
"Call home"
]
}
],
"week": 14,
"stage": "onboard"
},
{
"t": "Purifiers I: principle & operation",
"f": "Clean fuel and oil.",
"eq": [
"HFO/MDO separators",
"LO purifier",
"Gravity disc"
],
"safe": "Never open a purifier bowl until it has completely stopped.",
"ref": "MARPOL Annex VI (fuel quality)",
"chk": [
"Identify purifier and clarifier",
"Read operating water pressure",
"Observe a desludge"
],
"q": [
{
"q": "Purifier separates fuel from…",
"o": [
"Paint",
"Steel",
"Air",
"Water and sludge"
]
},
{
"q": "Gravity disc size depends on…",
"o": [
"Time of day",
"Colour",
"Fuel density",
"Speed"
]
}
],
"week": 15,
"stage": "onboard"
},
{
"t": "Purifiers II: overhaul & alarms",
"f": "Maintenance basics.",
"eq": [
"Bowl discs",
"O-rings",
"Sludge tank"
],
"safe": "Use proper lifting tools — bowls are heavy and can crush fingers.",
"ref": "Maker manual; CSWP",
"chk": [
"Assist bowl cleaning",
"Inspect O-rings",
"Note common alarms"
],
"q": [
{
"q": "Seal water loss can cause…",
"o": [
"Fuel overflow to sludge",
"Nothing",
"Fire alarm only",
"Better cleaning"
]
},
{
"q": "After overhaul you should…",
"o": [
"Paint",
"Skip check",
"Leave",
"Test run and check for leaks"
]
}
],
"week": 16,
"stage": "onboard"
},
{
"t": "Air compressors & starting air",
"f": "Air starts the engine.",
"eq": [
"Main air compressors",
"Air receivers",
"Safety valves"
],
"safe": "Drain air receivers regularly; never work on pressurised lines.",
"ref": "SOLAS II-1; Class",
"chk": [
"Drain compressor intercoolers",
"Read receiver pressure (~30 bar)",
"Locate safety valves"
],
"q": [
{
"q": "Starting air receiver pressure is about…",
"o": [
"3 bar",
"30 bar",
"300 bar",
"1 bar"
]
},
{
"q": "Why drain receivers?",
"o": [
"Remove water/oil to prevent explosion & corrosion",
"Fuel",
"Cooling",
"Fun"
]
}
],
"week": 17,
"stage": "onboard"
},
{
"t": "Boilers & steam",
"f": "Steam safety.",
"eq": [
"Auxiliary boiler",
"Gauge glass",
"Boiler water test kit"
],
"safe": "Blow down gauge glass only with correct valve sequence and face shield.",
"ref": "Class rules; SOLAS II-1",
"chk": [
"Watch gauge glass blow-down",
"Do a boiler water chloride test",
"Record results"
],
"q": [
{
"q": "High chlorides in boiler water suggest…",
"o": [
"Nothing",
"Good",
"Sea water contamination",
"Low fuel"
]
},
{
"q": "Low water level in a boiler is…",
"o": [
"Normal",
"Dangerous — burner must trip",
"Better",
"Ignored"
]
}
],
"week": 18,
"stage": "onboard"
},
{
"t": "Fresh water generator & STP",
"f": "Water making and sewage.",
"eq": [
"Fresh water generator",
"Salinometer",
"Sewage treatment plant"
],
"safe": "FWG must not run within 20 nm of land (contaminated sea water).",
"ref": "MARPOL Annex IV",
"chk": [
"Read salinometer",
"Check STP blower",
"Trace sewage discharge line"
],
"q": [
{
"q": "Salinometer measures…",
"o": [
"Air",
"Oil",
"Fuel",
"Salt content of produced water"
]
},
{
"q": "Untreated sewage discharge is allowed…",
"o": [
"Never logged",
"Anywhere",
"Beyond 12 nm and underway, per Annex IV",
"In port"
]
}
],
"week": 19,
"stage": "onboard"
},
{
"t": "OWS & 15 ppm monitor",
"f": "Oily water rules.",
"eq": [
"Oily Water Separator",
"15 ppm monitor & 3-way valve",
"Oil Record Book I"
],
"safe": "Never bypass the OWS — 'magic pipe' is a criminal offence.",
"ref": "MARPOL Annex I Reg 14 & 17",
"chk": [
"Trace OWS overboard line",
"Test 15 ppm alarm with engineer",
"Read ORB Part I entry"
],
"q": [
{
"q": "OWS overboard limit is…",
"o": [
"15 ppm",
"50 ppm",
"0 ppm",
"100 ppm"
]
},
{
"q": "Bypassing the OWS is…",
"o": [
"Normal",
"Fine offshore",
"Allowed at night",
"A serious crime"
]
}
],
"week": 20,
"stage": "onboard"
},
{
"t": "Pumps & piping",
"f": "Understand the system plan.",
"eq": [
"Centrifugal pumps",
"Valves (gate, globe, butterfly, NRV)",
"Strainers"
],
"safe": "Before opening a strainer, isolate, depressurise and drain.",
"ref": "STCW A-III/1",
"chk": [
"Identify 4 valve types",
"Clean a strainer with engineer",
"Trace one system on the plan"
],
"q": [
{
"q": "A non-return valve allows flow…",
"o": [
"Both ways",
"One way only",
"None",
"Random"
]
},
{
"q": "Before opening a strainer you must…",
"o": [
"Isolate, depressurise, drain",
"Paint",
"Heat it",
"Hurry"
]
}
],
"week": 21,
"stage": "onboard"
},
{
"t": "Steering gear",
"f": "Steering safety.",
"eq": [
"Steering gear",
"Hydraulic pumps",
"Local control"
],
"safe": "During emergency steering follow bridge orders exactly via telephone/talkback.",
"ref": "SOLAS V/26",
"chk": [
"Locate local control & telephone",
"Check hydraulic oil level",
"Participate in steering drill"
],
"q": [
{
"q": "Steering gear test before departure within…",
"o": [
"Never",
"12 hours",
"1 week",
"1 month"
]
},
{
"q": "Emergency steering drill every…",
"o": [
"3 months",
"year",
"day",
"5 years"
]
}
],
"week": 22,
"stage": "onboard"
},
{
"t": "Blackout recovery",
"f": "Restore power safely.",
"eq": [
"Standby generator",
"Emergency switchboard",
"Preferential trips"
],
"safe": "In blackout, stay calm, follow the engineer, and use your torch.",
"ref": "SOLAS II-1",
"chk": [
"Read blackout procedure",
"Locate emergency switchboard",
"Walk recovery steps with engineer"
],
"q": [
{
"q": "After blackout, first priority is…",
"o": [
"Paint",
"Clean",
"Lunch",
"Restore power with standby generator"
]
},
{
"q": "Preferential trips shed…",
"o": [
"None",
"Essential loads",
"Non-essential loads",
"All"
]
}
],
"week": 23,
"stage": "onboard"
},
{
"t": "Fire in the engine room",
"f": "ER fire response.",
"eq": [
"Fixed CO2/foam system",
"Fire dampers",
"Emergency fire pump",
"Fuel quick-closing"
],
"safe": "Never release fixed CO2 before all personnel are counted out.",
"ref": "SOLAS II-2; FSS Code",
"chk": [
"Locate CO2 release station",
"Locate fire dampers & quick-closing",
"Participate in ER fire drill"
],
"q": [
{
"q": "Before CO2 release you must…",
"o": [
"Evacuate and count all personnel, close openings",
"Open doors",
"Start fans",
"Release immediately"
]
},
{
"q": "Quick-closing valves are operated…",
"o": [
"By cook",
"Never",
"Inside the ER only",
"From outside the space"
]
}
],
"week": 24,
"stage": "onboard"
},
{
"t": "Emergency drills & LSA",
"f": "Drill like it's real.",
"eq": [
"Lifeboat engine",
"Immersion suit",
"SCBA"
],
"safe": "Know your muster duty and be on time.",
"ref": "SOLAS III/19",
"chk": [
"Start lifeboat engine",
"Don immersion suit in 2 min",
"Check SCBA pressure"
],
"q": [
{
"q": "Lifeboat engine test interval?",
"o": [
"Weekly",
"Yearly",
"Never",
"Daily by shore"
]
},
{
"q": "SCBA cylinder full pressure approx…",
"o": [
"200–300 bar",
"2 bar",
"1000 bar",
"20 bar"
]
}
],
"week": 25,
"stage": "onboard"
},
{
"t": "MARPOL VI: fuel changeover & ECA",
"f": "Clean air rules.",
"eq": [
"Fuel changeover valves",
"Bunker delivery notes",
"ECA log"
],
"safe": "Complete changeover to compliant fuel before entering ECA and log it.",
"ref": "MARPOL Annex VI Reg 14 & 18",
"chk": [
"Read changeover procedure",
"Check BDN retention",
"Note ECA times in log"
],
"q": [
{
"q": "ECA sulphur limit?",
"o": [
"2%",
"0.1%",
"0.5%",
"3.5%"
]
},
{
"q": "BDNs are kept onboard for…",
"o": [
"1 month",
"3 years",
"1 week",
"Never"
]
}
],
"week": 26,
"stage": "onboard"
},
{
"t": "Planned maintenance system",
"f": "Maintenance by the book.",
"eq": [
"PMS software",
"Job cards",
"Spare parts store"
],
"safe": "Report completed jobs truthfully with running hours.",
"ref": "ISM Code 10",
"chk": [
"Open a PMS job card",
"Record running hours",
"Find a spare in the store"
],
"q": [
{
"q": "ISM Code element 10 covers…",
"o": [
"Wages",
"Cargo",
"Maintenance of ship and equipment",
"Food"
]
},
{
"q": "PMS record must include…",
"o": [
"Nothing",
"Weather",
"Work done, date, hours, by whom",
"Music"
]
}
],
"week": 27,
"stage": "onboard"
},
{
"t": "Port State & vetting inspections (ER)",
"f": "Engine room readiness.",
"eq": [
"ORB",
"Emergency equipment",
"Fire dampers"
],
"safe": "If unsure, say you will ask the responsible engineer.",
"ref": "Paris/Tokyo MOU; SIRE 2.0",
"chk": [
"Locate ORB and certificates",
"Explain quick-closing valves to mock inspector",
"Check emergency generator readiness"
],
"q": [
{
"q": "Most common ER PSC deficiency?",
"o": [
"Oily bilges/fire safety & OWS issues",
"Paint colour",
"Music",
"Clean floor"
]
},
{
"q": "When asked something unknown you…",
"o": [
"Hide",
"Leave",
"Guess",
"Refer to the responsible engineer"
]
}
],
"week": 28,
"stage": "onboard"
},
{
"t": "Engine room watchkeeping",
"f": "UMS & watch duties.",
"eq": [
"Alarm monitoring system",
"Engine logbook",
"Dead-man alarm"
],
"safe": "In UMS, the duty engineer must answer every alarm; never silence without checking.",
"ref": "STCW A-VIII/2 Part 3-2",
"chk": [
"Observe UMS handover checks",
"Make an engine log draft entry",
"Test dead-man alarm"
],
"q": [
{
"q": "Dead-man alarm protects…",
"o": [
"Cargo",
"The lone engineer on rounds",
"Fuel",
"Cook"
]
},
{
"q": "Alarms in UMS must be…",
"o": [
"Acknowledged and investigated",
"Disabled",
"Muted",
"Silenced and ignored"
]
}
],
"week": 29,
"stage": "onboard"
},
{
"t": "Watch handover (ER)",
"f": "Hand over properly.",
"eq": [
"Engine logbook",
"Chief Engineer's standing orders"
],
"safe": "Do not hand over during a manoeuvre or abnormal condition.",
"ref": "STCW A-VIII/2",
"chk": [
"Observe full ER handover",
"Read CE standing orders",
"List items to hand over"
],
"q": [
{
"q": "Handover must include…",
"o": [
"Weather only",
"Jokes",
"Machinery status, abnormal conditions, ongoing work",
"Nothing"
]
},
{
"q": "Standing orders are written by…",
"o": [
"Cadet",
"Chief Engineer",
"Cook",
"Agent"
]
}
],
"week": 30,
"stage": "onboard"
},
{
"t": "Troubleshooting basics",
"f": "Think like an engineer.",
"eq": [
"Trend logs",
"Exhaust temperatures",
"Maker manuals"
],
"safe": "Never guess on machinery — check manuals and ask.",
"ref": "STCW A-III/1",
"chk": [
"Compare exhaust temperatures across units",
"Read a maker troubleshooting table",
"Explain one past fault"
],
"q": [
{
"q": "High exhaust temperature on one cylinder may indicate…",
"o": [
"More speed",
"Nothing",
"Good",
"Faulty injector/fuel issue"
]
},
{
"q": "Best first source for troubleshooting?",
"o": [
"Cook",
"Social media",
"Maker manual and senior engineer",
"Guess"
]
}
],
"week": 31,
"stage": "onboard"
},
{
"t": "Final review & record book sign-off",
"f": "Show what you learned.",
"eq": [
"Training Record Book",
"Equipment passport"
],
"safe": "Only sign what you actually did — honesty protects your career.",
"ref": "STCW Reg III/1, A-III/1",
"chk": [
"Review all weeks",
"Show passport to Chief Engineer",
"Get officer sign-off"
],
"q": [
{
"q": "Who signs your engine record book?",
"o": [
"Supervising engineer/Chief Engineer",
"Anyone",
"Nobody",
"You"
]
},
{
"q": "Falsifying records can…",
"o": [
"Nothing",
"Get bonus",
"Help you",
"Cancel your certificate"
]
}
],
"week": 32,
"stage": "onboard"
}
]
};
export const CADET_WEEKS = 32;
export const stageLabel = (w: number) => w <= 4 ? "Shore induction" : `Onboard · Month ${Math.min(7, Math.ceil((w - 4) / 4))}`;
/** Cadet status band for trainers: overdue, weak score or on track. */
export const cadetFlag = (c: { status: string; overdue_days: number; avg_score: number | null; low_weeks: number }) =>
  c.status !== "active" ? "closed" : c.overdue_days > 7 ? "overdue" : (c.avg_score !== null && c.avg_score < 60) || c.low_weeks >= 2 ? "weak" : "ok";
