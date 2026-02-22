import type { TopicData } from "./DrillDownTopic";

export const SIRE_2_TOPIC: TopicData = {
  title: "SIRE 2.0 — New Tanker Inspection Standard",
  summary: "Mandatory since September 2024. Everything has changed. Tap to learn what inspectors look for now.",
  points: [
    {
      title: "What is SIRE 2.0",
      summary: "The completely new OCIMF inspection framework replacing the old SIRE questionnaire.",
      detail: {
        heading: "What is SIRE 2.0 — Complete Overview",
        intro: "SIRE 2.0 is the Oil Companies International Marine Forum (OCIMF) replacement for the original Ship Inspection Report Programme. It went mandatory in September 2024 and represents the biggest change to tanker vetting in 30 years.",
        sections: [
          {
            title: "Key Changes from Old SIRE",
            items: [
              "The old questionnaire-based system is gone — replaced by competence-based assessment",
              "Inspectors no longer just check if things are 'in place' — they observe how things are done",
              "Inspection reports are now digital with objective evidence requirements",
              "Reports include photos and detailed observations, not just yes/no answers",
              "Inspection scope is determined by a risk-based matrix, not a fixed checklist",
            ],
          },
          {
            title: "What This Means for Crew",
            items: [
              "You will be observed during actual operations — cargo, mooring, navigation",
              "Multiple crew members will be interviewed, not just the Master and Chief Officer",
              "Ratings and junior officers are now directly assessed",
              "You must demonstrate competence, not just show paperwork",
              "Your communication and teamwork are assessed alongside technical skills",
            ],
          },
        ],
        note: "SIRE 2.0 is not harder — it is different. Crews that work safely and communicate well will perform better than under the old system. The key is preparation and genuine competence, not memorising answers.",
      },
    },
    {
      title: "Four Question Areas",
      summary: "SIRE 2.0 inspectors assess four distinct areas during every inspection.",
      detail: {
        heading: "The Four Question Areas",
        intro: "Every SIRE 2.0 inspection is structured around four question types. Understanding these helps you know exactly what the inspector is looking for at any moment.",
        sections: [
          {
            title: "1. Hardware Questions",
            items: [
              "Is the equipment present, in good condition, and properly maintained?",
              "Are safety devices fitted and operational?",
              "Is there evidence of regular testing and maintenance records?",
              "Examples: mooring winch brakes, cargo valve condition, fire-fighting equipment",
            ],
          },
          {
            title: "2. Process Questions",
            items: [
              "Are documented procedures being followed correctly?",
              "Is the SMS being implemented as written?",
              "Are risk assessments completed before operations?",
              "Examples: cargo loading checklists, permit to work system, passage planning",
            ],
          },
          {
            title: "3. Human Factor Questions",
            items: [
              "Are crew communicating effectively during operations?",
              "Is there evidence of good teamwork and leadership?",
              "Are crew showing situational awareness?",
              "Examples: bridge team communication, cargo watch handovers, toolbox talks",
            ],
          },
          {
            title: "4. Demonstration Questions",
            items: [
              "Can crew physically demonstrate competence in tasks?",
              "Can they explain what they are doing and why?",
              "Can ratings demonstrate emergency duties confidently?",
              "Examples: operating cargo equipment, explaining emergency procedures, demonstrating firefighting knowledge",
            ],
          },
        ],
        note: "The inspector will move between these four areas fluidly. Don't try to guess which type of question is coming — focus on doing your job properly and explaining what you're doing clearly.",
      },
    },
    {
      title: "Human Factors Assessment",
      summary: "SIRE 2.0 places crew communication, fatigue, and just culture at the centre of inspections.",
      detail: {
        heading: "Human Factors — What Inspector Checks",
        intro: "SIRE 2.0 inspectors now spend significant time assessing the human element onboard. This is new and many crews are not prepared for it.",
        sections: [
          {
            title: "What Inspector Observes",
            items: [
              "Do officers communicate clearly and professionally with each other?",
              "Does the Master create an environment where crew can speak up safely?",
              "Are crew showing signs of fatigue — slow responses, errors in paperwork, difficulty concentrating?",
              "Is there evidence of a just culture — are near-misses reported or hidden?",
              "Do ratings understand their tasks and feel confident explaining them?",
            ],
          },
          {
            title: "What Inspector Asks Crew Directly",
            items: [
              "How long have you been on this vessel?",
              "When did you last have proper rest?",
              "If you saw something unsafe, would you feel comfortable reporting it?",
              "Can you explain your emergency duties?",
            ],
          },
          {
            title: "How to Prepare",
            items: [
              "Know your emergency duties completely — practice explaining them out loud",
              "Ensure your rest hour records accurately reflect actual rest taken",
              "If you are fatigued — report it. A ship that hides fatigue fails SIRE 2.0",
              "SeaMinds conversations about stress and fatigue are private and help you process what you are feeling before an inspection",
            ],
          },
        ],
        note: "Inspectors are not trying to trick you. They want to see a crew that is safe, rested, and well-led. Honest answers and calm confidence are your best preparation.",
      },
    },
    {
      title: "Bridge Inspection",
      summary: "Navigation safety, BRM, and passage planning under SIRE 2.0.",
      detail: {
        heading: "Bridge Inspection — What to Expect",
        intro: "The bridge inspection under SIRE 2.0 goes far beyond checking equipment. Inspectors will observe bridge operations live and assess Bridge Resource Management in practice.",
        sections: [
          {
            title: "Equipment and Systems Checked",
            items: [
              "ECDIS — proper use, chart updates, route planning, backup arrangements",
              "Radar/ARPA — performance checks, tuning, target tracking",
              "AIS — operating correctly, data entries accurate",
              "GMDSS — equipment tests, distress procedures knowledge",
              "VDR — recording properly, crew aware of data retention requirements",
            ],
          },
          {
            title: "Bridge Team Operations",
            items: [
              "Is the OOW maintaining a proper lookout?",
              "Are bridge team communications clear and professional?",
              "Is the Master involved in critical navigation decisions?",
              "Are standing orders and night orders being followed?",
              "Is the passage plan monitored and adjusted as conditions change?",
            ],
          },
          {
            title: "Common Failures",
            items: [
              "OOW distracted by phone or paperwork during watch",
              "No evidence of bridge team communication during manoeuvres",
              "Passage plan exists but crew cannot explain key waypoints or hazards",
              "ECDIS safety settings not properly configured for the voyage",
              "Crew cannot demonstrate GMDSS distress procedures",
            ],
          },
        ],
        note: "The bridge inspection is where human factors and technical competence intersect. An OOW who communicates clearly and monitors the passage plan actively will always perform well.",
      },
    },
    {
      title: "Engine Room Inspection",
      summary: "ERRM, safety systems, and operational competence in the engine room.",
      detail: {
        heading: "Engine Room Inspection — What to Expect",
        intro: "Engine room inspections under SIRE 2.0 focus on Engine Room Resource Management (ERRM) and whether engineering crew can demonstrate operational competence, not just show maintenance records.",
        sections: [
          {
            title: "Systems and Equipment",
            items: [
              "Oily water separator — operation, 15 ppm alarm, oil content monitor calibration",
              "Fire detection and fixed fire-fighting systems — tested and crew can operate",
              "Emergency generator — start procedure, load test records",
              "Steering gear — changeover procedures, emergency steering drill evidence",
              "Fuel oil changeover records for ECA/SECA compliance",
            ],
          },
          {
            title: "Engineering Crew Competence",
            items: [
              "Can the engineer on watch explain current machinery status?",
              "Are alarm response procedures known and practiced?",
              "Is the planned maintenance system up to date and realistic?",
              "Can crew demonstrate bilge system and ballast system operations?",
              "Are toolbox talks and risk assessments done before maintenance?",
            ],
          },
          {
            title: "Common Failures",
            items: [
              "OWS bypassed or not operational — zero tolerance finding",
              "Crew cannot explain emergency procedures for engine room flooding or fire",
              "Maintenance records show tasks overdue by weeks or months",
              "Engineers unable to explain fuel changeover procedures for emission control areas",
              "No evidence of ERRM — engineers working in isolation without communication",
            ],
          },
        ],
        note: "A well-maintained engine room with competent, communicating engineers will always score well. Focus on knowing your systems and being able to explain them clearly.",
      },
    },
    {
      title: "Cargo Operations",
      summary: "How inspectors assess cargo handling competence on tankers.",
      detail: {
        heading: "Cargo Operations — Tanker Inspection",
        intro: "Cargo operations are the heart of tanker vetting. Under SIRE 2.0, inspectors don't just check paperwork — they observe actual cargo operations and interview cargo watch officers and ratings.",
        sections: [
          {
            title: "What Inspector Observes During Operations",
            items: [
              "Cargo watch changeover — is it structured and thorough?",
              "Communication between deck and CCR — clear and professional?",
              "Monitoring of cargo parameters — pressures, temperatures, levels",
              "Valve line-ups checked and confirmed before transfers",
              "PPE usage during cargo operations — not just available, but worn correctly",
            ],
          },
          {
            title: "Documentation and Procedures",
            items: [
              "Ship/shore safety checklist completed properly, not just ticked",
              "Cargo plan reflects actual operations and is understood by cargo team",
              "Enclosed space entry procedures for pump rooms and cargo tanks",
              "Tank cleaning procedures and wall wash standards (chemical tankers)",
              "Inert gas system operation and monitoring records",
            ],
          },
          {
            title: "Crew Competence Assessment",
            items: [
              "Can the duty officer explain the current cargo operation?",
              "Do ratings understand cargo hazards and emergency procedures?",
              "Can crew demonstrate operation of cargo equipment?",
              "Is there evidence of pre-operation toolbox talks?",
              "Can crew explain what to do if a cargo spill occurs?",
            ],
          },
        ],
        note: "The best preparation for a cargo inspection is doing your cargo operations properly every single time — not just when an inspector might be watching. SIRE 2.0 inspectors are experienced mariners who can tell the difference.",
      },
    },
    {
      title: "How to Prepare",
      summary: "Practical steps for your crew to be ready for a SIRE 2.0 inspection.",
      detail: {
        heading: "How to Prepare for SIRE 2.0",
        intro: "Preparation for SIRE 2.0 is fundamentally different from the old system. You cannot memorise answers from a questionnaire. Instead, focus on genuine competence and communication.",
        sections: [
          {
            title: "Before the Inspection",
            items: [
              "Ensure all crew know their emergency duties and can explain them confidently",
              "Review rest hour records — they must reflect actual rest, not fictional compliance",
              "Practice explaining your job to someone unfamiliar — this is what the inspector expects",
              "Check that all safety equipment is in working order, not just documented as such",
              "Ensure the SMS reflects actual practice onboard, not an idealised version",
            ],
          },
          {
            title: "During the Inspection",
            items: [
              "Be honest — inspectors are experienced seafarers, they can tell when you're rehearsed",
              "If you don't know something, say so — it's better than guessing incorrectly",
              "Communicate naturally with your team — don't go silent because an inspector is present",
              "Continue normal operations — the inspector wants to see real work, not a performance",
              "If asked about fatigue or stress, answer truthfully — this is protected information",
            ],
          },
          {
            title: "Common Mistakes to Avoid",
            items: [
              "Don't try to memorise scripted answers — SIRE 2.0 doesn't use a fixed questionnaire",
              "Don't hide problems — a ship that reports and manages issues scores better than one that hides them",
              "Don't let only the Master and Chief Officer speak — inspectors will talk to everyone",
              "Don't falsify rest hour records — this is the fastest way to fail",
              "Don't panic — if your ship operates safely day-to-day, you are already prepared",
            ],
          },
        ],
        note: "SIRE 2.0 rewards genuine safety culture. If your ship operates safely and your crew communicates well every day, you are already 80% prepared. Focus on the remaining 20% — knowing your emergency duties, maintaining accurate records, and being able to explain your work clearly.",
      },
    },
  ],
};

export const PSC_USCG_TOPIC: TopicData = {
  title: "USCG — United States Coast Guard",
  summary: "PSC inspections for all foreign vessels entering US ports. Zero tolerance on security and safety.",
  points: [
    {
      title: "What USCG Inspects",
      summary: "Structural, safety, crew, environmental, and security compliance checks.",
      detail: {
        heading: "USCG Inspection Scope",
        intro: "The USCG inspects all foreign-flagged vessels entering US ports under Port State Control authority. US inspections are among the most rigorous globally.",
        sections: [
          { title: "Core Areas", items: ["Structural integrity and hull condition", "Fire safety systems and drills — live demonstrations often required", "Life-saving appliances — lifeboats, EPIRB, SART testing", "Crew certifications — STCW compliance verified individually", "MARPOL compliance — oil record book, garbage management plan, sewage"] },
          { title: "Security Focus", items: ["MTSA (Maritime Transportation Security Act) compliance", "Cyber security awareness and procedures — increasingly important", "ISPS Code verification — access control, security plan knowledge", "Crew security awareness — ability to explain security levels and duties"] },
        ],
        note: "USCG inspectors have more authority than most PSC regimes. They can and do detain vessels, ban them from US waters, and impose civil penalties.",
      },
    },
    {
      title: "Current Focus Areas 2024–25",
      summary: "Cyber security, fatigue management, and ballast water compliance dominate.",
      detail: {
        heading: "USCG Current Priorities",
        intro: "USCG inspection priorities shift annually based on casualty data, policy changes, and international developments.",
        sections: [
          { title: "Priority Areas", items: ["Cyber security — vessels must demonstrate cyber risk management in SMS", "Crew fatigue — rest hour records scrutinised heavily, cross-checked with operations", "Ballast water management systems — compliance deadline enforcement", "Enclosed space entry — post-incident focus after multiple fatalities", "STCW Manila amendments — crew competency verification beyond certificates"] },
          { title: "Emerging Concerns", items: ["Alternative fuel safety — LNG/methanol bunkering procedures", "Autonomous systems integration and crew training", "Mental health awareness — not yet mandatory but increasingly observed"] },
        ],
        note: "Cyber security is the fastest-growing area of USCG focus. Ensure your vessel has a cyber risk management plan in the SMS and crew can explain basic cyber hygiene procedures.",
      },
    },
    {
      title: "Top Deficiencies",
      summary: "Fire safety, lifesaving equipment, and ISM failures lead the list.",
      detail: {
        heading: "Most Common USCG Deficiencies",
        intro: "These are the deficiencies most frequently found by USCG inspectors. Addressing these before arrival dramatically reduces detention risk.",
        sections: [
          { title: "Top 5 Deficiencies", items: ["Fire safety — expired extinguishers, fire doors not self-closing, detection system faults", "Lifesaving equipment — lifeboat fall wire condition, EPIRB registration errors", "ISM Code — crew unable to demonstrate SMS knowledge, non-conformities not closed", "MARPOL Annex I — oil record book discrepancies, OWS not operational", "MLC — rest hour violations, wage payment irregularities"] },
          { title: "How to Avoid Detention", items: ["Complete a thorough self-inspection 48 hours before arrival", "Ensure all fire extinguishers are in date and fire doors self-close properly", "Test all GMDSS equipment and record results", "Review oil record book entries for consistency with sounding logs", "Verify all crew certificates are valid and carried onboard"] },
        ],
        note: "A single serious deficiency can lead to detention. Multiple minor deficiencies can combine to create a detainable condition. Prevention is always better than corrective action in port.",
      },
    },
    {
      title: "Crew Interview Tips",
      summary: "What USCG inspectors ask crew members directly and how to respond.",
      detail: {
        heading: "USCG Crew Interview — What to Expect",
        intro: "USCG inspectors regularly interview crew members at all levels. Your responses can make or break an inspection.",
        sections: [
          { title: "Common Questions", items: ["What are your emergency duties? (muster list assignment)", "Where is the nearest fire extinguisher and how do you use it?", "What is the vessel's security level and what does it mean?", "How do you report an oil spill?", "When did you last participate in a fire/abandon ship drill?"] },
          { title: "How to Answer Well", items: ["Answer honestly and calmly — don't rush or appear rehearsed", "If you don't understand the question, ask the inspector to repeat it", "Point to actual equipment when explaining — show, don't just tell", "Know your muster list duties — practice explaining them out loud", "Be familiar with SOPEP procedures for your specific role"] },
        ],
        note: "Inspectors are not trying to fail you. They want to confirm that crew are competent and the safety management system works in practice. Calm, honest answers demonstrate a well-run ship.",
      },
    },
    {
      title: "Detention Consequences",
      summary: "What happens if your vessel is detained by the USCG.",
      detail: {
        heading: "USCG Detention — What Happens Next",
        intro: "A USCG detention is one of the most serious events for any vessel operator. Understanding the process helps you appreciate why prevention matters.",
        sections: [
          { title: "Immediate Consequences", items: ["Vessel cannot sail until all deficiencies are rectified to USCG satisfaction", "Detention is publicly recorded and visible to all charterers and vetting systems", "Owner/operator faces significant financial costs — port fees, surveys, repairs", "Crew may be interviewed individually as part of expanded inspection", "Flag state is notified and may conduct its own investigation"] },
          { title: "Long-term Impact", items: ["Vessel's targeting score increases — more frequent inspections for 2+ years", "Company reputation affected across all vessels in the fleet", "Charterers may refuse to hire vessels from the same operator", "Insurance premiums may increase", "Multiple detentions can lead to banning from US waters"] },
        ],
        note: "Prevention is everything. A well-maintained ship with competent crew will not be detained. The cost of proper maintenance and training is always less than the cost of a single detention.",
      },
    },
  ],
};

export const PSC_AMSA_TOPIC: TopicData = {
  title: "AMSA — Australian Maritime Safety",
  summary: "Australian inspections with unique biosecurity requirements and environmental focus.",
  points: [
    {
      title: "What AMSA Inspects",
      summary: "Safety, navigation, pollution prevention, and biosecurity compliance.",
      detail: {
        heading: "AMSA Inspection Scope",
        intro: "AMSA inspects all foreign vessels entering Australian waters with particular emphasis on environmental protection, especially near the Great Barrier Reef.",
        sections: [
          { title: "Core Areas", items: ["Structural safety and seaworthiness", "Navigation equipment — Australian waters charts must be current", "Pollution prevention — especially in reef and sensitive marine zones", "Crew welfare and MLC compliance — accommodation, food, medical", "Cargo securing and dangerous goods documentation", "Biosecurity compliance — unique to Australia, strictly enforced"] },
        ],
        note: "Australia has some of the strictest environmental requirements globally. Vessels transiting near the Great Barrier Reef face additional scrutiny.",
      },
    },
    {
      title: "Current Focus Areas 2024–25",
      summary: "Fire safety CIC, crew mental health, and IMSBC Code compliance.",
      detail: {
        heading: "AMSA Current Priorities",
        intro: "AMSA actively participates in Concentrated Inspection Campaigns and adds its own regional focus areas.",
        sections: [
          { title: "Priority Areas", items: ["CIC on SOLAS Chapter II-2 fire safety — aligned with global campaign", "Crew mental health and welfare — expanded MLC checks beyond minimum", "Environmental compliance in sensitive marine areas — zero tolerance", "Ballast water management — strict enforcement near reef areas", "IMSBC Code compliance for bulk carriers loading in Australia"] },
        ],
        note: "If you are loading bulk cargo in Australia, IMSBC Code compliance is critical. AMSA takes liquefying cargo risks extremely seriously after historical capsize incidents.",
      },
    },
    {
      title: "Top Deficiencies",
      summary: "Fire safety systems, navigation, and MLC rest hour non-compliance.",
      detail: {
        heading: "Most Common AMSA Deficiencies",
        intro: "These deficiencies are most frequently recorded by AMSA inspectors across all vessel types.",
        sections: [
          { title: "Top 5 Deficiencies", items: ["Fire safety — detection and suppression system faults", "Safety of navigation — passage planning and chart updates for Australian waters", "MLC — crew hours of rest non-compliance", "ISM — non-conformities in safety management systems", "Structural deficiencies — corrosion and wastage in tanks and void spaces"] },
          { title: "Prevention", items: ["Update all Australian waters charts before arrival", "Ensure fire detection systems are fully operational in all spaces", "Verify rest hour records are accurate and compliant for the preceding 7 days", "Complete biosecurity declaration accurately — false declarations lead to penalties", "Check structural condition of ballast tanks and void spaces"] },
        ],
        note: "AMSA publishes its inspection results publicly. A poor record with AMSA affects your vessel's targeting score across all port state control regimes.",
      },
    },
    {
      title: "Biosecurity Requirements",
      summary: "Unique Australian requirements for biofouling, ballast water, and cargo contamination.",
      detail: {
        heading: "Australian Biosecurity — Critical Requirements",
        intro: "Australia has unique and strictly enforced biosecurity requirements that don't exist in other PSC regimes. Non-compliance can result in vessel exclusion from Australian waters.",
        sections: [
          { title: "What You Must Do", items: ["Complete pre-arrival biosecurity declaration accurately", "Maintain biofouling management plan and record book", "Ballast water exchange or treatment must comply with Australian standards", "Cargo holds must be free from soil, seeds, and animal/plant contamination", "Report any biosecurity risk material found onboard immediately"] },
          { title: "Common Failures", items: ["Incomplete or inaccurate biosecurity declarations", "Evidence of marine growth on hull beyond acceptable thresholds", "Ballast water management records incomplete or inconsistent", "Cargo contamination with seeds, insects, or soil", "Failure to report biosecurity risk material"] },
        ],
        note: "Australian biosecurity fines are significant and can include vessel detention. Take the biosecurity declaration seriously — it is not just paperwork.",
      },
    },
    {
      title: "Crew Welfare Focus",
      summary: "AMSA leads on crew mental health and welfare inspections beyond MLC minimums.",
      detail: {
        heading: "AMSA Crew Welfare Inspections",
        intro: "AMSA has expanded its crew welfare inspections beyond the MLC minimum requirements, with particular attention to mental health and wellbeing.",
        sections: [
          { title: "What AMSA Checks", items: ["Accommodation standards — cleanliness, ventilation, heating/cooling, privacy", "Food quality and quantity — inspectors may check galley and provisions", "Access to communication — internet, phone access for crew", "Medical supplies — chest contents, first aid training records", "Recreation facilities — crew lounge, exercise equipment, entertainment"] },
          { title: "Mental Health Focus", items: ["Evidence of welfare programs or mental health awareness onboard", "Access to confidential support services — helplines, welfare contacts", "Shore leave arrangements — are crew actually getting shore leave?", "Contract duration — are crew on excessively long contracts?", "General crew morale — inspectors observe crew interactions and demeanour"] },
        ],
        note: "AMSA genuinely cares about crew welfare. If you have concerns about conditions onboard, AMSA inspectors are approachable and complaints are treated confidentially under the MLC.",
      },
    },
  ],
};

export const PSC_PARIS_MOU_TOPIC: TopicData = {
  title: "Paris MOU — Europe & Canada",
  summary: "27 maritime administrations with harmonised inspection standards and EU environmental rules.",
  points: [
    {
      title: "What Paris MOU Inspects",
      summary: "SOLAS, MARPOL, STCW, MLC, ISM/ISPS — comprehensive convention compliance.",
      detail: {
        heading: "Paris MOU Inspection Scope",
        intro: "Paris MOU covers 27 maritime administrations across Europe and Canada, providing one of the most comprehensive PSC regimes globally.",
        sections: [
          { title: "Core Areas", items: ["SOLAS safety equipment and structural condition", "MARPOL pollution prevention — all annexes", "STCW crew qualifications and certification", "MLC 2006 seafarer working and living conditions", "ISM/ISPS Code implementation and evidence", "Load line and tonnage compliance"] },
        ],
        note: "Paris MOU uses a ship risk profile (SRP) system to target inspections. High-risk vessels face mandatory expanded inspections every 5-6 months.",
      },
    },
    {
      title: "Current Focus Areas 2024–25",
      summary: "ECDIS navigation, EU carbon reporting, and enhanced MLC welfare checks.",
      detail: {
        heading: "Paris MOU Current Priorities",
        intro: "European PSC is heavily influenced by EU environmental regulations and global CIC campaigns.",
        sections: [
          { title: "Priority Areas", items: ["CIC 2024 — Safety of navigation including ECDIS familiarisation", "EU MRV / IMO DCS — carbon intensity reporting compliance", "EU ETS — fuel oil sulphur content and emissions trading compliance", "MLC amendments 2024 — enhanced crew welfare and connectivity checks", "Cyber risk management integration into SMS"] },
        ],
        note: "EU ETS and environmental regulations add complexity for vessels trading in European waters. Ensure your vessel's emissions monitoring plan is current and crew understand the requirements.",
      },
    },
    {
      title: "Top Deficiencies",
      summary: "Fire safety, lifesaving, navigation, MLC, and ISM lead European findings.",
      detail: {
        heading: "Most Common Paris MOU Deficiencies",
        intro: "Paris MOU publishes detailed annual statistics. These deficiency categories consistently rank highest.",
        sections: [
          { title: "Top 5 Deficiencies", items: ["Fire safety — detection, structural protection, and fire-fighting equipment", "Life-saving appliances — maintenance of launching appliances and servicing", "Safety of navigation — ECDIS familiarisation and chart updating", "MLC — seafarer employment agreements and wage documentation", "ISM — objective evidence of SMS non-conformities not addressed"] },
          { title: "Prevention", items: ["Ensure ECDIS familiarisation records are complete for all bridge officers", "Verify lifeboat launching appliance maintenance is current", "Check all fire detection zones are operational", "Review SEA terms against MLC requirements", "Close all ISM non-conformities with documented evidence"] },
        ],
        note: "Paris MOU has a 'New Inspection Regime' (NIR) that rewards good performance with less frequent inspections. Maintaining a clean record saves time and money.",
      },
    },
    {
      title: "EU Environmental Rules",
      summary: "EU ETS, sulphur regulations, and carbon intensity rules affecting vessels in European waters.",
      detail: {
        heading: "EU Environmental Compliance",
        intro: "Vessels trading in European waters face additional environmental regulations beyond standard MARPOL requirements.",
        sections: [
          { title: "Key Regulations", items: ["EU ETS — Emissions Trading System now covers maritime shipping", "Fuel sulphur limit — 0.1% in SECAs, 0.5% globally", "EU MRV — Monitoring, Reporting, Verification of CO2 emissions", "CII — Carbon Intensity Indicator rating affects commercial viability", "Ballast water management — IMO convention fully enforced"] },
          { title: "Crew Responsibilities", items: ["Understand fuel changeover procedures for emission control areas", "Maintain accurate fuel consumption and emissions records", "Know the vessel's CII rating and what it means", "Be aware of ETS reporting requirements", "Report any fuel system issues that could affect emissions compliance"] },
        ],
        note: "Environmental non-compliance in European waters can result in significant fines for the company and operational restrictions for the vessel. This area is growing rapidly in importance.",
      },
    },
    {
      title: "Ship Risk Profile",
      summary: "How Paris MOU targets vessels for inspection and what affects your risk score.",
      detail: {
        heading: "Paris MOU Ship Risk Profile (SRP)",
        intro: "Paris MOU uses a sophisticated targeting system to identify which vessels receive priority inspections. Understanding this helps you understand why some ships are inspected more than others.",
        sections: [
          { title: "Factors That Increase Risk Score", items: ["Flag state — grey or black list flags face more inspections", "Recognised organisation (class) performance record", "Company performance — deficiency history across the fleet", "Ship age — older vessels receive more scrutiny", "Previous detention history — recent detentions significantly increase targeting", "Ship type — certain vessel types face additional focus"] },
          { title: "How to Improve Your Score", items: ["Maintain a clean inspection record — every inspection counts", "Address all deficiencies promptly and document corrections", "Ensure company maintains good performance across the fleet", "Keep vessel well-maintained — first impressions matter", "Consider voluntary inspections during quiet periods to build a positive record"] },
        ],
        note: "Your vessel's risk profile is publicly available. Charterers and vetting teams check this before fixing. A low-risk profile is a commercial advantage.",
      },
    },
  ],
};

export const PSC_TOKYO_MOU_TOPIC: TopicData = {
  title: "Tokyo MOU — Asia Pacific",
  summary: "21 member authorities covering the busiest shipping region in the world.",
  points: [
    {
      title: "What Tokyo MOU Inspects",
      summary: "Ship structure, manning, working conditions, ISM, ISPS, and environmental compliance.",
      detail: {
        heading: "Tokyo MOU Inspection Scope",
        intro: "Tokyo MOU covers 21 member authorities in the Asia-Pacific region, the world's busiest shipping area.",
        sections: [
          { title: "Core Areas", items: ["Ship structure and equipment condition", "Manning and crew certification — STCW compliance", "Working and living conditions — MLC 2006", "Safety management — ISM Code implementation", "Security — ISPS Code compliance", "Environmental compliance — MARPOL, BWM Convention"] },
        ],
        note: "Tokyo MOU cooperates closely with Paris MOU on joint Concentrated Inspection Campaigns, meaning inspection focus areas are often aligned globally.",
      },
    },
    {
      title: "Current Focus Areas 2024–25",
      summary: "Joint fire safety CIC, bulk carrier safety, and EEXI/CII compliance.",
      detail: {
        heading: "Tokyo MOU Current Priorities",
        intro: "Tokyo MOU aligns many of its priorities with Paris MOU while adding regional focus on bulk carrier and tanker safety.",
        sections: [
          { title: "Priority Areas", items: ["Joint CIC with Paris MOU on fire safety", "Concentrated efforts on bulk carrier safety — structural and cargo", "Enhanced focus on tanker operational safety", "MLC compliance — particular focus on crew wages and repatriation", "EEXI/CII compliance verification — energy efficiency requirements"] },
        ],
        note: "Asia-Pacific ports handle enormous volumes of bulk cargo. Bulk carrier safety remains a persistent focus area given the historical casualty record.",
      },
    },
    {
      title: "Top Deficiencies",
      summary: "Fire safety, lifesaving, navigation, MARPOL, and labour conditions.",
      detail: {
        heading: "Most Common Tokyo MOU Deficiencies",
        intro: "Tokyo MOU deficiency patterns largely mirror global trends with some regional variations.",
        sections: [
          { title: "Top 5 Deficiencies", items: ["Fire safety — detection systems and fire-fighting equipment", "Life-saving appliances and arrangements — servicing and condition", "Safety of navigation equipment — radar, ECDIS issues", "MARPOL — oil filtering equipment, sewage treatment plant faults", "Labour conditions — hours of rest violations, wage documentation"] },
          { title: "Regional Considerations", items: ["High port turnover means inspections can be rapid — be always ready", "Language barriers may affect interviews — prepare key safety terms in English", "Some ports have limited repair facilities if detained", "Tropical conditions mean corrosion and maintenance are ongoing challenges", "Crew changes often happen in this region — ensure new crew are familiarised"] },
        ],
        note: "The speed of port operations in Asia means you may have very little notice before an inspection. Being permanently prepared is essential in this region.",
      },
    },
    {
      title: "Bulk Carrier Safety Focus",
      summary: "Structural integrity, cargo hold condition, and IMSBC Code compliance.",
      detail: {
        heading: "Tokyo MOU — Bulk Carrier Priority",
        intro: "Bulk carrier safety is a particular priority for Tokyo MOU given the high volume of bulk cargo trade in the Asia-Pacific region.",
        sections: [
          { title: "What Inspectors Focus On", items: ["Cargo hold structural condition — frame and floor wastage measurements", "Hatch cover weathertightness — ultrasonic testing may be required", "Cargo loading plan compliance with approved stability conditions", "Ventilation arrangements for cargoes that may emit gases", "Fire detection in cargo holds — especially for coal and DRI cargoes"] },
          { title: "IMSBC Code Compliance", items: ["Shipper's declaration for each cargo — is it complete and accurate?", "Moisture content certificates for Group A cargoes", "Master's right to refuse cargo if TML is exceeded — documented?", "Can testing procedures — visual assessment before and during loading", "Cargo monitoring requirements during voyage — trim, temperature, water ingress"] },
        ],
        note: "Bulk carrier losses due to cargo liquefaction remain a serious concern. Know your rights under the IMSBC Code — the Master has the right and duty to refuse cargo that exceeds the Transportable Moisture Limit.",
      },
    },
    {
      title: "Crew Wage and Repatriation",
      summary: "MLC wage documentation and repatriation rights — a regional focus area.",
      detail: {
        heading: "Wages and Repatriation in Asia-Pacific",
        intro: "Tokyo MOU places particular emphasis on MLC wage and repatriation compliance, reflecting the large number of crew changes and employment issues in the region.",
        sections: [
          { title: "What Inspectors Check", items: ["Seafarer Employment Agreements — terms match MLC requirements", "Wage payments — regular, documented, and at least at ILO minimum", "Allotment arrangements — crew can send money home reliably", "Repatriation provisions — financial security if company fails", "Maximum contract duration — MLC limits continuous service to 11 months"] },
          { title: "Your Rights", items: ["You have the right to receive wages at least monthly", "You have the right to repatriation at the end of your contract or after 11 months", "You have the right to make a complaint without retaliation", "You have the right to keep your passport and personal documents", "If your company cannot repatriate you, the flag state must arrange it"] },
        ],
        note: "If you are experiencing wage issues or cannot be repatriated, contact the ITF or the port state control authority. These are your legal rights under the MLC, not favours.",
      },
    },
  ],
};

export const PSC_INDIAN_OCEAN_TOPIC: TopicData = {
  title: "Indian Ocean MOU",
  summary: "Covers maritime administrations around the Indian Ocean region with focus on aging fleet.",
  points: [
    {
      title: "What Indian Ocean MOU Inspects",
      summary: "SOLAS, MARPOL, STCW, MLC, and structural condition of aging vessels.",
      detail: {
        heading: "Indian Ocean MOU Inspection Scope",
        intro: "Indian Ocean MOU covers maritime administrations around the Indian Ocean region where fleet age and certification integrity are key concerns.",
        sections: [
          { title: "Core Areas", items: ["SOLAS conventions compliance — safety equipment and systems", "MARPOL environmental standards — oil record book, waste management", "STCW seafarer certification — focus on verification of authenticity", "MLC 2006 working and living conditions", "Load lines and stability — particularly for older vessels", "Tonnage measurement compliance"] },
        ],
        note: "The Indian Ocean region sees a higher proportion of older vessels, which means structural condition and equipment maintenance are critical focus areas.",
      },
    },
    {
      title: "Current Focus Areas 2024–25",
      summary: "Structural integrity, certificate verification, and basic safety equipment.",
      detail: {
        heading: "Indian Ocean MOU Priorities",
        intro: "Focus areas reflect the regional fleet profile and common issues encountered during inspections.",
        sections: [
          { title: "Priority Areas", items: ["Structural integrity of aging fleet — corrosion, wastage, steel renewals", "Crew certification verification — focus on detecting fraudulent certificates", "Oil record book and MARPOL Annex I compliance", "Basic safety equipment maintenance — fire, LSA functionality", "MLC — food quality, catering standards, medical supplies aboard"] },
        ],
        note: "Certificate fraud is a real concern in this region. Ensure all your certificates are genuine, properly endorsed, and you can demonstrate the competencies they certify.",
      },
    },
    {
      title: "Top Deficiencies",
      summary: "Structural safety, fire equipment, lifesaving, crew certificates, and MARPOL violations.",
      detail: {
        heading: "Most Common Indian Ocean MOU Deficiencies",
        intro: "These deficiencies reflect the regional fleet characteristics and inspection priorities.",
        sections: [
          { title: "Top 5 Deficiencies", items: ["Structural safety — hull corrosion, tank wastage, deck deterioration", "Fire safety equipment — expired extinguishers, inoperable systems", "Life-saving appliances — poor maintenance, unserviced equipment", "Crew certification — invalid, expired, or missing certificates", "MARPOL violations — inadequate pollution prevention equipment and records"] },
          { title: "Prevention", items: ["Conduct regular structural inspections of tanks and void spaces", "Maintain a strict fire equipment maintenance schedule", "Service all lifesaving appliances per manufacturer requirements", "Carry original certificates with valid endorsements", "Keep oil record book entries accurate and consistent"] },
        ],
        note: "Many of these deficiencies are preventable with proper planned maintenance. A well-maintained vessel stands out positively in this region.",
      },
    },
    {
      title: "Certificate Verification",
      summary: "How inspectors check certificate authenticity and what to do if questioned.",
      detail: {
        heading: "Certificate Verification Process",
        intro: "Indian Ocean MOU inspectors place significant emphasis on verifying the authenticity of crew certificates, reflecting concerns about fraudulent documentation in the region.",
        sections: [
          { title: "What Inspectors Check", items: ["Certificate numbers verified against issuing authority databases", "Endorsement validity — flag state endorsements must be current", "STCW competency matching — certificate level must match position onboard", "Medical certificate validity — must be current and from approved physician", "Tanker endorsements, GMDSS certificates, and specialized training evidence"] },
          { title: "How to Prepare", items: ["Carry original certificates at all times — copies are not accepted", "Ensure all endorsements are current and properly issued", "Know your certificate numbers and issuing dates", "Be prepared to demonstrate competencies listed on your certificates", "If your certificate is questioned, remain calm and provide supporting evidence"] },
        ],
        note: "If you hold genuine certificates, you have nothing to worry about. If you are aware of certificate fraud onboard, you should report it confidentially — fraudulent certificates endanger everyone's safety.",
      },
    },
    {
      title: "Food and Living Standards",
      summary: "MLC food quality, catering, and accommodation inspections in the Indian Ocean region.",
      detail: {
        heading: "Food and Living Conditions Onboard",
        intro: "MLC food and catering standards are a particular focus in the Indian Ocean region, where provisioning quality and storage conditions can be challenging.",
        sections: [
          { title: "What Inspectors Check", items: ["Food storage — temperature control in fridges and freezers", "Galley hygiene — cleanliness, pest control, food handling", "Quality and variety of provisions — adequate for voyage duration", "Drinking water quality — testing records and treatment systems", "Crew mess room condition — cleanliness, seating, ventilation"] },
          { title: "Your Rights", items: ["You have the right to adequate food and drinking water at no cost", "Food must be of appropriate quality, quantity, and nutritional value", "The ship must carry qualified cook if more than 10 crew", "You can complain about food quality without retaliation", "Cultural and religious dietary needs should be accommodated where possible"] },
        ],
        note: "Good food and clean living conditions are not luxuries — they are your legal rights under the MLC. If conditions are inadequate, report them to the Master first, then to the port state or ITF if not resolved.",
      },
    },
  ],
};

export const PSC_ITF_TOPIC: TopicData = {
  title: "ITF Inspections",
  summary: "International Transport Workers' Federation focuses on crew welfare and labour rights.",
  points: [
    {
      title: "What ITF Inspects",
      summary: "Contracts, wages, rest hours, food, accommodation, and repatriation rights.",
      detail: {
        heading: "ITF Inspection Focus",
        intro: "ITF inspectors focus exclusively on seafarer welfare and labour rights. They are not government inspectors but have significant influence and can involve port state authorities.",
        sections: [
          { title: "Core Areas", items: ["Seafarer Employment Agreements — comparing your contract to CBA minimums", "Wage payments — are you receiving what your contract and CBA specify?", "Hours of work and rest — actual compliance, not just records", "Food quality and provisions — adequate for voyage length and crew size", "Accommodation and living conditions — meeting MLC standards", "Repatriation rights and financial security arrangements"] },
        ],
        note: "ITF inspectors are on your side. Their job is to protect seafarers. Contacting them is your right and is always confidential.",
      },
    },
    {
      title: "Wage Theft and Underpayment",
      summary: "How ITF identifies and recovers unpaid or underpaid wages for seafarers.",
      detail: {
        heading: "Wage Protection — Your Rights",
        intro: "Wage theft remains one of the most common issues facing seafarers. ITF has recovered over $50 million in unpaid wages annually.",
        sections: [
          { title: "Warning Signs", items: ["Wages consistently paid late or irregularly", "Deductions you don't understand or didn't agree to", "Being paid less than your signed contract specifies", "Different terms at embarkation than what was agreed during recruitment", "Company asking you to sign blank or incomplete documents"] },
          { title: "What ITF Can Do", items: ["Compare your wages against ITF-approved CBA rates for your vessel type", "Negotiate directly with the shipowner for back pay and corrections", "Involve port state authorities if the shipowner refuses to cooperate", "Provide legal support and representation in extreme cases", "In abandonment cases — help with food, fuel, and repatriation"] },
        ],
        note: "Keep copies of your contract, all payslips, and bank statements. This evidence is essential if you need to make a wage claim. Take photos of documents with your phone as a backup.",
      },
    },
    {
      title: "Confidential Contact",
      summary: "How to reach ITF without your company knowing — your right under the MLC.",
      detail: {
        heading: "How to Contact ITF Confidentially",
        intro: "Contacting the ITF is your right under the MLC. Your employer cannot punish, dismiss, or blacklist you for exercising this right.",
        sections: [
          { title: "Contact Methods", items: ["ITF Seafarers' app — download from app store, message directly and privately", "Email: mail@itf.org.uk — all communications are confidential", "ITF inspectors visit major ports worldwide — ask port welfare to arrange a meeting", "Port chaplains and welfare centres can facilitate ITF contact", "ITF has inspectors in over 50 countries covering all major shipping routes"] },
          { title: "What Happens When You Contact ITF", items: ["Your identity is kept strictly confidential", "An ITF inspector will assess your situation", "If action is needed, ITF contacts the shipowner — not you", "You cannot be identified as the person who made the complaint", "If retaliation occurs, ITF and port state can take further action"] },
        ],
        note: "You cannot be punished for contacting the ITF. This is protected under the MLC 2006. If any employer threatens you for exercising your rights, this itself is a serious violation that ITF and authorities will act on.",
      },
    },
    {
      title: "Contract Substitution",
      summary: "When the contract you sign at embarkation differs from what was promised.",
      detail: {
        heading: "Contract Substitution — Know Your Rights",
        intro: "Contract substitution — being asked to sign different terms at embarkation than what was agreed during recruitment — is illegal and a form of labour exploitation.",
        sections: [
          { title: "Warning Signs", items: ["Being presented with a new contract at embarkation with different terms", "Wages lower than originally agreed during recruitment", "Contract duration longer than initially discussed", "Terms about overtime, leave, or benefits changed", "Being told 'this is the standard contract' when terms differ from your agreement"] },
          { title: "What to Do", items: ["Read every contract carefully before signing — even under pressure", "Compare terms with your original offer letter or recruitment agreement", "If terms differ, document the differences before signing", "Contact ITF if you are forced to accept unfavorable changed terms", "Keep copies of all versions of contracts you've been presented with"] },
        ],
        note: "Never sign a contract you haven't read and understood. If you are pressured to sign different terms, this is a serious red flag. Contact ITF — they deal with these cases regularly and can help.",
      },
    },
    {
      title: "Abandonment Protection",
      summary: "What happens when a company leaves crew stranded — ITF's role in rescue.",
      detail: {
        heading: "Vessel Abandonment — Getting Help",
        intro: "Vessel abandonment occurs when a shipowner stops providing for crew — no wages, no provisions, no repatriation. ITF is the primary organisation that assists abandoned seafarers.",
        sections: [
          { title: "Signs of Abandonment", items: ["Wages unpaid for two or more months", "Company not responding to communications", "Provisions and fuel running low with no resupply planned", "P&I club coverage lapsed or uncertain", "Company representatives stop visiting the vessel"] },
          { title: "What ITF Does", items: ["Provides immediate assistance — food, water, essential supplies", "Contacts flag state and port state to invoke their MLC obligations", "Works with P&I clubs for financial security claims", "Arranges repatriation when the company cannot or will not", "Pursues wage recovery through legal channels on behalf of crew"] },
        ],
        note: "If you believe your vessel is being abandoned, contact ITF immediately. Do not wait until the situation becomes desperate. Early intervention gives the best outcomes. You can also contact the port state authority and your flag state.",
      },
    },
  ],
};

export const VESSEL_TANKER_TOPIC: TopicData = {
  title: "Tanker Vetting — SIRE, CDI & Oil Majors",
  summary: "Complete guide to tanker vetting requirements including SIRE 2.0, CDI, and oil major standards.",
  points: [
    {
      title: "CDI — Chemical Tanker Inspections",
      summary: "Chemical Distribution Institute requirements for chemical and product tankers.",
      detail: {
        heading: "CDI Chemical Tanker Inspections",
        intro: "CDI inspections are specific to chemical and product tankers. They focus on cargo handling competence for hazardous chemical cargoes.",
        sections: [
          { title: "What CDI Covers", items: ["Cargo handling procedures for hazardous chemicals", "Tank cleaning verification and wall wash testing standards", "Crew chemical cargo competency and hazard awareness", "Compatibility checks and cargo segregation knowledge", "MSDS availability and crew understanding of cargo hazards", "Heating/cooling system management for temperature-sensitive cargoes"] },
          { title: "Crew Preparation", items: ["Know the properties of every cargo you handle — not just the name", "Understand tank cleaning requirements between cargo grades", "Be able to explain compatibility and segregation requirements", "Know emergency procedures for chemical spills specific to your cargo", "Demonstrate PPE selection based on cargo MSDS requirements"] },
        ],
        note: "CDI inspectors are typically experienced chemical tanker officers. They can tell immediately if crew understand their cargoes or are just reading from the MSDS. Genuine knowledge and experience matter most.",
      },
    },
    {
      title: "Oil Major Vetting Standards",
      summary: "Shell TMSA 3, BP, ExxonMobil, Chevron, and TotalEnergies requirements.",
      detail: {
        heading: "Oil Major Vetting Requirements",
        intro: "Each oil major has its own vetting requirements in addition to SIRE 2.0. Understanding the differences helps you prepare effectively.",
        sections: [
          { title: "Key Oil Major Programs", items: ["Shell TMSA 3 — Third edition focuses on leadership and continuous improvement", "BP Shipping Standards — emphasis on behavioral safety observations and learning culture", "ExxonMobil HSSE — detailed pre-arrival questionnaires and competency verification", "Chevron Marine — crew competency and fatigue management focus", "TotalEnergies — environmental performance and safety culture assessment"] },
          { title: "Common Themes", items: ["All oil majors now emphasise human factors and crew welfare", "Crew mental health and fatigue management increasingly assessed", "Behavioral safety observations expected to be part of daily operations", "Near-miss reporting culture — evidence of learning from incidents", "Environmental performance — spill prevention and response readiness"] },
        ],
        note: "Oil major requirements evolve constantly. Stay updated through your company's vetting department. The common thread is genuine safety culture — this cannot be faked for an inspection.",
      },
    },
    {
      title: "Tanker Safety Culture",
      summary: "How inspectors assess the overall safety culture onboard tankers.",
      detail: {
        heading: "Building Tanker Safety Culture",
        intro: "Modern tanker vetting increasingly assesses overall safety culture rather than just compliance with specific requirements. This is harder to fake and more important than ever.",
        sections: [
          { title: "What Good Safety Culture Looks Like", items: ["Near-misses are reported voluntarily without fear of blame", "Toolbox talks happen before every operation and are genuinely participatory", "Stop Work Authority is understood and exercised when needed", "Crew speak up about concerns — and are listened to", "Master creates an open environment — not a fear-based one"] },
          { title: "What Poor Safety Culture Looks Like", items: ["Near-miss reports are rare or non-existent — nothing ever goes wrong?", "Toolbox talks are signed but not actually conducted", "Crew afraid to stop work even when they see unsafe conditions", "Only the Master and Chief Officer speak during inspections", "Rest hour records show perfect compliance — which is often unrealistic"] },
        ],
        note: "Safety culture is not a document or a poster on the wall. It is how people behave when no one is watching. SIRE 2.0 is designed to assess exactly this — and experienced inspectors can see through a facade quickly.",
      },
    },
    {
      title: "Mooring Operations",
      summary: "SIRE 2.0 mooring assessment — snap-back zones, PPE, and communication.",
      detail: {
        heading: "Mooring Operations Under SIRE 2.0",
        intro: "Mooring operations are one of the most dangerous activities on tankers. SIRE 2.0 gives significant attention to how mooring is managed and conducted.",
        sections: [
          { title: "What Inspector Observes", items: ["Snap-back zones clearly marked and crew aware of danger areas", "Mooring lines in good condition — no signs of excessive wear", "Communication between bridge and mooring stations — clear and structured", "PPE worn correctly — hard hat, gloves, safety footwear, high-vis", "Crew positioning — no one standing in snap-back zones during operations"] },
          { title: "Common Failures", items: ["Snap-back zones not marked or crew standing in them during mooring", "Poor communication between bridge and deck — no radio discipline", "Mooring lines mixed (different types/sizes on same lead)", "No toolbox talk or risk assessment before mooring operations", "Crew unfamiliar with emergency release procedures"] },
        ],
        note: "Mooring line snap-back kills and seriously injures seafarers every year. This is not just an inspection topic — it is a life-and-death safety issue. Take mooring safety personally.",
      },
    },
    {
      title: "Inert Gas System",
      summary: "IG system operation, monitoring, and common inspection findings on tankers.",
      detail: {
        heading: "Inert Gas System — Inspection Focus",
        intro: "The inert gas system is critical for tanker safety. SIRE 2.0 inspectors pay close attention to IG system operation and crew competence.",
        sections: [
          { title: "What Inspector Checks", items: ["IG system operational and maintaining positive pressure in cargo tanks", "O2 content monitoring — continuous recording, alarms set correctly", "Deck water seal and P/V breakers in good condition", "Crew can explain IG system operation and emergency procedures", "Tank atmosphere monitoring records — consistent and accurate"] },
          { title: "Common Deficiencies", items: ["IG system not achieving required O2 levels (below 5% by volume)", "Deck water seal level not maintained or monitored", "P/V breakers — inadequate maintenance or testing", "Crew cannot explain what happens if IG system fails during cargo operations", "Tank atmosphere records showing gaps or inconsistencies"] },
        ],
        note: "A malfunctioning inert gas system can lead to tank explosion. There is zero tolerance for IG system deficiencies during cargo operations. If your IG system is not working properly, stop cargo operations and fix it.",
      },
    },
  ],
};

export const VESSEL_DRY_CARGO_TOPIC: TopicData = {
  title: "Dry Cargo Vetting — RightShip & Regulations",
  summary: "RightShip ratings, IMSBC Code, hatch covers, container safety, and IMDG requirements.",
  points: [
    {
      title: "RightShip Star Rating System",
      summary: "How the 0.5–5 star rating works and what affects your vessel's score.",
      detail: {
        heading: "RightShip Star Rating — Complete Guide",
        intro: "RightShip is the primary vetting platform for dry cargo vessels. Your star rating determines whether charterers will hire your vessel.",
        sections: [
          { title: "How Rating Works", items: ["0.5 to 5 star rating based on vessel safety performance data", "Rating considers PSC detention history, casualties, and class records", "3 stars minimum typically required by major charterers", "GHG Rating now included — environmental performance matters commercially", "Age of vessel, flag state performance, and owner history all factor in", "Rating is dynamic — updates based on every new inspection result"] },
          { title: "How to Improve Your Rating", items: ["Maintain clean PSC records — every inspection affects the score", "Address class conditions promptly — outstanding conditions lower rating", "Ensure flag state maintains white list status", "Invest in environmental improvements — GHG rating increasingly important", "Avoid any incidents, detentions, or casualties"] },
        ],
        note: "Your RightShip rating directly affects your vessel's earning potential. A drop from 3 to 2 stars can make the difference between getting a charter and sitting idle. Maintaining safety standards is not just ethical — it's commercial survival.",
      },
    },
    {
      title: "Hatch Cover Requirements",
      summary: "Weathertightness testing, maintenance, and common deficiencies for bulk carriers.",
      detail: {
        heading: "Hatch Cover Inspections — Bulk Carriers",
        intro: "Hatch cover condition is one of the most critical safety and cargo protection issues for bulk carriers. Failures can lead to cargo damage claims worth millions.",
        sections: [
          { title: "What Inspectors Check", items: ["Weathertightness testing — ultrasonic or hose test results", "Coaming drainage and compression bar condition", "Hatch cover maintenance records in planned maintenance system", "Rubber packing condition — cracking, compression, gaps", "Cleating mechanisms — proper engagement and securing", "Hydraulic systems — leaks, pressure, operation speed"] },
          { title: "Common Deficiencies", items: ["Failed ultrasonic testing at multiple points around the hatch", "Rubber packing hardened, cracked, or compressed beyond effectiveness", "Drainage channels blocked with cargo residue or rust", "Hydraulic system leaking — hatch covers not achieving full pressure", "Maintenance records showing overdue or skipped inspections"] },
        ],
        note: "A leaking hatch cover can destroy an entire cargo hold of grain or other moisture-sensitive cargo. The cost of proper hatch cover maintenance is tiny compared to a single cargo damage claim.",
      },
    },
    {
      title: "IMSBC Code — Liquefying Cargoes",
      summary: "Critical safety requirements for nickel ore, iron ore fines, bauxite, and other Group A cargoes.",
      detail: {
        heading: "IMSBC Code — Protecting Your Ship and Crew",
        intro: "Cargo liquefaction has caused bulk carriers to capsize and sink with all hands. The IMSBC Code exists to prevent this. Understanding it can save your life.",
        sections: [
          { title: "Critical Requirements", items: ["Transportable Moisture Limit (TML) testing is mandatory for Group A cargoes", "Cargo moisture content must be below TML — certificates required from shipper", "Master has the absolute right to refuse cargo above TML", "Can testing — visual assessment of cargo moisture before and during loading", "Shipper's declaration and certificate of moisture content must be provided", "Group A cargoes include nickel ore, iron ore fines, bauxite, and many others"] },
          { title: "Master's Rights", items: ["You have the legal right to refuse any cargo you believe is above TML", "You can request independent testing if you doubt shipper's certificates", "You can stop loading if cargo appearance changes (becomes wetter)", "No charterer or shipper can force you to load unsafe cargo", "Document everything — photos, moisture readings, communications"] },
        ],
        note: "Cargo liquefaction has killed hundreds of seafarers. If cargo looks wet, forms puddles, or flows like liquid when tilted — STOP LOADING and exercise your right to refuse. Your life is more important than any cargo.",
      },
    },
    {
      title: "Container Lashing & Safety",
      summary: "Cargo Securing Manual compliance, VGM, and stack weight limits.",
      detail: {
        heading: "Container Safety — Lashing and Securing",
        intro: "Container losses at sea have increased in recent years. Proper lashing and compliance with the Cargo Securing Manual are essential for safety and commercial protection.",
        sections: [
          { title: "Key Requirements", items: ["Cargo Securing Manual (CSM) must be followed precisely — no shortcuts", "Container weight verification (VGM) — SOLAS requirement for all containers", "Stack weight limits must not be exceeded — check bay plans", "Lashing equipment must be inspected and maintained regularly", "Reefer containers require monitoring and pre-trip inspections"] },
          { title: "Common Issues", items: ["Lashing rods not properly tensioned or checked after sailing", "Stack weights exceeding CSM limits due to poor bay planning", "Lashing equipment worn or damaged — turnbuckles, bridge fittings", "VGM discrepancies not identified or challenged", "Reefer containers not monitored regularly during voyage"] },
        ],
        note: "Container stack collapse can be catastrophic — crushing other containers, damaging the vessel, and endangering crew. Always follow your CSM and report any concerns about container weights or lashing condition.",
      },
    },
    {
      title: "IMDG Code — Dangerous Goods",
      summary: "Stowage, segregation, and emergency procedures for dangerous goods in containers.",
      detail: {
        heading: "IMDG Code — Dangerous Goods Compliance",
        intro: "Carrying dangerous goods in containers requires strict compliance with the IMDG Code. Failures can result in fires, explosions, and toxic releases.",
        sections: [
          { title: "Key Requirements", items: ["Correct stowage and segregation according to IMDG Code tables", "Dangerous Goods Manifest must be accurate and accessible", "Emergency procedures (EmS) available for all DG classes carried", "Crew trained in DG handling and emergency response", "Proper marking, labelling, and placarding of DG containers"] },
          { title: "Crew Responsibilities", items: ["Know what dangerous goods are onboard and their locations", "Understand segregation requirements — which classes cannot be stowed together", "Know emergency procedures for the DG classes you are carrying", "Monitor DG stowage areas during voyage — temperature, leaks, damage", "Report any DG incidents immediately — spills, leaks, fire, damage to containers"] },
        ],
        note: "Misdeclared dangerous goods are a major cause of container fires at sea. While you cannot control what shippers declare, you can ensure proper stowage, segregation, and monitoring of declared DG cargo. Know your EmS guides.",
      },
    },
  ],
};

export const QUICK_REF_USCG_TOPIC: TopicData = {
  title: "USCG Quick Reference Checklist",
  summary: "Top deficiencies and what the USCG inspector checks first — essential pre-arrival guide.",
  points: [
    {
      title: "Top 5 USCG Deficiencies",
      summary: "The most common findings that lead to detention in US ports.",
      detail: {
        heading: "USCG Top Deficiencies — Details",
        intro: "These deficiencies are found most frequently by USCG inspectors. Each one has led to vessel detentions.",
        sections: [
          { title: "Deficiencies", items: ["Fire safety — extinguishers expired or discharged, fire doors not self-closing properly, fire detection zones with faults", "Lifesaving — lifeboat falls worn beyond safe limits, EPIRB not registered to current vessel, SART batteries expired", "ISM — crew unable to explain SMS procedures relevant to their duties, non-conformities from audits not closed out", "MARPOL — oil record book entries not matching sounding logs or fuel transfer records, OWS alarm bypassed", "MLC — rest hour records showing systematic violations, wage payment irregularities or late payments"] },
        ],
        note: "Any single one of these can lead to detention. Review each area 48 hours before US port arrival.",
      },
    },
    {
      title: "What Inspector Checks First",
      summary: "The sequence of a typical USCG boarding — what happens in the first 30 minutes.",
      detail: {
        heading: "USCG Inspection Sequence",
        intro: "Understanding the typical inspection sequence helps you prepare. The first 30 minutes often determine whether the inspection will be routine or expanded.",
        sections: [
          { title: "First 30 Minutes", items: ["Certificates and documents — class, statutory, crew — all checked for validity", "Bridge — GMDSS equipment test, ECDIS/chart verification, passage plan review", "General impression — cleanliness, maintenance standard, crew alertness", "Crew interview — usually starts with OOW or duty officer on bridge", "Security — ISPS documentation, access control, security awareness questions"] },
          { title: "If Inspector Extends", items: ["Engine room — OWS operation, incinerator log, fuel changeover records", "Fire safety — random fire station, extinguisher check across multiple locations", "LSA — lifeboat condition, launching appliance maintenance, EPIRB/SART", "Accommodation — crew quarters, galley, medical supplies, MLC compliance", "Cargo areas — relevant safety equipment, access, ventilation"] },
        ],
        note: "A good first impression matters enormously. A clean, well-maintained bridge with alert crew and organised documents often results in a shorter, routine inspection. A disorganised bridge triggers expanded scrutiny.",
      },
    },
    {
      title: "Pre-Arrival Checklist",
      summary: "Essential items to verify 48 hours before arriving at a US port.",
      detail: {
        heading: "48-Hour Pre-Arrival Checklist — US Ports",
        intro: "Complete this checklist 48 hours before arrival at any US port to minimise detention risk.",
        sections: [
          { title: "Documents", items: ["All statutory certificates valid and onboard", "Crew certificates — originals, valid, with proper endorsements", "Oil record book up to date with consistent entries", "Garbage record book current", "Ballast water management records complete"] },
          { title: "Equipment", items: ["All fire extinguishers in date and properly mounted", "Fire doors self-closing properly throughout the vessel", "GMDSS equipment tested and functional", "EPIRB registered to current vessel", "Navigation lights operational", "LSA equipment serviced and ready"] },
          { title: "Crew", items: ["Rest hour records accurate for previous 7 days", "All crew can explain their emergency duties", "Security duties understood at current MARSEC level", "OOW can demonstrate basic ECDIS/radar competence", "Engineers can explain OWS operation and alarms"] },
        ],
        note: "This checklist covers the most common detention triggers. Completing it thoroughly 48 hours before arrival gives you time to fix any issues discovered.",
      },
    },
    {
      title: "Cyber Security Preparedness",
      summary: "USCG cyber requirements — what you need to have in place before arrival.",
      detail: {
        heading: "Cyber Security for USCG Inspections",
        intro: "Cyber security is a rapidly growing area of USCG focus. Vessels are increasingly expected to demonstrate cyber risk awareness.",
        sections: [
          { title: "What You Need", items: ["Cyber risk management integrated into your SMS", "Crew awareness of basic cyber threats — phishing, USB risks, social engineering", "Policy on personal device connections to ship systems", "Procedures for reporting suspected cyber incidents", "Network architecture understanding — who has access to what systems"] },
          { title: "Common Questions from USCG", items: ["Does your SMS address cyber risks?", "What would you do if you suspected a cyber attack on navigation systems?", "Are personal devices allowed to connect to ship networks?", "How are software updates managed for critical systems?", "Who is responsible for cyber security onboard?"] },
        ],
        note: "Cyber security sounds complex but USCG expectations are currently reasonable — awareness, basic procedures, and SMS integration. Start with these fundamentals.",
      },
    },
    {
      title: "Emergency Response Readiness",
      summary: "What USCG expects crew to demonstrate about emergency procedures.",
      detail: {
        heading: "Emergency Response — USCG Expectations",
        intro: "USCG inspectors frequently test crew knowledge of emergency procedures. This is one of the easiest areas to prepare for — and one of the most common failure points.",
        sections: [
          { title: "What Crew Must Know", items: ["Your muster list assignment — station, duties, equipment", "Location and operation of nearest fire extinguisher and fire alarm point", "How to raise the alarm — fire, man overboard, abandon ship, security", "SOPEP procedures relevant to your role", "Enclosed space entry procedures — never enter without authorisation and procedures"] },
          { title: "How to Practice", items: ["Read your muster list assignment and practice explaining it out loud", "Walk to your emergency station and time yourself", "Physically locate and handle the nearest fire extinguisher", "Practice explaining SOPEP procedures for your specific duty", "Discuss enclosed space entry steps with a colleague"] },
        ],
        note: "Emergency response knowledge saves lives — not just during inspections, but in real emergencies. Take 10 minutes before arrival to review your duties. It could save your life and your colleagues' lives.",
      },
    },
  ],
};

export const QUICK_REF_AMSA_TOPIC: TopicData = {
  title: "AMSA Quick Reference Checklist",
  summary: "Australian inspection priorities and pre-arrival essentials including biosecurity.",
  points: [
    {
      title: "Top 5 AMSA Deficiencies",
      summary: "Most common findings by Australian maritime inspectors.",
      detail: {
        heading: "AMSA Top Deficiencies — Details",
        intro: "AMSA publishes detailed inspection statistics. These categories consistently lead to deficiency findings.",
        sections: [
          { title: "Deficiencies", items: ["Fire detection systems — faulty smoke detectors in accommodation, missing or damaged detector heads", "Navigation safety — outdated Australian charts, incomplete passage plans for coastal waters", "MLC rest hours — crew working hours exceeding limits, records not reflecting actual rest", "ISM non-conformities — objective evidence of problems not addressed within deadlines", "Structural — corrosion in ballast tanks and void spaces, especially on older vessels"] },
        ],
        note: "AMSA is transparent about what it finds and shares data publicly. Use this information to your advantage in preparation.",
      },
    },
    {
      title: "What AMSA Checks First",
      summary: "The typical AMSA inspection sequence and initial focus areas.",
      detail: {
        heading: "AMSA Inspection Sequence",
        intro: "AMSA inspections follow a structured approach with initial focus areas that determine whether the inspection remains routine or expands.",
        sections: [
          { title: "Initial Checks", items: ["Ship's particulars and certificates validity — all statutory docs", "Bridge equipment — ECDIS with current Australian charts, AIS, VDR recording", "Biosecurity declaration accuracy — this is uniquely Australian and strictly checked", "Crew welfare — quick assessment of accommodation, food stores, medical supplies", "Pollution prevention — SOPEP, oil record book, garbage management plan"] },
        ],
        note: "The biosecurity declaration is often the first thing checked and Australian authorities take it extremely seriously. Complete it accurately.",
      },
    },
    {
      title: "Biosecurity Pre-Arrival",
      summary: "Essential biosecurity steps before entering Australian waters.",
      detail: {
        heading: "Australian Biosecurity — Pre-Arrival Steps",
        intro: "Biosecurity is uniquely important in Australia. Non-compliance can result in vessel exclusion from Australian waters.",
        sections: [
          { title: "Before Arrival", items: ["Complete pre-arrival biosecurity report accurately — no guessing", "Inspect hull and niche areas for marine growth — document condition", "Ensure ballast water exchange or treatment records are complete", "Clean cargo holds thoroughly — no soil, seeds, or organic material", "Check stores for prohibited items — fresh fruit, plant material, soil", "Ensure biofouling management plan and record book are current"] },
        ],
        note: "Australia can refuse entry to vessels that pose a biosecurity risk. This is not an inspection formality — it is strictly enforced.",
      },
    },
    {
      title: "Environmental Compliance",
      summary: "Reef protection, emission zones, and ballast water requirements.",
      detail: {
        heading: "Environmental Compliance — Australian Waters",
        intro: "Australian environmental regulations are among the strictest globally, particularly near the Great Barrier Reef and other marine protected areas.",
        sections: [
          { title: "Key Requirements", items: ["Ballast water management — full compliance required, zero tolerance near reef", "Great Barrier Reef transit — additional environmental precautions required", "Waste management — strict discharge restrictions in Australian waters", "Fuel oil sulphur content compliance in emission control areas", "Oil spill response — SOPEP must cover Australian water-specific scenarios"] },
        ],
        note: "Environmental violations in Australian waters carry severe penalties and can affect your vessel's future access to Australian ports.",
      },
    },
    {
      title: "MLC Welfare Focus",
      summary: "AMSA's expanded crew welfare checks beyond MLC minimums.",
      detail: {
        heading: "Crew Welfare — AMSA Standards",
        intro: "AMSA goes beyond MLC minimum requirements in its welfare inspections, reflecting Australia's commitment to seafarer wellbeing.",
        sections: [
          { title: "What AMSA Looks For", items: ["Accommodation cleanliness, ventilation, temperature control", "Food quality and variety — inspectors may check galley and stores", "Internet and communication access for crew", "Medical supplies — chest contents current, crew trained in first aid", "Shore leave arrangements — are crew actually able to go ashore?", "General crew morale and wellbeing — observed through interactions"] },
        ],
        note: "AMSA genuinely cares about crew welfare. If you have legitimate concerns about conditions onboard, AMSA inspectors are approachable and complaints are confidential.",
      },
    },
  ],
};

export const QUICK_REF_PARIS_TOPIC: TopicData = {
  title: "Paris MOU Quick Reference Checklist",
  summary: "European inspection priorities, EU environmental rules, and pre-arrival preparation.",
  points: [
    {
      title: "Top 5 Paris MOU Deficiencies",
      summary: "Most common findings across European and Canadian ports.",
      detail: {
        heading: "Paris MOU Top Deficiencies — Details",
        intro: "Paris MOU publishes comprehensive annual statistics. These deficiency categories consistently rank highest across all 27 member administrations.",
        sections: [
          { title: "Deficiencies", items: ["Fire safety — structural fire protection failures, detection system faults, fire door maintenance", "Life-saving appliances — launching appliance maintenance overdue, servicing records incomplete", "Navigation — ECDIS familiarisation records missing or incomplete for assigned bridge officers", "MLC — seafarer employment agreement terms not matching MLC requirements, wage documentation gaps", "ISM — objective evidence requirements not met, corrective actions from audits still outstanding"] },
        ],
        note: "Paris MOU rewards good performance through its New Inspection Regime — clean vessels are inspected less frequently, saving time and costs.",
      },
    },
    {
      title: "What Inspector Checks First",
      summary: "The typical Paris MOU inspection approach and initial document review.",
      detail: {
        heading: "Paris MOU Inspection Sequence",
        intro: "Paris MOU inspections typically begin with a structured document review before proceeding to physical inspection.",
        sections: [
          { title: "Inspection Flow", items: ["Document review — certificates, class status, flag state information", "General impression — deck condition, maintenance standard, housekeeping", "Bridge — navigation equipment, ECDIS chart updates, BRM evidence", "Engine room — safety systems, alarm testing, OWS condition", "Crew quarters — MLC compliance assessment, food, medical supplies"] },
        ],
        note: "First impressions count. A well-maintained vessel with organised documentation sets a positive tone for the entire inspection.",
      },
    },
    {
      title: "EU ETS and Emissions",
      summary: "EU Emissions Trading System requirements that affect vessel operations in European waters.",
      detail: {
        heading: "EU ETS — What Crew Need to Know",
        intro: "The EU Emissions Trading System now covers maritime shipping. While most compliance falls on the company, crew have operational responsibilities.",
        sections: [
          { title: "Crew Responsibilities", items: ["Maintain accurate fuel consumption records — bunker delivery notes, daily consumption", "Record cargo carried and voyage data accurately in logbooks", "Understand fuel changeover procedures for emission control areas", "Report any fuel system issues that could affect emissions monitoring", "Be aware that emissions data from your vessel is commercially sensitive"] },
        ],
        note: "EU ETS is a company-level obligation but depends on accurate operational data from the vessel. Your fuel records matter commercially and legally.",
      },
    },
    {
      title: "ECDIS Familiarisation",
      summary: "ECDIS familiarisation requirements — a major deficiency area in European inspections.",
      detail: {
        heading: "ECDIS Familiarisation — Avoiding Deficiencies",
        intro: "ECDIS familiarisation is one of the fastest-growing deficiency areas in Paris MOU inspections. Bridge officers must demonstrate genuine ECDIS competence.",
        sections: [
          { title: "What Inspectors Expect", items: ["Documented evidence of type-specific ECDIS familiarisation for each bridge officer", "Bridge officers can operate the ECDIS confidently — not just basic functions", "Safety settings properly configured for the current voyage", "Chart updates applied and current — Electronic Navigational Charts (ENCs)", "Backup arrangements understood and documented — paper charts or second ECDIS"] },
          { title: "Common Failures", items: ["Familiarisation records exist but bridge officers cannot demonstrate competence", "Safety settings not adjusted for specific voyage requirements", "Chart licenses expired or ENCs not updated to latest correction", "Officers only familiar with basic functions — cannot use advanced features", "No evidence of familiarisation for officers who joined recently"] },
        ],
        note: "ECDIS familiarisation is not just paperwork. Inspectors will ask you to demonstrate functions. Practice using your specific ECDIS model regularly — not just during inspections.",
      },
    },
    {
      title: "CII Rating Awareness",
      summary: "Carbon Intensity Indicator — what it means for your vessel and how crew contribute.",
      detail: {
        heading: "CII Rating — Crew Guide",
        intro: "The Carbon Intensity Indicator (CII) rates your vessel's energy efficiency. While it's primarily a company concern, crew actions directly affect the rating.",
        sections: [
          { title: "What CII Means", items: ["Vessels rated A (best) to E (worst) based on carbon intensity", "Rating affects commercial viability — charterers increasingly require C or better", "Rating is calculated from actual fuel consumption and voyage data", "A vessel rated D or E must develop a corrective action plan", "Rating tightens every year — what's acceptable today may not be tomorrow"] },
          { title: "How Crew Affect CII", items: ["Efficient voyage execution — speed optimisation, weather routing compliance", "Accurate fuel consumption recording — errors affect the calculation", "Minimising auxiliary engine use where possible", "Reporting hull condition — biofouling increases fuel consumption", "Supporting slow steaming and just-in-time arrival practices"] },
        ],
        note: "CII is becoming a commercial reality. Vessels with poor ratings will find it harder to find employment. Every crew member contributes to the vessel's environmental performance.",
      },
    },
  ],
};

export const QUICK_REF_TOKYO_TOPIC: TopicData = {
  title: "Tokyo MOU Quick Reference Checklist",
  summary: "Asia-Pacific inspection priorities, bulk carrier focus, and crew preparation guide.",
  points: [
    {
      title: "Top 5 Tokyo MOU Deficiencies",
      summary: "Most common findings across Asia-Pacific ports.",
      detail: {
        heading: "Tokyo MOU Top Deficiencies — Details",
        intro: "Tokyo MOU deficiency patterns reflect both global trends and regional operational characteristics.",
        sections: [
          { title: "Deficiencies", items: ["Fire safety — detection systems and fire-fighting equipment failures", "Life-saving appliances — servicing records incomplete, equipment condition poor", "Navigation — radar performance issues, ECDIS operational deficiencies", "MARPOL — oil filtering equipment faults, sewage treatment plant not operational", "Labour conditions — hours of rest violations, wage documentation incomplete"] },
        ],
        note: "The high tempo of operations in Asian ports means vessels have less time to prepare between inspections. Being permanently ready is the best strategy.",
      },
    },
    {
      title: "What Inspector Checks First",
      summary: "Tokyo MOU inspection targeting and initial assessment approach.",
      detail: {
        heading: "Tokyo MOU Inspection Approach",
        intro: "Tokyo MOU uses a targeting system similar to Paris MOU to identify priority vessels for inspection.",
        sections: [
          { title: "Targeting Factors", items: ["Ship risk profile — based on flag, class, company history, ship age", "Previous inspection history — recent deficiencies increase targeting", "Type of vessel — bulk carriers and tankers face additional scrutiny", "Time since last inspection — overdue vessels are prioritised", "Information or complaints received about the vessel"] },
          { title: "Initial Checks", items: ["Certificates and crew documentation — quick validity check", "Safety equipment spot checks — fire extinguishers, LSA condition", "Engine room walkthrough — OWS condition, fuel changeover records", "Crew interview — emergency procedures and rest hour questions", "General impression — maintenance standard and crew alertness"] },
        ],
        note: "Tokyo MOU inspections can happen with minimal notice. The best preparation is maintaining your vessel at inspection-ready standard at all times.",
      },
    },
    {
      title: "Bulk Carrier Readiness",
      summary: "Special preparation for bulk carriers operating in Asia-Pacific trade.",
      detail: {
        heading: "Bulk Carrier Inspection Preparation",
        intro: "Bulk carriers face additional scrutiny in the Asia-Pacific region given the high volume of bulk cargo trade.",
        sections: [
          { title: "Key Areas", items: ["Cargo hold structural condition — document frame and floor measurements", "Hatch cover weathertightness — recent test results available", "Cargo loading computer — operational and calculations verified", "IMSBC Code compliance — cargo documentation and TML certificates", "Ventilation arrangements for enclosed cargo spaces"] },
        ],
        note: "If you are loading bulk cargo in Asia-Pacific, have your cargo documentation ready and ensure your Master is aware of the right to refuse cargo that exceeds TML.",
      },
    },
    {
      title: "Language and Communication",
      summary: "Preparing for inspections when English is not your first language.",
      detail: {
        heading: "Communication During Inspections",
        intro: "Language barriers can affect inspection outcomes. Preparation helps you communicate effectively even if English is not your first language.",
        sections: [
          { title: "Preparation Tips", items: ["Learn key safety terms in English — fire, abandon ship, man overboard, muster station", "Practice explaining your emergency duties in simple English sentences", "Know technical terms for your equipment in English", "If you don't understand a question, ask the inspector to repeat slowly", "It's better to say 'I don't understand' than to guess and give wrong answer"] },
          { title: "Common Inspector Phrases", items: ["'Show me your muster station' — walk them to your emergency position", "'What are your duties in case of fire?' — explain your fire party role", "'When did you last have rest?' — state your actual rest period", "'Can you operate this equipment?' — demonstrate if asked", "'Do you have any concerns about safety?' — be honest"] },
        ],
        note: "Inspectors understand that English may not be your first language. They appreciate honest attempts to communicate. Clear, simple answers are always better than fluent but incorrect responses.",
      },
    },
    {
      title: "Regional Port Differences",
      summary: "How inspection approaches vary across major Asia-Pacific ports.",
      detail: {
        heading: "Port-by-Port Variations",
        intro: "While Tokyo MOU provides a harmonised framework, individual ports and countries within the region may have specific characteristics.",
        sections: [
          { title: "Key Variations", items: ["Singapore — very efficient, focused inspections, high volume of traffic", "China — emphasis on MARPOL compliance and crew certification verification", "South Korea — thorough structural inspections, especially bulk carriers", "Japan — detailed and methodical, attention to documentation quality", "Philippines — MLC focus, particularly crew welfare and wages"] },
        ],
        note: "These are general tendencies, not guarantees. Every inspector is different. The best preparation is consistent compliance with all conventions regardless of port.",
      },
    },
  ],
};

export const ITF_RIGHTS_TOPIC: TopicData = {
  title: "ITF Rights — Your Protection at Sea",
  summary: "Your rights under the MLC, how to contact ITF confidentially, wage protection, and anti-retaliation guarantees.",
  points: [
    {
      title: "Your Right to Protection",
      summary: "MLC 2006 guarantees you cannot be punished for reporting concerns or contacting ITF.",
      detail: {
        heading: "You Cannot Be Punished — Your Legal Protection",
        intro: "Under the MLC 2006, seafarers have the absolute right to make complaints without fear of retaliation. This is not optional — it is international law.",
        sections: [
          { title: "What Is Protected", items: ["Contacting ITF inspectors — always confidential", "Filing complaints with port state control authorities", "Reporting unsafe conditions to any authority", "Refusing unsafe work when your life is genuinely at risk", "Reporting wage underpayment or contract violations"] },
          { title: "What Employers Cannot Do", items: ["Dismiss you for making a complaint", "Blacklist you for contacting ITF or port state", "Withhold wages as punishment for complaints", "Deny you shore leave as retaliation", "Transfer you to worse duties or conditions as punishment", "If any of these happen, this is itself a serious violation"] },
        ],
        note: "If you experience retaliation for exercising your rights, report it immediately to the ITF. Retaliation is a more serious violation than the original complaint and will be pursued aggressively.",
      },
    },
    {
      title: "What ITF Inspects",
      summary: "Contracts, wages, rest hours, food, accommodation — everything affecting your life at sea.",
      detail: {
        heading: "ITF Inspection Focus Areas",
        intro: "ITF inspectors focus exclusively on your welfare and rights. They are experienced maritime professionals who understand life at sea.",
        sections: [
          { title: "What They Check", items: ["Seafarer Employment Agreements — do they meet MLC and CBA requirements?", "Wage payments — are you receiving what you're owed, on time?", "Hours of work and rest — actual compliance, not just paperwork", "Food quality and quantity — adequate nutrition for demanding work", "Accommodation — clean, comfortable, meeting MLC standards", "Repatriation arrangements — can you go home when your contract ends?", "Social security and insurance — are you covered?"] },
        ],
        note: "ITF inspectors are on your side. Their entire purpose is to protect seafarers. You should never feel afraid to speak with them.",
      },
    },
    {
      title: "How to Contact ITF",
      summary: "Multiple confidential ways to reach ITF — app, email, port welfare, and inspector visits.",
      detail: {
        heading: "Contacting ITF — All Methods",
        intro: "There are multiple ways to contact the ITF, all of them confidential. Choose whichever method you feel most comfortable with.",
        sections: [
          { title: "Contact Methods", items: ["ITF Seafarers' app — available on iOS and Android, message directly and privately", "Email: mail@itf.org.uk — all communications treated as strictly confidential", "ITF inspectors visit major ports — ask port welfare to arrange a private meeting", "Port chaplains and welfare centres can facilitate contact with ITF", "ITF has inspectors in over 50 countries covering all major shipping routes", "Visit itfseafarers.org for local inspector contact details"] },
          { title: "What Happens Next", items: ["Your identity is kept strictly confidential throughout the process", "An ITF inspector assesses your situation and advises on options", "If action is needed, ITF contacts the shipowner — never identifying you", "Follow-up inspections may be arranged to verify improvements", "If issues are serious, port state control may be involved"] },
        ],
        note: "You do not need permission from anyone to contact the ITF. You do not need to tell your Master or your company. This is your right.",
      },
    },
    {
      title: "Wage Protection",
      summary: "What to do if you're underpaid, and how ITF recovers wages for seafarers.",
      detail: {
        heading: "Wage Protection — Your Money, Your Right",
        intro: "Wage theft remains one of the most common problems facing seafarers. ITF has recovered over $50 million in unpaid wages annually for seafarers worldwide.",
        sections: [
          { title: "Warning Signs of Wage Theft", items: ["Wages consistently paid late or not on the agreed date", "Deductions you don't understand or didn't agree to in your contract", "Being paid less than your signed SEA specifies", "Different wage terms at embarkation than what was promised during recruitment", "Company asking you to sign receipts for amounts you didn't receive"] },
          { title: "How to Protect Yourself", items: ["Keep copies of your contract, all payslips, and bank statements", "Take photos of all documents with your phone as backup", "Record any discrepancies in a personal log with dates", "Compare your wages with ITF-approved CBA rates for your vessel type", "If underpaid, contact ITF — they will negotiate on your behalf"] },
        ],
        note: "Evidence is everything. Keep copies of every document related to your employment and wages. Digital photos on your personal phone are the best backup — they cannot be confiscated or destroyed.",
      },
    },
    {
      title: "Abandonment — Getting Help",
      summary: "What to do when a company stops providing for crew — food, wages, or repatriation.",
      detail: {
        heading: "Vessel Abandonment — Emergency Guide",
        intro: "Vessel abandonment is one of the worst situations a seafarer can face. Knowing what to do and who to contact can make the difference between weeks and months of suffering.",
        sections: [
          { title: "Recognising Abandonment", items: ["Wages unpaid for two or more months with no explanation", "Company not responding to communications from the vessel", "Provisions and fuel running low with no resupply arranged", "P&I club coverage uncertain or lapsed", "Company representatives have stopped visiting or communicating"] },
          { title: "What to Do Immediately", items: ["Contact ITF — they have emergency response procedures for abandonment", "Contact the port state authority — they have MLC obligations to assist", "Contact your flag state — they must ensure your repatriation", "Document everything — dates, communications, provisions status", "Do not leave the vessel without coordinating with ITF or port state", "ITF can provide immediate assistance with food, water, and essential supplies"] },
        ],
        note: "If you suspect your vessel is being abandoned, act early. Don't wait until food and water run out. The earlier ITF and authorities are involved, the faster the situation can be resolved. Every day of delay makes recovery harder.",
      },
    },
  ],
};

export const MY_NEXT_PORT_TOPIC: TopicData = {
  title: "My Next Port — Inspection Lookup",
  summary: "Find out which PSC authority covers your next port and what they currently focus on.",
  points: [
    {
      title: "How Port Targeting Works",
      summary: "How PSC authorities decide which vessels to inspect at each port.",
      detail: {
        heading: "How PSC Targeting Works",
        intro: "PSC authorities don't inspect every vessel — they use targeting systems to prioritise which ships to board. Understanding this helps you know your risk level.",
        sections: [
          { title: "Targeting Factors", items: ["Ship Risk Profile — based on flag state, class, company history, and ship age", "Time since last inspection — overdue vessels are prioritised", "Previous deficiency history — more deficiencies means higher targeting score", "Type of vessel — certain types face additional scrutiny in certain ports", "Intelligence and complaints — reports from crew or other authorities", "Random selection — some vessels are inspected randomly regardless of profile"] },
          { title: "How to Reduce Targeting", items: ["Maintain clean inspection records across all PSC regimes", "Address deficiencies promptly and document corrective actions", "Ensure flag state maintains good standing (white list)", "Keep vessel well-maintained — first impressions affect inspector decisions", "Consider voluntary inspections during quiet periods to build positive record"] },
        ],
        note: "Your inspection history follows you globally. A detention in one region increases your targeting score in all regions. Prevention is always the best strategy.",
      },
    },
    {
      title: "Regional Authority Map",
      summary: "Which PSC authority covers each major shipping region worldwide.",
      detail: {
        heading: "Global PSC Authority Coverage",
        intro: "Different regions are covered by different MOU agreements. Knowing which authority governs your next port helps you prepare appropriately.",
        sections: [
          { title: "Regional Coverage", items: ["USA — USCG (United States Coast Guard) — independent, not an MOU member", "Europe & Canada — Paris MOU — 27 member administrations", "Asia Pacific — Tokyo MOU — 21 member authorities", "Indian Ocean — Indian Ocean MOU — growing membership and capacity", "Latin America — Viña del Mar Agreement — covers South American ports", "Mediterranean — Mediterranean MOU — overlaps with Paris MOU in some ports", "Black Sea — Black Sea MOU — covers Black Sea coastal states", "Caribbean — Caribbean MOU — covers Caribbean island states", "West & Central Africa — Abuja MOU — developing PSC capacity"] },
        ],
        note: "Some ports may fall under multiple PSC regimes. Prepare for the stricter standard — this ensures you're ready for any inspection regardless of which authority conducts it.",
      },
    },
    {
      title: "Pre-Arrival Preparation",
      summary: "Universal pre-arrival steps regardless of which port you're entering.",
      detail: {
        heading: "Universal Pre-Arrival Checklist",
        intro: "Regardless of which port you're entering, these preparation steps will help you be ready for any PSC inspection.",
        sections: [
          { title: "48 Hours Before Arrival", items: ["Verify all statutory certificates are valid and onboard", "Check crew certificates — originals present, endorsements current", "Review oil record book for consistency and completeness", "Test all GMDSS equipment and record results", "Verify fire detection systems operational in all zones", "Check all navigation lights"] },
          { title: "24 Hours Before Arrival", items: ["Brief crew on expected PSC authority and their focus areas", "Review rest hour records for compliance over previous 7 days", "Ensure bridge passage plan is complete for arrival", "Verify ECDIS charts updated for port approach", "Check gangway, accommodation ladder, and access arrangements", "Prepare all documents for easy access on the bridge"] },
        ],
        note: "A well-prepared vessel is rarely detained. The investment of a few hours of preparation before arrival is worth more than days of delay from a detention.",
      },
    },
    {
      title: "What If You're Inspected",
      summary: "Practical advice for crew during any PSC inspection — what to do and what not to do.",
      detail: {
        heading: "During a PSC Inspection — Crew Guide",
        intro: "Being inspected can be stressful, especially the first time. Knowing what to expect and how to behave makes a significant difference.",
        sections: [
          { title: "Do", items: ["Be polite and professional — first impressions matter enormously", "Answer questions honestly — if you don't know, say so", "Show, don't just tell — demonstrate equipment, point to locations", "Have documents organised and accessible", "Accompany the inspector when asked — be helpful and cooperative"] },
          { title: "Don't", items: ["Don't argue with the inspector — even if you disagree", "Don't try to hide things — inspectors are experienced and will find them", "Don't volunteer information not asked for — stay relevant", "Don't blame others — focus on facts and what you know", "Don't panic — most inspections are routine and result in no detentions"] },
        ],
        note: "Remember: inspectors are maritime professionals doing their job. They are not your enemy. A cooperative, professional attitude from crew is the single best thing you can do during any inspection.",
      },
    },
    {
      title: "After an Inspection",
      summary: "How to handle deficiencies, deadlines, and follow-up actions.",
      detail: {
        heading: "Post-Inspection — Next Steps",
        intro: "After an inspection, whether routine or with deficiencies, there are important steps to take.",
        sections: [
          { title: "If Deficiencies Are Found", items: ["Review each deficiency carefully — understand what was found", "Prioritise deficiencies by deadline — some must be fixed before departure", "Document all corrective actions taken with photos and records", "Notify your company/DPA immediately about any significant findings", "Keep a copy of the inspection report for ship and company records"] },
          { title: "If Detained", items: ["Understand exactly what must be rectified before release", "Contact your company, P&I club, and classification society immediately", "Cooperate fully with the port state authority throughout the process", "Document all repair and rectification work thoroughly", "Request re-inspection promptly once deficiencies are addressed", "Learn from the experience — update your preparation checklist"] },
        ],
        note: "A deficiency is not the end of the world — it's an opportunity to improve. How you respond to deficiencies matters more than the finding itself. Prompt, professional corrective action demonstrates good safety management.",
      },
    },
  ],
};

export const ALL_TOPICS = [
  { id: "sire2", data: SIRE_2_TOPIC, icon: "Ship" as const },
  { id: "psc-uscg", data: PSC_USCG_TOPIC, icon: "Shield" as const },
  { id: "psc-amsa", data: PSC_AMSA_TOPIC, icon: "Shield" as const },
  { id: "psc-paris", data: PSC_PARIS_MOU_TOPIC, icon: "Shield" as const },
  { id: "psc-tokyo", data: PSC_TOKYO_MOU_TOPIC, icon: "Shield" as const },
  { id: "psc-indian", data: PSC_INDIAN_OCEAN_TOPIC, icon: "Shield" as const },
  { id: "psc-itf", data: PSC_ITF_TOPIC, icon: "Shield" as const },
  { id: "vessel-tanker", data: VESSEL_TANKER_TOPIC, icon: "Ship" as const },
  { id: "vessel-dry", data: VESSEL_DRY_CARGO_TOPIC, icon: "Ship" as const },
  { id: "ref-uscg", data: QUICK_REF_USCG_TOPIC, icon: "FileText" as const },
  { id: "ref-amsa", data: QUICK_REF_AMSA_TOPIC, icon: "FileText" as const },
  { id: "ref-paris", data: QUICK_REF_PARIS_TOPIC, icon: "FileText" as const },
  { id: "ref-tokyo", data: QUICK_REF_TOKYO_TOPIC, icon: "FileText" as const },
  { id: "itf-rights", data: ITF_RIGHTS_TOPIC, icon: "Scale" as const },
  { id: "next-port", data: MY_NEXT_PORT_TOPIC, icon: "MapPin" as const },
];
