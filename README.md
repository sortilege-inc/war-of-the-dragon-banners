# War of the Dragon Banners

A **Pendragon, 6th Edition** campaign, begun in November 2025: squires of Salisbury, pages together at
Sarum, whose fathers died rebelling against Vortigern, chosen as squires by the knights called the Wolves
of Vagan. After the Night of the Long Knives, Merlin sets them to find a banner for a man who has not yet
revealed himself.

This repo is an **instance** of [`sortilege-vtt-pendragon6e`](https://github.com/sortilege-inc/sortilege-vtt-pendragon6e):
the VTT owns the root (the site at `/`, the Gamemaster's table at `/gm/`, the player's page, the engine,
the generated book data); the campaign owns `campaign/` and a few per-deployment root files
(`.gitattributes`, `merge=ours`).

```bash
git config merge.ours.driver true        # once per clone — the fork boundary needs it
git fetch upstream && git merge upstream/main   # pull the VTT; a merge, never a rebase
bash campaign/build/build.sh             # the squires, the public pages, the table's seed
```

The squires with sheets (Paun and Tiphaine) are their Foundry exports (`campaign/source/foundry/`),
written into the campaign's DSL layer (`campaign/dsl/`) on the corpus's `ACTOR "Player Knight"`, built
through the books' gate into `campaign/data/`, and checked field by field against the exports.
Local: the launch entries `dragon-banners` (8758) and `dragon-banners-worker` (8808). The plan, the
decisions and the proof of each step are in `campaign/PLAN.md`.
