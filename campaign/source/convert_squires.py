#!/usr/bin/env python3
"""
convert_squires.py — campaign/source/squires.json → campaign/dsl/squires/*.actor, one squire to a file,
each a DEF on the corpus's ACTOR "Player Knight" (titterpig-dsl-pendragon6e/0.5, core-base) — the same
type the VTT's creator makes, so its sheet, Knights pane and Cast read a squire unchanged.

    python3 campaign/source/convert_squires.py

Where a value goes (campaign/PLAN.md, the decision log):
  * the five Characteristics, and the Health and Other panels — Hit Points, Knockdown, Major Wound,
    Unconscious; Movement, Armor Points, Healing Rate, Weapon Damage — as the Foundry sheet shows them;
  * Attacks — every weapon, its skill and that skill's value, its damage as Foundry writes the formula;
  * Traits as pairs; Passions, Skills and Weapon Skills as Name/Value rows — a skill with a weapon type
    is a Weapon Skill, the rest (Battle, Horsemanship among them) Skills, as the core's knights list
    them. A row's Name drops Foundry's trailing "*"; the Printed … strings keep every name as Foundry
    prints it;
  * Armor — the pieces worn; Equipment — the weapons, and armour not worn;
  * History — each Foundry history entry, its year and Glory, its note after the name;
  * the Personal Information panel (Born, Heir, Homeland, Class, Culture, Religion, Distinctive
    Features), Current Hit Points, Total Armor Protection, Glory, Family Characteristic;
  * Parents — a father whose final Glory the background prints;
  * the background's paragraphs — the DESCRIPTION, as the Starter's folios carry a knight's biography.
"""
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, "campaign", "source", "squires.json")
OUT = os.path.join(ROOT, "campaign", "dsl", "squires")
HASH = {"paun": "wdbSquirePaun0000001", "tiphaine": "wdbSquireTiphaine001"}
RATED = '#pndRatedValue0000000 ^"Rated Value"'
FATHER = re.compile(r"^Father: (.+?)(?: \[.*\])?$")
FINAL = re.compile(r"Final Total: ([\d,]+)")


def q(s):
    return '"' + str(s).replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n") + '"'


def row(**kv):
    parts = []
    for k, v in kv.items():
        parts.append('^%s %s %s' % (q(k), "INTEGER" if isinstance(v, int) and not isinstance(v, bool) else "STRING", v if isinstance(v, int) else q(v)))
    return "DEF { " + "  ".join(parts) + " }"


def lst(name, of, rows, ind):
    if not rows:
        return []
    pad = " " * ind
    out = [pad + '^%s LIST OF %s [' % (q(name), of)]
    out += [pad + "    " + r + ("," if i < len(rows) - 1 else "") for i, r in enumerate(rows)]
    out.append(pad + "]")
    return out


def rated_name(n):
    return re.sub(r"\*$", "", n)


def father(sq):
    """The father's name and final Glory, where the background prints both."""
    name = next((m.group(1) for p in sq["background"] for m in [FATHER.match(p)] if m), None)
    glory = next((int(m.group(1).replace(",", "")) for p in sq["background"] for m in [FINAL.search(p)] if m), None)
    return (name, glory) if name and glory is not None else None


def actor(key, sq):
    P = " " * 12
    L = []
    prop = lambda k, t, v: L.append(P + '^%s %s %s' % (q(k), t, v if t in ("INTEGER", "BOOLEAN") else q(v)))  # noqa: E731
    prop("Name", "STRING", sq["name"])
    for c in ("SIZ", "DEX", "STR", "CON", "APP"):
        prop(c, "INTEGER", sq["stats"][c])
    L += lst("Attacks", '#pndAttack00000000000 ^"Attack"',
             [row(Weapon=a["weapon"], Skill=a["skill"], Value=a["value"], Damage=a["damage"]) if a["value"] is not None
              else row(Weapon=a["weapon"], Damage=a["damage"]) for a in sq["attacks"]], 12)
    ap = str(sq["armour"]) + ("+%d" % sq["shield"] if sq["shield"] else "")
    stats = [("Health", "Hit Points", sq["hp"]["max"]), ("Health", "Knockdown", sq["hp"]["knockdown"]),
             ("Health", "Major Wound", sq["hp"]["major"]), ("Health", "Unconscious", sq["hp"]["unconscious"]),
             ("Other", "Movement", sq["move"]), ("Other", "Armor Points", ap), ("Other", "Healing Rate", sq["healRate"]),
             ("Other", "Weapon Damage", "%dD6" % sq["damage"])]
    L += lst("Statistics", '#pndStatistic00000000 ^"Statistic"', [row(Panel=a, Statistic=b, Value=str(c)) for a, b, c in stats], 12)
    L += lst("Traits", '#pndTraitValue0000000 ^"Trait Value"',
             [row(Virtue=t["virtue"], **{"Virtue Value": t["value"]}, Vice=t["vice"], **{"Vice Value": t["opp"]}) for t in sq["traits"]], 12)
    worn = [a["name"] for a in sq["armourItems"] if a["equipped"]]
    if worn:
        prop("Armor", "STRING", ", ".join(worn))
    L += lst("Passions", RATED, [row(Name=rated_name(p["name"]), Value=p["total"]) for p in sq["passions"]], 12)
    if sq["passions"]:
        prop("Printed Passions", "STRING", ", ".join("%s %d" % (p["name"], p["total"]) for p in sq["passions"]))
    skills = [s for s in sq["skills"] if not s["weaponType"]]
    weapons = [s for s in sq["skills"] if s["weaponType"]]
    L += lst("Skills", RATED, [row(Name=rated_name(s["name"]), Value=s["total"]) for s in skills], 12)
    prop("Printed Skills", "STRING", ", ".join("%s %d" % (s["name"], s["total"]) for s in skills))
    L += lst("Weapon Skills", RATED, [row(Name=rated_name(s["name"]), Value=s["total"]) for s in weapons], 12)
    prop("Printed Weapon Skills", "STRING", ", ".join("%s %d" % (s["name"], s["total"]) for s in weapons))
    prop("Born", "INTEGER", sq["born"])
    prop("Heir", "BOOLEAN", "true" if sq["heir"] else "false")
    for k, f in (("Homeland", "homeland"), ("Lord", "lord"), ("Class", "class"), ("Culture", "culture"), ("Religion", "religion"),
                 ("Distinctive Features", "features")):
        if sq[f]:
            prop(k, "STRING", sq[f])
    prop("Current Hit Points", "INTEGER", sq["hp"]["current"])
    prop("Total Armor Protection", "INTEGER", sq["armour"] + sq["shield"])
    prop("Glory", "INTEGER", sq["glory"])
    L += lst("History", '#pndHistoryEvent00000 ^"History Event"',
             [row(Year=h["year"], Event=h["event"] + ("" if not h["note"] else " — " + " ".join(h["note"])), **{"New Glory": h["glory"]})
              for h in sq["history"]], 12)
    kit = [a["weapon"] for a in sq["attacks"]] + ["%s (not worn)" % a["name"] for a in sq["armourItems"] if not a["equipped"]]
    if kit:
        prop("Equipment", "STRING", ", ".join(kit))
    fa = father(sq)
    if fa:
        L += lst("Parents", RATED, [row(Name=fa[0], Value=fa[1])], 12)
    if sq["family"]:
        prop("Family Characteristic", "STRING", sq["family"])
    head = [
        'EXTENSION "war-of-the-dragon-banners-squire-%s" EXTENDS "pendragon6e" {' % key,
        '    NAME "War of the Dragon Banners - %s"' % sq["name"].replace('"', "'"),
        '    VERSION "0.1.0"',
        '    SPEC_VERSION "0.5"',
        '    RELEASE_DATE "2026-09-28"',
        "    # Generated by campaign/source/convert_squires.py from campaign/source/squires.json (the owner's Foundry",
        "    # export %s) — do not edit by hand. Every value as the Foundry sheet shows it; the" % sq["file"],
        "    # background is the DESCRIPTION.",
        "",
        '    #%s ^%s DEF {' % (HASH[key], q(sq["name"])),
        '        EXTENDS #pndPlayerKnightActor ^"Player Knight"',
        "        PROPERTIES {",
    ]
    tail = ["        }"]
    if sq["background"]:
        tail.append("        DESCRIPTION " + q("\n\n".join(sq["background"])))
    tail += ["    }", "}"]
    return "\n".join(head + L + tail) + "\n"


def main():
    squires = json.load(open(SRC, encoding="utf-8"))
    os.makedirs(OUT, exist_ok=True)
    for key, sq in squires.items():
        path = os.path.join(OUT, "wdb-squire-%s.actor" % key)
        with open(path, "w", encoding="utf-8") as fh:
            fh.write(actor(key, sq))
        print("convert_squires: %s → %s" % (sq["name"], os.path.relpath(path, ROOT)))
    print("convert_squires: OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
