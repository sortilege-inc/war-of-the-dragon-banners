#!/usr/bin/env python3
"""
build_seed.py — the table's first import → campaign/pack/seed.json (VttConfig.defaultCampaign.seed).

    python3 campaign/build/build_seed.py

The owner plays in this campaign; the Gamemaster's prep is in no source here, so no Gamemaster material is
seeded (campaign/PLAN.md, the decision log). The seed holds only the knights at the table:

  * the squires with a Foundry sheet (Paun, Tiphaine) — each a member on its profile in the campaign's layer
    (campaign/data/index.js, built by build/build_layer.sh), its live Hit Points and Glory at the sheet's
    own, the same member the Knights pane makes from a profile (system/pendragon6e/sheet.js fromProfile);
  * the other squires still played at the table (Sineda, Drust) — blank knights by name, for their players
    to claim and fill (sheet.js newMember).

Gates (exit non-zero): every member unique; every profile a Player Knight of the layer; live numbers the
layer's own.
"""
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "campaign", "pack", "seed.json")
INDEX = re.compile(r"var d=(\{.*?\});var T=window\.PENDRAGON6E", re.S)
LAYER = re.compile(r"var d=(\{.*\});var T=window\.PENDRAGON6E", re.S)
PROFILED = [("paun", "#wdbSquirePaun0000001"), ("tiphaine", "#wdbSquireTiphaine001")]
BLANK = ["Sineda", "Drust"]


def main():
    fail = 0
    idx = json.loads(INDEX.search(open(os.path.join(ROOT, "campaign", "data", "index.js"), encoding="utf-8").read()).group(1))
    ents = json.loads(LAYER.search(open(os.path.join(ROOT, "campaign", "data", "campaign.js"), encoding="utf-8").read()).group(1))["entities"]
    recs = {r["id"]: r for r in idx["records"]}
    party = []
    for slug, pid in PROFILED:
        r, e = recs.get(pid), ents.get(pid)
        if not r or not e or r.get("type") != "Player Knight":
            print("  PARTY — %s is not a Player Knight of the layer" % pid)
            fail = 1
            continue
        props = {p["name"]: p for p in e["props"]}
        hp = next(int(it["d"][2]["value"]) for it in props["Statistics"]["items"] if it["d"][1]["value"] == "Hit Points")
        live = {"checks": {}, "hp": hp, "glory": props["Glory"]["value"]}
        party.append({"id": "wdb-member-" + slug, "templateId": pid, "name": r["name"], "player": "", "profile": pid, "character": None,
                      "source": {"kind": "profile", "id": pid, "book": "campaign"}, "live": live, "notes": ""})
    for n in BLANK:
        party.append({"id": "wdb-member-" + n.lower(), "templateId": "blank", "name": n, "player": "", "profile": None,
                      "character": {"Name": n}, "source": {"kind": "blank"}, "live": {"glory": 0, "checks": {}}, "notes": ""})
    ids = [m["id"] for m in party]
    if len(ids) != len(set(ids)):
        print("  IDS — not unique: %r" % ids)
        fail = 1
    pack = {"kind": "sortilege-vtt-campaign", "version": 1, "party": party}
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(pack, fh, ensure_ascii=False, indent=1)
        fh.write("\n")
    print("build_seed: party %d (%s) → campaign/pack/seed.json" % (len(party), ", ".join(
        "%s%s" % (m["name"], " HP %s Glory %s" % (m["live"].get("hp"), m["live"]["glory"]) if m["profile"] else " (blank)") for m in party)))
    print("build_seed: %s" % ("FAILED" if fail else "OK"))
    return fail


if __name__ == "__main__":
    sys.exit(main())
