#!/usr/bin/env python3
"""
extract_foundry.py — the owner's Foundry VTT exports of the squires → campaign/source/squires.json.

    python3 campaign/source/extract_foundry.py [<foundry dir>]

The exports (fvtt-Actor-*.json, Foundry 13.351, the Pendragon system 13.1.61) live OUTSIDE the repo,
in ../source/foundry/ beside it: their actor names carry the player's name. Each squire here is the
export's values as the Foundry sheet shows them — the system stores a characteristic, skill, trait or
passion as its parts (base, culture, creation, winter …) and sums them when it draws the sheet; this
does the same sum, and derives Hit Points, Knockdown, Major Wound, Unconscious, Movement, Healing Rate,
Damage, Armor and Glory by the system's own code (github.com/cragstone/Pendragon, module/actor/actor.mjs at
tag 13.62, the nearest tag to 13.1.61: `_prepareCommonData`, `_prepareCharacterData`), JavaScript's Math.round and all.

What is left out, and why (campaign/PLAN.md, the decision log):
  * the player's name in the actor's name ("… (<player>)") and in the export's file name — personal data,
    never in the repo: the exports are found by a pattern;
  * a passion whose total is 0 — the system's empty slots ("Love (Person)", "Hate (Person)", "Duty
    (Vassals)" …), not a passion the squire has;
  * Foundry's bookkeeping (ids, ownership, token, flags, sheet-creation state, compendium links).

Without the exports (a fresh clone) this does nothing and says so; squires.json is committed.
"""
import glob
import html
import json
import math
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "campaign", "source", "squires.json")
DEFAULT = os.path.join(os.path.dirname(ROOT), "source", "foundry")
# the export each squire is read from — the latest of each, by a pattern (the file name carries the player's)
FILES = {
    "paun": "fvtt-Actor-squire-llwyd-'paun'-*-kVl1KjMatqwfZ70w.json",
    "tiphaine": "fvtt-Actor-Squire-Tiphaine-Character-Creation.json",
}


def find(src, pattern):
    hits = glob.glob(os.path.join(glob.escape(src), pattern))
    if len(hits) != 1:
        raise SystemExit("extract_foundry: %d exports match %s" % (len(hits), pattern))
    return hits[0]


PLAYER_TAG = re.compile(r"\s*\([^)]*\)\s*$")
STATS = ("siz", "dex", "str", "con", "app")
STAT_PARTS = ("value", "culture", "create", "poison", "disease", "sol", "age", "major", "winter")  # not growth
SKILL_PARTS = ("value", "culture", "family", "create", "winter")
TRAIT_PARTS = ("value", "religious", "winter")
PASSION_PARTS = ("value", "inherit", "sol", "homeland", "winter")


def js_round(x):
    """JavaScript's Math.round: halves round up."""
    return math.floor(x + 0.5)


def total(sysd, parts):
    return sum(int(sysd.get(k) or 0) for k in parts)


def text(h):
    """An HTML field as paragraphs of plain text, its markup dropped and its entities read."""
    paras = re.split(r"</p>\s*<p[^>]*>|<br\s*/?>", h or "")
    out = []
    for p in paras:
        t = html.unescape(re.sub(r"<[^>]+>", "", p)).strip()
        if t:
            out.append(re.sub(r"\s+", " ", t))
    return out


def squire(path, pattern):
    d = json.load(open(path, encoding="utf-8"))
    s = d["system"]
    items = d["items"]
    st = {k.upper(): total(s["stats"][k], STAT_PARTS) for k in STATS}
    hp = st["SIZ"] + st["CON"] + int(s["hp"].get("adj") or 0)
    damage = js_round((st["STR"] + st["SIZ"]) / 6) + int(s.get("damAdj") or 0)
    move = js_round((st["STR"] + st["DEX"]) / 2) + 5 + int(s.get("moveAdj") or 0)
    wounds = sum(max(int(i["system"].get("value") or 0), 0) for i in items if i["type"] == "wound")
    armour = sum(int(i["system"]["ap"]) for i in items if i["type"] == "armour" and i["system"].get("equipped") and i["system"].get("type"))
    shield = sum(int(i["system"]["ap"]) for i in items if i["type"] == "armour" and i["system"].get("equipped") and not i["system"].get("type"))
    skills = []
    for i in items:
        if i["type"] == "skill":
            skills.append({"name": i["name"], "total": total(i["system"], SKILL_PARTS), "combat": bool(i["system"].get("combat")),
                           "weaponType": i["system"].get("weaponType") or ""})
    traits = []
    for i in items:
        if i["type"] == "trait":
            t = total(i["system"], TRAIT_PARTS)
            traits.append({"virtue": i["name"], "value": max(t, 0), "vice": i["system"]["oppName"], "opp": 20 - t if t <= 20 else 0})
    passions = [{"name": i["name"], "total": total(i["system"], PASSION_PARTS)} for i in items if i["type"] == "passion"]
    history = [{"year": i["system"].get("year"), "event": i["name"], "glory": int(i["system"].get("glory") or 0),
                "note": text(i["system"].get("description") or "")} for i in items if i["type"] == "history"]
    attacks = []
    for i in items:
        if i["type"] != "weapon":
            continue
        w = i["system"]
        sk = next((x for x in skills if x["weaponType"] and x["weaponType"] == w["skill"]), None)
        dice, flat = (damage, 0) if w["damageChar"] == "c" else (0, damage) if w["damageChar"] == "b" else (0, 0)
        flat += int(w.get("damageBonus") or 0)
        dice = min(dice + int(w.get("damageMod") or 0), int(w.get("damageMax") or 99))
        attacks.append({"weapon": i["name"], "skill": sk["name"] if sk else "", "value": sk["total"] if sk else None,
                        "damage": "%dD6+%d" % (dice, flat)})
    return {
        "name": PLAYER_TAG.sub("", d["name"]),
        "file": pattern,
        "modified": d["_stats"]["modifiedTime"],
        "stats": st,
        "hp": {"max": hp, "current": hp - wounds, "knockdown": st["SIZ"], "major": st["CON"], "unconscious": js_round(hp / 4)},
        "move": move,
        "healRate": js_round(st["CON"] / 5),
        "damage": damage,
        "armour": armour, "shield": shield,
        "armourItems": [{"name": i["name"], "ap": i["system"]["ap"], "equipped": bool(i["system"].get("equipped")), "body": bool(i["system"].get("type"))}
                        for i in items if i["type"] == "armour"],
        "glory": sum(h["glory"] for h in history),
        "born": s.get("born"), "class": s.get("class") or "", "culture": s.get("culture") or "", "religion": s.get("religion") or "",
        "homeland": s.get("homeland") or "", "family": s.get("family") or "", "features": s.get("features") or "", "heir": bool(s.get("heir")),
        "lord": s.get("lord") or "", "sol": s.get("sol") or "",
        "background": text(s.get("background") or ""),
        "traits": traits, "passions": [p for p in passions if p["total"] != 0], "skills": skills,
        "attacks": attacks, "history": history,
    }


def main():
    src = sys.argv[1] if len(sys.argv) > 1 else DEFAULT
    if not os.path.isdir(src):
        print("extract_foundry: no exports at %s — squires.json kept as committed" % src)
        return 0
    out = {k: squire(find(src, f), f) for k, f in FILES.items()}
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(out, fh, ensure_ascii=False, indent=1)
        fh.write("\n")
    for k, q in out.items():
        print("extract_foundry: %s — %s, HP %d, Glory %d, %d skills, %d traits, %d passions, %d attacks, %d events"
              % (k, q["name"], q["hp"]["max"], q["glory"], len(q["skills"]), len(q["traits"]), len(q["passions"]), len(q["attacks"]), len(q["history"])))
    print("extract_foundry: OK → campaign/source/squires.json")
    return 0


if __name__ == "__main__":
    sys.exit(main())
