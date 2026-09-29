// system/pendragon6e/creator.js — making a player-knight: *Creating Your Player-knight* walked step by
// step (PLAYBOOK §2), by its Constructed or its Random method (one or the other throughout, as the
// chapter says; a Random part is rolled once, with the page's die, and kept in the draft). Each step
// quotes, verbatim, only the chapter's words that govern its choices (chargen.js GUIDE — no setting
// prose, no table its controls already draw); the controls pick from the corpus's
// own sets (the religions, the Trait pairs, Table 3.5's Skills, Table 3.6's families, Table 8.1's
// weapons); every number is chargen.js's, read from the chapter's sentences and tables. What leaves is
// a knight file the table takes (system/pendragon6e/sheet.js), or, on the GM's and the player's pages,
// the knight itself.
//
// Typing never loses its box (PLAYBOOK §2): a text or number field is never rebuilt by its own input —
// what an edit changes elsewhere (the budgets, the derived numbers, the errors) is redrawn in its own
// element. A step made of +/− buttons redraws itself on a click; it holds no field being typed in.
window.PDCreator = (function () {
  const { el, button } = window.VttRender;
  const D = window.PDData;
  const E = window.PDEntity;
  const G = window.PDChargen;
  const DRAFT_KEY = ((window.VttConfig || {}).storagePrefix || 'sortilege-vtt') + ':creator-draft';

  // each step's quotes from the chapter are chargen.js's GUIDE: only the words that govern its choices
  const STEPS = [
    { id: 'knight', label: '1. Your knight' },
    { id: 'characteristics', label: '2. Characteristics' },
    { id: 'features', label: '3. Distinctive Features' },
    { id: 'traits', label: '4. Traits' },
    { id: 'passions', label: '5. Passions' },
    { id: 'skills', label: '6. Skills' },
    { id: 'training', label: '7. Training & Practice' },
    { id: 'knighted', label: '8. Being knighted' },
    { id: 'review', label: '9. The knight' },
  ];

  const fresh = () => ({ method: 'constructed', rollMode: 'all', rolled: {}, rolling: {}, parentRolled: null, name: '', religion: '', knightClass: '', homeland: '', lord: '', parentName: '', blazon: '', chars: { SIZ: 12, DEX: 12, STR: 12, CON: 12, APP: 12 }, distinctive: '', sixteen: '', traitPoints: {}, passionPoints: {}, extraPassions: [], family: '', skillPoints: {}, training: [], age: null, year: '', parentGlory: '', lordGlory: '', extraWeapon: '' });
  function load() { try { const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); return d && d.chars ? Object.assign(fresh(), d) : fresh(); } catch (e) { return fresh(); } }
  function save(d) { try { localStorage.setItem(DRAFT_KEY, JSON.stringify(d)); } catch (e) { /* a private window: the draft lives in this page only */ } }

  // ── the corpus, as chargen reads it ────────────────────────────────
  let chapterOrder = null;
  function order() {
    if (chapterOrder) return chapterOrder;
    const ch = D.chapters('core').find((c) => /creating-your-player-knight/.test(c.file));
    chapterOrder = [];
    (function walk(list) { list.forEach((e) => { chapterOrder.push(e); walk(D.children(e.id)); }); })((ch.roots || []).map(D.entity).filter(Boolean));
    return chapterOrder;
  }
  function inChapter(name) {
    const m = /^(.*)#(\d+)$/.exec(name);
    const hits = order().filter((e) => e.name === (m ? m[1] : name));
    return hits[m ? Number(m[2]) - 1 : 0] || null;
  }
  const coreTyped = (t) => D.all(['core']).filter((e) => e.type === t);
  const src = {
    text: (n) => (inChapter(n) || {}).desc || null,
    guide: (n) => ((inChapter(n) || {}).guidance || []).map((g) => g.text).join('\n'),
    table: (n) => {
      const t = coreTyped('Table').find((e) => e.name === n);
      return t ? { columns: D.val(t, 'Columns') || [], rows: D.children(t.id).filter((r) => r.type === 'Table Row').map((r) => (D.val(r, 'Cells') || []).map(String)) } : null;
    },
    tableNote: (n) => { const t = coreTyped('Table').find((e) => e.name === n); return t ? D.val(t, 'Note') || '' : ''; },
    coreText: (n) => (D.named(n, 'core') || {}).desc || null,
    pairs: () => coreTyped('Trait Pair').map((e) => ({ Virtue: D.val(e, 'Virtue'), Vice: D.val(e, 'Vice') })),
    courts: () => coreTyped('Passion Court').map((e) => ({ name: e.name, Passions: D.val(e, 'Passions') || [] })),
  };

  function render(container, path, ctx, opts) {
    const o = opts || {};
    const page = el('div', { class: 'page creator' });
    container.appendChild(page);
    page.appendChild(el('div', { class: 'muted loading' }, ['Opening the Core Rulebook…']));
    D.ensure('core').then(() => { page.innerHTML = ''; build(page, path, ctx, o); });
  }

  function build(page, path, ctx, o) {
    const R = G.rules(src);
    const d = load();
    if (!d.religion) d.religion = Object.keys(R.religions)[0] || '';
    if (!d.knightClass) d.knightClass = R.classes[0] || '';
    if (d.age == null) d.age = R.age;
    if (!d.rolling) d.rolling = {};
    if (!d.rollMode) d.rollMode = 'all';
    let stepId = (path && path[0]) || 'knight';
    if (!STEPS.some((s) => s.id === stepId)) stepId = 'knight';
    const go = (id) => { if (ctx && !o.embedded) ctx.go('create', [id]); else { stepId = id; draw(); } };

    if (R.missing.length) page.appendChild(el('div', { class: 'empty' }, ['The book no longer reads as this creator expects: ' + R.missing.join('; ') + '.']));
    page.appendChild(el('div', { class: 'creator-head' }, [el('h1', {}, ['Make a knight']), el('span', { class: 'muted small' }, ['Your draft stays in this browser.'])]));
    const nav = el('nav', { class: 'creator-steps', 'aria-label': 'Steps' });
    const grid = el('div', { class: 'creator-grid' });
    const foot = el('div', { class: 'creator-foot' });
    const todo = el('div', { class: 'creator-todo' });
    page.appendChild(nav);
    page.appendChild(grid);
    page.appendChild(foot);

    const result = () => G.build(R, d);
    // what an edit changes outside its own field: the budgets, the derived numbers, what is left to do
    const live = [];
    function refresh() {
      save(d);
      const r = result();
      todo.innerHTML = '';
      let mine = r.errors.filter((e) => e.step === stepId || stepId === 'review');
      // a part not yet rolled: only "Roll …" — its numbers are not there to be wrong
      const unrolled = new Set(mine.filter((e) => /^Roll /.test(e.text)).map((e) => e.step));
      mine = mine.filter((e) => /^Roll /.test(e.text) || !unrolled.has(e.step));
      if (mine.length) todo.appendChild(el('ul', {}, mine.map((e) => el('li', {}, [e.text]))));
      live.forEach((f) => f(r));
      nav.querySelectorAll('[data-step]').forEach((a) => a.classList.toggle('warn', r.errors.some((e) => e.step === a.dataset.step)));
    }
    const change = (fn) => { fn(); refresh(); };
    const redrawStep = () => { save(d); draw(); };

    function draw() {
      nav.innerHTML = '';
      STEPS.forEach((s, i) => nav.appendChild(el('a', { class: 'creator-step' + (s.id === stepId ? ' on' : ''), 'data-step': s.id, 'aria-current': s.id === stepId ? 'step' : null, href: ctx && !o.embedded ? ctx.href('create', [s.id]) : '#', onclick: (ev) => { if (!ctx || o.embedded) { ev.preventDefault(); go(s.id); } } }, [el('span', { class: 'creator-step-n' }, [String(i + 1)]), el('span', { class: 'creator-step-k' }, [s.label.replace(/^\d+\.\s*/, '')])])));
      grid.innerHTML = '';
      live.length = 0;
      const step = STEPS.find((s) => s.id === stepId);
      const q = G.guide(src, stepId, d.method);
      const quotes = (list, cls) => el('aside', { class: 'creator-rules' + (cls ? ' ' + cls : '') }, [cls ? null : el('div', { class: 'creator-rules-k' }, ['From the book']), q.missing.length && !cls ? el('div', { class: 'empty' }, ['The book no longer reads as this step expects: ' + q.missing.join('; ') + '.']) : null].concat(list.map((x) => el('div', { class: 'creator-quote' + (x.label ? ' labelled' : '') }, [x.label ? el('span', { class: 'creator-quote-k' }, [x.label]) : null, E.prose(x.text, 'prose', 'core')]))));
      const before = q.quotes.filter((x) => !x.after);
      const after = q.quotes.filter((x) => x.after);
      grid.classList.toggle('bare', !q.quotes.length && !q.missing.length);
      if (before.length || q.missing.length) grid.appendChild(quotes(before));
      grid.appendChild(el('div', { class: 'creator-main' }, [el('h2', { class: 'creator-step-h' }, [step.label.replace(/^\d+\.\s*/, '')]), STEP[stepId]()]));
      if (after.length) grid.appendChild(quotes(after, 'after'));
      const i = STEPS.indexOf(step);
      foot.innerHTML = '';
      foot.appendChild(todo);
      foot.appendChild(el('div', { class: 'chiprow creator-go' }, [
        i > 0 ? button('← ' + STEPS[i - 1].label.replace(/^\d+\.\s*/, ''), () => go(STEPS[i - 1].id), 'ghost') : null,
        i < STEPS.length - 1 ? button(STEPS[i + 1].label.replace(/^\d+\.\s*/, '') + ' →', () => go(STEPS[i + 1].id), 'primary') : null,
      ]));
      refresh();
    }

    const field = (label, input, note, cls) => el('label', { class: 'field' + (cls ? ' ' + cls : '') }, [el('span', { class: 'field-k' }, [label]), input, note ? el('span', { class: 'field-note' }, [note]) : null]);
    const textIn = (key, label, ph) => {
      const i = el('input', { type: 'text', class: 'text', value: d[key] || '', placeholder: ph || '', 'aria-label': label });
      i.addEventListener('input', () => change(() => (d[key] = i.value)));
      return field(label, i);
    };
    const numIn = (get, set, label, attrs) => {
      const i = el('input', Object.assign({ type: 'number', class: 'num-in', value: get() == null ? '' : get(), 'aria-label': label }, attrs || {}));
      i.addEventListener('input', () => change(() => set(i.value === '' ? '' : Number(i.value))));
      return i;
    };
    const select = (value, options, onchange, label) => {
      const s = el('select', { class: 'scope', 'aria-label': label }, options.map((x) => el('option', { value: x.value, selected: x.value === value || null }, [x.label])));
      s.addEventListener('change', () => onchange(s.value));
      return s;
    };
    // a +/− allocator: the points given to `key` in `bag`
    function stepper(bag, key, label, onchange) {
      const n = Number(bag[key]) || 0;
      return el('span', { class: 'stepper' + (n ? ' used' : '') }, [
        el('button', { class: 'step-b', type: 'button', disabled: n ? null : true, 'aria-label': 'One less to ' + label, onclick: () => { const v = (Number(bag[key]) || 0) - 1; if (v <= 0) delete bag[key]; else bag[key] = v; onchange(); } }, ['−']),
        el('b', { class: 'num' }, [n ? '+' + n : '0']),
        el('button', { class: 'step-b', type: 'button', 'aria-label': 'One more to ' + label, onclick: () => { bag[key] = (Number(bag[key]) || 0) + 1; onchange(); } }, ['+']),
      ]);
    }
    const budget = (label, used, of) => el('div', { class: 'budget' + (used === of ? ' ok' : used > of ? ' over' : '') }, [el('span', {}, [label]), el('b', {}, [used + ' of ' + of])]);
    const kv = (k, v) => el('div', { class: 'kv' }, [el('div', { class: 'kv-k' }, [k]), el('div', { class: 'kv-v' }, [v])]);
    const sum = (x) => Object.keys(x || {}).reduce((a, k) => a + (Number(x[k]) || 0), 0);
    const table = (cls, head, rows) => el('div', { class: 'table-wrap' }, [el('table', { class: 'creator-table ' + cls }, [head ? el('thead', {}, [el('tr', {}, head.map((h) => el('th', {}, [h])))]) : null, el('tbody', {}, rows)])]);

    // the Random method: a part is rolled once, with the page's die, and kept in the draft — one roll at
    // a time or all together (d.rollMode); the rolls made so far wait in d.rolling until the part is whole
    const random = () => d.method === 'random';
    const rollSide = (n) => window.PDDice.rollSide(n);
    const facesOf = (r) => { const add = r.total - r.faces.reduce((a, b) => a + b, 0); return r.faces.join('+') + (add ? (add > 0 ? '+' : '−') + Math.abs(add) : '') + ' = ' + r.total; };
    const partOf = (what) => d.rolled[what] || d.rolling[what] || null;
    function rollOnce(what) {
      const p = G.rollNext(R, what, d.rolling[what] || null, rollSide);
      if (G.nextRoll(R, what, p)) d.rolling[what] = p; else { d.rolled[what] = p; delete d.rolling[what]; }
    }
    function roller(what, allLabel) {
      if (d.rolled[what]) return null;
      const nx = G.nextRoll(R, what, d.rolling[what] || null);
      const started = !!d.rolling[what];
      const mode = el('span', { class: 'seg', role: 'group', 'aria-label': 'Rolls' }, [['all', 'All together'], ['one', 'One at a time']].map(([v, t]) => el('button', { type: 'button', class: 'seg-b' + (d.rollMode === v ? ' on' : ''), 'aria-pressed': d.rollMode === v ? 'true' : 'false', onclick: () => { d.rollMode = v; redrawStep(); } }, [t])));
      const btn = d.rollMode === 'one'
        ? button('Roll ' + nx.label + ' · ' + nx.expr, () => { rollOnce(what); redrawStep(); }, 'primary')
        : button(started ? 'Roll the rest' : allLabel, () => { while (!d.rolled[what]) rollOnce(what); redrawStep(); }, 'primary');
      return el('div', { class: 'creator-roller' }, [btn, mode]);
    }
    const rolledCell = (r, expr) => r ? el('span', { class: 'faces' }, [facesOf(r)]) : el('span', { class: 'faces pending' }, [expr || '—']);

    const STEP = {
      knight() {
        const box = el('div', { class: 'creator-form' });
        // "Players choose one and use only that one and do not cherrypick parts from the others."
        box.appendChild(field('Method', select(d.method || 'constructed', [{ value: 'constructed', label: 'Constructed' }, { value: 'random', label: 'Random' }], (v) => { d.method = v; redrawStep(); }, 'Method')));
        box.appendChild(textIn('name', 'Name', 'Sir …'));
        if (!random()) box.appendChild(field('Religion', select(d.religion, Object.keys(R.religions).map((r) => ({ value: r, label: r })), (v) => { d.religion = v; redrawStep(); }, 'Religion')));
        else box.appendChild(field('Religion', d.rolled.religion ? el('span', { class: 'field-v' }, [d.rolled.religion.value + ' ', el('span', { class: 'faces' }, [R.random.religion.die + ': ' + d.rolled.religion.total])]) : button('Roll ' + R.random.religion.die + ' on Table 3.2', () => { rollOnce('religion'); redrawStep(); }, 'primary')));
        box.appendChild(field('Class', select(d.knightClass, R.classes.map((c) => ({ value: c, label: c })), (v) => { d.knightClass = v; redrawStep(); }, 'Class')));
        box.appendChild(field('Culture', el('span', { class: 'field-v' }, [R.culture]), R.heir ? 'Heir to the family estate' : null));
        box.appendChild(textIn('homeland', 'Homeland', R.homelandDefault));
        box.appendChild(textIn('lord', 'Liege lord', R.lord));
        box.appendChild(textIn('blazon', 'Blazon', ''));
        return box;
      },
      characteristics() {
        const box = el('div');
        const cm = random() ? R.random.culturalChar : R.culturalChar;
        const rc = partOf('chars') || {};
        if (random()) { const r = roller('chars', 'Roll all five (Table 3.3)'); if (r) box.appendChild(r); }
        const finals = {};
        const derived = el('div', { class: 'creator-derived' });
        const b = el('div');
        box.appendChild(table('creator-chars', [''].concat(G.CHARS), [
          el('tr', {}, [el('th', {}, [random() ? 'Rolled' : 'Points'])].concat(G.CHARS.map((k) => el('td', {}, [random() ? rolledCell(rc[k], R.random.chars[k]) : numIn(() => d.chars[k], (v) => (d.chars[k] = v), k, { min: R.charMin, max: R.charMax })])))),
          el('tr', { class: 'mod' }, [el('th', {}, [R.culture])].concat(G.CHARS.map((k) => el('td', {}, [cm[k] ? '+' + cm[k] : ''])))),
          el('tr', { class: 'final' }, [el('th', {}, ['Value'])].concat(G.CHARS.map((k) => (finals[k] = el('td', {}, ['']))))),
        ]));
        box.appendChild(b);
        box.appendChild(derived);
        live.push((r) => {
          const known = !random() || d.rolled.chars;
          G.CHARS.forEach((k) => (finals[k].textContent = known || rc[k] ? String(random() && !d.rolled.chars ? rc[k].total + (cm[k] || 0) : r.chars[k]) : ''));
          b.innerHTML = '';
          if (r.charSum != null) b.appendChild(budget('Points', r.charSum, R.charPoints));
          derived.innerHTML = '';
          if (!known) return;
          derived.appendChild(el('div', { class: 'creator-sub' }, ['Derived']));
          derived.appendChild(el('div', { class: 'creator-kvs' }, Object.keys(r.derived).map((k) => kv(k, String(r.derived[k]) + (k === 'Weapon Damage' ? 'D6' : '')))));
        });
        return box;
      },
      features() {
        const box = el('div');
        const t = src.table('Table 3.4: Distinctive Features');
        const app = result().chars.APP;
        const row = t ? t.rows.find((r) => { const s = r[0]; const lo = G.num(s); if (/or less/.test(s)) return app <= lo; if (/or more/.test(s)) return app >= lo; const m = /(\d+)\D+(\d+)/.exec(s); return m ? app >= Number(m[1]) && app <= Number(m[2]) : app === lo; }) : null;
        if (row) box.appendChild(el('div', { class: 'callout' }, [el('b', {}, ['APP ' + app + ' · ' + row[1]]), ' — ' + row[2]]));
        const i = el('textarea', { class: 'text', rows: 2, placeholder: 'e.g. Brawny, stutter', 'aria-label': 'Distinctive Features' }, [d.distinctive || '']);
        i.value = d.distinctive || '';
        i.addEventListener('input', () => change(() => (d.distinctive = i.value)));
        box.appendChild(field('Distinctive Features', i));
        return box;
      },
      traits() {
        const r = result();
        const box = el('div');
        const all = [];
        R.pairs.forEach((p) => { all.push(p.Virtue); all.push(p.Vice); });
        const religion = random() ? r.religion : d.religion;
        const favored = R.religions[religion] || [];
        const nm = (t) => el('span', { class: 'trait-n' + (favored.indexOf(t) !== -1 ? ' favored' : '') }, [t]);
        const rt = partOf('traits') || {};
        if (random()) {
          if (!r.religion) { box.appendChild(el('div', { class: 'callout' }, ['Roll the religion first (step 1): it decides the +' + R.random.traits.religious + ' and –' + R.random.traits.opposite + '.'])); return box; }
          const rl = roller('traits', 'Roll all ' + R.pairs.length + ' Traits');
          if (rl) box.appendChild(rl);
          const adj = (p) => favored.indexOf(p.Virtue) !== -1 ? ' +' + R.random.traits.religious : favored.indexOf(p.Vice) !== -1 ? ' –' + R.random.traits.opposite : '';
          const vOf = (p) => { const x = rt[p.Virtue]; if (!x) return null; const f = r.pairs.find((y) => y.Virtue === p.Virtue); return d.rolled.traits ? f.v : x.total + (favored.indexOf(p.Virtue) !== -1 ? R.random.traits.religious : favored.indexOf(p.Vice) !== -1 ? -R.random.traits.opposite : 0); };
          box.appendChild(table('creator-traits random', null, R.pairs.map((p) => { const v = vOf(p); return el('tr', {}, [
            el('td', { class: 'faces-c' }, [rolledCell(rt[p.Virtue], p.Virtue === R.random.traits.except ? R.random.traits.exceptRoll : R.random.traits.each), rt[p.Virtue] ? el('span', { class: 'faces' }, [adj(p)]) : null]),
            el('td', { class: 'l' }, [nm(p.Virtue)]), el('td', { class: 'v' }, [v == null ? '' : String(v)]), el('td', { class: 'sl' }, ['/']), el('td', { class: 'v' }, [v == null ? '' : String(R.traitSum - v)]), el('td', { class: 'r' }, [nm(p.Vice)]),
          ]); })));
        } else {
          box.appendChild(field('Raise one Trait to ' + R.traitOne, select(d.sixteen, [{ value: '', label: 'choose…' }].concat(all.map((t) => ({ value: t, label: t }))), (v) => { d.sixteen = v; redrawStep(); }, 'The Trait raised to ' + R.traitOne), null, 'narrow'));
          box.appendChild(budget('Points', sum(d.traitPoints), R.traitPoints));
          box.appendChild(table('creator-traits', null, r.pairs.map((p) => el('tr', {}, [
            el('td', {}, [stepper(d.traitPoints, p.Virtue, p.Virtue, redrawStep)]), el('td', { class: 'l' }, [nm(p.Virtue)]), el('td', { class: 'v' }, [String(p.v)]),
            el('td', { class: 'sl' }, ['/']),
            el('td', { class: 'v' }, [String(R.traitSum - p.v)]), el('td', { class: 'r' }, [nm(p.Vice)]), el('td', {}, [stepper(d.traitPoints, p.Vice, p.Vice, redrawStep)]),
          ]))));
        }
        if (religion) box.appendChild(el('div', { class: 'muted small' }, ['Underlined: the ' + religion + ' virtues.']));
        return box;
      },
      passions() {
        const r = result();
        const box = el('div');
        const rp = partOf('passions');
        if (random()) {
          const rl = roller('passions', 'Roll all the Passions and the points');
          if (rl) box.appendChild(rl);
          if (!d.rolled.passions) {
            const rows = R.random.passions.map((x) => [x.name, rp && rp.start[x.name], x.roll]).concat(R.random.homeland ? [[R.random.homeland.name, rp && rp.homeland, R.random.homeland.roll]] : []).concat([['Points to distribute', rp && rp.pool, R.random.pool]]);
            box.appendChild(table('creator-passions', ['Passion', 'Rolled', 'Value'], rows.map((x) => el('tr', {}, [el('td', {}, [x[0]]), el('td', {}, [rolledCell(x[1], x[2])]), el('td', { class: 'v' }, [x[1] ? String(x[1].total) : ''])]))));
            return box;
          }
          box.appendChild(el('div', { class: 'budget' + (sum(d.passionPoints) > r.passionPool ? ' over' : '') }, [el('span', {}, ['Points']), el('b', {}, [sum(d.passionPoints) + ' of no more than ' + r.passionPool]), el('span', { class: 'faces' }, [R.random.pool + ': ' + facesOf(rp.pool)])]));
        } else box.appendChild(budget('Points', sum(d.passionPoints), R.passionPoints));
        const rolledOf = (name) => { if (!rp) return null; const k = Object.keys(rp.start).find((n) => n === name || name === n.replace('Homage', 'Fealty')); return k ? rp.start[k] : R.random.homeland && name === R.random.homeland.name ? rp.homeland : null; };
        box.appendChild(table('creator-passions', ['Passion'].concat(random() ? ['Rolled'] : []).concat(['Points', 'Value', '']), r.passions.map((p) => el('tr', {}, [
          el('td', {}, [p.Name]),
          random() ? el('td', {}, [rolledOf(p.Name) ? rolledCell(rolledOf(p.Name)) : '']) : null,
          el('td', {}, [stepper(d.passionPoints, p.Name, p.Name, redrawStep)]),
          el('td', { class: 'v' }, [String(p.Value)]),
          el('td', {}, [d.extraPassions.indexOf(p.Name) !== -1 ? el('button', { class: 'ref tiny', type: 'button', 'aria-label': 'Remove ' + p.Name, onclick: () => { d.extraPassions = d.extraPassions.filter((x) => x !== p.Name); delete d.passionPoints[p.Name]; redrawStep(); } }, ['×']) : null]),
        ]))));
        const names = coreTyped('Passion').map((e) => e.name);
        const add = el('input', { type: 'text', class: 'text', list: 'pd-passions', placeholder: 'Another Passion, e.g. Love (Person)', 'aria-label': 'Another Passion' });
        const doAdd = () => { const v = add.value.trim(); if (v && d.extraPassions.indexOf(v) === -1) { d.extraPassions.push(v); redrawStep(); } };
        add.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); add.blur(); doAdd(); } });
        box.appendChild(el('datalist', { id: 'pd-passions' }, names.map((n) => el('option', { value: n }))));
        box.appendChild(el('div', { class: 'creator-add' }, [add, button('Add', doAdd, 'ghost')]));
        return box;
      },
      skills() {
        const r = result();
        const box = el('div');
        if (!random()) box.appendChild(field('Family Characteristic', select(d.family, [{ value: '', label: 'choose…' }].concat(R.families.map((f) => ({ value: f.name, label: f.name + ' (+' + f.bonus + ' ' + f.printed + ')' }))), (v) => { d.family = v; redrawStep(); }, 'Family Characteristic'), null, 'narrow'));
        else if (!d.rolled.family) {
          const fr = partOf('family');
          box.appendChild(field('Family Characteristic', el('div', {}, [fr ? el('span', { class: 'faces' }, ['Rolled ' + fr.rolls.map((x) => x.total).join(', ') + ' ']) : null, roller('family', 'Roll ' + R.random.family + ' on Table 3.6')])));
        } else box.appendChild(field('Family Characteristic', el('span', { class: 'field-v' }, [r.values['Family Characteristic'] + ' ', el('span', { class: 'faces' }, [R.random.family + ': ' + d.rolled.family.rolls.map((x) => x.total).join(', ')])])));
        r.notes.filter((n) => /Transcendent/.test(n)).forEach((n) => box.appendChild(el('div', { class: 'callout' }, [n])));
        box.appendChild(budget('Points', sum(d.skillPoints), R.skillPoints));
        // Table 3.5's own groups (its heads "Combat Skills", "Weapon Skills"), side by side where there is room
        const groups = [];
        r.skills.forEach((x) => { let g = groups.find((y) => y.name === x.group); if (!g) groups.push((g = { name: x.group, skills: [] })); g.skills.push(x); });
        const row = (x) => el('tr', { class: x.knightly ? 'knightly' : null }, [
          el('td', {}, [x.name + (x.knightly ? '*' : '')]), el('td', { class: 'muted' }, [x.base === String(x.begin) ? String(x.begin) : x.base + ' = ' + x.begin]), el('td', {}, [x.bonus ? '+' + x.bonus : '']),
          el('td', {}, [x.begin === 0 && R.noRaiseFromZero ? '' : stepper(d.skillPoints, x.name, x.name, redrawStep)]), el('td', { class: 'v' }, [String(x.value)]),
        ]);
        box.appendChild(el('div', { class: 'creator-skill-groups' }, groups.map((g) => el('div', {}, [el('div', { class: 'creator-sub' }, [g.name]), table('creator-skills', ['Skill', 'Beginning', 'Bonus', 'Points', 'Value'], g.skills.map(row))]))));
        return box;
      },
      training() {
        const r = result();
        const box = el('div');
        const skillNames = r.skills.map((s) => s.name);
        const traitNames = [];
        R.pairs.forEach((p) => { traitNames.push(p.Virtue); traitNames.push(p.Vice); });
        const KINDS = [{ value: '', label: 'choose…' }, { value: 'skills', label: R.training.skills + ' Skill points' }, { value: 'trait', label: '+' + R.training.trait + ' to a Trait' }, { value: 'passion', label: '+' + R.training.trait + ' to a Passion' }, { value: 'char', label: '+' + R.training.char + ' to a Characteristic' }];
        box.appendChild(budget('Years', d.training.length, R.trainingYears));
        d.training.forEach((y, i) => {
          const row = el('div', { class: 'train-row' }, [el('b', { class: 'train-y' }, ['Year ' + (i + 1)]), select(y.kind || '', KINDS, (v) => { d.training[i] = { kind: v, name: '', points: {} }; redrawStep(); }, 'Year ' + (i + 1))]);
          const pick = (names) => select(y.name || '', [{ value: '', label: 'which…' }].concat(names.map((n) => ({ value: n, label: n }))), (v) => { y.name = v; redrawStep(); }, 'Year ' + (i + 1) + ' trains');
          if (y.kind === 'trait') row.appendChild(pick(traitNames));
          if (y.kind === 'passion') row.appendChild(pick(r.passions.map((p) => p.Name)));
          if (y.kind === 'char') row.appendChild(pick(G.CHARS));
          if (y.kind === 'skills') {
            y.points = y.points || {};
            row.appendChild(el('span', { class: 'budget inline' + (sum(y.points) === R.training.skills ? ' ok' : '') }, [sum(y.points) + ' of ' + R.training.skills]));
            row.appendChild(select('', [{ value: '', label: '+1 to…' }].concat(skillNames.map((n) => ({ value: n, label: n }))), (v) => { if (v) { y.points[v] = (y.points[v] || 0) + 1; redrawStep(); } }, 'Year ' + (i + 1) + ': a Skill point'));
            Object.keys(y.points).forEach((k) => row.appendChild(el('span', { class: 'chip' }, [k + ' +' + y.points[k], el('button', { class: 'ref tiny', type: 'button', 'aria-label': 'Take back a point from ' + k, onclick: () => { y.points[k] -= 1; if (!y.points[k]) delete y.points[k]; redrawStep(); } }, ['×'])])));
          }
          row.appendChild(el('button', { class: 'ref tiny train-x', type: 'button', 'aria-label': 'Remove year ' + (i + 1), onclick: () => { d.training.splice(i, 1); redrawStep(); } }, ['×']));
          box.appendChild(row);
        });
        if (d.training.length < R.trainingYears) box.appendChild(button('+ A year of training', () => { d.training.push({ kind: '', name: '', points: {} }); redrawStep(); }, 'ghost'));
        r.notes.filter((n) => !/Transcendent/.test(n)).forEach((n) => box.appendChild(el('div', { class: 'muted small' }, [n])));
        return box;
      },
      knighted() {
        const box = el('div');
        const form = el('div', { class: 'creator-form' });
        form.appendChild(field('Age', numIn(() => d.age, (v) => (d.age = v), 'Age', { min: 14 })));
        form.appendChild(field('Current game year', numIn(() => d.year, (v) => (d.year = v), 'Current game year')));
        form.appendChild(textIn('parentName', 'Parent’s name', ''));
        form.appendChild(field('Parent’s Glory', numIn(() => d.parentGlory, (v) => { d.parentGlory = v; d.parentRolled = null; }, 'Parent’s Glory', { min: 0, step: 100 })));
        form.appendChild(field('Glory of the lord who knighted them', numIn(() => d.lordGlory, (v) => (d.lordGlory = v), 'Glory of the lord who knighted them', { min: 0, step: 100 })));
        const weapons = R.weapons ? R.weapons.rows.filter((w) => w[2] && w[2] !== 'Weapon Skill' && ['Arming Sword', 'Lance', 'Spear', 'Dagger'].indexOf(w[0]) === -1).map((w) => w[0]) : [];
        form.appendChild(field('Additional weapon of choice', select(d.extraWeapon || '', [{ value: '', label: 'none' }].concat(weapons.map((w) => ({ value: w, label: w }))), (v) => change(() => (d.extraWeapon = v)), 'An additional weapon of choice')));
        box.appendChild(form);
        // "if you do not know it, either go through the Quick Family History below or roll 6D6 and multiply
        // the result by 100, then add 2,000" (Parent’s Glory) — for either method
        const rolledGlory = (x, how) => { d.parentGlory = x.total; d.parentRolled = Object.assign({ how }, x); redrawStep(); };
        box.appendChild(el('div', { class: 'creator-sub' }, ['Don’t know the parent’s Glory?']));
        box.appendChild(el('div', { class: 'chiprow tight' }, [
          R.parentRoll ? button('Roll ' + R.parentRoll.roll + ' × ' + R.parentRoll.times + ' + ' + R.parentRoll.add.toLocaleString('en'), () => rolledGlory(G.rollParentGlory(R, rollSide), 'roll'), 'ghost') : null,
          R.quickHistory ? button('The Quick Family History', () => rolledGlory(G.rollQuickHistory(R, rollSide), 'history'), 'ghost') : null,
        ]));
        if (d.parentRolled) box.appendChild(el('div', { class: 'callout' }, [
          el('div', {}, [el('b', {}, [d.parentRolled.total.toLocaleString('en') + ' Glory']), el('span', { class: 'faces' }, [' ' + (d.parentRolled.how === 'history' ? 'Quick Family History: ' : '') + d.parentRolled.rolls.map((x) => x.expr + ' ' + facesOf(x)).join('; ')])]),
          (d.parentRolled.events || []).length ? el('ul', { class: 'items' }, d.parentRolled.events.map((e) => el('li', {}, [el('b', {}, [(e.year && e.year !== '—' ? e.year : '')]), ' ' + (e.head ? e.head + ' ' : '') + e.text, el('span', { class: 'faces' }, [' (' + e.roll + (e.sub ? '/' + e.sub : '') + ')'])]))) : null,
        ]));
        const g = el('div', { class: 'creator-glory' });
        live.push((r) => {
          g.innerHTML = '';
          g.appendChild(el('div', { class: 'creator-kvs' }, [kv('Inherited', r.glory.inherited.toLocaleString('en')), kv('Knighted', r.glory.knighted.toLocaleString('en')), kv('From the lord', r.glory.fromLord.toLocaleString('en')), r.glory.household ? kv('Household', r.glory.household.toLocaleString('en')) : null]));
          g.appendChild(el('div', { class: 'creator-total' }, [el('span', {}, ['Glory']), el('b', {}, [r.glory.total.toLocaleString('en')])]));
          g.appendChild(el('div', { class: 'muted small' }, [r.values.Born != null ? 'Born ' + r.values.Born : 'Enter the current game year to find the year born.']));
        });
        box.appendChild(el('div', { class: 'creator-sub' }, ['Glory on being knighted']));
        box.appendChild(g);
        return box;
      },
      review() {
        const r = result();
        const v = r.values;
        const box = el('div', { class: 'creator-review' });
        const line = (list, a, b) => el('div', { class: 'printed-line' }, list.map((x, i) => [i ? ', ' : null, x[a] + ' ' + x[b]]));
        box.appendChild(el('div', { class: 'review-head' }, [el('div', { class: 'review-name' }, [v.Name || 'Your knight']), el('div', { class: 'muted' }, [[r.method === 'random' ? 'Random method' : 'Constructed method', v.Class, v.Homeland, v.Religion, v.Culture, 'Glory ' + v.Glory.toLocaleString('en')].filter(Boolean).join(' · ')])]));
        box.appendChild(el('div', { class: 'stats' }, G.CHARS.map((k) => el('div', { class: 'stat' }, [el('div', { class: 'stat-k' }, [k]), el('div', { class: 'stat-v' }, [String(v[k])])])).concat(v.Statistics.map((s) => el('div', { class: 'stat' }, [el('div', { class: 'stat-k' }, [s.Statistic]), el('div', { class: 'stat-v' }, [s.Value])])))));
        const sec = (h, body) => el('section', { class: 'review-sec' }, [el('h4', {}, [h]), body]);
        box.appendChild(sec('Attacks', el('div', {}, v.Attacks.map((a) => el('div', {}, [a.Weapon + ' · ' + a.Skill + ' ' + a.Value + ' · ' + a.Damage])))));
        box.appendChild(sec('Traits', el('div', { class: 'printed-line' }, v.Traits.map((t, i) => [i ? ', ' : null, t.Virtue + ' ' + t['Virtue Value'] + '/' + t['Vice Value'] + ' ' + t.Vice]))));
        box.appendChild(sec('Passions', line(v.Passions, 'Name', 'Value')));
        box.appendChild(sec('Skills', line(v.Skills, 'Name', 'Value')));
        box.appendChild(sec('Weapon Skills', line(v['Weapon Skills'], 'Name', 'Value')));
        box.appendChild(el('div', { class: 'muted small' }, ['Armor: ' + v.Armor + ' · Family Characteristic: ' + (v['Family Characteristic'] || '—')]));
        const ok = !r.errors.length && v.Name;
        const done = el('div', { class: 'chiprow creator-done' });
        if (!v.Name) done.appendChild(el('span', { class: 'muted' }, ['Name your knight (step 1).']));
        if (o.onDone) done.appendChild(button(o.doneLabel || 'Take this knight to the table', () => { if (ok) { o.onDone(JSON.parse(JSON.stringify(v))); } }, ok ? 'primary' : 'ghost'));
        else done.appendChild(button('Download the knight’s file', () => { if (ok) download(v); }, ok ? 'primary' : 'ghost'));
        done.appendChild(button('Start again', () => { if (confirm('Clear this draft?')) { Object.assign(d, fresh(), { method: d.method, rollMode: d.rollMode, religion: d.religion, knightClass: d.knightClass, age: R.age }); save(d); go('knight'); } }, 'ghost'));
        box.appendChild(done);
        return box;
      },
    };
    draw();
  }

  // the knight file the table reads (system/pendragon6e/sheet.js readMember): a made knight, its live
  // numbers at the sheet's own
  function fileOf(v) {
    const hp = (v.Statistics || []).find((x) => x.Statistic === 'Hit Points');
    return { kind: 'pendragon6e-knight', version: 1, name: v.Name, player: '', profile: null, character: v, live: { hp: hp ? Number(hp.Value) : null, glory: v.Glory || 0, checks: {} } };
  }
  function download(v) {
    const blob = new Blob([JSON.stringify(fileOf(v), null, 2)], { type: 'application/json' });
    const a = el('a', { href: URL.createObjectURL(blob), download: (v.Name || 'knight').replace(/[^\w-]+/g, '-').toLowerCase() + '.json' });
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
  }

  return { render, STEPS, src, fileOf };
})();
