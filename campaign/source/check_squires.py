#!/usr/bin/env python3
"""
check_squires.py — the squires on the VTT, checked field by field against the owner's Foundry exports.

    python3 campaign/source/check_squires.py            # exit 0 = every field agrees
    python3 campaign/source/check_squires.py --plant    # plants faults; must report each and exit 1

Two halves, neither sharing code with the converter:

  A. squires.json against the exports (when ../source/foundry/ is present): every characteristic,
     skill, trait and passion total re-summed from the export's parts; Glory as the history's sum;
     every history entry, weapon and armour piece present; the name the export's, less the player.
  B. the built layer (campaign/data/campaign.js, what the VTT reads) against squires.json: every
     property of each squire's entity compared to the value squires.json gives it; no property,
     row or block the squire does not have; the DESCRIPTION the background's paragraphs.
"""
import copy
import glob
import json
import math
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SQ = os.path.join(ROOT, "campaign", "source", "squires.json")
LAYER = os.path.join(ROOT, "campaign", "data", "campaign.js")
RAW = os.path.join(os.path.dirname(ROOT), "source", "foundry")
FILES = {"paun": "wdbSquirePaun0000001", "tiphaine": "wdbSquireTiphaine001"}
NOT_PARTS = {"formula", "growth"}


class Report:
    def __init__(self):
        self.n = 0
        self.bad = []

    def eq(self, where, got, want):
        self.n += 1
        if got != want:
            self.bad.append("%s: %r ≠ %r" % (where, got, want))


def part_sum(d, skip=()):
    return sum(v for k, v in d.items() if isinstance(v, int) and not isinstance(v, bool) and k not in skip)


def check_raw(sq, r):
    for key, q in sq.items():
        hits = glob.glob(os.path.join(glob.escape(RAW), q["file"]))
        path = hits[0] if len(hits) == 1 else None
        if not path:
            r.bad.append("%s: its export %s is missing" % (key, q["file"]))
            continue
        d = json.load(open(path, encoding="utf-8"))
        r.eq(key + " name", q["name"], re.sub(r"\s*\([^)]*\)$", "", d["name"]))
        for k, st in d["system"]["stats"].items():
            r.eq("%s %s" % (key, k.upper()), q["stats"][k.upper()], part_sum({a: b for a, b in st.items() if a not in NOT_PARTS}))
        items = d["items"]
        want = {i["name"]: part_sum({a: i["system"][a] for a in ("value", "culture", "family", "create", "winter")}) for i in items if i["type"] == "skill"}
        r.eq(key + " skills", {s["name"]: s["total"] for s in q["skills"]}, want)
        want = {i["name"]: part_sum({a: i["system"][a] for a in ("value", "religious", "winter")}) for i in items if i["type"] == "trait"}
        r.eq(key + " traits", {t["virtue"]: t["value"] for t in q["traits"]}, want)
        r.eq(key + " trait pairs", {t["virtue"]: t["value"] + t["opp"] for t in q["traits"]}, {n: 20 for n in want})
        want = {i["name"]: part_sum({a: i["system"][a] for a in ("value", "inherit", "sol", "homeland", "winter")}) for i in items if i["type"] == "passion"}
        r.eq(key + " passions", {p["name"]: p["total"] for p in q["passions"]}, {n: v for n, v in want.items() if v})
        hist = [i for i in items if i["type"] == "history"]
        r.eq(key + " history", [(h["year"], h["event"], h["glory"]) for h in q["history"]], [(h["system"]["year"], h["name"], h["system"]["glory"]) for h in hist])
        r.eq(key + " glory", q["glory"], sum(h["system"]["glory"] for h in hist))
        r.eq(key + " weapons", [a["weapon"] for a in q["attacks"]], [i["name"] for i in items if i["type"] == "weapon"])
        r.eq(key + " armour", [a["name"] for a in q["armourItems"]], [i["name"] for i in items if i["type"] == "armour"])
        siz, con = q["stats"]["SIZ"], q["stats"]["CON"]
        r.eq(key + " hit points", q["hp"]["max"], siz + con)
        r.eq(key + " damage dice", q["damage"], math.floor((q["stats"]["STR"] + siz) / 6 + 0.5))


def layer_entities():
    s = open(LAYER, encoding="utf-8").read()
    return json.loads(re.search(r"var d=(\{.*\});var T=", s, re.S).group(1))["entities"]


def props(e):
    out = {}
    for p in e.get("props", []):
        if p.get("vk") == "list":
            out[p["name"]] = [{x["name"]: x["value"] for x in it["d"]} for it in p.get("items", [])]
        else:
            out[p["name"]] = p.get("value")
    return out


def expected(q):
    """What the VTT should read for a squire — written from the decision log, not from the converter."""
    bare = lambda n: n[:-1] if n.endswith("*") else n  # noqa: E731
    sk = [s for s in q["skills"] if not s["weaponType"]]
    wk = [s for s in q["skills"] if s["weaponType"]]
    e = {"Name": q["name"], **q["stats"]}
    if q["attacks"]:
        e["Attacks"] = [dict({"Weapon": a["weapon"], "Damage": a["damage"]}, **({"Skill": a["skill"], "Value": a["value"]} if a["value"] is not None else {})) for a in q["attacks"]]
    ap = "%d" % q["armour"] + ("+%d" % q["shield"] if q["shield"] else "")
    e["Statistics"] = [{"Panel": p, "Statistic": s, "Value": str(v)} for p, s, v in (
        ("Health", "Hit Points", q["hp"]["max"]), ("Health", "Knockdown", q["hp"]["knockdown"]), ("Health", "Major Wound", q["hp"]["major"]),
        ("Health", "Unconscious", q["hp"]["unconscious"]), ("Other", "Movement", q["move"]), ("Other", "Armor Points", ap),
        ("Other", "Healing Rate", q["healRate"]), ("Other", "Weapon Damage", "%dD6" % q["damage"]))]
    e["Traits"] = [{"Virtue": t["virtue"], "Virtue Value": t["value"], "Vice": t["vice"], "Vice Value": t["opp"]} for t in q["traits"]]
    worn = [a["name"] for a in q["armourItems"] if a["equipped"]]
    if worn:
        e["Armor"] = ", ".join(worn)
    if q["passions"]:
        e["Passions"] = [{"Name": bare(p["name"]), "Value": p["total"]} for p in q["passions"]]
        e["Printed Passions"] = ", ".join("%s %d" % (p["name"], p["total"]) for p in q["passions"])
    e["Skills"] = [{"Name": bare(s["name"]), "Value": s["total"]} for s in sk]
    e["Printed Skills"] = ", ".join("%s %d" % (s["name"], s["total"]) for s in sk)
    e["Weapon Skills"] = [{"Name": bare(s["name"]), "Value": s["total"]} for s in wk]
    e["Printed Weapon Skills"] = ", ".join("%s %d" % (s["name"], s["total"]) for s in wk)
    e["Born"] = q["born"]
    e["Heir"] = q["heir"]
    for k, f in (("Homeland", "homeland"), ("Lord", "lord"), ("Class", "class"), ("Culture", "culture"), ("Religion", "religion"), ("Distinctive Features", "features")):
        if q[f]:
            e[k] = q[f]
    e["Current Hit Points"] = q["hp"]["current"]
    e["Total Armor Protection"] = q["armour"] + q["shield"]
    e["Glory"] = q["glory"]
    if q["history"]:
        e["History"] = [{"Year": h["year"], "Event": h["event"] + (" — " + " ".join(h["note"]) if h["note"] else ""), "New Glory": h["glory"]} for h in q["history"]]
    kit = [a["weapon"] for a in q["attacks"]] + [a["name"] + " (not worn)" for a in q["armourItems"] if not a["equipped"]]
    if kit:
        e["Equipment"] = ", ".join(kit)
    fa = [p for p in q["background"] if p.startswith("Father: ")]
    fin = [m.group(1) for p in q["background"] for m in [re.search(r"Final Total: ([\d,]+)", p)] if m]
    if fa and fin:
        e["Parents"] = [{"Name": re.sub(r" \[.*\]$", "", fa[0][len("Father: "):]), "Value": int(fin[0].replace(",", ""))}]
    if q["family"]:
        e["Family Characteristic"] = q["family"]
    return e


def check_layer(sq, ents, r):
    for key, h in FILES.items():
        e = ents.get("#" + h)
        if not e:
            r.bad.append("%s: no entity #%s in the layer" % (key, h))
            continue
        q = sq[key]
        r.eq(key + " type", e.get("type"), "Player Knight")
        r.eq(key + " blocks", e.get("blocks", []), [])
        got, want = props(e), expected(q)
        r.eq(key + " properties", sorted(got), sorted(want))
        for k in want:
            r.eq("%s %s" % (key, k), got.get(k), want[k])
        r.eq(key + " description", e.get("desc"), "\n\n".join(q["background"]) or None)


def run(sq, ents):
    r = Report()
    if os.path.isdir(RAW):
        check_raw(sq, r)
    check_layer(sq, ents, r)
    return r


def main():
    sq = json.load(open(SQ, encoding="utf-8"))
    ents = layer_entities()
    if "--plant" in sys.argv:
        bad = copy.deepcopy(ents)
        p = bad["#wdbSquirePaun0000001"]
        next(x for x in p["props"] if x["name"] == "SIZ")["value"] = 17                       # a characteristic
        next(x for x in p["props"] if x["name"] == "Traits")["items"][1]["d"][1]["value"] = 16  # Valorous 17 → 16
        t = bad["#wdbSquireTiphaine001"]
        t["props"] = [x for x in t["props"] if x["name"] != "Family Characteristic"]            # a dropped field
        t["desc"] = t["desc"].replace("goshawk Argantia", "goshawk Argentia")                   # one letter of prose
        r = run(sq, bad)
        for b in r.bad:
            print("  PLANTED — " + b)
        ok = len(r.bad) >= 4
        print("check_squires --plant: %d reported — %s" % (len(r.bad), "the check fails as it must" if ok else "MISSED A PLANTED FAULT"))
        return 1 if ok else 2
    r = run(sq, ents)
    for b in r.bad:
        print("  DIFFERS — " + b)
    print("check_squires: %d checks over %d squires%s, %d differ" % (r.n, len(FILES), " (and their exports)" if os.path.isdir(RAW) else "", len(r.bad)))
    print("check_squires: %s" % ("OK" if not r.bad else "FAILED"))
    return 1 if r.bad else 0


if __name__ == "__main__":
    sys.exit(main())
