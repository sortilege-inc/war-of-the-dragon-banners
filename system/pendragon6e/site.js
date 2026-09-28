// system/pendragon6e/site.js — what Pendragon puts on the site: the books, and the game's own lists
// across them — the knights and stat blocks, skills, traits and passions, arms and combat, Glory and
// the Winter Phase, the tables, the cards, the realm, the indexes — the d20, and search. Every word
// shown comes from titterpig-dsl-pendragon6e/0.5 through data/; this file decides only what is listed
// where. A list reads data/records.js; opening anything loads its book on demand. Ported from
// sortilege-vtt-marvelmultiverse (itself L5R5e's): the shelf, the reader and the filterable list are
// its; the tabs are this game's.
window.VttSiteTabs = (function () {
  const { el, debounce } = window.VttRender;
  const D = window.PDData;
  const E = window.PDEntity;
  const Dice = window.PDDice;
  const Site = () => window.VttSite;

  // a link inside any rendered entity opens it in the reader, loading its book first
  window.PDOpenEntity = (id) => {
    const r = D.entity(id) || D.record(id);
    if (r) Site().go('book', [r.book, id]);
  };

  const page = (container) => {
    const p = el('div', { class: 'page' });
    container.appendChild(p);
    return p;
  };
  const loading = (p, what) => p.appendChild(el('div', { class: 'muted loading' }, ['Opening ' + what + '…']));
  function after(p, ids, fn) {
    const note = loading(p, Array.isArray(ids) ? ids.map(D.label).join(', ') : D.label(ids));
    D.ensure(ids).then(() => { note.remove(); fn(); }).catch((e) => {
      console.error(e);
      p.appendChild(el('div', { class: 'empty' }, ['Could not show this: ' + e.message]));
    });
  }
  // `campaign` is an instance's own layer (build/build_layer.py) — its homebrew, shelved first.
  const KIND_ORDER = { campaign: -1, book: 0 };
  const KIND_LABEL = { campaign: 'This campaign', book: 'The books' };
  const allBooks = () => D.books().map((b) => b.id);

  // ── the books ──────────────────────────────────────────────────────
  function renderShelf(container, ctx) {
    const p = page(container);
    const idx = D.index();
    p.appendChild(el('div', { class: 'masthead' }, [
      el('h1', {}, ['The books']),
      el('p', { class: 'muted' }, [String(idx.counts.books) + ' books, generated from their corpus: ' + idx.counts.entities.toLocaleString() + ' entries out of ' + idx.counts.files + ' files. Open one.']),
    ]));
    const groups = {};
    D.books().forEach((b) => (groups[b.kind] = groups[b.kind] || []).push(b));
    Object.keys(groups).sort((a, b) => (KIND_ORDER[a] || 0) - (KIND_ORDER[b] || 0)).forEach((k) => {
      if (Object.keys(groups).length > 1) p.appendChild(el('h2', { class: 'shelf-h' }, [KIND_LABEL[k] || k]));
      p.appendChild(el('div', { class: 'shelf' }, groups[k].map((b) => el('a', { class: 'shelf-book', href: ctx.href('book', [b.id]) }, [
        el('div', { class: 'shelf-title' }, [b.label]),
        el('div', { class: 'muted small' }, [b.counts.chapters + ' chapters · ' + b.counts.entities.toLocaleString() + ' entries · ' + Math.round(b.bytes / 1024) + ' KB']),
      ]))));
    });
  }

  // the prose chapters first, in the book's order; the knights and stat blocks (one .actor file each) after them
  const proseChapters = (bid) => D.chapters(bid).filter((c) => c.kind !== 'actor');
  const profileChapters = (bid) => D.chapters(bid).filter((c) => c.kind === 'actor');
  function chapterLink(bid, c, ctx, active) {
    return el('a', { class: 'ref' + (active ? ' active' : ''), href: ctx.href('book', [bid, 'ch:' + c.file]) }, [D.shortTitle(c)]);
  }
  function tree(bid, list, ctx, openId) {
    return el('ul', { class: 'toc' }, list.map((e) => {
      const kids = D.children(e.id);
      const a = el('a', { class: 'ref' + (e.id === openId ? ' active' : ''), href: ctx.href('book', [bid, e.id]) }, [e.name]);
      if (!kids.length) return el('li', {}, [a]);
      const open = openId && (e.id === openId || D.ancestors(openId).some((x) => x.id === e.id));
      return el('li', {}, [el('details', { open: open || null }, [el('summary', {}, [a]), tree(bid, kids, ctx, openId)])]);
    }));
  }

  function renderBook(container, path, ctx) {
    const bid = path[0] && D.indexBook(path[0]) ? path[0] : null;
    if (!bid) return renderShelf(container, ctx);
    const p = page(container);
    const meta = D.indexBook(bid);
    after(p, bid, () => {
      const target = path[1] || null;
      const chFile = target && target.indexOf('ch:') === 0 ? target.slice(3) : null;
      const e = target && !chFile ? D.entity(target) : null;
      const openCh = chFile || (e ? e.file : null);
      p.appendChild(el('div', { class: 'crumbs' }, [ctx.isOpen('book') ? el('a', { href: ctx.href('book', []) }, ['The books']) : 'The books', ' › ',
        ctx.isOpen('book') ? el('a', { href: ctx.href('book', [bid]) }, [meta.label]) : meta.label,
        e ? D.ancestors(e.id).map((a) => [' › ', ctx.isOpen('book') ? el('a', { href: ctx.href('book', [bid, a.id]) }, [a.name]) : a.name]) : null]));
      // one entry opened from another tab while the books are closed: the entry alone
      if (!ctx.isOpen('book')) {
        p.appendChild(el('div', { class: 'site-reader solo' }, [e ? entityPage(e, bid, ctx) : el('div', { class: 'empty' }, ['The books are closed on this site.'])]));
        return;
      }
      const q = el('input', { type: 'search', class: 'search', placeholder: 'Search ' + meta.label + '…' });
      const results = el('div', { class: 'results' });
      q.addEventListener('input', debounce(() => showHits(results, q.value.trim(), [bid], ctx), 250));
      const chItem = (c) => {
        const roots = (c.roots || []).map(D.entity).filter(Boolean);
        const here = c.file === openCh;
        return el('li', {}, [roots.length && c.kind !== 'actor'
          ? el('details', { open: here || null }, [el('summary', {}, [chapterLink(bid, c, ctx, chFile === c.file)]), tree(bid, roots, ctx, e ? e.id : null)])
          : chapterLink(bid, c, ctx, chFile === c.file || (e && here))]);
      };
      const profs = profileChapters(bid);
      const toc = el('div', { class: 'site-toc' }, [q, results,
        el('ul', { class: 'toc chapters' }, proseChapters(bid).map(chItem)),
        profs.length ? el('details', { class: 'toc-profiles', open: (e && e.file.endsWith('.actor')) || null }, [el('summary', {}, ['Knights and stat blocks (' + profs.length + ')']), el('ul', { class: 'toc chapters' }, profs.map(chItem))]) : null,
      ]);
      let body;
      if (e) body = entityPage(e, bid, ctx);
      else if (chFile) body = chapterPage(bid, D.chapter(bid, chFile), ctx);
      else body = bookFront(bid, meta, ctx);
      p.appendChild(el('div', { class: 'reader' }, [toc, el('div', { class: 'site-reader' }, [body])]));
    });
  }

  // A large entry (more than BIG entries beneath it — the Starter's SoloQuest holds 135 passages) opens as its own text
  // and a contents list; a smaller one renders whole, its children nested as the book nests them.
  const BIG = 40;
  function entityPage(e, bid, ctx) {
    if (D.descendants(e.id) <= BIG) return E.render(e);
    return el('div', {}, [
      E.render(e, { noKids: true }),
      el('div', { class: 'contents' }, [el('h4', {}, ['In this section']), el('ul', { class: 'items columns' }, D.children(e.id).map((k) => el('li', {}, [
        el('a', { class: 'ref', href: ctx.href('book', [bid, k.id]) }, [k.name]), k.type ? el('span', { class: 'etype' }, [k.type]) : null,
        k.children && k.children.length ? el('span', { class: 'muted small' }, [' · ' + D.descendants(k.id)]) : null,
      ])))]),
    ]);
  }

  function bookFront(bid, meta, ctx) {
    return el('div', {}, [
      el('h2', {}, [meta.label]),
      el('h4', {}, ['Chapters']),
      el('ul', { class: 'items' }, proseChapters(bid).map((c) => el('li', {}, [chapterLink(bid, c, ctx), c.page ? el('span', { class: 'muted small' }, [' · from page ' + c.page]) : null]))),
      profileChapters(bid).length ? el('p', {}, [el('a', { class: 'ref', href: ctx.href('knights', []) }, [profileChapters(bid).length + ' knights and stat blocks']), ' — each its own file.']) : null,
    ]);
  }

  // A chapter: its own top-level blocks and its entities in order.
  function chapterPage(bid, c, ctx) {
    if (!c) return el('div', { class: 'empty' }, ['No such chapter.']);
    const loose = D.guidanceLoose(c.file);
    const top = (c.blocks || []).filter((b) => !('ent' in b));
    const roots = (c.roots || []).map(D.entity).filter(Boolean);
    // a knight's file is its one entity
    if (c.kind === 'actor' && roots.length === 1) return entityPage(roots[0], bid, ctx);
    return el('div', {}, [
      el('h2', {}, [D.chapterTitle(c)]),
      el('div', { class: 'muted small' }, [c.file + (c.page ? ' · from page ' + c.page : '')]),
      top.length ? E.nodes(top, bid) : null,
      E.guidance(loose, bid),
      roots.length ? el('div', { class: 'contents' }, [
        el('h4', {}, ['In this chapter']),
        el('ul', { class: 'items' }, roots.map((x) => el('li', {}, [el('a', { class: 'ref', href: ctx.href('book', [bid, x.id]) }, [x.name]), x.type ? el('span', { class: 'etype' }, [x.type]) : null]))),
      ]) : null,
    ]);
  }

  function showHits(results, term, bookIds, ctx) {
    results.innerHTML = '';
    if (term.length < 2) return;
    const hits = D.search(term, bookIds, 2000);
    const shown = hits.slice(0, 80);
    results.appendChild(el('div', { class: 'muted small' }, [hits.length + ' hits' + (hits.length > shown.length ? ' — the first ' + shown.length : '')]));
    shown.forEach((h) => {
      const ex = D.excerpt(h, term, 60);
      results.appendChild(el('div', { class: 'hit' }, [
        el('a', { class: 'ref', href: ctx.href('book', [h.book, h.id]) }, [h.name]),
        h.type ? el('span', { class: 'etype' }, [h.type]) : null,
        el('span', { class: 'muted small' }, [' · ' + D.label(h.book)]),
        ex ? el('div', { class: 'muted small' }, [ex]) : null,
      ]));
    });
  }

  // ── a filterable list over records ─────────────────────────────────
  function recordList(p, rows, opts) {
    const state = opts.state;
    const q = el('input', { type: 'search', class: 'search', placeholder: opts.placeholder, value: state.q || '' });
    const filters = (opts.filters || []).map((f) => {
      const sel = el('select', { class: 'scope' });
      sel.appendChild(el('option', { value: '' }, [f.all]));
      f.values(rows).forEach((v) => sel.appendChild(el('option', { value: v, selected: state[f.key] === v || null }, [f.label ? f.label(v) : String(v)])));
      sel.addEventListener('change', () => { state[f.key] = sel.value; draw(); });
      return sel;
    });
    const count = el('span', { class: 'muted small' });
    const out = el('div', {});
    function draw() {
      const t = (state.q || '').toLowerCase();
      const hit = rows.filter((r) => (!t || opts.text(r).toLowerCase().indexOf(t) !== -1) && (opts.filters || []).every((f) => !state[f.key] || f.match(r, state[f.key])));
      count.textContent = hit.length + ' of ' + rows.length;
      out.innerHTML = '';
      out.appendChild(opts.draw(hit));
    }
    q.addEventListener('input', debounce(() => { state.q = q.value.trim(); draw(); }, 150));
    p.appendChild(el('div', { class: 'chiprow filters' }, [q].concat(filters, [count])));
    p.appendChild(out);
    draw();
  }
  const uniq = (xs) => Array.from(new Set(xs.filter((x) => x != null && x !== ''))).sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }));
  const openRow = (r, label) => el('a', { class: 'ref', href: '#book/' + encodeURIComponent(r.book) + '/' + encodeURIComponent(r.id) }, [label || r.name]);
  const bookFilter = { key: 'book', all: 'Every book', values: (rs) => uniq(rs.map((r) => r.book)), label: D.label, match: (r, v) => r.book === v };
  const f = (r, k) => (r.fields || {})[k];

  // ── the knights and stat blocks ────────────────────────────────────
  // One per .actor file: the Core's pre-generated knights, the Starter's character folios, and the
  // stat blocks of the Handbooks and the Starter Set. A stat block says where the book prints it
  // (its Chapter and Section); a folio its Class and Homeland.
  const KIND_NAME = { Knight: 'Pre-generated knight', 'Folio Knight': 'Character folio', 'Stat Block': 'Stat block', 'Player Knight': 'Player knight' };
  const knightState = { q: '' };
  const where = (r) => [f(r, 'Chapter'), f(r, 'Section')].filter(Boolean).join(' · ') || [f(r, 'Class'), f(r, 'Homeland')].filter(Boolean).join(' · ');
  function renderKnights(container, path, ctx) {
    const p = page(container);
    const all = D.profiles();
    const id = path[0] && all.find((r) => r.id === path[0]) ? path[0] : null;
    if (id) {
      const r = all.find((x) => x.id === id);
      p.appendChild(el('div', { class: 'crumbs' }, [el('a', { href: ctx.href('knights', []) }, ['Knights & foes']), ' › ', r.name]));
      after(p, r.book, () => p.appendChild(el('div', { class: 'site-reader solo' }, [E.render(D.entity(id))])));
      return;
    }
    p.appendChild(el('h1', {}, ['Knights & foes']));
    p.appendChild(el('p', { class: 'muted' }, [all.length + ' knights and stat blocks, each an instance of the corpus’s ', el('code', {}, ['Knight']), ', ', el('code', {}, ['Folio Knight']), ' or ', el('code', {}, ['Stat Block']), ' type.']));
    recordList(p, all, {
      state: knightState, placeholder: 'Find a knight, a foe, a beast…',
      text: (r) => [r.name, f(r, 'Byline'), where(r)].filter(Boolean).join(' '),
      filters: [
        { key: 'kind', all: 'Every kind', values: (rs) => uniq(rs.map((r) => r.type)), label: (v) => KIND_NAME[v] || v, match: (r, v) => r.type === v },
        { key: 'chapter', all: 'Every chapter', values: (rs) => uniq(rs.map((r) => f(r, 'Chapter'))), match: (r, v) => f(r, 'Chapter') === v },
        bookFilter,
      ],
      draw: (hit) => el('div', { class: 'table-wrap' }, [el('table', { class: 'printed list' }, [
        el('thead', {}, [el('tr', {}, ['Name', 'Kind', 'Where', 'Book'].map((h) => el('th', {}, [h])))]),
        el('tbody', {}, hit.slice().sort((a, b) => a.name.localeCompare(b.name)).map((r) => el('tr', {}, [
          el('td', {}, [el('a', { class: 'ref', href: ctx.href('knights', [r.id]) }, [D.profileLabel(r)]), f(r, 'Byline') ? el('div', { class: 'muted small' }, [f(r, 'Byline')]) : null]),
          el('td', { class: 'small' }, [KIND_NAME[r.type] || r.type]), el('td', { class: 'small' }, [where(r)]), el('td', { class: 'muted small' }, [D.label(r.book)]),
        ]))),
      ])]),
    });
  }

  // ── sets of the corpus's own types, each entry shown whole ─────────
  // A page of sub-tabs, one per set; each set is the corpus's own type (or types), and each entry is
  // shown as the book holds it — they are short — so a player choosing reads what the book prints.
  // A set marked `list` is long: a filterable table of links instead.
  function setsPage(tabId, title, sets) {
    const state = {};
    return function (container, path, ctx) {
      const p = page(container);
      const avail = sets.filter((s) => rowsOf(s).length);
      const set = avail.find((o) => o.id === path[0]) || avail[0];
      p.appendChild(el('h1', {}, [title]));
      p.appendChild(el('div', { class: 'chiprow subtabs' }, avail.map((o) => el('a', { class: 'chip' + (o === set ? ' on' : ''), href: ctx.href(tabId, [o.id]) }, [o.label + ' (' + rowsOf(o).length + ')']))));
      if (!set) return;
      if (set.note) p.appendChild(el('p', { class: 'muted small' }, [set.note]));
      const rows = rowsOf(set);
      const st = (state[set.id] = state[set.id] || { q: '' });
      const filters = [bookFilter].concat(set.filters || []);
      if (set.list) {
        recordList(p, rows, {
          state: st, placeholder: 'Find ' + set.label.toLowerCase() + '…',
          text: (r) => r.name + ' ' + (r.under || '') + ' ' + Object.values(r.fields || {}).join(' '),
          filters,
          draw: (hit) => el('div', { class: 'table-wrap' }, [el('table', { class: 'printed list' }, [
            el('thead', {}, [el('tr', {}, [set.head || 'Name'].concat((set.cols || []).map((c) => c[0]), ['Under', 'Book']).map((h) => el('th', {}, [h])))]),
            el('tbody', {}, hit.map((r) => el('tr', {}, [el('td', {}, [openRow(r)])].concat(
              (set.cols || []).map((c) => el('td', { class: 'small' }, [String(c[1](r) == null ? '' : c[1](r))])),
              [el('td', { class: 'small' }, [r.under || '']), el('td', { class: 'muted small' }, [D.label(r.book)])])))),
          ])]),
        });
        return;
      }
      after(p, uniq(rows.map((r) => r.book)), () => recordList(p, rows, {
        state: st, placeholder: 'Find ' + set.label.toLowerCase() + '…',
        text: (r) => r.name + ' ' + (r.under || ''),
        filters,
        draw: (hit) => el('div', { class: 'option-list' }, hit.map((r) => {
          const e = D.entity(r.id);
          return e ? el('div', { class: 'option' }, [E.render(e), el('div', { class: 'muted small' }, [(r.under ? r.under + ' · ' : '') + D.label(r.book)])]) : null;
        })),
      }));
    };
  }
  const rowsOf = (s) => (s.rows ? s.rows() : D.records().filter((r) => s.types.indexOf(r.type) !== -1 && r.kind !== 'actor'));

  const renderTraits = setsPage('traits', 'Skills, traits & passions', [
    { id: 'characteristics', label: 'Characteristics', types: ['Characteristic', 'Derived Characteristic'] },
    { id: 'traits', label: 'Traits', types: ['Trait Pair'] },
    { id: 'passions', label: 'Passions', types: ['Passion Court', 'Passion', 'Obsession', 'Affliction'] },
    { id: 'skills', label: 'Skills', types: ['Skill Use', 'Skill Group', 'Skill'] },
    { id: 'ideals', label: 'Ideals & ranks', types: ['Ideal', 'Knight Rank'] },
  ]);
  const renderArms = setsPage('arms', 'Arms & combat', [
    { id: 'actions', label: 'Combat actions', types: ['Combat Action'], filters: [{ key: 'kind', all: 'Every kind', values: (rs) => uniq(rs.map((r) => f(r, 'Kind'))), match: (r, v) => f(r, 'Kind') === v }] },
    { id: 'round', label: 'The combat round', types: ['Combat Round Step', 'Melee Distance'] },
    { id: 'weapons', label: 'Weapons', types: ['Weapon Skill', 'Weapon'] },
    { id: 'armor', label: 'Armor', types: ['Armor', 'Helm', 'Shield'] },
    { id: 'prices', label: 'Prices', types: ['Price List'] },
  ]);
  const renderGlory = setsPage('glory', 'Glory & the Winter Phase', [
    { id: 'glory', label: 'Glory and Honor', types: ['Glory Award', 'Honor Loss'] },
    { id: 'winter', label: 'The Winter Phase', types: ['Winter Phase Step'] },
    { id: 'events', label: 'Personal events', types: ['Personal Event'] },
    { id: 'solos', label: 'Solos', types: ['Solo'] },
  ]);
  const renderCards = setsPage('cards', 'Cards & encounters', [
    { id: 'feast', label: 'Feast Event cards', types: ['Feast Event Card'], filters: [{ key: 'host', all: 'Every card', values: () => ['Host', 'Event'], match: (r, v) => (v === 'Host') === !!(D.entity(r.id) ? D.val(D.entity(r.id), 'Host') : false) }] },
    { id: 'battle', label: 'Battle cards', types: ['Battle Encounter Card', 'Battle Opportunity Card'] },
    { id: 'foes', label: 'Foes & opportunities', types: ['Foe Encounter', 'Opportunity'] },
  ]);
  const renderRealm = setsPage('realm', 'The realm', [
    { id: 'chronology', label: 'The chronology', types: ['Chronology', 'Period'] },
    { id: 'characters', label: 'Major characters', types: ['Major Character'] },
    { id: 'baronies', label: 'Baronies', types: ['Barony'] },
    { id: 'animals', label: 'Allegorical animals', types: ['Allegorical Animal'] },
    { id: 'maps', label: 'Maps', types: ['Map'], list: true, cols: [['Labels', (r) => (D.entity(r.id) ? D.children(r.id).length : '')]] },
  ]);

  // ── the tables ─────────────────────────────────────────────────────
  // Every Table the books draw; a table whose rows carry their roll range can be rolled on its page.
  const tableState = { q: '' };
  function renderTables(container, path, ctx) {
    const p = page(container);
    const all = D.typed('Table');
    const id = path[0] && all.find((r) => r.id === path[0]) ? path[0] : null;
    if (id) {
      const r = all.find((x) => x.id === id);
      p.appendChild(el('div', { class: 'crumbs' }, [el('a', { href: ctx.href('tables', []) }, ['Tables']), ' › ', r.name]));
      after(p, r.book, () => p.appendChild(el('div', { class: 'site-reader solo' }, [E.render(D.entity(id))])));
      return;
    }
    p.appendChild(el('h1', {}, ['Tables']));
    p.appendChild(el('p', { class: 'muted' }, [all.length + ' tables the books draw. A table with a die in its first column rolls on its page.']));
    recordList(p, all, {
      state: tableState, placeholder: 'Find a table…',
      text: (r) => r.name + ' ' + (r.under || ''),
      filters: [bookFilter],
      draw: (hit) => el('div', { class: 'table-wrap' }, [el('table', { class: 'printed list' }, [
        el('thead', {}, [el('tr', {}, ['Table', 'Under', 'Book'].map((h) => el('th', {}, [h])))]),
        el('tbody', {}, hit.map((r) => el('tr', {}, [
          el('td', {}, [el('a', { class: 'ref', href: ctx.href('tables', [r.id]) }, [r.name])]),
          el('td', { class: 'small' }, [r.under || '']), el('td', { class: 'muted small' }, [D.label(r.book)]),
        ]))),
      ])]),
    });
  }

  // ── the indexes ────────────────────────────────────────────────────
  // Each book's printed index: its terms, their pages, sub-entries and cross-references, as printed.
  const indexState = { q: '' };
  function renderIndex(container, path, ctx) {
    const p = page(container);
    p.appendChild(el('h1', {}, ['Index']));
    const rows = D.typed('Index Entry');
    after(p, uniq(rows.map((r) => r.book)), () => {
      const withText = rows.map((r) => { const e = D.entity(r.id); return Object.assign({ printed: (e && D.text(e, 'Printed')) || r.name }, r); });
      recordList(p, withText, {
        state: indexState, placeholder: 'Find a term…',
        text: (r) => r.printed,
        filters: [bookFilter],
        draw: (hit) => el('ul', { class: 'items index-list' }, hit.map((r) => el('li', {}, [openRow(r, r.printed), el('span', { class: 'muted small' }, [' · ' + D.label(r.book)])]))),
      });
    });
  }

  // ── the dice ───────────────────────────────────────────────────────
  function renderDice(container, path, ctx) {
    const p = page(container);
    p.appendChild(el('h1', {}, ['The d20']));
    after(p, 'core', () => {
      const log = el('div', { class: 'roll-log' });
      p.appendChild(Dice.roller({ onResolve: (r) => log.prepend(Dice.logLine(Dice.logEntry(r, 'You'))) }));
      const dmg = el('input', { type: 'text', class: 'search', value: '5D6', 'aria-label': 'Dice to roll', style: 'max-width:8em' });
      const dmgOut = el('span', {});
      const drawDmg = () => { dmgOut.innerHTML = ''; const b = Dice.diceButton(dmg.value, { onRoll: (r) => log.prepend(Dice.logLine({ who: 'You', dice: r.expr, faces: r.faces, total: r.total })) }); if (b) dmgOut.appendChild(b); };
      dmg.addEventListener('input', drawDmg);
      drawDmg();
      p.appendChild(el('div', { class: 'chiprow dmg' }, [el('span', { class: 'field-k' }, ['Six-sided dice (damage)']), dmg, dmgOut]));
      p.appendChild(log);
      p.appendChild(el('p', { class: 'muted small' }, ['Roll against the value with its modifiers; over 20 the rest is the critical bonus, added to the roll. The rules, as The Game System prints them:']));
      ['Unopposed Resolution', 'Opposed Resolution', 'Fixed Opposition', 'Modifiers', 'Skill Modifiers', 'Values Less Than 1', 'Dice'].map((n) => D.named(n, 'core')).filter(Boolean).forEach((e) => p.appendChild(el('details', { class: 'rules-ref' }, [el('summary', {}, [e.name]), E.render(e, { bare: true })])));
    });
  }

  // ── search everywhere ──────────────────────────────────────────────
  const searchState = { q: '' };
  function renderSearch(container, path, ctx) {
    const p = page(container);
    p.appendChild(el('h1', {}, ['Search the books']));
    const results = el('div', { class: 'results' });
    const q = el('input', { type: 'search', class: 'search wide', placeholder: 'A rule, a skill, a name…', value: searchState.q });
    const scope = el('select', { class: 'scope' }, [el('option', { value: '' }, ['Every book'])].concat(D.books().map((b) => el('option', { value: b.id }, [b.label]))));
    const run = () => {
      const ids = scope.value ? [scope.value] : allBooks();
      results.innerHTML = '';
      if (searchState.q.length < 2) return;
      results.appendChild(el('div', { class: 'muted loading' }, [ids.length > 1 ? 'Opening every book (' + Math.round(D.books().reduce((a, b) => a + b.bytes, 0) / 1048576) + ' MB) to search them…' : '']));
      D.ensure(ids).then(() => showHits(results, searchState.q, ids, ctx));
    };
    q.addEventListener('input', debounce(() => { searchState.q = q.value.trim(); run(); }, 300));
    scope.addEventListener('change', run);
    p.appendChild(el('div', { class: 'chiprow' }, [q, scope]));
    p.appendChild(results);
    if (searchState.q) run();
    setTimeout(() => q.focus(), 0);
  }

  return [
    { id: 'book', label: 'The books', render: renderBook, books: true },
    { id: 'knights', label: 'Knights & foes', render: renderKnights },
    { id: 'traits', label: 'Skills & passions', render: renderTraits },
    { id: 'arms', label: 'Arms & combat', render: renderArms },
    { id: 'glory', label: 'Glory & winter', render: renderGlory },
    { id: 'tables', label: 'Tables', render: renderTables },
    { id: 'cards', label: 'Cards', render: renderCards },
    { id: 'realm', label: 'The realm', render: renderRealm, books: true },
    { id: 'index', label: 'Index', render: renderIndex },
    { id: 'dice', label: 'Dice', render: renderDice },
    { id: 'search', label: 'Search', render: renderSearch, books: true },
  ];
})();
