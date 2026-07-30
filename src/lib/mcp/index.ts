import { auth, defineMcp } from "@lovable.dev/mcp-js";
import getMyProfile from "./tools/get-my-profile";
import searchJobs from "./tools/search-jobs";
import getMySmcScore from "./tools/get-my-smc-score";
import updateAvailability from "./tools/update-availability";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "seaminds-your-crew-companion",
  title: "SeaMinds: Your Crew Companion",
  version: "0.1.0",
  instructions:
    "Tools for SeaMinds, a companion app for seafarers. Use `get_my_profile` for the signed-in seafarer's crew profile, `get_my_smc_score` for their latest Seafarer Merit Score, `search_jobs` to find maritime vacancies, and `update_availability` to change their availability for work. Wellness chat and welfare data are private and never exposed.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [getMyProfile, getMySmcScore, searchJobs, updateAvailability],
});
