/**
 * Base dictionary. Every other language file must satisfy this shape.
 * GLOSSARY RULE: rank names, vessel types, certificate abbreviations (STCW, CoC,
 * SIRE, SMC, DP) and company names are NEVER translated — only the sentences
 * around them.
 */
const en = {
  // --- shared ---
  back: "Back",
  continue: "CONTINUE →",
  close: "Close",

  // --- homepage console: header ---
  worldwide: "Worldwide",
  marketsSoon: "Indonesia · Philippines · India · Vietnam — opening soon",
  marketsNote: "Counts arrive as we verify each market",

  // --- quick dock ---
  dockJobs: "JOBS",
  dockProfile: "SEA PROFILE",
  dockAi: "AI",
  dockFeed: "FEED",
  dockMarket: "MARKET",
  dockStart: "START",
  dockTry: "TRY",
  dockOpen: "OPEN",
  dockLive: "LIVE",

  // --- proof bar ---
  live: "LIVE",
  jobsWord: "JOBS",
  today: "TODAY",
  loading: "LOADING…",

  // --- hero ---
  heroKicker: "LOOKING FOR YOUR NEXT SHIP?",
  heroTitle: "CREATE ONE SEA PROFILE. GET MATCHED.",
  stepProfile: "PROFILE",
  stepMatch: "MATCH",
  stepApply: "APPLY",
  stepInterview: "INTERVIEW",
  recruitersFindYou: "↘ recruiters find you",
  heroCta: "START FREE — ACTIVATE SEA PROFILE",
  alreadyRegistered: "Already registered? SEE MY JOBS →",

  // --- matching now ---
  matchingNow: "🔥 MATCHING NOW",

  // --- live jobs + quick sheet ---
  loadingVacancies: "Loading live vacancies…",
  allJobs: "ALL",
  vacancy: "Vacancy",
  seafarer: "Seafarer",
  various: "Various",
  variousVessels: "Various vessels",
  joining: "Joining",
  externalSource: "EXTERNAL SOURCE",
  direct: "DIRECT",
  yourSeaProfile: "YOUR SEA PROFILE",
  profileActive: "✓ Active",
  profileNotActive: "Not active yet",
  applyWithProfile: "APPLY WITH SEA PROFILE →",
  activateAndApply: "ACTIVATE PROFILE & APPLY",
  benefitReuse: "Reuse for future applications",
  benefitMatched: "Get matched with relevant jobs",
  benefitVisibility: "Control professional visibility",
  salaryFrom: "from",

  // --- /profile-start ---
  psTitle: "Sea Profile — quick start",
  psStep: "STEP",
  psOf: "OF",
  psQ1: "What is your rank?",
  psQ2: "Which vessels have you sailed on?",
  psQ3: "When are you available?",
  psAvailNow: "Now",
  psAvail7: "7 days",
  psAvail30: "30 days",
  psAvailLater: "Later",
  psRewardTitle: "GOOD NEWS — YOUR MARKET IS ACTIVE ⚓",
  psChecking: "Checking live vacancies…",
  psLiveFor: "live vacancies for",
  psOnVessels: "on your vessel types",
  psAddedIn24h: "added in the last 24h",
  psQuiet: "Your market is quieter today — new vacancies arrive daily",
  psActivate: "ACTIVATE MY SEA PROFILE →",
  psSeeJobs: "SEE MY JOBS →",

  // --- /join ---
  joinTitle: "Join SeaMinds",
  joinSubtitle: "Free for seafarers — 2-minute Sea Profile, jobs, SMC assessment.",
  joinBullet1: "Confidential conversations — never shared with your company",
  joinBullet2: "Built by a Master Mariner",
  joinBullet3: "Works wherever your voyage takes you",
  joinGoogle: "Continue with Google",
  joinOr: "or",
  joinCreated: "✓ Account created!",
  joinCheckEmail: "Check your email to confirm, then sign in.",
  joinTabCreate: "Create account",
  joinTabSignin: "Sign in",
  joinPasswordHint: "Minimum 8 characters.",
  joinCreateBtn: "Create free account ⚓",
  joinForgot: "Forgot password?",
  joinFreeForCrew: "Free for crew members",
  joinManagerLogin: "Manager Login",
  joinErrEmailPassword: "Enter your email and a password of at least 8 characters",
  joinErrExists: "This email already has an account — sign in instead.",
  joinErrWrong: "Wrong email or password",
  joinResetPrompt: "Enter your email to reset your password",
  joinResetSent: "Reset link sent — check your email",
  joinBackHome: "Back to home",

  // --- /quick-profile ---
  qpTitle: "Quick Sea Profile",
  qpSubtitle: "All taps, no typing — about 2 minutes.",
  qpMatches: "live vacancies match your profile",
  qpQRank: "Your rank",
  qpSelectRank: "Select your rank",
  qpQYears: "Years in this rank",
  qpQContracts: "Contracts completed in this rank",
  qpFirstContract: "0 — first contract",
  qpStartingOut: "⚓ Starting your sea career — welcome aboard!",
  qpQSeaService: "Total sea service (years)",
  qpQAvailable: "Available for work now?",
  qpAvailableYes: "Yes — available",
  qpAvailableNo: "Not available",
  qpAvailableFrom: "Available from",
  qpNeedFour: "Tap all four answers to continue",
  qpStep2Help: "Which vessels have you sailed on? Tap to select, then tap your sea time.",
  qpChooseSeaTime: "Choose sea time",
  qpNeedVessel: "Select at least one vessel type",
  qpSkipNoService: "No sea service yet — skip",
  qpStep3Help: "A few questions for your rank — all taps.",
  qpFinish: "Finish my Sea Profile ⚓",
  qpDoneTitle: "Your Sea Profile is ready",
  qpDoneBody: "You can now apply for jobs and take your SeaMinds assessment.",
  qpDoneNote:
    "Add your CV and certificates anytime to strengthen your profile and help companies evaluate you faster.",
  qpDoneJobs: "See my matching jobs →",
  qpDoneSmc: "Take the SMC Assessment →",
  qpContinue: "Continue →",
  yes: "Yes",
  no: "No",
};

export type Dict = typeof en;
export default en;
