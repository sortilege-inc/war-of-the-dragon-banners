# sortilege-vtt-pendragon6e — plan and decision log

A virtual tabletop for **Pendragon, 6th Edition** (Chaosium), built on the Titterpig corpus
`titterpig-dsl-pendragon6e/0.5`. Its shape follows `PLAYBOOK.md` (in `~/Sortilege/VTT/`, beside the
VTT repos) and the Marvel Multiverse build, the newest of the family ("like the others"); the sibling
repos are read-only reference — nothing in them is modified here.

Status words: **PROPOSED** (awaiting the owner), **(owner)** decided, **landed** built and
verified by the main session.

## Ground rules (inherited)

- The sibling repos are read-only reference. What is reused is the system-agnostic code only:
  `engine/*.js` (no game words), the generic DSL parser, the shape of the gate and of the build,
  the Worker. No other system's data, `system/` module, css, book map or namespace comes across.
  Every word of rules text this site shows is from `titterpig-dsl-pendragon6e/0.5`.
- `data/` is generated; regenerating is the only way to change it. Corpus gaps found while
  building are reported to `titterpig-dsl-pendragon6e/TODO.md`, never patched in the tool.
- Rules text is verbatim. The tool's own words are labels and connective prose only. A number
  the rules state only in prose is a named constant citing its sentence.
- The book calls the GM the **Gamemaster**; the tool's own labels use the book's word.

## What is on disk (read 2026-09-28)

| Input | State |
|---|---|
| `~/Sortilege/VTT/sortilege-vtt-pendragon6e` | cloned empty 2026-09-28; remote `sortilege-inc/sortilege-vtt-pendragon6e` (**PRIVATE**, `gh repo view`); identity Jordan Peacock <jordan@sortilege.online> set per repo |
| `~/Sortilege/Titterpig/DSL/titterpig-dsl-pendragon6e/0.5` | 215 DSL files, 5.5 MB, clean at `a18a3c3` (D1): 81 `.ttrpg`, 134 `.actor` in `characters/`; four products — Core Rulebook 26 files, Gamemaster's Handbook 115, Noble's Handbook 19, Starter Set 55; its `./gates.sh` rc=0 at that commit |
| The art | none on disk outside the PDFs (`~/Downloads/Pendragon/`); see D4 |

**The parser** is L5R5e's (by way of Marvel Multiverse), unchanged. It reads 215 of 215 files.

### The corpus, by what the tool needs

| Need | In the corpus | Shape |
|---|---|---|
| The rules | Core chapters 1–14 and appendices; 233 `Table`s (1,834 `Table Row`s), 81 `Quotation`s, GUIDANCE sidebars and margin notes | typed DEFs, nested as the book nests them |
| The dice | d20 resolution in *The Game System*'s prose — **no FACES or outcome ladder declared** | read at M2 from the prose, each number a named constant citing its sentence |
| Character creation | *Creating Your Player Knight*: 5 `Characteristic`s (ENUM), 8 `Derived Characteristic`s (each with its printed formula), 13 `Trait Pair`s, 13 `Passion`s in 4 `Passion Court`s, 23+ `Skill`s, 11 `Weapon Skill`s, 24 `Weapon`s, 6 `Armor`s, 3 `Helm`s, 6 `Shield`s, the Character Sheet's 20 `Sheet Panel`s | typed |
| Knights and foes | `ACTOR "Knight"` (6 pre-gens), `ACTOR "Player Knight"` EXTENDS it (D1), `ACTOR "Stat Block"` (GMH: 120 across the books), `ACTOR "Folio Knight"` (Starter: 8) | ACTOR instances |
| Play | 26 `Combat Action`s, 4 `Melee Distance`s, 8 `Combat Round Step`s, 11 `Winter Phase Step`s, 20 `Personal Event`s, 7 `Glory Award`s, 6 `Honor Loss`es, 36 `Price List`s (185 `Price`s); GMH: 12 `Foe Encounter`s, 6 `Opportunity`s, 10 `Major Character`s, 73 `Feast Event Card`s, 15 `Allegorical Animal`s; NH: 20 `Barony` records; Starter: 135 `Quest Passage`s, 17 battle cards | typed |
| Setting | 13 `Period`s of *The Pendragon Chronology*; 6 `Map`s (624 `Map Label`s) | typed |
| An adventure | **none as an `.arc`** — GMH ch. 9's scenarios and the Starter's Book III are chapters | the Gamemaster's own scenes (M3) |

## Decisions

**D1 — `ACTOR "Player Knight"` in the Core BASE (owner, 2026-09-28).** The Core's `ACTOR "Knight"`
holds only what the six pre-generated knights print (SIZ–APP, Attacks, Health/Other, 13 Traits,
Armor, Passions, Skills, Weapon Skills) — no Glory, Homeland, Lord, Class, Culture, Religion,
Heir, horses, squire or history. Asked with three options (a Core ACTOR; the Starter's Folio Knight;
Knight alone); the owner took the Core ACTOR. Added in the conversion's `gen_base.py` (BASE 0.5.1,
corpus `a18a3c3`, its TODO V1): Player Knight EXTENDS Knight with the character sheet's other panels
in their printed order, and one new type, `History Event`. Only the BASE regenerated — `gen_base`
reproduced the committed file byte for byte first; `./gates.sh` rc=0 after.

**D2 — the books are the shelf; a book's chapters are its files** (autonomous, tool/method).
`build/build_data.py` maps each corpus file to its book by the file-name prefix
(`pendragon6e-0.5-<book>-…`, the name not the path). Four books: `core`, `gmh`, `nh`, `starter`, in
that order (the Core supersedes the Starter's rules). *The Sauvage King* is one line of `BOOKS` once
converted.

**D3 — private; deployment deferred** (autonomous default, as Marvel Multiverse's D3; the owner's to
change). The GitHub repo is private. Nothing in the repo hard-codes an origin; the Worker admits
localhost and, until a deploy is decided, only `sortilege-inc.github.io`; `engine/config.js` has
`worker.deployed` empty.

**D4 — no art for now** (autonomous default, as Marvel Multiverse's D4). Text and CSS with the tool's
own mark; the PDFs' art is the owner's call to offer.

**D5 — the §4c GM workbench from the start.** Marvel Multiverse's engine already carries it (the
sectioned nav, layout presets, the Scenes outline of typed beats, Encounter beats, tracked copies),
so it arrives with M0 rather than as a later port.

## Layout (the inherited three-layer shape; everything game-specific written here)

```
index.html                  the site
build/                      the generators and their gates
data/                       GENERATED — window.PENDRAGON6E.books / .entities / .index / .records
engine/                     system-agnostic, copied whole from Marvel Multiverse
system/pendragon6e/         accessors, the entity renderer, the dice, the sheet, the creator, the
                            site's tabs; for the table: ops, the table adapter, panels
gm/                         the Gamemaster's page, the table (vtt.html), the player's page
worker/                     the session rooms (Cloudflare Worker + Durable Object); not deployed
```

## Milestones

| # | Milestone | Proof required |
|---|---|---|
| M0 | Repo skeleton: `engine/*.js`, `worker/`, `build/` from Marvel Multiverse HEAD, renamed; `engine/config.js`; `system/pendragon6e/ops.js`; launch entries (`vtt-pendragon6e` 8750, `vtt-pendragon6e-worker` 8805) | **landed 2026-09-28** — `grep -rniE 'vtm\|vampire\|kindred\|l5r\|samurai\|rokugan\|coyote\|marvel\|narrator\|d616\|karma'` over `engine worker/src build system` matches only provenance comments ("Ported from sortilege-vtt-l5r5e"); the pilot parse reads 215 of 215 DSL files; `node` loads `engine/ops.js` + `system/pendragon6e/ops.js` (register, shared, playerView…) |
| M1 | `build/` generates `data/` from the corpus losslessly; `verify_data.py` both directions **and by count**; `check_shape.py` against counts scanned from the corpus; `build_layer.sh` with a Pendragon fixture | **landed 2026-09-28** — `bash build/build.sh` exit 0: 215 corpus files → 4 books, 6,492 entities (0 ids written here), 4,482 records; `verify_data: 15391 strings (69486 occurrences) — 0 uncovered · 0 short · 0 unsourced`; `check_shape: OK (259 assertions)` — every typed set by its own EXTENDS lines, the four ACTORs and 34 declared fields, one knight or stat block per `.actor` (134), the 14 knights with thirteen Trait Values, every row of every typed-list kind by a bracket count of the raw text, every named value by field name, TABLEs / ROWs, GUIDANCE entries, the DESCRIPTIONs. **Proven to fail**: the data checked against a corpus copy with one Passion row added to the Hardy Knight → 3 FAILED (exit 1). `build_layer.sh build/fixtures/layer`: references and names resolve, OK; a copy with a mistyped Player Knight hash and a misspelt MODIFY target **fails** (exit 1) |
| M2 | The site: the books (outline, reader, sidebars, tables), the knights and stat blocks, skills, traits and passions, weapons and armor, the chronology, the d20 roller, search; the §4b standards that concern the site | **landed 2026-09-28** — in the browser pane through the real controls: books off by default shows 8 tabs (Knights & foes, Skills & passions, Arms & combat, Glory & winter, Tables, Cards, Index, Dice), on shows 11 (+ The books, The realm, Search); the shelf lists the four books; the Core's reader lists its 20 prose chapters and its 6 knights; *The Hardy Knight* as the book prints him (SIZ–APP, the Health and Other panels, 5 attacks, the 13 trait pairs as virtue value · pair · vice value, armor and its note, his printed Passions / Skills / Weapon Skills); a stat block (*Bandit*) under its own heads with its printed fields; a folio (*Sir Clarion*); *Table 14.1 Personal Events* rolled with the d20 pinned to 7 → only the row "7 Merciful" marked; Table 7.5's "Mount" drawn over 4 rows, Table 11.2's "Aggravation Effect" over 2 columns, Table 3.1's "5" over 7 rows; the quotation *King Pellinore Strikes a Critical* set with its attribution; a book entry opened with the books closed shows alone; the d20 roller, dice pinned: Value 17 → a 17 → *Critical Success* (logged); Value 15, fixed opposition 15, a 14 → *Success* against a fixed 15 → *Partial Success*; search "Grammarye" over every book → 10 hits; every list tab's sub-tab counts equal the typed sets (Skills 58, Traits 26, Passions 26, Combat actions 40, Feast Event cards 73, Baronies 20, Index 416, knights 134); 375 px: 25 pages, none scrolls sideways (the Skills page did, at 634 px, until the grid columns could shrink); 0 console errors. `node build/check_dice.js` (in build.sh): 23 assertions, each quoting its sentence, which must be in the corpus as quoted — OK; with the critical bonus's "counted as a critical success with a value of 20" removed → 2 FAILED |
| M3 | The Gamemaster's page (and its §4b gate): Adventure (the Gamemaster's own scenes), Knights, Inspector, Cast, Dice, Rules & Book, Log, Campaign; the engine's GM panes; a first live sheet; the table and the player's page wired | |
| M4 | The sheet derived from ACTOR "Player Knight"; the creator (*Creating Your Player Knight* walked over the typed sets); the live sheet (Hit Points, wounds, Glory; skill, trait and passion rolls) | |
| M5 | Sessions proven with `wrangler dev` on 8805; deploy stays off (D3) | |

One commit per milestone; each proven by the main session through the real controls
(PLAYBOOK §5) before the next begins.

## Decision log

| # | Decision | Why |
|---|---|---|
| 1 | `engine/`, `worker/`, `build/`, `robots.txt`, `.gitignore`, `gm/`, `assets/css/gm.css` taken from Marvel Multiverse HEAD `d97b9f1` by `git archive`, never the working tree | The newest of the family: its engine is Coyote & Crow's workbench (itself VtM5e's), its build is L5R5e's lossless dump with a generic `check_shape`, and its M5 session harness is the family's latest |
| 2 | Local ports **8750 / 8805** | Every port in 8731–8749, 8751–8752, 8754–8755 and 8787–8804 is in a launch entry already (`~/.claude/launch.json` and every repo's own) and 8756 is listening; neither of these is listening (`ss -ltn`). Both entries added to `~/.claude/launch.json` |
| 3 | D2 above: four books, `core`, `gmh`, `nh`, `starter` | — |
| 4 | No parser extensions were needed | The shape gate passes on the inherited parser as it is |
| 5 | `check_shape.py`'s ACTOR section rewritten for this corpus (the four ACTORs read from every file's `ACTOR "…" DEF` lines; the Knight's and the Player Knight's fields; one knight or stat block per `.actor`; thirteen Trait Values per knight); everything else is Marvel's generic checks | The generic parts name no set by hand; the ACTOR part is the one place a system's own fields are asserted |
| 6 | Proof of failure is the data checked against a mutated corpus copy, not a build from it | A build from the mutated copy moves both sides alike and passes (tried first); the gate's job is to see the data disagree with the corpus |
| 7 | `RECORD_FIELDS`: Byline, Chapter, Section, Class, Homeland, Weapon Skill, Period, Size, Court, Kind, Mounting, Roll, Glory, Honor, Number, County, Title | The fields a list of stat blocks, weapons, armor, passions, combat actions, events, passages and baronies sorts and filters on, read off the types files |
| 8 | The layer fixture rewritten for this corpus: a Player Knight with a Passion and a History Event, a MODIFY and a CONCERNS by name on *Hospitality* | The inherited fixture pointed at Marvel hashes; the gate must be proven against this corpus |
| 9 | GM-facing labels in `engine/config.js` say **Gamemaster** (the gate's title and text); the default campaign is "A new campaign" with no module | The book's own word for the GM; "campaign" is the book's word too |
| 10 | Marvel's `tools/check-session.js`, `check_dice.js` and `check_chargen.js` not taken at M0; this repo writes its own at M2 (dice), M4 (creator) and M5 (sessions) | Each asserts Marvel's own rules and examples |
| 11 | `system/pendragon6e/data.js` and `entity.js` ported from Marvel Multiverse (the same data shape); `dice.js`, `site.js`, `assets/css/pendragon6e.css` and the mark written here | The data is the same lossless dump, so its accessors fit; nothing of Marvel's look or game comes across (its comic borders and uppercase were stripped from the copied stylesheet) |
| 12 | A `Table` renders as the table the book draws: caption, heads, a head over several columns (Spans), rows (a Header row as heads), a cell over several rows (Row Spans) — each span applied only where the cells it covers are printed blank, so no text is hidden | 233 tables are typed `Table`/`Table Row` entities, not TABLE blocks; Row counts the heads' row as row 1 (Table 7.5's "Mount", Table 3.1's "5" read so) |
| 13 | A table whose first head is a die ("1D20", "2D6 Roll") and whose rows carry Minimum/Maximum rolls on its page, marking the row | 81 tables are rollable so; the range is the corpus's own, never parsed here |
| 14 | A knight's and a stat block's lists show the printed line when the corpus keeps one ("Printed Passions"; a stat block's "Traits:" Field) and hide the parsed list it prints; the parsed lists are what the sheet rolls | Both are the corpus's; showing both printed the same line twice. The printed form is the verbatim one. Labelled by the list it prints ("Passions") |
| 15 | Tabs: The books, The realm and Search are the books' tabs (closed by default, §4b.4); Knights & foes, Skills & passions, Arms & combat, Glory & winter, Tables, Cards, Index and Dice always show | §4b.4: reference tabs, stat blocks and dice stay; the realm (the chronology, baronies, major characters, maps) is setting text. The Starter's SoloQuest is in its book, not a tab |
| 16 | The d20: critical when the roll plus any critical bonus equals the modified value (or reaches 20 over a value of 20); a fumble on a natural 20 below 20, and from 20 + value when the value is below zero; opposed and fixed resolution by the book's five outcomes; a critical counts as 20 against an opponent | Each step cites its sentence in dice.js; the rules are pure and replayed by build/check_dice.js |
| 17 | Six-sided dice read the first expression of a printed string ("7D6†" → 7D6; "1D3" as the book defines it) | The damage the book prints carries marks; the mark stays as printed beside the roll |
