// campaign/site/site.js — War of the Dragon Banners' own tabs on the VTT's site, ahead of the system's
// (engine/instance.js, stage `site`): the campaign's home, the chronicle, the squires, the people they met,
// and the map of the realm. The prose is campaign/data/docs.js (window.WDB_DOCS, built by
// campaign/build/build_docs.py from campaign/docs/). A squire with a Foundry sheet (Paun, Tiphaine) also shows
// that sheet: the entity in the campaign's layer (campaign/data/campaign.js, built from campaign/dsl/ by
// build/build_layer.sh), drawn by the VTT's own renderer — the same entity the Gamemaster's table reads.
(function () {
  const DOCS = window.WDB_DOCS;
  const tabs = window.VttSiteTabs;
  if (!DOCS || !Array.isArray(tabs)) return;
  const { el } = window.VttRender;
  const D = window.PDData;
  const E = window.PDEntity;

  const page = (container) => { const p = el('div', { class: 'page wdb-page' }); container.appendChild(p); return p; };
  const prose = (h, cls) => { const d = el('div', { class: 'wdb-prose' + (cls ? ' ' + cls : '') }); d.innerHTML = h; return d; };
  const crumbs = (ctx, id, label, here) => el('div', { class: 'crumbs' }, [el('a', { href: ctx.href(id) }, [label]), here ? ' › ' + here : '']);
  const facts = (rows) => el('table', { class: 'wdb-facts' }, [el('tbody', {}, rows.filter((r) => r[1]).map((r) => el('tr', {}, [el('th', {}, [r[0]]), el('td', {}, [String(r[1])])])))]);
  const chapter = (n) => DOCS.chronicle.find((c) => c.n === n);
  // presentation only: the owner's portraits and Paun's arms (campaign/assets/)
  const img = (src, alt, cls) => el('img', { class: cls, src, alt, loading: 'lazy' });
  const portrait = (x, cls) => (x.portrait ? img('campaign/assets/portraits/' + x.portrait + '.webp', 'Portrait of ' + x.name, cls) : null);
  const ARMS = { paun: 'campaign/assets/arms/paun.webp' };
  const person = (x) => DOCS.people.find((p) => p.slug === x);

  function inChronicle(p, x, ctx) {
    const chs = (x.chapters || []).map(chapter).filter(Boolean);
    if (!chs.length) return;
    p.appendChild(el('h3', { class: 'wdb-h' }, ['In the chronicle']));
    p.appendChild(el('ul', { class: 'wdb-in' }, chs.map((c) => el('li', {}, [el('a', { href: ctx.href('chronicle', [c.slug]) }, [c.title])]))));
  }

  // ── the campaign ──
  function renderHome(container, path, ctx) {
    const p = page(container);
    const h = DOCS.home;
    p.appendChild(el('div', { class: 'wdb-hero' }, [el('h1', { class: 'wdb-title' }, [h.title]), el('p', { class: 'wdb-sub' }, [h.subtitle])]));
    p.appendChild(prose(h.html, 'wdb-lede'));
    p.appendChild(el('h2', { class: 'wdb-h' }, ['The squires']));
    p.appendChild(grid(ctx));
    const cards = [
      ['chronicle', 'The Chronicle', DOCS.chronicle.length + ' chapters, from the fathers to the fort'],
      ['people', 'Dramatis Personae', 'The Wolves of Vagon, Merlin, and the rest'],
      ['realm', 'The Realm', 'A map of Britain'],
    ];
    p.appendChild(el('div', { class: 'wdb-cards' }, cards.map((c) => el('a', { class: 'shelf-book wdb-card', href: ctx.href(c[0]) }, [el('div', { class: 'wdb-card-t' }, [c[1]]), el('div', { class: 'muted small' }, [c[2]])]))));
  }

  function grid(ctx) {
    return el('div', { class: 'wdb-grid' }, DOCS.party.map((x) => el('a', { class: 'wdb-sq', href: ctx.href('squires', [x.slug]) }, [
      portrait(x, 'wdb-sq-img') || el('div', { class: 'wdb-sq-img wdb-sq-blank' }, [x.name.charAt(0)]),
      el('div', { class: 'wdb-sq-n' }, [x.name]),
      el('div', { class: 'wdb-sq-s muted small' }, [x.role]),
    ])));
  }

  // ── the chronicle: its contents, then one chapter to a page ──
  function renderChronicle(container, path, ctx) {
    const p = page(container);
    const c = path[0] && DOCS.chronicle.find((x) => x.slug === path[0]);
    if (!c) {
      p.appendChild(el('h2', { class: 'chapter-h' }, ['The Chronicle']));
      p.appendChild(el('ol', { class: 'wdb-toc' }, DOCS.chronicle.map((x) => el('li', {}, [
        el('a', { href: ctx.href('chronicle', [x.slug]) }, [x.title]), el('span', { class: 'muted small' }, [' · ' + x.part]),
      ]))));
      return;
    }
    const prev = chapter(c.n - 1), next = chapter(c.n + 1);
    p.appendChild(crumbs(ctx, 'chronicle', 'The Chronicle', c.title));
    p.appendChild(el('h2', { class: 'chapter-h wdb-chapter-h' }, [c.title]));
    p.appendChild(el('div', { class: 'wdb-part muted' }, [c.part]));
    p.appendChild(prose(c.html, 'wdb-chapter'));
    p.appendChild(el('nav', { class: 'wdb-turn' }, [
      prev ? el('a', { href: ctx.href('chronicle', [prev.slug]) }, ['‹ ' + prev.title]) : el('span'),
      next ? el('a', { href: ctx.href('chronicle', [next.slug]) }, [next.title + ' ›']) : el('span'),
    ]));
  }

  // ── the squires ──
  function renderSquires(container, path, ctx) {
    const p = page(container);
    const x = path[0] && DOCS.party.find((c) => c.slug === path[0]);
    if (!x) {
      p.appendChild(el('h2', { class: 'chapter-h' }, ['The squires']));
      p.appendChild(grid(ctx));
      return;
    }
    p.appendChild(crumbs(ctx, 'squires', 'The squires', x.name));
    const knight = x.knight && DOCS.people.find((q) => q.name.indexOf(x.knight.replace(/^(Sir|Lord) /, '')) !== -1);
    p.appendChild(el('div', { class: 'wdb-head' }, [
      portrait(x, 'wdb-portrait'),
      el('div', { class: 'wdb-head-t' }, [
        el('h2', { class: 'chapter-h wdb-name' }, [x.full || x.name]),
        facts([['Born', x.born], ['People', x.people], ['Faith', x.faith], ['Squire to', knight ? null : x.knight]]),
        knight ? el('p', { class: 'wdb-knight' }, ['Squire to ', el('a', { href: ctx.href('people', [knight.slug]) }, [knight.name])]) : null,
        ARMS[x.slug] ? img(ARMS[x.slug], 'The arms of ' + x.name, 'wdb-arms') : null,
      ]),
    ]));
    p.appendChild(prose(x.html));
    inChronicle(p, x, ctx);
    if (!x.profile) return;
    p.appendChild(el('h3', { class: 'wdb-h' }, ['The sheet']));
    const note = el('div', { class: 'muted loading' }, ['Opening ' + x.name + '’s sheet…']);
    p.appendChild(note);
    D.ensure('campaign').then(() => {
      note.remove();
      p.appendChild(el('div', { class: 'site-reader solo wdb-sheet' }, [E.render(D.entity(x.profile))]));
    }).catch((err) => { note.remove(); p.appendChild(el('div', { class: 'empty' }, ['Could not show this: ' + err.message])); });
  }

  // ── the people they met ──
  function renderPeople(container, path, ctx) {
    const p = page(container);
    const x = path[0] && person(path[0]);
    if (!x) {
      p.appendChild(el('h2', { class: 'chapter-h' }, ['Dramatis Personae']));
      const wolves = DOCS.people.filter((q) => /Wolves of Vagon/.test(q.role || ''));
      const rest = DOCS.people.filter((q) => wolves.indexOf(q) === -1);
      [['The Wolves of Vagon', wolves], ['Others', rest]].forEach(([h, list]) => {
        p.appendChild(el('h3', { class: 'wdb-h' }, [h]));
        p.appendChild(el('div', { class: 'wdb-people' }, list.map((c) => el('a', { class: 'wdb-person', href: ctx.href('people', [c.slug]) }, [
          portrait(c, 'wdb-person-img'),
          el('div', { class: 'wdb-person-n' }, [c.name]), el('div', { class: 'wdb-person-s muted small' }, [c.role]),
        ]))));
      });
      return;
    }
    p.appendChild(crumbs(ctx, 'people', 'Dramatis Personae', x.name));
    p.appendChild(el('div', { class: 'wdb-head' + (x.portrait ? '' : ' wdb-head-solo') }, [
      portrait(x, 'wdb-portrait'),
      el('div', { class: 'wdb-head-t' }, [el('h2', { class: 'chapter-h wdb-name' }, [x.name]), el('div', { class: 'wdb-part muted' }, [x.role])]),
    ]));
    p.appendChild(prose(x.html));
    inChronicle(p, x, ctx);
  }

  // ── the realm ──
  function renderRealm(container, path, ctx) {
    const p = page(container);
    p.appendChild(el('h2', { class: 'chapter-h' }, ['The Realm']));
    const src = 'campaign/assets/maps/britain.webp';
    p.appendChild(el('a', { class: 'wdb-map', href: src, target: '_blank', rel: 'noopener' }, [img(src, 'A map of Britain', 'wdb-map-img')]));
    p.appendChild(el('p', { class: 'muted small' }, ['The map the table uses. Open it full size to read it.']));
  }

  tabs.unshift(
    { id: 'wdb', label: 'War of the Dragon Banners', render: renderHome },
    { id: 'chronicle', label: 'The Chronicle', render: renderChronicle },
    { id: 'squires', label: 'The squires', render: renderSquires },
    { id: 'people', label: 'Dramatis Personae', render: renderPeople },
    { id: 'realm', label: 'The Realm', render: renderRealm },
  );
})();
