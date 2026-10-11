#!/usr/bin/env python3
"""Turn /tmp/inventory/<family>.json (output of ai_inventory_pipeline.py) into SQL inserts.
Items are stored as approval_status='AI_VALIDATED' with explicit AI provenance; never SME_APPROVED."""
import json, glob, sys, os

def q(s): return "NULL" if s is None else "'" + str(s).replace("'", "''") + "'"
def arr(xs): return "ARRAY[" + ",".join(q(x) for x in xs) + "]::text[]"
def js(o): return q(json.dumps(o, ensure_ascii=False)) + "::jsonb"

out_dir = sys.argv[1] if len(sys.argv) > 1 else "/tmp/inventory_sql"
os.makedirs(out_dir, exist_ok=True)
for path in sorted(glob.glob("/tmp/inventory/*.json")):
    d = json.load(open(path)); fam = d["family"]; m = d["models"]
    basis = (f"SeaMinds AI-Assessed Professional Screening: drafted by {m['draft']}; independently validated by "
             f"{m['validator_a']} and {m['validator_b']} (both confirmed answer/rubric, regulation, rank suitability, no ambiguity, "
             f"professional-only). Not human SME reviewed; not accredited.")
    rows = []
    for n, it in enumerate(d["items"], 1):
        kind = it["kind"]
        if kind == "mcq":
            prompt = {"question": it["question"], "options": it["options"]}
            key = {"correct_index": it["correct_index"], "explanation": it.get("explanation"), "regulation": it.get("regulation")}
            lvl = it.get("cognitive_level") if it.get("cognitive_level") in ("recall", "application", "judgment") else "application"
        else:
            prompt = {"question": it["question"], "situation": it.get("situation"), "time_seconds": int(it.get("time_seconds") or (180 if kind == "scenario" else 120)),
                      "category": it.get("domain")}
            key = {"key_steps": it["key_steps"], "critical_step": it["critical_step"], "regulation": it.get("regulation")}
            lvl = "judgment" if kind == "scenario" else "application"
        rows.append("(" + ",".join([
            q(f"aiv1-{fam.lower()}-{kind}-{n:03d}"), "1", q(kind), arr(d["ranks"]), "ARRAY['General']::text[]",
            q((it.get("domain") or "professional practice")[:80]), q(lvl), js(prompt), js(key), "'AI_DRAFT'",
            q((it.get("regulation") or "")[:300] or None), "'AI_VALIDATED'", q(basis), q(f"AI:{m['validator_a']}+{m['validator_b']}"), "now()", "true",
        ]) + ")")
    if not rows: continue
    sql = ("INSERT INTO public.assessment_items (item_key, question_version, question_type, rank_scope, vessel_scope, domain, cognitive_level, "
           "prompt, answer_key, source_type, source_reference, approval_status, approval_basis, reviewed_by, reviewed_at, is_active) VALUES\n"
           + ",\n".join(rows) + "\nON CONFLICT (item_key, question_version) DO NOTHING;")
    open(f"{out_dir}/{fam}.sql", "w").write(sql)
    print(fam, len(rows), "items", sum(1 for i in d["items"] if i["kind"] == "mcq"), "mcq",
          sum(1 for i in d["items"] if i["kind"] == "scenario"), "scen", sum(1 for i in d["items"] if i["kind"] == "behavioural"), "beh")
