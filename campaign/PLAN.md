# War of the Dragon Banners × sortilege-vtt-pendragon6e — plan and decision log

A **Pendragon, 6th Edition** campaign, begun 14 November 2025 and still running: squires of Salisbury,
the children of rebels, chosen by the knights called the Wolves of Vagon and sent by Merlin after a banner.
The owner **plays** (Paun, and Tiphaine to come); the Gamemaster is someone else. Built as an **instance** of
`sortilege-vtt-pendragon6e` (`~/Sortilege/VTT/INSTANCES.md`, PLAYBOOK §4/§4b).

**This repo depends on `sortilege-vtt-pendragon6e` only.** Every script under `campaign/` is its own.

Status words: **PROPOSED** (awaiting the owner), **(owner)** decided, **landed** built and proven.

- **here** — `sortilege-inc/war-of-the-dragon-banners` (empty on GitHub until pushed; **not pushed** — W4).
- **upstream** — `sortilege-inc/sortilege-vtt-pendragon6e` (private), remote `upstream`, at `817c758`.

## What is on disk (read 2026-09-28)

Sources are **kept outside the repo**, in `../source/` beside it (they carry the players' names), copied from
`~/Downloads/2025 War of the Dragon Banners (Pendragon 6e)/`:

- `foundry/` — the owner's Foundry exports: **Paun** (`fvtt-Actor-squire-llwyd-'paun'-…-kVl1KjMatqwfZ70w.json`,
  modified 2026-05-12, the record), an earlier Paun (19 December 2025, superseded), **Tiphaine**
  (`fvtt-Actor-Squire-Tiphaine-Character-Creation.json`, 2026-05-14). Foundry 13.351, Pendragon system 13.1.61.
- `transcripts/` — the eight recorded sessions as text (three `.docx` auto-transcripts read to text, five `.txt`):
  14 Nov 2025 character creation; 5 Dec family histories; 19 Dec training day and feast; 2 Jan 2026 the hunt;
  9 Jan the choosing; 3 Apr Easter at Carohaise; 8 May the giants; 15 May the forest. Machine-made, speaker
  labels unreliable, every name several ways. **Sessions between 9 Jan and 3 Apr were played and not recorded.**
- `players.txt` — the table's real names, read by the privacy gate.
- In Downloads only: `WinterPhasev02.pdf` (a KAP 5.2 fan summary, not this edition — not used); the embrace
  images and video (not used, W3); the audio/video recordings.

## Decisions

**W1 — (owner, 2026-09-28) names: best reading, flagged.** One spelling per name, from the sheets, the corpus and
the transcripts, listed in the log below for review; each is a one-place change (`CAMPAIGN_NAMES` in
`campaign/build/build_docs.py` and the pages).

**W2 — (owner) Tiphaine is on the site** as the owner's second squire, with her VTT sheet and a page marked not yet
in play.

**W3 — (owner) art:** the portraits of Paun, Tiphaine and Branwen, Paun's arms (`CoaMaker.png`), and the Re Artù map
of Britain, all as `.webp` in `campaign/assets/`. Not used: the Paun–Branwen embrace (hasn't happened in play).

**W4 — (owner) build and commit; push and deploy on the owner's word.** Nothing is pushed. Pushing publishes
upstream's `data/` (the Pendragon books) as the other public instances do.

## Milestones

| # | What | Proof |
|---|---|---|
| **M1** | The fork — `main` = upstream `main` (`817c758`) + the instance commit: `engine/config.js` (title, storage prefix and channel `dragon-banners-vtt`, the seed, `hidePanes: ['adventure']`, `defaultSlots` Scenes · Knights · Inspector, the instance stages, Worker on 8808), `.gitattributes`, `.gitignore`, `.nojekyll`, `.claude/launch.json`, `worker/wrangler.jsonc` (`war-of-the-dragon-banners`), README | landed 2026-09-28 (`0a54e5e`). **Boundary proven by making it fail** in a throwaway clone: a fake upstream commit to `engine/config.js` and `index.html` merged without the driver → `CONFLICT (content): Merge conflict in engine/config.js`; with `merge.ours.driver true` → merged clean, the title stayed *War of the Dragon Banners*, `index.html` took upstream's line |
| **M2** | The squires — `campaign/source/extract_foundry.py` (exports → `squires.json`) · `convert_squires.py` (→ `campaign/dsl/squires/*.actor` on `ACTOR "Player Knight"`) · `build/build_layer.sh` (→ `campaign/data/`) · `check_squires.py` | landed 2026-09-28. **build_layer: OK** — 185 strings (675 occurrences) 0 uncovered · 0 short · 0 unsourced; 2 ids, none the corpus's; every reference resolves. **check_squires: OK — 93 checks over 2 squires (and their exports), 0 differ**; **proven by planted faults** in the layer (Paun SIZ 17, Valorous 16, Tiphaine's Family Characteristic dropped, one letter of her background) → 5 reported, exit 1, and in squires.json against the exports (a skill +1, Glory 976) → 2 reported. Paun: HP 32, Glory 1,362, Midsummer Feast 57 Glory (= the table's 19 × 3); Tiphaine: HP 23, Glory 975. The first build found `BOOLEAN TRUE` (the spec writes `true`) had swallowed the next property into a stray block — the gate had not caught it; `check_squires` now fails on any block or missing property |
| **M3** | The public pages — `campaign/docs/` → `campaign/build/build_docs.py` → `campaign/data/docs.js`; `campaign/site/site.js` (tabs *War of the Dragon Banners · The Chronicle · The squires · Dramatis Personae · The Realm*), `campaign.css` | landed 2026-09-28. **build_docs: OK** — home, 8 chapters, 7 squires, 15 people, 10,965 words; gates names, private, links, words. **Each proven by a planted fault**: *Aemon* → names neither the campaign nor the books use; a player's name on Jenny's page → names someone at the table; chapter 9 → does not exist; a wrong profile id → not in the campaign layer. Browser on 8758: five tabs ahead of the VTT's (books off), robots meta; Paun's page with portrait, arms, *Squire to Sir Eamon* linked, and the sheet from the layer (SIZ 16, Hit Points 32, Weapon Damage 5D6); Tiphaine's sheet; at 375 px scrollWidth 375 on every page (home, chronicle, a chapter, a squire, people, a person, the realm); 0 console errors |
| **M4** | The table's seed — `campaign/build/build_seed.py` → `campaign/pack/seed.json` | landed 2026-09-28. **build_seed: OK** — party 4: Paun (HP 32, Glory 1,362) and Tiphaine (23, 975) on their layer profiles; Sineda and Drust blank by name. Browser, fresh storage, through the gate's *Enter*: campaign *War of the Dragon Banners*, the four knights, no Adventure pane; Paun in the Inspector "Squire · South Counties (Belgae) · Hit Points 32/32 · Glory 1,362", attacks with their skills; the Hit Points *−* button → 31 in the store, log "Squire Llwyd 'Paun': Hit Points 32 → 31"; 0 console errors |
| **M5** | Deploy — push, Pages from `main`, the Worker `war-of-the-dragon-banners` | **waiting on the owner** (W4) |

`bash campaign/build/build.sh` runs M2–M4's steps and gates in order.

## Decision log

| When | Kind | Decision | Why |
|---|---|---|---|
| 2026-09-28 | autonomous, method | **`main` is upstream's `main` plus the instance commit**, not a move-and-merge | The repo was empty (Naadag's and X-FRONT's precedent) |
| 2026-09-28 | autonomous, tool | Identity Jordan Peacock <jordan@sortilege.online>; `merge.ours.driver true`; launch `dragon-banners` 8758 / `dragon-banners-worker` 8808 (free: `ss -ltn` and every launch file), also in `~/.claude/launch.json`; storage prefix and channel `dragon-banners-vtt`; Worker `war-of-the-dragon-banners` | Per-instance values |
| 2026-09-28 | autonomous, scope | **No Gamemaster material seeded** — the pack holds only the knights | The owner plays in this campaign; the Gamemaster's prep is in no source here (War of Princes' precedent) |
| 2026-09-28 | autonomous, scope | **The party is Paun, Tiphaine, Sineda, Drust.** Lothwellen, Caradoc and Gorthyn are pages, not members: their players have left the table and they are played as the Gamemaster's squires (8 May: "we also have Lothwellen, Gorthyn and Caradoc") | Only who plays is seated |
| 2026-09-28 | autonomous, fidelity | **A squire is the Foundry sheet's values as Foundry shows them.** The export stores each characteristic, skill, trait and passion as parts; they are summed, and Hit Points (SIZ+CON), Knockdown (SIZ), Major Wound (CON), Unconscious (HP/4), Movement, Healing Rate, Damage and Glory are derived, by the system's own code (`cragstone/Pendragon` `module/actor/actor.mjs`, tag 13.62), JavaScript rounding included. Armor Points is the worn pieces' sum as Foundry adds them (Paun 11: gambeson, open helm, aketon, haubergeon; the shield is not worn) | The exports carry no totals; the derivation is the sheet's own, not the book's re-applied |
| 2026-09-28 | autonomous, fidelity | **Where the values go on `ACTOR "Player Knight"`**: a skill with a weapon type is a Weapon Skill, the rest (Battle, Horsemanship) Skills, as the core's knights list them; a row's Name drops Foundry's trailing `*`, the Printed strings keep every name as printed; a history entry's note follows its name in the Event; weapons and unworn armour are Equipment; Paun's father and his final Glory (2,282) are Parents; the background is the DESCRIPTION, as the Starter's folios carry a biography. Names kept as Foundry prints them, *Vengful* and *Hafted - 2H* included | No upstream edit; one sheet type for every knight |
| 2026-09-28 | autonomous, fidelity | **A passion at 0 is left out** (Foundry's empty slots: Love (Person), Hate (Person), Duty (Vassals), Homage (Lord), Fealty (Lord), Loyalty (King), Loyalty (Companions)) | Slots, not passions the squire has |
| 2026-09-28 | autonomous, privacy | **No player's real name in the repo.** The exports' actor names and Paun's file name carry the owner's; the exports stay in `../source/foundry/`, found by a pattern, and `squires.json` drops the tag. `build_docs.py` reads the table's names from `../source/players.txt` and fails a page that names one (case-sensitive: "peacock" on Paun's page is the bird). `grep -rw` for every name over `campaign/`, `engine/config.js`, `README.md`, `.claude/`, `worker/wrangler.jsonc` → 0. The owner's personal news at the end of the 3 April recording is in no file | Personal data, not campaign material |
| 2026-09-28 | autonomous, content | **The chronicle is prose, one chapter per recorded session** — no dice, rules or players' names, nothing the recordings do not show; *The Fathers* is the two creation sessions' family histories; *The Banner* stands for the unrecorded sessions and holds only Paun's Foundry record for 464–465 (the Merlin rescue, Squire's Hill and its Lay, the barguests, Bambury, the Easter feast) and what the 3 April recap recalls | The owner's register for chronicles (Naadag P3, Fall of London, Banes) |
| 2026-09-28 | autonomous, fidelity | **Pronouns from the record**: every squire and knight *he* as the table speaks of them; Tiphaine *she* (her background); Jenny, Branwen *she* | Never inferred from a name |
| 2026-09-28 | autonomous, fidelity | **Chapter 1's history names not in the books** (Aylesford, Horsa, Thanet, Watsom Channel, Stonar, Carlion, the River Parrot) are declared as the Book of Sires' tables were read at the table | The names gate requires every name be declared |
| 2026-09-28 | autonomous, look | **The colours of Paun's arms**: the VTT's parchment tokens with `--gold` the sun, `--blue` the bend's dark blue-green, `--red` Pendragon's dragon, both schemes | An instance never edits upstream files |

### Names — best readings, for the owner's review (W1)

| Used | Heard as | Source of the choice |
|---|---|---|
| **Sir Elad of Vagon**, the **Wolves of Vagon** | Elaid, Elad Abh-Vhagan, Vagan, Aegon | The corpus: GMH's Sir Elad and the castle of Vagon on the Salisbury map (the Gamemaster: "the NPC I already had") |
| **Lord Clefford** (Sir Clefford ap Codford) | Clefford, Clifford, AbCodford | The Gamemaster's own read-out of the Wolves (19 Dec); Codford is a Wylye valley village |
| **Sir Eamon**, the Fox | Aemon, Eamon, Ammon, Airman | Irish by way of Estregales |
| **Sir Hywel** | Hiawell, Highwell, Haywell, Hywell | The corpus prints *Hywel* |
| **Sir Moriad**, the Gorgon | Moriad, Morrid, Mauryad | Consistent |
| **Sir Rayne of Wylye**, the Red Giant | Rayne, Rain, Reign, "Serene" | The transcript's own spelling; *Wylye* is the corpus's river |
| **Paun**, **Llwyd**, **Gorthyn**, **Sir Geraint ap Llwyd**, **Branwen**, **Tiphaine** | — | Paun's and Tiphaine's sheets |
| **Sineda** | Sineda, Sinaita, Senada, Sonata, Scarsineda | Most frequent |
| **Drust** | Droost, Druce, Drews, Druist | The Pictish name |
| **Lothwellen** | Lothwellen, Luthwellen, Llewellyn, Luftwell | Most frequent |
| **Caradoc** | Caradoc, Paradoc, Peridoc, Karadoc | The corpus's name list |
| **Jenny** | Jenny, Jillian, Jennifer, Janelle | She names herself "Jenny" (9 Jan) |
| **Roderick**, heir of Salisbury | Roderick, Rotary | The corpus's Roderick of Salisbury |
| **Sir Perrin** | Perrin, Parent, Parrot, Perid | The corpus's name list has *Perin* — **uncertain** |
| **Rhodri** of Cameliard | "Rotary", "King rotary" | A Welsh name close to the sound — **uncertain** |
| **Martin** of Cameliard | Martin | As heard — **uncertain** |
| **Carohaise**, **Cameliard** | "carbonides", "recuences", Camelard | The corpus's Cameliard and its castle Carohaise — **uncertain** that this is the castle meant |
| **Barnabas**, **Lady Trisha of Tintagel**, **Bambury**, **Squire's Hill** | — | As heard / Paun's sheet |

## To add a session

Write `campaign/docs/chronicle/NN-<slug>.md` from its recording (front matter `title`, `part`), add any new person
under `campaign/docs/people/` (and its name to `CAMPAIGN_NAMES`), drop a new Foundry export into `../source/foundry/`
(and its pattern into `extract_foundry.py`), then `bash campaign/build/build.sh`.
