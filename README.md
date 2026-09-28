# sortilege-vtt-pendragon6e

A virtual tabletop for **Pendragon, 6th Edition**, generated from the Titterpig corpus
`titterpig-dsl-pendragon6e/0.5`: the Core Rulebook, the Gamemaster's Handbook, the Noble's
Handbook and the Starter Set to read, the d20, the knights and stat blocks, and live sessions for
players on their own devices.

- `/` — the site: the books, the knights, the skills, traits and passions, the dice, making a
  knight, search. Writes nothing.
- `/gm/` — the Gamemaster's table: panels over the campaign, the map table (`gm/vtt.html`), the
  player's page (`gm/play.html`).

No build step for the pages; `data/` is generated:

```bash
bash build/build.sh
```

It parses every corpus file, writes `data/`, and gates the result both ways (every string the
corpus prints reaches the data as often as it is printed, and nothing in the data is not in the
corpus), then checks the shapes the site reads against counts taken from the raw corpus.

Local: the launch entries `vtt-pendragon6e` (8750) and `vtt-pendragon6e-worker` (8805;
`cd worker && npm ci` first). See `PLAN.md` for the milestones, the decisions and the proof of each.
