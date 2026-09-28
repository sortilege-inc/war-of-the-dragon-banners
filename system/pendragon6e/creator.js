// system/pendragon6e/creator.js — making a player-knight: *Creating Your Player-knight* walked step by
// step (PLAYBOOK §2), by its Constructed method. Each step shows the chapter's own text for it,
// verbatim (its entities, rendered as the reader renders them); the controls pick from the corpus's
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

  // the chapter's entities each step shows, in the chapter's order, each shallow (its own text, not
  // what nests in it; a table's rows are its own); 'Name#2' is the second entity of that name
  const STEPS = [
    { id: 'knight', label: '1. Your knight', text: ['Character Creation', 'Constructed Characters', 'Culture and Homeland', 'Religion', 'Constructed', 'Liege Lord and Current Home', 'Class', 'Heir'] },
    { id: 'characteristics', label: '2. Characteristics', text: ['Characteristics', 'Constructed Method', 'Derived Characteristics', 'Knockdown', 'Major Wound', 'Weapon Damage', 'Brawling Damage', 'Healing Rate', 'Movement Rate', 'Total Hit Points', 'Unconscious'] },
    { id: 'features', label: '3. Distinctive Features', text: ['Distinctive Features', 'Table 3.4: Distinctive Features', 'Sample Distinctive Features', 'Physique', 'Limbs', 'Hair', 'Face', 'Speech'] },
    { id: 'traits', label: '4. Traits', text: ['Personality Traits', 'Religious Virtues', 'Constructed Method#2', 'Fill in the Opposite Values'] },
    { id: 'passions', label: '5. Passions', text: ['Passions', 'Constructed Method#3', 'Inherited Passions'] },
    { id: 'skills', label: '6. Skills', text: ['Skills', 'Beginning Values', 'Table 3.5: Beginning Knight Skill Values', 'Cultural Skill Modifiers', 'Family Characteristic', 'Constructed#2', 'Table 3.6: Family Characteristics', 'Personal Skill Additions', 'Limitations'] },
    { id: 'training', label: '7. Training & Practice', text: ['Attaining Knighthood#2', 'Training & Practice'] },
    { id: 'knighted', label: '8. Being knighted', text: ['Age & Year Born', 'Parent’s Glory', 'Glory', 'Starting Knightly Gear', 'Horses', 'Table 3.8: Starting Horses'] },
    { id: 'review', label: '9. The knight', text: [] },
  ];

  const fresh = () => ({ name: '', religion: '', knightClass: '', homeland: '', lord: '', parentName: '', blazon: '', chars: { SIZ: 12, DEX: 12, STR: 12, CON: 12, APP: 12 }, distinctive: '', sixteen: '', traitPoints: {}, passionPoints: {}, extraPassions: [], family: '', skillPoints: {}, training: [], age: null, year: '', parentGlory: '', lordGlory: '', extraWeapon: '' });
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
    let stepId = (path && path[0]) || 'knight';
    if (!STEPS.some((s) => s.id === stepId)) stepId = 'knight';
    const go = (id) => { if (ctx && !o.embedded) ctx.go('create', [id]); else { stepId = id; draw(); } };

    if (R.missing.length) page.appendChild(el('div', { class: 'empty' }, ['The book no longer reads as this creator expects: ' + R.missing.join('; ') + '.']));
    page.appendChild(el('h1', {}, ['Make a knight']));
    page.appendChild(el('p', { class: 'muted' }, ['The chapter’s Constructed method, step by step. Your draft stays in this browser.']));
    const nav = el('div', { class: 'chiprow subtabs creator-steps' });
    const body = el('div', { class: 'creator-body' });
    const status = el('div', { class: 'creator-status' });
    page.appendChild(nav);
    page.appendChild(status);
    page.appendChild(body);

    const result = () => G.build(R, d);
    // what an edit changes outside its own field: the budgets, the errors of this step
    const live = [];
    function refresh() {
      save(d);
      const r = result();
      status.innerHTML = '';
      const mine = r.errors.filter((e) => e.step === stepId || (stepId === 'review'));
      if (mine.length) status.appendChild(el('ul', { class: 'errors' }, mine.map((e) => el('li', {}, [e.text]))));
      if (stepId === 'review' || stepId === 'training') r.notes.forEach((n) => status.appendChild(el('div', { class: 'muted small' }, [n])));
      live.forEach((f) => f(r));
    }
    const change = (fn) => { fn(); refresh(); };
    const redrawStep = () => { save(d); draw(); };

    function draw() {
      nav.innerHTML = '';
      const errs = result().errors;
      STEPS.forEach((s) => nav.appendChild(el('a', { class: 'chip' + (s.id === stepId ? ' on' : '') + (errs.some((e) => e.step === s.id) ? ' warn' : ''), href: ctx && !o.embedded ? ctx.href('create', [s.id]) : '#', onclick: (ev) => { if (!ctx || o.embedded) { ev.preventDefault(); go(s.id); } } }, [s.label])));
      body.innerHTML = '';
      live.length = 0;
      const step = STEPS.find((s) => s.id === stepId);
      const text = el('details', { class: 'creator-text', open: stepId !== 'review' || null }, [el('summary', {}, ['The book, for this step'])].concat(step.text.map(inChapter).filter(Boolean).map((e) => E.render(e, { depth: 1, shallow: true }))));
      if (step.text.length) body.appendChild(text);
      body.appendChild(STEP[stepId]());
      const i = STEPS.indexOf(step);
      body.appendChild(el('div', { class: 'chiprow creator-go' }, [
        i > 0 ? button('← ' + STEPS[i - 1].label, () => go(STEPS[i - 1].id), 'ghost') : null,
        i < STEPS.length - 1 ? button(STEPS[i + 1].label + ' →', () => go(STEPS[i + 1].id), 'primary') : null,
      ]));
      refresh();
    }

    const field = (label, input, note) => el('label', { class: 'field' }, [el('span', { class: 'field-k' }, [label]), input, note || null]);
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
      return el('span', { class: 'stepper' }, [
        el('button', { class: 'btn ghost tiny', type: 'button', 'aria-label': 'One less to ' + label, onclick: () => { const v = (Number(bag[key]) || 0) - 1; if (v <= 0) delete bag[key]; else bag[key] = v; onchange(); } }, ['−']),
        el('b', { class: 'num' }, [n ? '+' + n : '0']),
        el('button', { class: 'btn ghost tiny', type: 'button', 'aria-label': 'One more to ' + label, onclick: () => { bag[key] = (Number(bag[key]) || 0) + 1; onchange(); } }, ['+']),
      ]);
    }
    const budget = (label, used, of) => el('div', { class: 'budget' + (used === of ? ' ok' : used > of ? ' over' : '') }, [label + ': ' + used + ' of ' + of]);
    const sum = (o) => Object.keys(o || {}).reduce((a, k) => a + (Number(o[k]) || 0), 0);

    const STEP = {
      knight() {
        const box = el('div', { class: 'fields creator-fields' });
        box.appendChild(textIn('name', 'Name', 'Sir …'));
        box.appendChild(field('Religion', select(d.religion, Object.keys(R.religions).map((r) => ({ value: r, label: r })), (v) => { d.religion = v; redrawStep(); }, 'Religion')));
        box.appendChild(field('Class', select(d.knightClass, R.classes.map((c) => ({ value: c, label: c })), (v) => { d.knightClass = v; redrawStep(); }, 'Class')));
        box.appendChild(el('div', { class: 'muted small' }, ['Culture ' + R.culture + ' · Heir ' + (R.heir ? 'yes' : 'no')]));
        box.appendChild(textIn('homeland', 'Homeland', R.homelandDefault));
        box.appendChild(textIn('lord', 'Lord', R.lord));
        box.appendChild(textIn('blazon', 'Blazon', ''));
        return box;
      },
      characteristics() {
        const box = el('div');
        const b = el('div');
        const dv = el('div', { class: 'stats' });
        live.push((r) => {
          b.innerHTML = '';
          b.appendChild(budget('Points', r.charSum, R.charPoints));
          dv.innerHTML = '';
          G.CHARS.forEach((k) => dv.appendChild(el('div', { class: 'stat' }, [el('div', { class: 'stat-k' }, [k]), el('div', { class: 'stat-v' }, [String(r.chars[k])])])));
          Object.keys(r.derived).forEach((k) => dv.appendChild(el('div', { class: 'stat' }, [el('div', { class: 'stat-k' }, [k]), el('div', { class: 'stat-v' }, [String(r.derived[k]) + (k === 'Weapon Damage' ? 'D6' : '')])])));
        });
        box.appendChild(el('div', { class: 'check-grid chars' }, G.CHARS.map((k) => field(k, numIn(() => d.chars[k], (v) => (d.chars[k] = v), k, { min: R.charMin, max: R.charMax })))));
        box.appendChild(b);
        box.appendChild(el('div', { class: 'muted small' }, ['With the ' + R.culture + ' modifier (' + Object.keys(R.culturalChar).map((k) => '+' + R.culturalChar[k] + ' ' + k).join(', ') + '), and the derived Characteristics:']));
        box.appendChild(dv);
        return box;
      },
      features() {
        const box = el('div');
        const t = src.table('Table 3.4: Distinctive Features');
        const app = result().chars.APP;
        const row = t ? t.rows.find((r) => { const s = r[0]; const lo = G.num(s); if (/or less/.test(s)) return app <= lo; if (/or more/.test(s)) return app >= lo; const m = /(\d+)\D+(\d+)/.exec(s); return m ? app >= Number(m[1]) && app <= Number(m[2]) : app === lo; }) : null;
        if (row) box.appendChild(el('div', { class: 'paper' }, ['APP ' + app + ': ' + row[1] + ' — ' + row[2]]));
        box.appendChild(textIn('distinctive', 'Distinctive Features', ''));
        return box;
      },
      traits() {
        const r = result();
        const box = el('div');
        const all = [];
        R.pairs.forEach((p) => { all.push(p.Virtue); all.push(p.Vice); });
        box.appendChild(field('Raise one Trait to ' + R.traitOne, select(d.sixteen, [{ value: '', label: 'choose…' }].concat(all.map((t) => ({ value: t, label: t }))), (v) => { d.sixteen = v; redrawStep(); }, 'The Trait raised to ' + R.traitOne)));
        box.appendChild(budget('Points', sum(d.traitPoints), R.traitPoints));
        const favored = R.religions[d.religion] || [];
        box.appendChild(el('div', { class: 'trait-grid creator-traits' }, r.pairs.map((p) => el('div', { class: 'trait-row' }, [
          el('span', { class: 'check-name' + (favored.indexOf(p.Virtue) !== -1 ? ' favored' : '') }, [p.Virtue + ' ' + p.v]),
          stepper(d.traitPoints, p.Virtue, p.Virtue, redrawStep),
          el('span', { class: 'check-name' + (favored.indexOf(p.Vice) !== -1 ? ' favored' : '') }, [p.Vice + ' ' + (R.traitSum - p.v)]),
          stepper(d.traitPoints, p.Vice, p.Vice, redrawStep),
        ]))));
        box.appendChild(el('div', { class: 'muted small' }, ['Underlined: the ' + d.religion + ' virtues.']));
        return box;
      },
      passions() {
        const r = result();
        const box = el('div');
        box.appendChild(budget('Points', sum(d.passionPoints), R.passionPoints));
        box.appendChild(el('div', { class: 'check-grid' }, r.passions.map((p) => el('div', { class: 'check-row' }, [
          el('span', { class: 'check-name' }, [p.Name + ' ' + p.Value]),
          stepper(d.passionPoints, p.Name, p.Name, redrawStep),
          d.extraPassions.indexOf(p.Name) !== -1 ? button('remove', () => { d.extraPassions = d.extraPassions.filter((x) => x !== p.Name); delete d.passionPoints[p.Name]; redrawStep(); }, 'ghost tiny') : null,
        ]))));
        const names = coreTyped('Passion').map((e) => e.name);
        const add = el('input', { type: 'text', class: 'text', list: 'pd-passions', placeholder: 'Another Passion, e.g. Love (Person)', 'aria-label': 'Another Passion' });
        box.appendChild(el('datalist', { id: 'pd-passions' }, names.map((n) => el('option', { value: n }))));
        box.appendChild(el('div', { class: 'chiprow tight' }, [add, button('Add', () => { const v = add.value.trim(); if (v && d.extraPassions.indexOf(v) === -1) { d.extraPassions.push(v); redrawStep(); } }, 'tiny')]));
        return box;
      },
      skills() {
        const r = result();
        const box = el('div');
        box.appendChild(field('Family Characteristic', select(d.family, [{ value: '', label: 'choose…' }].concat(R.families.map((f) => ({ value: f.name, label: f.name + ' (+' + f.bonus + ' ' + f.printed + ')' }))), (v) => { d.family = v; redrawStep(); }, 'Family Characteristic')));
        box.appendChild(budget('Points', sum(d.skillPoints), R.skillPoints));
        box.appendChild(el('div', { class: 'table-wrap' }, [el('table', { class: 'printed rows creator-skills' }, [
          el('thead', {}, [el('tr', {}, ['Skill', 'Beginning', 'Bonus', 'Points', 'Value'].map((h) => el('th', {}, [h])))]),
          el('tbody', {}, r.skills.map((s) => el('tr', {}, [
            el('td', {}, [s.name + (s.knightly ? '*' : '')]), el('td', {}, [s.base + ' = ' + s.begin]), el('td', {}, [s.bonus ? '+' + s.bonus : '']),
            el('td', {}, [s.begin === 0 && R.noRaiseFromZero ? '' : stepper(d.skillPoints, s.name, s.name, redrawStep)]), el('td', { class: 'num' }, [String(s.value)]),
          ]))),
        ])]));
        return box;
      },
      training() {
        const r = result();
        const box = el('div');
        const skillNames = r.skills.map((s) => s.name);
        const traitNames = [];
        R.pairs.forEach((p) => { traitNames.push(p.Virtue); traitNames.push(p.Vice); });
        const KINDS = [{ value: '', label: 'choose…' }, { value: 'skills', label: R.training.skills + ' Skill points' }, { value: 'trait', label: '+' + R.training.trait + ' to a Trait' }, { value: 'passion', label: '+' + R.training.trait + ' to a Passion' }, { value: 'char', label: '+' + R.training.char + ' to a Characteristic' }];
        box.appendChild(el('div', { class: 'muted small' }, [d.training.length + ' of up to ' + R.trainingYears + ' years']));
        d.training.forEach((y, i) => {
          const row = el('div', { class: 'train-row chiprow tight' }, [el('b', {}, ['Year ' + (i + 1)]), select(y.kind || '', KINDS, (v) => { d.training[i] = { kind: v, name: '', points: {} }; redrawStep(); }, 'Year ' + (i + 1))]);
          const pick = (names) => select(y.name || '', [{ value: '', label: 'which…' }].concat(names.map((n) => ({ value: n, label: n }))), (v) => { y.name = v; redrawStep(); }, 'Year ' + (i + 1) + ' trains');
          if (y.kind === 'trait') row.appendChild(pick(traitNames));
          if (y.kind === 'passion') row.appendChild(pick(r.passions.map((p) => p.Name)));
          if (y.kind === 'char') row.appendChild(pick(G.CHARS));
          if (y.kind === 'skills') {
            y.points = y.points || {};
            row.appendChild(budget('Points', sum(y.points), R.training.skills));
            const add = select('', [{ value: '', label: '+1 to…' }].concat(skillNames.map((n) => ({ value: n, label: n }))), (v) => { if (v) { y.points[v] = (y.points[v] || 0) + 1; redrawStep(); } }, 'Year ' + (i + 1) + ': a Skill point');
            row.appendChild(add);
            Object.keys(y.points).forEach((k) => row.appendChild(el('span', { class: 'chip' }, [k + ' +' + y.points[k], el('button', { class: 'ref tiny', type: 'button', 'aria-label': 'Take back a point from ' + k, onclick: () => { y.points[k] -= 1; if (!y.points[k]) delete y.points[k]; redrawStep(); } }, ['×'])])));
          }
          row.appendChild(button('remove', () => { d.training.splice(i, 1); redrawStep(); }, 'ghost tiny'));
          box.appendChild(row);
        });
        if (d.training.length < R.trainingYears) box.appendChild(button('+ a year of training', () => { d.training.push({ kind: '', name: '', points: {} }); redrawStep(); }, 'tiny'));
        return box;
      },
      knighted() {
        const box = el('div', { class: 'fields creator-fields' });
        const g = el('div', { class: 'paper' });
        live.push((r) => {
          g.innerHTML = '';
          g.appendChild(el('div', {}, ['Glory ' + r.glory.total.toLocaleString('en') + ' = inherited ' + r.glory.inherited + ' + knighted ' + r.glory.knighted + ' + from the lord ' + r.glory.fromLord + (r.glory.household ? ' + household ' + r.glory.household : '')]));
          const born = r.values.Born;
          g.appendChild(el('div', { class: 'muted small' }, [born != null ? 'Born ' + born : 'Enter the current game year to find the year born.']));
        });
        box.appendChild(field('Age', numIn(() => d.age, (v) => (d.age = v), 'Age', { min: 14 })));
        box.appendChild(field('Current game year', numIn(() => d.year, (v) => (d.year = v), 'Current game year')));
        box.appendChild(textIn('parentName', 'Parent’s name', ''));
        box.appendChild(field('Parent’s Glory', numIn(() => d.parentGlory, (v) => (d.parentGlory = v), 'Parent’s Glory', { min: 0, step: 100 })));
        box.appendChild(field('Glory of the lord who knighted them', numIn(() => d.lordGlory, (v) => (d.lordGlory = v), 'Glory of the lord who knighted them', { min: 0, step: 100 })));
        const weapons = R.weapons ? R.weapons.rows.filter((w) => w[2] && w[2] !== 'Weapon Skill' && ['Arming Sword', 'Lance', 'Spear', 'Dagger'].indexOf(w[0]) === -1).map((w) => w[0]) : [];
        box.appendChild(field('An additional weapon of choice', select(d.extraWeapon || '', [{ value: '', label: 'none' }].concat(weapons.map((w) => ({ value: w, label: w }))), (v) => change(() => (d.extraWeapon = v)), 'An additional weapon of choice')));
        box.appendChild(g);
        return box;
      },
      review() {
        const r = result();
        const v = r.values;
        const box = el('div', { class: 'creator-review' });
        const rows = (list, a, b) => el('div', { class: 'printed-line' }, list.map((x, i) => [i ? ', ' : null, x[a] + ' ' + x[b]]));
        box.appendChild(el('h2', {}, [v.Name || 'Your knight']));
        box.appendChild(el('div', { class: 'muted' }, [[v.Class, v.Homeland, v.Religion, v.Culture, 'Glory ' + v.Glory.toLocaleString('en')].filter(Boolean).join(' · ')]));
        box.appendChild(el('div', { class: 'stats' }, G.CHARS.map((k) => el('div', { class: 'stat' }, [el('div', { class: 'stat-k' }, [k]), el('div', { class: 'stat-v' }, [String(v[k])])])).concat(v.Statistics.map((s) => el('div', { class: 'stat' }, [el('div', { class: 'stat-k' }, [s.Statistic]), el('div', { class: 'stat-v' }, [s.Value])])))));
        box.appendChild(el('h4', {}, ['Attacks']));
        box.appendChild(el('div', {}, v.Attacks.map((a) => el('div', {}, [a.Weapon + ' · ' + a.Skill + ' ' + a.Value + ' · ' + a.Damage]))));
        box.appendChild(el('h4', {}, ['Traits']));
        box.appendChild(el('div', { class: 'printed-line' }, v.Traits.map((t, i) => [i ? ', ' : null, t.Virtue + ' ' + t['Virtue Value'] + '/' + t['Vice Value'] + ' ' + t.Vice])));
        box.appendChild(el('h4', {}, ['Passions']));
        box.appendChild(rows(v.Passions, 'Name', 'Value'));
        box.appendChild(el('h4', {}, ['Skills']));
        box.appendChild(rows(v.Skills, 'Name', 'Value'));
        box.appendChild(el('h4', {}, ['Weapon Skills']));
        box.appendChild(rows(v['Weapon Skills'], 'Name', 'Value'));
        box.appendChild(el('div', { class: 'muted small' }, ['Armor: ' + v.Armor + ' · Family Characteristic: ' + (v['Family Characteristic'] || '—')]));
        const ok = !r.errors.length && v.Name;
        const done = el('div', { class: 'chiprow creator-done' });
        if (!v.Name) done.appendChild(el('span', { class: 'muted' }, ['Name your knight (step 1).']));
        if (o.onDone) done.appendChild(button(o.doneLabel || 'Take this knight to the table', () => { if (ok) { o.onDone(JSON.parse(JSON.stringify(v))); } }, ok ? 'primary' : 'ghost'));
        else done.appendChild(button('Download the knight’s file', () => { if (ok) download(v); }, ok ? 'primary' : 'ghost'));
        done.appendChild(button('Start again', () => { if (confirm('Clear this draft?')) { Object.assign(d, fresh(), { religion: d.religion, knightClass: d.knightClass, age: R.age }); save(d); go('knight'); } }, 'ghost'));
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
