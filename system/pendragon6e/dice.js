// system/pendragon6e/dice.js — the d20 roll against a Statistic, as The Game System states it, and the
// six-sided dice of damage and the random tables.
//
// Every rule below is a named constant or a step citing the sentence it comes from (the Core
// Rulebook's *The Game System* chapter, pendragon6e-0.5-core-the-game-system.ttrpg: Success and
// Failure, its boxed Critical Bonus text under Skill Modifiers, Values Less Than 1, Fixed
// Opposition). The rules (`core`) are pure and take their dice from an injected roll, so
// build/check_dice.js replays the book's own worked examples under node; the roller (`roller`) is
// the page's control over them. The outcome names are the book's own headings, and the page links
// each to its entry.
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PDDice = api;
})(typeof self !== 'undefined' ? self : this, function () {
  // "A twenty-sided die determines success or failure for all Statistic tests" (Dice)
  const SIDES = 20;
  // "With the exception of Characteristics, no Statistic value may ever exceed 20. Any points in a
  // Statistic in excess of 20 become the critical bonus." (the Critical Bonus box, Skill Modifiers)
  const CAP = 20;
  // "A fumble occurs whenever a character rolls a natural 20 unless the Statistic value is 20" (Fumble)
  const FUMBLE = 20;

  // The value a roll is made against, once its modifiers apply: "Bonuses and penalties are always
  // added to or subtracted from Statistic values" (Modifiers); "If a modifier raises a value above
  // 20, convert the difference from 20 into a critical bonus" (the Critical Bonus box); "the value
  // is simply counted as 0 … the range of die roll results indicating a fumble increases by one
  // point for every point below zero" (Values Less Than 1).
  function effective(value, modifier) {
    const raw = (Number(value) || 0) + (Number(modifier) || 0);
    return {
      raw,
      value: Math.max(0, Math.min(CAP, raw)),
      bonus: Math.max(0, raw - CAP),
      fumbleFrom: raw < 0 ? FUMBLE + raw : FUMBLE,
    };
  }

  // One roll of the d20 against a value. `face` is the natural roll.
  function resolve(value, modifier, face) {
    const v = effective(value, modifier);
    // "The x-value is always added to the result of a relevant die roll" (the Critical Bonus box)
    const total = face + v.bonus;
    let outcome;
    // "A Statistic value of 20 has no chance of a fumble" (Fumble); "A character with a Statistic
    // value of 20 cannot fumble in a roll against that Statistic" (the Critical Bonus box)
    if (v.value < CAP && face >= v.fumbleFrom) outcome = 'Fumble';
    // "A critical success … is when a die roll exactly matches the modified Statistic value"
    // (Critical Success); "Although the modified value of the die roll may be greater than 20, its
    // result is simply counted as a critical success with a value of 20" (the Critical Bonus box)
    else if (v.value > 0 && (total === v.value || (v.value === CAP && total >= CAP))) outcome = 'Critical Success';
    // "A success occurs when the die roll is less than the value of the Statistic being tested" (Success)
    else if (total < v.value) outcome = 'Success';
    // "A failure occurs when the die roll is greater than the value" (Failure); at 0 "Failure is
    // automatic" (Values Less Than 1)
    else outcome = 'Failure';
    const succeeded = outcome === 'Success' || outcome === 'Critical Success';
    // what the roll counts as against an opponent: "all critical successes are equal" (Tie), "a
    // critical success with a value of 20" (the Critical Bonus box)
    const counts = outcome === 'Critical Success' ? CAP : total;
    return { face, value: v.value, bonus: v.bonus, raw: v.raw, fumbleFrom: v.fumbleFrom, total, outcome, succeeded, counts };
  }

  // Opposed resolution between two rolls (Opposed Resolution and its outcomes): the result for the
  // first roll. "To win, the Player must succeed with their own roll, yet also roll a higher number
  // than that of the opposing Player" (Opposed Resolution); "If you roll greater than your Statistic
  // value, you are the loser" (Loss); "A partial success occurs when a roll is successful … but also
  // lower than the opponent's roll" (Partial Success); "A tie occurs when opponents both succeed and
  // roll exactly the same number" (Tie); "A mutual failure occurs when both parties fail" (Mutual Failure).
  function opposed(a, b) {
    if (!a.succeeded && !b.succeeded) return 'Mutual Failure';
    if (!a.succeeded) return 'Loss';
    if (!b.succeeded) return 'Win';
    if (a.counts > b.counts) return 'Win';
    if (a.counts < b.counts) return 'Partial Success';
    return 'Tie';
  }
  // "the character must make an opposed resolution against a fixed value of opposition … The roll
  // must therefore succeed and beat the value of 15 to win" (Fixed Opposition): the fixed value
  // stands as the opponent's successful roll.
  const fixed = (a, value) => opposed(a, { succeeded: true, counts: Number(value) || 0 });

  // ── six-sided dice: "5D6", "2D6+5", "1D3", "4D6/4D6" ───────────────
  // "1D3 indicates the roll of a six-sided die, where a roll of 1–2 counts as a 1, 3–4 counts as a 2,
  // and 5–6 counts as a 3" (Dice); "+x indicates a number (x) to add to the die roll result" (Dice).
  // The first expression in the printed string is read; a mark after it (†, *) is left as printed.
  function parseDice(s) {
    const m = /(\d*)\s*[dD]\s*(\d+)\s*(?:([+\-–−])\s*(\d+))?/.exec(String(s || ''));
    if (!m) return null;
    const n = m[1] === '' ? 1 : Number(m[1]);
    const sides = Number(m[2]);
    const add = m[3] ? (m[3] === '+' ? 1 : -1) * Number(m[4]) : 0;
    return { n, sides, add, text: m[0].trim() };
  }
  function rollDice(expr, rollSide) {
    const d = typeof expr === 'string' ? parseDice(expr) : expr;
    if (!d) return null;
    const faces = [];
    for (let i = 0; i < d.n; i++) {
      const f = d.sides === 3 ? Math.ceil(rollSide(6) / 2) : rollSide(d.sides);
      faces.push(f);
    }
    return { expr: d.text, faces, add: d.add, total: faces.reduce((a, b) => a + b, 0) + d.add };
  }

  const core = { SIDES, CAP, FUMBLE, effective, resolve, opposed, fixed, parseDice, rollDice };

  // ── the page ───────────────────────────────────────────────────────
  // an unbiased die from the page's cryptographic source
  function rollSide(sides) {
    const a = new Uint32Array(1);
    const lim = Math.floor(4294967296 / sides) * sides;
    for (;;) {
      crypto.getRandomValues(a);
      if (a[0] < lim) return (a[0] % sides) + 1;
    }
  }
  const rollDie = () => rollSide(SIDES);

  const OPEN = (name) => {
    const D = window.PDData;
    const e = D && D.named(name, 'core');
    const { el } = window.VttRender;
    return e ? el('a', { class: 'ref', href: '#', onclick: (ev) => { ev.preventDefault(); window.PDOpenEntity && window.PDOpenEntity(e.id); } }, [name]) : name;
  };
  const valueText = (r) => String(r.value) + (r.bonus ? ' (+' + r.bonus + ')' : '');

  // The roller: a Statistic's value, a modifier, and — for an opposed roll — the opponent's value
  // (rolled here too) or a fixed value. `o.onResolve(r)` receives each finished roll; `preset`
  // fills it from a sheet's button.
  function roller(opts) {
    const o = opts || {};
    const { el } = window.VttRender;
    const box = el('div', { class: 'roller d20' });
    const value = el('input', { type: 'number', class: 'num-in', value: o.value != null ? o.value : 10, step: 1, 'aria-label': 'Value' });
    const mod = el('input', { type: 'number', class: 'num-in', value: 0, step: 1, 'aria-label': 'Modifier' });
    const mode = el('select', { class: 'scope', 'aria-label': 'Opposition' }, [
      el('option', { value: '' }, ['Unopposed']),
      el('option', { value: 'opposed' }, ['Opposed: their value']),
      el('option', { value: 'fixed' }, ['Fixed opposition']),
    ]);
    const other = el('input', { type: 'number', class: 'num-in', value: '', step: 1, placeholder: '—', 'aria-label': 'Opposing value' });
    const otherMod = el('input', { type: 'number', class: 'num-in', value: 0, step: 1, 'aria-label': 'Opposing modifier' });
    const oppWrap = el('span', { class: 'opp' }, [other, el('span', { class: 'muted small' }, [' mod ']), otherMod]);
    const syncMode = () => {
      oppWrap.style.display = mode.value ? '' : 'none';
      otherMod.style.display = mode.value === 'opposed' ? '' : 'none';
      oppWrap.querySelector('.muted').style.display = mode.value === 'opposed' ? '' : 'none';
    };
    mode.addEventListener('change', syncMode);
    const field = (label, input) => el('label', { class: 'field' }, [el('span', { class: 'field-k' }, [label]), input]);
    const out = el('div', { class: 'roll-out' });
    let label = o.label || null;
    const forLine = el('div', { class: 'roll-for muted small' }, [label || '']);
    let last = null;

    function draw(r) {
      out.innerHTML = '';
      if (!r) return;
      const line = (x, who) => el('div', { class: 'roll-line' }, [
        who ? el('span', { class: 'muted small' }, [who + ' ']) : null,
        el('span', { class: 'die d20' + (x.outcome === 'Critical Success' ? ' crit' : x.outcome === 'Fumble' ? ' fumble' : '') }, [String(x.face)]),
        el('span', { class: 'muted' }, [(x.bonus ? ' + ' + x.bonus + ' = ' + x.total : '') + ' vs ' + valueText(x) + (x.raw !== x.value + x.bonus ? ' (' + x.raw + ')' : '') + ' → ']),
        el('span', { class: 'outcome ' + (x.succeeded ? 'ok' : 'fail') }, [OPEN(x.outcome)]),
      ]);
      out.appendChild(line(r.mine, r.theirs ? 'You' : null));
      if (r.theirs) out.appendChild(line(r.theirs, 'Them'));
      if (r.fixed != null) out.appendChild(el('div', { class: 'muted small' }, ['against a fixed ' + r.fixed]));
      if (r.result) out.appendChild(el('div', { class: 'roll-total' }, [el('span', { class: 'big' }, [OPEN(r.result)])]));
      if (o.extra) { const x = o.extra(r, box); if (x) out.appendChild(x); }
    }
    const go = () => {
      const mine = resolve(value.value, mod.value, rollDie());
      const r = { label, mine, theirs: null, fixed: null, result: null };
      if (mode.value === 'opposed' && other.value !== '') {
        r.theirs = resolve(other.value, otherMod.value, rollDie());
        r.result = opposed(mine, r.theirs);
      } else if (mode.value === 'fixed' && other.value !== '') {
        r.fixed = Number(other.value);
        r.result = fixed(mine, r.fixed);
      }
      last = r;
      draw(r);
      if (o.onResolve) o.onResolve(r);
    };
    box.appendChild(forLine);
    box.appendChild(el('div', { class: 'roller-controls' }, [
      field('Value', value),
      field('Modifier', mod),
      field('Opposition', el('span', { class: 'tn-pick' }, [mode, oppWrap])),
      el('button', { class: 'btn primary', type: 'button', onclick: go }, ['Roll d20']),
    ]));
    box.appendChild(out);
    syncMode();
    box.result = () => last;
    box.meta = {};
    // a sheet's roll button: the value to roll against, and what the roll is for
    box.preset = (p) => {
      box.meta = p.meta || {};
      if (p.value != null) value.value = p.value;
      mod.value = p.modifier != null ? p.modifier : 0;
      label = p.label || null;
      forLine.textContent = label ? 'Rolling for ' + label : '';
      last = null;
      draw(null);
      value.focus();
    };
    return box;
  }

  // A die expression's roll, for damage and the tables: "5D6 → 3 5 1 6 2 = 17".
  function diceButton(expr, opts) {
    const { el } = window.VttRender;
    const d = parseDice(expr);
    if (!d) return null;
    const o = opts || {};
    const out = el('span', { class: 'dice-out muted small' });
    return el('span', { class: 'dice-btn' }, [
      el('button', { class: 'btn ghost small', type: 'button', title: 'Roll ' + d.text, onclick: () => {
        const r = rollDice(d, rollSide);
        out.textContent = ' ' + r.faces.join(' ') + (r.add ? (r.add > 0 ? ' + ' : ' − ') + Math.abs(r.add) : '') + ' = ' + r.total;
        if (o.onRoll) o.onRoll(r);
      } }, [o.label || 'Roll ' + d.text]), out,
    ]);
  }

  function logEntry(r, who) {
    return {
      who, at: Date.now(), label: r.label || null, face: r.mine.face, total: r.mine.total, value: r.mine.value, bonus: r.mine.bonus,
      outcome: r.mine.outcome, result: r.result || null, theirs: r.theirs ? { face: r.theirs.face, total: r.theirs.total, value: r.theirs.value, outcome: r.theirs.outcome } : null, fixed: r.fixed,
    };
  }
  function logLine(x) {
    const { el } = window.VttRender;
    if (x.dice) return el('div', { class: 'log-line' }, [el('b', {}, [x.label || x.who || '']), ' ', x.dice + ': ' + x.faces.join(' ') + ' = ', el('b', {}, [String(x.total)])]);
    return el('div', { class: 'log-line' + (x.outcome === 'Critical Success' ? ' crit' : x.outcome === 'Fumble' ? ' fumble' : '') }, [
      el('b', {}, [x.label || x.who || '']), ' d20 ', String(x.face), x.bonus ? ' + ' + x.bonus : '', ' vs ', String(x.value) + (x.bonus ? ' (+' + x.bonus + ')' : ''), ' · ', x.outcome,
      x.theirs ? ' — them ' + x.theirs.face + ' vs ' + x.theirs.value + ' · ' + x.theirs.outcome : '', x.fixed != null ? ' — against ' + x.fixed : '',
      x.result ? el('b', {}, [' → ' + x.result]) : '',
    ]);
  }

  return Object.assign({ core, roller, rollDie, rollSide, diceButton, logEntry, logLine }, core);
});
