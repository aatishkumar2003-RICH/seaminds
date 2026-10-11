#!/usr/bin/env python3
"""SeaMinds AI-Assessed Professional Screening — question inventory pipeline.

Run once by an operator (never by the browser). Steps per rank family:
  1. Draft  (google/gemini-3-flash-preview)
  2. Independent validator A (google/gemini-3.1-pro-preview) — answers each MCQ blind,
     checks regulatory basis, ambiguity, rank suitability, professional-only content.
  3. Independent validator B (openai/gpt-5.4-mini) — same checks, blind.
  4. Keep an MCQ only if BOTH validators pass it AND both choose the draft's correct option.
     Keep scenario/behavioural only if both pass it and it has key steps + critical step.
  5. Near-duplicate removal (normalised text similarity).
Output: /tmp/inventory/<family>.json  → loaded as approval_status='AI_VALIDATED'.
AI_VALIDATED is NOT SME_APPROVED: no human reviewer is claimed, no IMO/STCW accreditation is claimed.
"""
import json, os, re, sys, difflib, concurrent.futures as cf, requests, time

GW = "https://ai.gateway.lovable.dev/v1/chat/completions"
KEY = os.environ["LOVABLE_API_KEY"]
DRAFT, VAL_A, VAL_B = "google/gemini-3-flash-preview", "google/gemini-3.1-pro-preview", "openai/gpt-5.4-mini"
OUT = "/tmp/inventory"; os.makedirs(OUT, exist_ok=True)

FAMILIES = {
  "DECK_MGMT": (["Master", "Chief Officer", "SDPO"], "deck management-level officers (Master, Chief Officer, Senior DPO)",
    ["navigation & passage planning", "cargo operations & stability", "SOLAS safety management", "MARPOL pollution prevention", "ISM & PSC/vetting", "leadership & crew management", "COLREG", "emergency response"]),
  "DECK_OPS": (["2nd Officer", "3rd Officer", "DPO", "Deck Cadet"], "deck operational-level officers and deck cadets (2nd/3rd Officer, DPO)",
    ["bridge watchkeeping & COLREG", "ECDIS & passage planning", "LSA/FFA maintenance", "cargo watch", "GMDSS & communications", "MARPOL record keeping", "dynamic positioning basics", "mooring & anchoring"]),
  "DECK_RATING": (["Bosun", "Able Seaman", "Ordinary Seaman", "Deck Boy"], "deck ratings (Bosun, AB, OS, Deck Boy)",
    ["lookout & helm orders", "mooring operations safety", "enclosed space entry", "permit to work & PPE", "deck maintenance", "LSA/FFA & drills", "cargo securing", "oil spill & garbage handling"]),
  "ENG_MGMT": (["Chief Engineer", "2nd Engineer"], "engine management-level officers (Chief Engineer, 2nd Engineer)",
    ["main engine & propulsion", "auxiliary machinery & power", "MARPOL Annex I/VI compliance", "planned maintenance & ISM", "bunkering & fuel management", "engine room emergencies", "UMS & automation", "leadership & budgeting"]),
  "ENG_OPS": (["3rd Engineer", "4th Engineer", "Engine Cadet"], "engine operational-level officers and engine cadets (3rd/4th Engineer)",
    ["engine room watchkeeping", "purifiers & fuel treatment", "boilers & steam", "pumps & compressors", "oily water separator & ORB", "lubrication", "safety & lock-out tag-out", "refrigeration & air-con"]),
  "ENG_RATING": (["Fitter", "Motorman", "Oiler", "Wiper", "Pumpman"], "engine ratings and pumpman (Fitter, Motorman, Oiler, Wiper, Pumpman)",
    ["engine room rounds", "lubrication & sounding", "hot work & welding safety", "pumps and cargo pumping", "lock-out tag-out", "bilge & oily water handling", "tools & workshop safety", "fire prevention"]),
  "ETO": (["ETO", "Electrician"], "electro-technical officers and electricians",
    ["high-voltage safety", "generators & switchboards", "automation & PLC", "navigation electronics", "insulation testing", "electrical fire prevention", "battery systems", "fault finding"]),
  "CATERING": (["Chief Cook", "Cook", "2nd Cook", "Messman", "Steward", "Camp Boss"], "catering department (Chief Cook, Cook, 2nd Cook, Messman, Steward, Camp Boss)",
    ["food safety & HACCP", "galley fire safety", "MLC 2006 food & catering standards", "provisions & storage", "hygiene & sanitation", "garbage management MARPOL Annex V", "allergen & menu planning", "emergency duties"]),
}
PLAN = [("mcq", 13)] * 4 + [("scenario", 8), ("behavioural", 6)]  # overgenerate; validators prune
if os.environ.get("PLAN"):  # top-up runs, e.g. PLAN="scenario:8:3,behavioural:6:2" (kind:size:batches); merges into existing file
    PLAN = [(k, int(n)) for part in os.environ["PLAN"].split(",") for k, n, b in [part.split(":")] for _ in range(int(b))]

def call(model, messages, tries=4):
    body = {"model": model, "messages": messages, "response_format": {"type": "json_object"}}
    if model.startswith("openai/gpt-5.4"): pass
    for i in range(tries):
        r = requests.post(GW, headers={"Authorization": f"Bearer {KEY}", "Content-Type": "application/json"}, json=body, timeout=240)
        if r.status_code == 200:
            txt = r.json()["choices"][0]["message"]["content"]
            txt = re.sub(r"^```(json)?|```$", "", txt.strip()).strip()
            v = json.loads(txt)
            return v if isinstance(v, dict) else {"items": v, "results": v}
        if r.status_code in (429,) or r.status_code >= 500: time.sleep(5 * (i + 1)); continue
        raise RuntimeError(f"{model} {r.status_code} {r.text[:200]}")
    raise RuntimeError(f"{model} retries exhausted")

RULES = ("Professional maritime employment screening only: technical, SOLAS, MARPOL, STCW, ISM, MLC, COLREG, navigation, cargo, engineering, "
         "safety, maritime English, decision-making, leadership, communication. NEVER ask about wellness, health, family, mental health, "
         "religion, nationality or personal life. No trick questions; one unambiguous correct answer; cite a real regulation or recognised guidance.")

def draft(fam, kind, n, batch):
    ranks, desc, domains = FAMILIES[fam]
    if kind == "mcq":
        spec = (f"Write {n} multiple-choice questions for {desc}. Mix cognitive levels: ~30% recall, ~50% application, ~20% judgment. "
                f"Spread across domains: {', '.join(domains)}. Batch #{batch}: vary topics from other batches. Each item: "
                '{"question":str,"options":[4 strings],"correct_index":0-3,"explanation":str,"regulation":str,"domain":one of the domains,'
                '"cognitive_level":"recall"|"application"|"judgment","min_rank":one of ' + json.dumps(ranks) + "}. "
                "Questions must suit the most junior rank listed unless min_rank names a more senior one.")
    elif kind == "scenario":
        spec = (f"Write {n} situational-judgment scenarios for {desc}, realistic shipboard events. Each item: "
                '{"situation":str (3-5 sentences),"question":"What do you do? Explain your actions in order.","key_steps":[4-6 strings],'
                '"critical_step":str,"regulation":str,"domain":str,"time_seconds":180}.')
    else:
        spec = (f"Write {n} professional workplace-behaviour questions for {desc} (teamwork, communication, reporting, leadership, "
                "safety culture, handover). Each item: "
                '{"question":str,"key_steps":[3-5 strings describing a strong answer],"critical_step":str,"regulation":str,"domain":str,"time_seconds":120}.')
    out = call(DRAFT, [{"role": "system", "content": RULES}, {"role": "user", "content": spec + ' Return JSON {"items":[...]}.'}])
    return out.get("items", [])

def validate(model, fam, kind, items):
    _, desc, _ = FAMILIES[fam]
    blind = []
    for i, it in enumerate(items):
        d = {"id": i, "question": it.get("question"), "regulation": it.get("regulation")}
        if kind == "mcq": d["options"] = it.get("options")
        else: d.update(situation=it.get("situation"), key_steps=it.get("key_steps"), critical_step=it.get("critical_step"))
        blind.append(d)
    task = ("You are an independent maritime assessment moderator. For each item decide if it is valid for " + desc + ". "
            "Fail it if: factually wrong, ambiguous, more than one defensible answer, wrong/fabricated regulation, unsuitable for the rank, "
            "trivial, or touches wellness/health/family/personal life. ")
    task += ('For MCQs, independently choose the correct option index yourself. Return {"results":[{"id":int,"valid":bool,"answer_index":int|null,"issue":str}]}.'
             if kind == "mcq" else 'For open items also fail if key_steps are not a sound scoring rubric. Return {"results":[{"id":int,"valid":bool,"issue":str}]}.')
    res = call(model, [{"role": "system", "content": RULES}, {"role": "user", "content": task + " Respond in JSON.\nItems:\n" + json.dumps(blind)}])
    return {r["id"]: r for r in res.get("results", []) if isinstance(r, dict) and "id" in r}

def norm(s): return re.sub(r"[^a-z0-9 ]", "", (s or "").lower())

def run_family(fam):
    prev = json.load(open(f"{OUT}/{fam}.json")) if os.environ.get("PLAN") and os.path.exists(f"{OUT}/{fam}.json") else None
    kept, log = (prev["items"], prev["log"]) if prev else ([], {"drafted": 0, "rejected": 0})
    for b, (kind, n) in enumerate(PLAN):
        try:
            items = [x for x in draft(fam, kind, n, b + (100 if prev else 0)) if isinstance(x, dict) and x.get("question")]
        except Exception as e:
            print(fam, kind, "draft failed", e, flush=True); continue
        if kind == "mcq":
            items = [x for x in items if isinstance(x.get("options"), list) and len(x["options"]) == 4 and x.get("correct_index") in (0, 1, 2, 3)]
        else:
            items = [x for x in items if isinstance(x.get("key_steps"), list) and len(x["key_steps"]) >= 3 and x.get("critical_step")]
        log["drafted"] += len(items)
        try:
            with cf.ThreadPoolExecutor(2) as ex:
                va, vb = ex.submit(validate, VAL_A, fam, kind, items), ex.submit(validate, VAL_B, fam, kind, items)
                va, vb = va.result(), vb.result()
        except Exception as e:
            print(fam, kind, "validate failed", e, flush=True); continue
        for i, it in enumerate(items):
            a, bb = va.get(i), vb.get(i)
            ok = bool(a and bb and a.get("valid") and bb.get("valid"))
            if ok and kind == "mcq": ok = a.get("answer_index") == it["correct_index"] == bb.get("answer_index")
            if ok and any(difflib.SequenceMatcher(None, norm(it["question"]), norm(k["question"])).ratio() > 0.85 for k in kept): ok = False
            if ok: it["kind"] = kind; kept.append(it)
            else: log["rejected"] += 1
        print(fam, kind, "kept so far", len(kept), flush=True)
    json.dump({"family": fam, "ranks": FAMILIES[fam][0], "items": kept, "log": log,
               "models": {"draft": DRAFT, "validator_a": VAL_A, "validator_b": VAL_B}}, open(f"{OUT}/{fam}.json", "w"))
    return fam, len(kept), log

if __name__ == "__main__":
    fams = sys.argv[1:] or list(FAMILIES)
    with cf.ThreadPoolExecutor(4) as ex:
        for r in ex.map(run_family, fams): print("DONE", r, flush=True)
