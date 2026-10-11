/** Single frozen exam contract shared by UI and database blueprints (requirements_by_mode). Times are estimates. */
export const EXAM_CONTRACT = {
  PROFILE: { mcq: 18, scenario: 3, behavioural: 2, total: 23, minutes: "20–30" },
  CV_BASED: { mcq: 22, scenario: 3, behavioural: 2, total: 27, minutes: "25–35" },
  MANAGER: { mcq: 24, scenario: 4, behavioural: 3, total: 31, minutes: "30–40" },
} as const;
export type ExamEntry = keyof typeof EXAM_CONTRACT;

export const SCREENING_LABEL = "SeaMinds AI-Assessed Professional Screening (not an official certificate of competency)";
export const CV_EVIDENCE_LABEL = "CV evidence included, not independently verified";

/** Blueprint requirements for one entry context — must match what is stored in assessment_blueprints. */
export const requirementsFor = (entry: ExamEntry) => {
  const c = EXAM_CONTRACT[entry];
  return [
    { item_type: "mcq", count: c.mcq },
    { item_type: "scenario", count: c.scenario },
    { item_type: "behavioural", count: c.behavioural },
  ];
};
