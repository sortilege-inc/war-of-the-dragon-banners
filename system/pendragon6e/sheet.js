// system/pendragon6e/sheet.js — a knight at the table: the sheet derived from its ACTOR.
//
// What a sheet shows is what the ACTOR declares (PLAYBOOK §1b): its properties, in their declared
// order, walked down the EXTENDS chain — a pre-generated knight's ACTOR "Knight", a character folio's
// ACTOR "Folio Knight", and a knight made here or by hand ACTOR "Player Knight" (D1: Knight's panels,
// then the character sheet's own). A value is shown the way its declaration types it; the fields the
// book rolls get a layout of their own: the five Characteristics, the Attacks, the Traits as pairs, the
// Passions, the Skills and Weapon (or Combat) Skills — each a button that sets up the d20.
//
// A knight's values come from one of two places, never copied into the pack from the corpus:
//   * a printed knight (m.profile — its entity, read at runtime), or
//   * the creator or a blank sheet (m.character — values in ACTOR "Player Knight"'s shape).
// What the table tracks is the knight's live state:
//   live { hp, glory, checks: { [name]: true } }
//     hp      Hit Points as they stand; they start at the sheet's own Hit Points
//     glory   Glory as it stands; it starts at the sheet's own (a Player Knight's Glory, a folio's
//             "Current Glory"), or 0 where the knight prints none
//     checks  the experience checks marked this year: "Every Trait, Passion, and Skill has a checkbox
//             … The Player checks off the box at the Gamemaster's discretion or whenever the Player
//             rolls a critical success." (Experience Checks)
//
// A character file: { kind: 'pendragon6e-knight', version: 1, name, player, profile, character, live }.
window.PDSheet = (function () {
  const { el, button } = window.VttRender;
  const D = window.PDData;
  const E = window.PDEntity;
  const Dice = window.PDDice;
  const State = window.VttState;

  const FILE_KIND = 'pendragon6e-knight';
  const ACTOR = 'Player Knight';
  const CHARS = ['SIZ', 'DEX', 'STR', 'CON', 'APP'];
  // a number the book prints as a string ("2,205", "10+6" reads as its first number)
  const printedInt = (s) => {
    if (s == null || s === '') return null;
    if (typeof s === 'number') return s;
    const m = /-?\d[\d,]*/.exec(String(s).replace(/[–−]/g, '-'));
    return m ? Number(m[0].replace(/,/g, '')) : null;
  };

  // ── values ─────────────────────────────────────────────────────────
  const profileOf = (m) => (m && m.profile ? D.entity(m.profile) : null);
  const profileRecord = (m) => (m && m.profile ? D.record(m.profile) : null);
  const booksFor = (m) => { const r = profileRecord(m); return r ? [r.book] : []; };
  function entityValues(e) {
    const out = {};
    (e.props || []).forEach((p) => {
      if (p.vk === 'list') out[p.name] = p.ofHash ? (p.items || []).filter((it) => it.d).map(D.rowOf) : (p.items || []).map(D.arg);
      else out[p.name] = D.pval(p);
    });
    return out;
  }
  function values(m) {
    if (m && m.character) return m.character;
    const e = profileOf(m);
    if (e) return entityValues(e);
    const r = profileRecord(m);
    return r ? Object.assign({ Name: r.name }, r.fields || {}) : { Name: m ? m.name : '' };
  }
  const typeOf = (m) => { const e = profileOf(m); return (e && e.type) || (m && m.profile ? (profileRecord(m) || {}).type : null) || ACTOR; };
  // a row of the Health or Other panel, by its name ("Hit Points", "Current Glory")
  const statistic = (v, name) => { const r = (v.Statistics || []).find((x) => x.Statistic === name); return r ? r.Value : null; };
  const maxHp = (v) => printedInt(statistic(v, 'Hit Points'));
  const startGlory = (v) => printedInt(v.Glory != null ? v.Glory : statistic(v, 'Current Glory'));
  const hpOf = (m) => { const l = (m.live || {}).hp; return l != null ? l : (m.character && m.character['Current Hit Points'] != null ? m.character['Current Hit Points'] : maxHp(values(m))); };
  const gloryOf = (m) => { const l = (m.live || {}).glory; return l != null ? l : startGlory(values(m)) || 0; };
  const checksOf = (m) => (m.live || {}).checks || {};
  const startLive = (v) => { const live = { checks: {} }; const h = maxHp(v); if (h != null) live.hp = h; const g = startGlory(v); live.glory = g || 0; return live; };

  // the rollable lists, as rows { Name, Value }, whichever ACTOR declares them
  const rated = (v, k) => (v[k] || []).filter((r) => r && r.Name != null && r.Value != null);
  const weaponSkills = (v) => rated(v, 'Weapon Skills').concat(rated(v, 'Combat Skills'));

  // ── members and files ──────────────────────────────────────────────
  function fromProfile(id, player) {
    const r = D.record(id);
    if (!r) throw new Error('No such knight: ' + id);
    const e = D.entity(id);
    return { id: State.genId('pc'), templateId: id, name: r.name, player: player || '', profile: id, character: null, source: { kind: 'profile', id, book: r.book }, live: e ? startLive(entityValues(e)) : { checks: {} }, notes: '' };
  }
  function fromValues(v, player) {
    return { id: State.genId('pc'), templateId: 'created', name: v.Name || 'A new knight', player: player || '', profile: null, character: v, source: { kind: 'file', name: 'the creator' }, live: startLive(v), notes: '' };
  }
  function newMember(name, player) {
    const n = String(name || '').trim();
    if (!n) throw new Error('Name the knight first.');
    return { id: State.genId('pc'), templateId: 'blank', name: n, player: String(player || '').trim(), profile: null, character: { Name: n }, source: { kind: 'blank' }, live: { glory: 0, checks: {} }, notes: '' };
  }
  function fileOf(m) {
    return { kind: FILE_KIND, version: 1, name: m.name, player: m.player || '', profile: m.profile || null, character: m.profile ? null : (m.character || null), live: JSON.parse(JSON.stringify(m.live || {})) };
  }
  function readMember(obj, fileName) {
    if (!obj || obj.kind !== FILE_KIND) throw new Error((fileName || 'That file') + ' is not a Pendragon knight file.');
    const r = obj.profile ? D.record(obj.profile) : null;
    if (obj.profile && !r) throw new Error((fileName || 'That file') + ' names a knight the books don’t have.');
    if (!obj.profile && !(obj.character && typeof obj.character === 'object')) throw new Error((fileName || 'That file') + ' holds no knight.');
    const character = obj.profile ? null : obj.character;
    return { id: State.genId('pc'), templateId: obj.profile || 'created', name: String(obj.name || (r && r.name) || (character && character.Name) || 'Knight'), player: String(obj.player || ''), profile: obj.profile || null, character, source: { kind: 'file', name: fileName || null }, live: Object.assign({ checks: {} }, obj.live || {}), notes: '' };
  }
  function downloadMember(m) {
    const blob = new Blob([JSON.stringify(fileOf(m), null, 2)], { type: 'application/json' });
    const a = el('a', { href: URL.createObjectURL(blob), download: (m.name || 'knight').replace(/[^\w-]+/g, '-').toLowerCase() + '.json' });
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
  }

  // one line about a knight: class and homeland, then the live numbers
  function sentence(m) {
    const v = values(m);
    const bits = [];
    if (v.Class) bits.push(v.Class);
    if (v.Homeland) bits.push(v.Homeland);
    const hp = hpOf(m);
    const max = maxHp(v);
    if (hp != null) bits.push('Hit Points ' + hp + (max != null ? '/' + max : ''));
    bits.push('Glory ' + gloryOf(m).toLocaleString('en'));
    if (m.player) bits.push('played by ' + m.player);
    return bits.join(' · ');
  }

  const logEvent = (m, text) => State.commit('appendLog', [{ at: Date.now(), kind: 'event', memberId: m.id, text: m.name + ': ' + text }]);
  function setLive(m, key, n, label, cause) {
    const was = key === 'hp' ? hpOf(m) : gloryOf(m);
    if (was === n) return;
    State.commit('setPartyLive', [m.id, { [key]: n }]);
    logEvent(m, label + ' ' + (was == null ? '—' : was) + ' → ' + n + (cause ? ' (' + cause + ')' : ''));
  }
  function setCheck(m, name, on, why) {
    const checks = Object.assign({}, checksOf(m));
    if (!!checks[name] === !!on) return;
    if (on) checks[name] = true; else delete checks[name];
    State.commit('setPartyLive', [m.id, { checks }]);
    logEvent(m, (on ? 'checked ' : 'unchecked ') + name + (why ? ' (' + why + ')' : ''));
  }

  // ── rendering a declared value ─────────────────────────────────────
  const target = (name, bookId) => (name ? D.named(name, bookId) || D.recordNamed(name)[0] || null : null);
  const opener = (t, label) => el('a', { class: 'ref', href: '#', onclick: (ev) => { ev.preventDefault(); if (window.PDOpenEntity) window.PDOpenEntity(t.id); } }, [label]);
  function rowsView(rows, bookId) {
    if (!rows.length) return el('span', { class: 'muted' }, ['—']);
    if (rows.every((r) => r.Name != null && r.Value != null && Object.keys(r).length <= 3)) return el('div', { class: 'printed-line' }, rows.map((r, i) => [i ? ', ' : null, r.Name + ' ' + r.Value + (r.Note ? ' ' + r.Note : '')]));
    const cols = [];
    rows.forEach((r) => Object.keys(r).forEach((k) => cols.indexOf(k) === -1 && cols.push(k)));
    return el('div', { class: 'table-wrap' }, [el('table', { class: 'printed rows' }, [
      el('thead', {}, [el('tr', {}, cols.map((c) => el('th', {}, [c])))]),
      el('tbody', {}, rows.map((r) => el('tr', {}, cols.map((c) => el('td', {}, [Array.isArray(r[c]) ? rowsView(r[c], bookId) : r[c] == null ? '' : String(r[c])]))))),
    ])]);
  }
  function valueView(v, bookId) {
    if (v == null || v === '' || (Array.isArray(v) && !v.length)) return el('span', { class: 'muted' }, ['—']);
    if (typeof v === 'boolean') return el('span', {}, [v ? 'yes' : 'no']);
    if (Array.isArray(v)) return typeof v[0] === 'object' ? rowsView(v, bookId) : el('span', {}, [v.join(', ')]);
    const s = String(v);
    return s.length > 90 ? E.prose(s, 'prose', bookId) : el('span', {}, [s]);
  }

  // ── the live sheet ─────────────────────────────────────────────────
  const rollers = {};
  // the fields the sheet lays out itself; every other declared field shows in declared order
  const OWN = ['Name'].concat(CHARS, ['Statistics', 'Attacks', 'Attacks Note', 'Traits', 'Directed Traits', 'Passions', 'Printed Passions', 'Skills', 'Printed Skills',
    'Weapon Skills', 'Combat Skills', 'Printed Weapon Skills', 'Glory', 'Current Hit Points']);

  function live(m, opts) {
    const o = opts || {};
    const v = values(m);
    const decl = D.declared(typeOf(m)).props;
    const bookId = (profileRecord(m) || {}).book || 'core';
    const checks = checksOf(m);
    const box = el('div', { class: 'sheet live' });
    box.appendChild(el('div', { class: 'sheet-head' }, [el('h2', {}, [m.name]), el('div', { class: 'muted small' }, [sentence(m)])]));

    // the d20, preset by the buttons below; one roller per knight, kept across redraws (a roll commits
    // to the log, the log redraws the sheet, and a new roller would lose the roll on screen)
    const roller = rollers[m.id] || (rollers[m.id] = Dice.roller({
      onResolve: (r) => afterRoll(m.id, r),
      extra: (r, rb) => afterCheck(m.id, r, rb),
    }));
    const roll = (label, value, meta) => roller.preset({ value, label: m.name + ' · ' + label, meta: Object.assign({ name: label }, meta || {}) });
    const tick = (name) => (checks[name] ? el('span', { class: 'check-mark', title: 'checked this year' }, ['✓']) : null);
    const rollBtn = (label, value, meta, cls) => (value == null ? el('span', { class: 'muted small' }, [label]) : el('span', { class: 'rollable' }, [button(label + ' ' + value, () => roll(label, value, meta), cls || 'tiny'), meta && meta.checkable ? tick(label) : null]));

    // the trackers: Hit Points against the sheet's own, and Glory
    const hp = hpOf(m);
    const max = maxHp(v);
    const glory = gloryOf(m);
    const trackerBox = (label, cur, top, set, step) => {
      const input = el('input', { type: 'number', class: 'num-in', value: cur == null ? '' : cur, 'aria-label': label });
      input.addEventListener('change', () => { const n = Number(input.value); if (Number.isFinite(n)) set(n, 'set'); });
      return el('div', { class: 'tracker' }, [
        el('div', { class: 'stat-k' }, [label]),
        el('div', { class: 'tracker-row' }, [button('−', () => set((cur || 0) - step), 'ghost tiny'), input, top != null ? el('span', { class: 'muted' }, ['/ ' + top]) : null, button('+', () => set((cur || 0) + step), 'ghost tiny')]),
      ]);
    };
    box.appendChild(el('div', { class: 'trackers' }, [
      trackerBox('Hit Points', hp, max, (n, c) => setLive(m, 'hp', n, 'Hit Points', c), 1),
      trackerBox('Glory', glory, null, (n, c) => setLive(m, 'glory', n, 'Glory', c), 1),
      // "a roll against the character's Glory divided by 1,000 (rounding to the nearest whole number)" (The Glory Roll)
      el('div', { class: 'tracker' }, [el('div', { class: 'stat-k' }, ['Glory Roll']), rollBtn('Glory Roll', Math.round(glory / 1000), { characteristic: true }, 'ghost tiny')]),
    ]));

    // the five Characteristics: "There is no special benefit to a critical success on a Characteristic
    // roll … Characteristics do not gain experience checks." (Critical Success)
    box.appendChild(el('div', { class: 'check-grid chars' }, CHARS.map((k) => rollBtn(k, printedInt(v[k]), { characteristic: true }))));
    // the Health and Other panels, as printed
    const stats = v.Statistics || [];
    if (stats.length) box.appendChild(el('div', { class: 'stats' }, stats.map((s) => el('div', { class: 'stat' }, [el('div', { class: 'stat-k' }, [s.Statistic]), el('div', { class: 'stat-v' }, [String(s.Value)])]))));
    box.appendChild(roller);

    // the Attacks: a roll at the weapon's Skill value, its Damage a roll of six-sided dice
    const attacks = v.Attacks || [];
    if (attacks.length) {
      box.appendChild(el('div', { class: 'prop-k' }, ['Attacks']));
      box.appendChild(el('div', { class: 'check-grid' }, attacks.map((a) => el('div', { class: 'check-row' }, [
        el('span', { class: 'check-name' }, [a.Weapon || a.Attack]),
        rollBtn(a.Skill || 'Attack', printedInt(a.Value), { checkable: !!a.Skill, damage: a.Damage, weapon: a.Weapon || a.Attack }),
        a.Damage ? el('span', { class: 'muted small' }, ['damage ', Dice.diceButton(a.Damage, { label: a.Damage, onRoll: (r) => logDamage(m, (a.Weapon || a.Attack), r) }) || a.Damage]) : null,
      ]))));
      if (v['Attacks Note']) box.appendChild(el('div', { class: 'muted small' }, [v['Attacks Note']]));
    }

    // the Traits, as the sheet prints them: the virtue's value, the pair, the vice's value
    const traits = v.Traits || [];
    if (traits.length && traits[0].Virtue != null) {
      box.appendChild(el('div', { class: 'prop-k' }, ['Traits']));
      box.appendChild(el('div', { class: 'trait-grid' }, traits.map((t) => el('div', { class: 'trait-row' }, [
        rollBtn(t.Virtue, t['Virtue Value'], { checkable: true, pair: t.Vice }),
        rollBtn(t.Vice, t['Vice Value'], { checkable: true, pair: t.Virtue }),
      ]))));
    } else if (traits.length) box.appendChild(ratedBlock('Traits', traits));
    function ratedBlock(label, rows) {
      return el('div', {}, [el('div', { class: 'prop-k' }, [label]), el('div', { class: 'check-grid wrap' }, rows.map((r) => rollBtn(r.Name, r.Value, { checkable: true })))]);
    }
    [['Directed Traits', rated(v, 'Directed Traits')], ['Passions', rated(v, 'Passions')], ['Skills', rated(v, 'Skills')], [decl.some((p) => p.name === 'Combat Skills') ? 'Combat Skills' : 'Weapon Skills', weaponSkills(v)]]
      .forEach(([label, rows]) => { if (rows.length || decl.some((p) => p.name === label)) box.appendChild(rows.length ? ratedBlock(label, rows) : el('div', {}, [el('div', { class: 'prop-k' }, [label]), el('span', { class: 'muted' }, ['—'])])); });

    // every other declared field, in declared order
    const rest = decl.filter((p) => OWN.indexOf(p.name) === -1);
    if (rest.length) box.appendChild(el('div', { class: 'fields' }, rest.map((p) => el('div', { class: 'prop' }, [el('div', { class: 'prop-k' }, [p.name]), el('div', { class: 'prop-v' }, [valueView(v[p.name], bookId)])]))));
    if (Object.keys(checks).length) box.appendChild(el('div', { class: 'checks-line' }, [el('span', { class: 'prop-k' }, ['Checked this year ']), Object.keys(checks).sort().map((k, i) => [i ? ', ' : null, k])]));
    if (profileOf(m)) box.appendChild(el('details', { class: 'profile-print' }, [el('summary', {}, ['The knight, as printed']), E.render(profileOf(m), { bare: true })]));
    if (o.player) {
      const notes = el('textarea', { class: 'text', rows: 4, placeholder: 'Your notes' }, [m.playerNotes || '']);
      notes.addEventListener('change', () => State.commit('setPartyPlayerNotes', [m.id, notes.value]));
      box.appendChild(el('div', { class: 'prop-k' }, ['Notes']));
      box.appendChild(notes);
    }
    return box;
  }

  function logDamage(m, weapon, r) {
    State.commit('appendLog', [{ at: Date.now(), kind: 'roll', memberId: m.id, who: m.name, label: m.name + ' · ' + weapon + ' damage', dice: r.expr, faces: r.faces, total: r.total }]);
  }
  // a finished roll: logged; a critical or a fumble on a Trait, Passion or Skill checks it — "the
  // Player-knight should gain a check for a Statistic when: They obtain a critical success. … They
  // roll a fumble." (Experience Checks)
  function afterRoll(memberId, r) {
    const m = (State.state.party || []).find((x) => x.id === memberId);
    if (!m) return;
    const meta = (rollers[memberId] || {}).meta || {};
    State.commit('appendLog', [Object.assign(Dice.logEntry(r, m.name), { kind: 'roll', memberId: m.id })]);
    if (meta.checkable && (r.mine.outcome === 'Critical Success' || r.mine.outcome === 'Fumble')) setCheck(m, meta.name, true, r.mine.outcome.toLowerCase());
  }
  // under a finished roll: the weapon's damage to roll if it hit, and a check the Gamemaster may give
  // for a success — "Experience checks are not automatic whenever a roll is successful. The ability to
  // award or deny an experience check is one of the key powers of the Gamemaster." (Experience Checks)
  function afterCheck(memberId, r, rb) {
    const m = (State.state.party || []).find((x) => x.id === memberId);
    if (!m) return null;
    const meta = rb.meta || {};
    const wrap = el('div', { class: 'after-check' });
    if (meta.damage && r.mine.succeeded) wrap.appendChild(el('div', { class: 'damage' }, [el('span', { class: 'prop-k' }, ['If it hits · ' + meta.weapon + ' ']), Dice.diceButton(meta.damage, { label: 'Roll ' + meta.damage, onRoll: (x) => logDamage(m, meta.weapon, x) })]));
    if (meta.checkable && !checksOf(m)[meta.name]) wrap.appendChild(button('Check ' + meta.name, () => setCheck(m, meta.name, true, 'the Gamemaster’s award'), 'ghost tiny'));
    return wrap.childNodes.length ? wrap : null;
  }

  return { FILE_KIND, ACTOR, CHARS, printedInt, values, entityValues, typeOf, profileOf, booksFor, maxHp, hpOf, gloryOf, checksOf, statistic, startLive, fromProfile, fromValues, newMember, fileOf, readMember, downloadMember, sentence, setLive, setCheck, live };
})();
