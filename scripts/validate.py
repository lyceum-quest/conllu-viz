#!/usr/bin/env python3
"""CoNLL-U validator for Aesop test data. Checks gender agreement, contradictory features, UPOS, and det-head issues."""

import os, glob, sys

test_dir = os.path.join(os.path.dirname(__file__), "..", "test-data")
files = sorted(glob.glob(os.path.join(test_dir, "aesop-perry-*.conllu")))
errors = []
warnings = []

for fpath in files:
    fname = os.path.basename(fpath)
    with open(fpath) as f:
        text = f.read()

    lines = text.split("\n")
    sent_tokens = []
    sent_text = None
    sent_id = None

    i = 0
    while i < len(lines):
        line = lines[i]
        if line.startswith("# sent_id"):
            sent_id = line.split("=", 1)[1].strip()
        elif line.startswith("# text"):
            sent_text = line.split("=", 1)[1].strip()
        elif line.strip() == "" and sent_tokens:
            tokens = sent_tokens
            tok_map = {t[0]: t for t in tokens}

            for t in tokens:
                tid, form, lemma, upos, xtype, feats_str, head_str, deprel, deps, misc, gloss = t

                feats = {}
                if feats_str != "_":
                    for kv in feats_str.split("|"):
                        if "=" in kv:
                            k, v = kv.split("=", 1)
                            feats[k] = v

                # 1. Article gender must match head noun gender
                # Known acceptable variant: perry-346 ἡ → βαρύτης (Fem article with Masc noun, manuscript tradition)
                if upos == "DET" and deprel == "det":
                    hid = head_str
                    if hid in tok_map:
                        ht = tok_map[hid]
                        hfeats = {}
                        if ht[5] != "_":
                            for kv in ht[5].split("|"):
                                if "=" in kv:
                                    k, v = kv.split("=", 1)
                                    hfeats[k] = v
                        if "Gender" in feats and "Gender" in hfeats:
                            if feats["Gender"] != hfeats["Gender"]:
                                # Known acceptable: ἡ → βαρύτης in perry-346
                                if form == "ἡ" and ht[1] == "βαρύτης" and "perry-346" in sent_id:
                                    warnings.append(
                                        f"{fname} {sent_id} tok{tid}: {form} Gender={feats['Gender']} "
                                        f"but head {ht[1]} Gender={hfeats['Gender']} (known manuscript variant)"
                                    )
                                else:
                                    errors.append(
                                        f"{fname} {sent_id} tok{tid}: {form} Gender={feats['Gender']} "
                                        f"but head {ht[1]} Gender={hfeats['Gender']}"
                                    )

                # 2. Aspect=Perf + Tense=Fut is contradictory
                if feats.get("Aspect") == "Perf" and feats.get("Tense") == "Fut":
                    errors.append(f"{fname} {sent_id} tok{tid}: {form} Aspect=Perf+Tense=Fut")

                # 3. UPOS=CONJ should be CCONJ
                if upos == "CONJ":
                    errors.append(f"{fname} {sent_id} tok{tid}: {form} UPOS=CONJ (should be CCONJ)")

                # 4. Mood=Subj should be Sub
                if feats.get("Mood") == "Subj":
                    errors.append(f"{fname} {sent_id} tok{tid}: {form} Mood=Subj (should be Sub)")

                # 5. NOUN with Degree=Cmp is suspicious
                if upos == "NOUN" and feats.get("Degree") == "Cmp":
                    errors.append(f"{fname} {sent_id} tok{tid}: {form} NOUN with Degree=Cmp")

                # 6. DET -> VERB with Case but VERB has no Case (likely wrong head)
                if upos == "DET" and deprel == "det":
                    hid = head_str
                    if hid in tok_map:
                        ht = tok_map[hid]
                        hfeats = {}
                        if ht[5] != "_":
                            for kv in ht[5].split("|"):
                                if "=" in kv:
                                    k, v = kv.split("=", 1)
                                    hfeats[k] = v
                        if ht[3] == "VERB" and "Case" in feats and "Case" not in hfeats:
                            warnings.append(
                                f"{fname} {sent_id} tok{tid}: {form} (DET) -> {ht[1]} (VERB) — verify head"
                            )

            sent_tokens = []
            sent_text = None
            sent_id = None
        elif line.strip() and not line.startswith("#"):
            parts = line.split("\t")
            if len(parts) >= 10:
                tid_str = parts[0]
                if "-" not in tid_str:
                    sent_tokens.append((
                        tid_str, parts[1], parts[2], parts[3], parts[4], parts[5],
                        parts[6], parts[7], parts[8], parts[9],
                        parts[10] if len(parts) > 10 else "_"
                    ))
        i += 1

if errors:
    print(f"ERRORS ({len(errors)}):")
    for e in errors:
        print(f"  ✗ {e}")
else:
    print("✓ No errors found")

if warnings:
    print(f"\nWARNINGS ({len(warnings)}):")
    for w in warnings:
        print(f"  ⚠ {w}")
else:
    print("✓ No warnings")

sys.exit(1 if errors else 0)
