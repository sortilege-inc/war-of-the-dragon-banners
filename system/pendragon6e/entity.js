// system/pendragon6e/entity.js — one entity, as the book holds it. Ported from
// sortilege-vtt-marvelmultiverse (itself L5R5e's).
//
// Generic by design: an entity is rendered from its own fields and blocks, in the corpus's
// order, whatever it is — a skill, a combat action, a barony, a stat block — so the renderer names
// almost nothing. Every string shown is the corpus's; the words added are labels: a property's
// name (the corpus's own) and a keyword's. Four shapes get a layout of their own because the book
// prints them so:
//
//   * a typed list of rows (`^"Attacks" LIST OF ^"Attack" [ DEF { … }, … ]`) is a table, one
//     column per field; a list of a name and its value (a knight's Passions, a stat block's Skills)
//     is a line, "Honor 15, Homage 15", as the page sets it;
//   * a `Table` is the table the book draws: its caption, its heads (a head over two columns
//     spans them), its `Table Row`s (a cell drawn beside several rows spans them), its note;
//   * a `Quotation` is set as the book sets it: the title, the text (verse keeps its lines), the
//     attribution;
//   * a knight or a stat block leads with its five Characteristics and its Health and Other
//     panels, then its Attacks, its Traits as the pairs the sheet prints, and its lists.
//
// EMPHASIS (spec §5: a bold or italic run the page sets, recorded beside the verbatim prose) is
// drawn back into that prose here, each run where it first occurs after the last, and never shown
// as a block of its own. The string in data/ is untouched.
window.PDEntity = (function () {
  const { el, esc } = window.VttRender;
  const D = window.PDData;
  const open = (id) => window.PDOpenEntity && window.PDOpenEntity(id);

  // ── emphasis ───────────────────────────────────────────────────────
  // A pool of an entity's marked runs, consumed in printed order: each string the entity shows
  // takes the runs it contains, from where the previous run ended; a run not found stays for the
  // next string (the runs of a stat block sit in its fields, not its name).
  function pool(spans) {
    return { spans: (spans || []).slice() };
  }
  function marked(s, P) {
    const src = String(s);
    if (!P || !P.spans.length) return esc(src);
    let out = '';
    let at = 0;
    const left = [];
    // a run that starts or ends on a letter is a whole word there ("and" is not in "understand")
    const word = /[\p{L}\p{N}]/u;
    const find = (sp, from) => {
      for (let i = src.indexOf(sp, from); i >= 0; i = src.indexOf(sp, i + 1)) {
        const before = i > 0 && word.test(sp[0]) && word.test(src[i - 1]);
        const after = i + sp.length < src.length && word.test(sp[sp.length - 1]) && word.test(src[i + sp.length]);
        if (!before && !after) return i;
      }
      return -1;
    };
    P.spans.forEach((sp) => {
      const i = sp ? find(sp, at) : -1;
      if (i < 0) return left.push(sp);
      out += esc(src.slice(at, i)) + '<b class="emph">' + esc(sp) + '</b>';
      at = i + sp.length;
    });
    P.spans = left;
    return out + esc(src.slice(at));
  }

  // ── text ───────────────────────────────────────────────────────────
  function inline(s, bookId, P) {
    let h = marked(s, P);
    // ^"Name" (escaped by esc() to ^&quot;Name&quot;): the name, linked when the corpus has it
    h = h.replace(/\^&quot;(.+?)&quot;/g, (m, nm) => {
      const raw = nm.replace(/&#39;/g, "'").replace(/&amp;/g, '&');
      const e = D.named(raw, bookId);
      const r = e ? null : D.recordNamed(raw)[0];
      const id = e ? e.id : r ? r.id : null;
      return id ? '<a class="ref" href="#" data-open="' + esc(id) + '">' + nm + '</a>' : '<span class="refname">' + nm + '</span>';
    });
    return h;
  }
  function wire(node) {
    node.addEventListener('click', (ev) => {
      const a = ev.target.closest && ev.target.closest('a[data-open]');
      if (!a) return;
      ev.preventDefault();
      open(a.dataset.open);
    });
    return node;
  }
  // \n\n paragraphs, \n line breaks; nothing is added or reflowed. The pool is consumed across
  // the paragraphs in order.
  function prose(text, cls, bookId, P) {
    if (text == null || text === '') return null;
    const wrap = el('div', { class: cls || 'prose' });
    String(text).split(/\n\s*\n/).forEach((p) => wrap.appendChild(el('p', { html: inline(p, bookId, P).replace(/\n/g, '<br>') })));
    return wire(wrap);
  }
  const span = (text, bookId, cls, P) => wire(el('span', { class: cls || null, html: inline(String(text), bookId, P) }));

  // A reference: a link when the corpus has the target (loaded, or listed in the records),
  // the printed name when it does not.
  function link(ref, bookId) {
    if (!ref) return null;
    const t = (ref.hash && D.entity(ref.hash)) || (ref.name && D.named(ref.name, bookId));
    const r = t ? null : (ref.hash && D.record(ref.hash)) || (ref.name && D.recordNamed(ref.name)[0]);
    const label = ref.name || (t && t.name) || (r && r.name) || '';
    const id = t ? t.id : r ? r.id : null;
    if (!id) return el('span', { class: 'refname' }, [label]);
    return el('a', { class: 'ref', href: '#', onclick: (ev) => { ev.preventDefault(); open(id); } }, [label]);
  }

  // ── labels ─────────────────────────────────────────────────────────
  const kwLabel = (kw) => kw.charAt(0) + kw.slice(1).toLowerCase().replace(/_/g, ' ');

  // ── arguments ──────────────────────────────────────────────────────
  function argNode(a, bookId, P) {
    if ('s' in a) return span(a.s, bookId, null, P);
    if ('c' in a) return link({ hash: a.h || null, name: a.c }, bookId);
    if ('h' in a) return link({ hash: a.h, name: null }, bookId);
    if ('i' in a) return el('span', { class: 'num' }, [String(a.i)]);
    if ('b' in a) return el('span', {}, [a.b ? 'yes' : 'no']);
    if ('w' in a) return el('span', { class: 'word' }, [a.w]);
    if ('l' in a) return el('span', { class: 'arglist' }, a.l.map((x, i) => [i ? ', ' : null, argNode(x, bookId, P)]));
    if ('d' in a) return fields(a.d, bookId, P);
    return null;
  }
  const args = (list, bookId, P) => (list || []).map((a, i) => [i ? ' ' : null, argNode(a, bookId, P)]);

  // ── typed lists of rows ────────────────────────────────────────────
  const isRows = (p) => p && p.vk === 'list' && p.ofHash && (p.items || []).length && p.items.every((it) => it && it.d);
  // a row that is a name and its value (Rated Value, Stat Rating): "Hate (Saxons) 5", its Note after it
  const RATED = ['Rated Value', 'Stat Rating'];
  const fieldOf = (it, n) => (it.d.find((x) => x.name === n) || {}).value;
  function ratedLine(p, bookId) {
    return el('div', { class: 'printed-line' }, p.items.map((it, i) => {
      const nm = fieldOf(it, 'Name');
      const t = typeof nm === 'string' ? D.named(nm, bookId) : null;
      const txt = nm + ' ' + fieldOf(it, 'Value') + (fieldOf(it, 'Note') ? ' ' + fieldOf(it, 'Note') : '');
      return [i ? ', ' : null, t ? el('a', { class: 'ref', href: '#', onclick: (ev) => { ev.preventDefault(); open(t.id); } }, [txt]) : txt];
    }));
  }
  // a knight's Traits: each pair as the sheet prints it, the virtue's value, the pair, the vice's value
  function traitGrid(p, bookId) {
    return el('div', { class: 'table-wrap' }, [el('table', { class: 'printed traits' }, [el('tbody', {}, p.items.map((it) => el('tr', {}, [
      el('td', { class: 'num' }, [String(fieldOf(it, 'Virtue Value'))]),
      el('td', {}, [link({ name: fieldOf(it, 'Virtue') }, bookId)]),
      el('td', {}, [link({ name: fieldOf(it, 'Vice') }, bookId)]),
      el('td', { class: 'num' }, [String(fieldOf(it, 'Vice Value'))]),
    ])))])]);
  }
  // the string the book printed for a row, when the row carries it
  const printed = (it) => {
    const f = (it.d || []).find((x) => x.name === 'Printed' && typeof x.value === 'string');
    return f ? f.value : null;
  };
  function rowsView(p, bookId, P) {
    const items = p.items;
    // the printed string, linked to the entry its Name names when the corpus has one
    // (a Name the corpus has opens its entry)
    const one = (it) => {
      const nm = (it.d.find((x) => x.name === 'Name') || {}).value;
      const t = typeof nm === 'string' ? D.named(nm, bookId) || D.recordNamed(nm)[0] : null;
      if (!t) return span(printed(it), bookId, null, P);
      return el('a', { class: 'ref', href: '#', onclick: (ev) => { ev.preventDefault(); open(t.id); } }, [printed(it)]);
    };
    if (items.every(printed)) return el('div', { class: 'printed-line' }, items.map((it, i) => [i ? ', ' : null, one(it)]));
    const cols = [];
    items.forEach((it) => it.d.forEach((f) => cols.indexOf(f.name) === -1 && cols.push(f.name)));
    return el('div', { class: 'table-wrap' }, [el('table', { class: 'printed rows' }, [
      el('thead', {}, [el('tr', {}, cols.map((c) => el('th', {}, [c])))]),
      el('tbody', {}, items.map((it) => el('tr', {}, cols.map((c) => {
        const f = it.d.find((x) => x.name === c);
        return el('td', {}, [f ? value(f, bookId, P) : null]);
      })))),
    ])]);
  }

  // ── property values ────────────────────────────────────────────────
  function value(p, bookId, P) {
    switch (p.vk) {
      case 'ref': return link(p.ref, bookId);
      case 'list': {
        const items = p.items || [];
        // a declaration (no items at all) says what it holds; an instance's empty list is empty
        if (!items.length) return p.items ? el('span', { class: 'muted' }, ['—']) : p.of ? el('span', { class: 'muted small' }, ['list of ' + p.of]) : null;
        if (isRows(p) && RATED.indexOf(p.of) !== -1) return ratedLine(p, bookId);
        if (isRows(p) && p.of === 'Trait Value') return traitGrid(p, bookId);
        if (isRows(p)) return rowsView(p, bookId, P);
        return el('ul', { class: 'items' }, items.map((it) => el('li', {}, [argNode(it, bookId, P)])));
      }
      case 'def': return el('div', { class: 'def' }, [fields(p.fields, bookId, P), p.blocks ? nodes(p.blocks, bookId, 0, P) : null]);
      case 'enum': return p.value !== undefined ? span(String(p.value), bookId, null, P) : el('span', { class: 'muted small' }, ['one of ' + (p.options || []).join(', ')]);
      case 'choice': return el('span', {}, ['choose ' + (p.pick || 1) + ': ', args(p.items, bookId, P)]);
      case 'tagged': return el('span', {}, [link({ name: p.name }, bookId), ' ', el('span', { class: 'tags' }, p.tags.map((t) => el('span', { class: 'tag' }, [String(D.arg(t))])))]);
      case 'block': return nodes(p.body, bookId, 0, P);
      case 'name': return link({ name: p.name }, bookId);
      default: {
        const v = p.value !== undefined ? p.value : p.default;
        if (v === undefined) return el('span', { class: 'muted small decl' }, [[p.dtype || 'value', p.min != null ? 'min ' + p.min : null, p.max != null ? 'max ' + p.max : null, p.required ? 'required' : null].filter(Boolean).join(' ')]);
        if (typeof v === 'boolean') return el('span', {}, [v ? 'yes' : 'no']);
        if (typeof v === 'number') return el('span', { class: 'num' }, [String(v)]);
        return String(v).length > 90 ? prose(String(v), 'prose', bookId, P) : span(String(v), bookId, null, P);
      }
    }
  }
  // a knight's printed line is labelled by the list it prints (the value is the printed string)
  const FIELD_LABEL = { 'Printed Passions': 'Passions', 'Printed Skills': 'Skills', 'Printed Weapon Skills': 'Weapon Skills' };
  function fieldRow(p, bookId, P) {
    if (p.vk === 'name' || p.vk === 'tagged') return el('div', { class: 'prop solo' }, [value(p, bookId, P)]);
    const v = value(p, bookId, P);
    return el('div', { class: 'prop' + (isRows(p) ? ' wide' : '') }, [el('div', { class: 'prop-k' }, [FIELD_LABEL[p.name] || p.name, p.default !== undefined && p.value === undefined ? el('span', { class: 'muted' }, [' (default)']) : null]), el('div', { class: 'prop-v' }, [v])]);
  }
  function fields(list, bookId, P) {
    if (!list || !list.length) return null;
    return el('div', { class: 'fields' }, list.map((f) => fieldRow(f, bookId, P)));
  }

  // ── blocks, generically ────────────────────────────────────────────
  function node(b, bookId, depth, P) {
    if (!b || typeof b !== 'object') return null;
    if ('ent' in b) {
      const e = D.entity(b.ent);
      return e ? el('div', { class: 'nested' }, [render(e, { depth: (depth || 0) + 1 })]) : null;
    }
    if ('rule' in b) return ruleLine(b.text, bookId);
    if ('num' in b) return el('div', { class: 'numrow' }, [el('span', { class: 'n' }, [String(b.num)]), el('span', {}, [args(b.args, bookId, P)]), b.body ? nodes(b.body, bookId, depth, P) : null]);
    if ('s' in b && !('kw' in b)) {
      if (b.body) return el('div', { class: 'section' }, [el('div', { class: 'sec-k' }, [span(b.s, bookId, null, P)]), nodes(b.body, bookId, depth, P)]);
      return el('div', { class: 'line' }, [span(b.s, bookId, null, P), b.args && b.args.length ? el('span', {}, [' → ', args(b.args, bookId, P)]) : null]);
    }
    if ('name' in b && 'vk' in b) return fieldRow(b, bookId, P);
    if (!('kw' in b)) return null;
    if (b.kw === 'EMPHASIS') return null;                 // drawn into the prose it marks
    if (b.kw === 'GUIDANCE' && b.body) return null;       // attached to what it concerns
    if (b.kw === 'TABLE' && b.body) return tableBlock(b, bookId);
    if (b.kw === 'CHOOSE' && !b.body) return chooseLine(b, bookId, P);
    const label = el('span', { class: 'kw' }, [kwLabel(b.kw)]);
    const a = b.args && b.args.length ? args(b.args, bookId, P) : null;
    if (!b.body) {
      const long = b.args && b.args.length === 1 && 's' in b.args[0] && b.args[0].s.length > 90;
      if (long) return el('div', { class: 'kwpara' }, [el('div', { class: 'prop-k' }, [kwLabel(b.kw)]), prose(b.args[0].s, 'prose', bookId, P)]);
      return el('div', { class: 'kwline' }, [label, a ? el('span', { class: 'kwargs' }, [a]) : null]);
    }
    return el('div', { class: 'kwblock' + (depth ? ' deep' : '') }, [
      el('div', { class: 'kwhead' }, [label, a ? el('span', { class: 'kwargs' }, [' ', a]) : null]),
      nodes(b.body, bookId, (depth || 0) + 1, P),
    ]);
  }
  function nodes(list, bookId, depth, P) {
    if (!list || !list.length) return null;
    return el('div', { class: 'nodes' }, list.map((b) => node(b, bookId, depth, P)));
  }

  function chooseLine(b, bookId, P) {
    const n = b.args.find((a) => 'i' in a);
    const list = b.args.find((a) => 'l' in a);
    return el('div', { class: 'kwline choose' }, [
      el('span', { class: 'kw' }, ['Choose ' + (n ? n.i : '')]), ' ',
      list ? el('span', { class: 'arglist' }, list.l.map((x, i) => [i ? ', ' : null, argNode(x, bookId, P)])) : null,
    ]);
  }

  // A RULES line: `slug "text"` shows its text; a bare slug is a rule id with no text.
  function ruleText(t) {
    const m = /^\S+\s+"([\s\S]*)"$/.exec(t);
    return m ? m[1].replace(/\\(["\\n])/g, (x, c) => (c === 'n' ? '\n' : c)) : null;
  }
  function ruleLine(t, bookId) {
    const txt = ruleText(t);
    return txt ? el('div', { class: 'rule' }, [prose(txt, 'prose', bookId)]) : null;
  }
  function rules(list, bookId) {
    if (!list || !list.length) return null;
    const withText = list.filter((r) => ruleText(r.text));
    const bare = list.filter((r) => !ruleText(r.text));
    return el('div', { class: 'rules' }, [
      withText.map((r) => ruleLine(r.text, bookId)),
      bare.length ? el('details', { class: 'rule-ids' }, [el('summary', { class: 'muted small' }, [bare.length + ' rule id' + (bare.length === 1 ? '' : 's')]), el('div', { class: 'muted small mono' }, [bare.map((r) => r.text).join(' · ')])]) : null,
    ]);
  }

  // ── a printed table ────────────────────────────────────────────────
  function table(t, bookId) {
    if (!t) return null;
    return el('div', { class: 'table-wrap' }, [el('table', { class: 'printed' }, [
      el('thead', {}, [el('tr', {}, t.columns.map((c) => el('th', {}, [String(c)])))]),
      el('tbody', {}, t.rows.map((r) => el('tr', {}, r.map((c) => wire(el('td', { html: inline(String(c), bookId) })))))),
    ])]);
  }
  // a TABLE the build could not read into columns and rows (it carries more): its blocks
  function tableBlock(b, bookId) {
    const cols = (b.body || []).find((x) => x.kw === 'COLUMNS');
    const rowsB = (b.body || []).filter((x) => x.kw === 'ROW');
    const other = (b.body || []).filter((x) => x.kw !== 'COLUMNS' && x.kw !== 'ROW');
    const cell = (a) => el('td', {}, [argNode(a, bookId)]);
    return el('div', { class: 'table-wrap' }, [
      el('table', { class: 'printed' }, [
        cols ? el('thead', {}, [el('tr', {}, (cols.args[0] && cols.args[0].l ? cols.args[0].l : []).map((c) => el('th', {}, [String(D.arg(c))])))]) : null,
        el('tbody', {}, rowsB.map((r) => el('tr', {}, (r.args[0] && r.args[0].l ? r.args[0].l : []).map(cell)))),
      ]),
      other.length ? nodes(other, bookId, 1) : null,
    ]);
  }

  // ── a Table the book draws ─────────────────────────────────────────
  // Its heads (Columns), a head drawn over several columns (Spans: Row 1 is the heads' row), its
  // Table Rows in order (a Header row as heads), a cell drawn beside several rows (Row Spans, counted
  // with the heads' row as row 1) — joined only where the cells it covers are printed blank, so no
  // text is ever hidden — the labels set along its axes, the note printed under it, its notes.
  const cellsOf = (r) => (D.val(r, 'Cells') || []).map((c) => (c == null ? '' : String(c)));
  function drawnTable(e, bookId, P) {
    const cols = (D.val(e, 'Columns') || []).map(String);
    const rowEnts = D.children(e.id).filter((k) => k.type === 'Table Row');
    const grid = rowEnts.map(cellsOf);
    const spans = {};                     // "r:c" → rowspan, over the data rows (0-based)
    const hidden = {};
    D.rows(e, 'Row Spans').forEach((rs) => {
      const r0 = rs.Row - 2, c0 = rs.Column - 1, n = rs.Rows;
      if (r0 < 0 || !grid[r0] || n < 2) return;
      for (let i = 1; i < n; i++) if (!grid[r0 + i] || (grid[r0 + i][c0] || '') !== '') return;
      spans[r0 + ':' + c0] = n;
      for (let i = 1; i < n; i++) hidden[(r0 + i) + ':' + c0] = true;
    });
    const colspan = {};
    const colHidden = {};
    D.rows(e, 'Spans').forEach((sp) => {
      if (sp.Row !== 1) return;
      const c0 = sp.Column - 1, n = sp.Columns;
      for (let i = 1; i < n; i++) if ((cols[c0 + i] || '') !== '') return;
      colspan[c0] = n;
      for (let i = 1; i < n; i++) colHidden[c0 + i] = true;
    });
    const cell = (tag, txt, attrs) => wire(el(tag, Object.assign({ html: inline(txt, bookId) }, attrs || {})));
    // A table whose first head is a die ("1D20", "2D6 Roll") and whose rows carry their roll range
    // (Table Row: Minimum, Maximum, Or More) can be rolled: the roll marks its row.
    const Dice = window.PDDice;
    const die = Dice && /^\s*\d*[dD]\d+\b/.test(cols[0] || '') ? Dice.parseDice(cols[0]) : null;
    const ranged = rowEnts.filter((r) => D.val(r, 'Minimum') != null);
    const trs = [];
    const roll = die && ranged.length ? Dice.diceButton(die.text, { label: 'Roll ' + die.text, onRoll: (res) => {
      trs.forEach((tr, i) => {
        const r = rowEnts[i];
        const lo = D.val(r, 'Minimum'), hi = D.val(r, 'Maximum');
        tr.classList.toggle('rolled', !!(lo != null && res.total >= lo && (res.total <= hi || D.val(r, 'Or More'))));
      });
    } }) : null;
    const caption = D.val(e, 'Caption');
    const note = D.val(e, 'Note');
    const labels = D.val(e, 'Labels') || [];
    return el('div', { class: 'drawn-table' }, [
      el('div', { class: 'table-wrap' }, [el('table', { class: 'printed' }, [
        caption ? el('caption', {}, [caption]) : null,
        cols.some((c) => c !== '') ? el('thead', {}, [el('tr', {}, cols.map((c, i) => (colHidden[i] ? null : cell('th', c, colspan[i] ? { colspan: colspan[i] } : null))))]) : null,
        el('tbody', {}, grid.map((r, ri) => {
          const tr = el('tr', { class: D.val(rowEnts[ri], 'Header') ? 'head-row' : null }, r.map((c, ci) => {
            if (hidden[ri + ':' + ci]) return null;
            return cell(D.val(rowEnts[ri], 'Header') ? 'th' : 'td', c, spans[ri + ':' + ci] ? { rowspan: spans[ri + ':' + ci] } : null);
          }));
          trs.push(tr);
          return tr;
        })),
      ])]),
      roll ? el('div', { class: 'table-roll' }, [roll]) : null,
      labels.length ? el('div', { class: 'muted small' }, [labels.join(' · ')]) : null,
      note ? prose(note, 'prose table-note', bookId, P) : null,
      D.rows(e, 'Notes').length ? el('div', { class: 'table-notes' }, D.rows(e, 'Notes').map((n) => el('div', { class: n.Head ? 'tn-head' : 'tn' }, [
        n.Head ? n.Head : null, n.Label ? el('b', {}, [n.Label + ' ']) : null, n.Text ? span(n.Text, bookId) : null,
      ]))) : null,
    ]);
  }

  // ── a Quotation, as the book sets it ───────────────────────────────
  function quotation(e, bookId, P) {
    const t = D.val(e, 'Text') || '';
    const verse = D.val(e, 'Verse');
    return el('figure', { class: 'quotation' + (verse ? ' verse' : '') }, [
      D.val(e, 'Title') ? el('div', { class: 'q-title' }, [D.val(e, 'Title')]) : null,
      D.val(e, 'Introduction') ? prose(D.val(e, 'Introduction'), 'prose q-intro', bookId, P) : null,
      el('blockquote', {}, [prose(t, 'prose', bookId, P)]),
      D.val(e, 'Attribution') ? el('figcaption', {}, [D.val(e, 'Attribution')]) : null,
    ]);
  }

  // ── a knight's or a stat block's head, as the book sets it ─────────
  const CHARS = ['SIZ', 'DEX', 'STR', 'CON', 'APP'];
  function profileHead(e) {
    const cells = CHARS.map((k) => (D.val(e, k) != null ? el('div', { class: 'stat' }, [el('div', { class: 'stat-k' }, [k]), el('div', { class: 'stat-v' }, [String(D.val(e, k))])]) : null)).filter(Boolean);
    const panels = {};
    const order = [];
    D.rows(e, 'Statistics').forEach((r) => {
      if (!panels[r.Panel]) { panels[r.Panel] = []; order.push(r.Panel); }
      panels[r.Panel].push(r);
    });
    return el('div', { class: 'statblock' }, [
      cells.length ? el('div', { class: 'stats' }, cells) : null,
      order.map((pn) => el('div', { class: 'stat-panel' }, [el('div', { class: 'stat-panel-k' }, [pn]), el('div', { class: 'stats' }, panels[pn].map((r) => el('div', { class: 'stat' }, [el('div', { class: 'stat-k' }, [r.Statistic]), el('div', { class: 'stat-v' }, [r.Value])])))])),
    ]);
  }
  // the fields a knight prints after its head, in the sheet's order; the rest follow as declared
  const PROFILE_ORDER = ['Byline', 'Attack Columns', 'Attacks', 'Attacks Note', 'Traits', 'Directed Traits', 'Religious Traits', 'Armor', 'Armor Note',
    'Passions', 'Printed Passions', 'Skills', 'Printed Skills', 'Weapon Skills', 'Combat Skills', 'Printed Weapon Skills', 'Skills & Traits', 'Fields'];
  // A printed line the corpus also keeps parsed (a knight's "Printed Passions" beside its Passions; a
  // stat block's "Traits: Merciful 7, …" Field beside its Traits): the printed string is shown, the
  // parsed list is what the sheet rolls. Which list each printed form stands for:
  const PRINTED_OF = { 'Printed Passions': 'Passions', 'Printed Skills': 'Skills', 'Printed Weapon Skills': 'Weapon Skills' };
  function hiddenByPrinted(e) {
    const out = {};
    Object.keys(PRINTED_OF).forEach((k) => { if (D.val(e, k) != null) out[PRINTED_OF[k]] = true; });
    D.rows(e, 'Fields').forEach((f) => { if (D.prop(e, f.Label) && D.prop(e, f.Label).vk === 'list') out[f.Label] = true; });
    return out;
  }
  // a stat block's Attacks under the heads the block prints (Attack Columns)
  function statAttacks(e, bookId, P) {
    const heads = D.val(e, 'Attack Columns');
    const p = D.prop(e, 'Attacks');
    if (!isRows(p)) return null;
    const keys = [];
    p.items.forEach((it) => it.d.forEach((f) => keys.indexOf(f.name) === -1 && keys.push(f.name)));
    const labels = heads && heads.length === keys.length ? heads : keys;
    return el('div', { class: 'prop wide' }, [el('div', { class: 'prop-k' }, ['Attacks']), el('div', { class: 'prop-v' }, [el('div', { class: 'table-wrap' }, [el('table', { class: 'printed rows' }, [
      el('thead', {}, [el('tr', {}, labels.map((c) => el('th', {}, [String(c)])))]),
      el('tbody', {}, p.items.map((it) => el('tr', {}, keys.map((k) => { const f = it.d.find((x) => x.name === k); return el('td', {}, [f ? value(f, bookId, P) : null]); })))),
    ])])])]);
  }
  // a stat block's Fields: "Armor: Gambeson", as printed
  function statFields(e, bookId, P) {
    const rs = D.rows(e, 'Fields');
    return rs.length ? el('div', { class: 'fields stat-fields' }, rs.map((f) => el('div', { class: 'prop' }, [el('div', { class: 'prop-k' }, [f.Label]), el('div', { class: 'prop-v' }, [f.Text != null ? span(f.Text, bookId, null, P) : null])]))) : null;
  }

  // ── sidebars (the worked examples) ─────────────────────────────────
  function guidance(list, bookId) {
    return (list || []).map((g) => el('aside', { class: 'guidance' + ((g.topics || []).indexOf('Example') !== -1 ? ' example' : '') }, [
      el('div', { class: 'guidance-k' }, [(g.topics || []).join(', ') || 'Sidebar']),
      prose(g.text, 'prose', bookId, pool(g.emphasis)),
    ]));
  }
  // an instance's house rule beside what it changes
  function corrections(e) {
    const list = D.correctionsFor(e.id);
    if (!list.length) return null;
    return el('div', { class: 'errata' }, list.map((c) => el('aside', { class: 'correction' }, [
      el('div', { class: 'guidance-k' }, [c.op === 'MODIFY' ? 'Changed' : 'Replaced', el('span', { class: 'muted small' }, [' · ' + D.label(c.book)])]),
      nodes(c.body, c.book, 1),
    ])));
  }

  // ── the entity ─────────────────────────────────────────────────────
  function subtitle(e) {
    const bits = [];
    if (e.form === 'ACTOR') bits.push('actor type' + (e.type ? ', a kind of ' + e.type : ''));
    else if (e.type) bits.push(e.type);
    if (D.isProfile(e) && D.val(e, 'Byline')) bits.push(D.val(e, 'Byline'));
    return bits;
  }

  const TEXTY = ['Description', 'Effect', 'Text', 'Summary', 'Situation', 'Instructions'];
  function render(e, opts) {
    const o = opts || {};
    const bid = e.book;
    const P = pool(D.emphasis(e));
    const profile = D.isProfile(e);
    const box = el('article', { class: 'entity' + (e.form === 'ACTOR' ? ' actor' : '') + (profile ? ' profile' : '') + (e.type ? ' type-' + e.type.toLowerCase().replace(/\W+/g, '-') : '') + (o.depth ? ' depth' : '') });
    if (!o.bare) {
      const H = o.depth ? 'h4' : 'h3';
      box.appendChild(el(H, {}, [e.name, e.type ? el('span', { class: 'etype' }, [e.type]) : null]));
      const sub = subtitle(e);
      if (sub.length && !o.depth) box.appendChild(el('div', { class: 'muted small' }, [sub.join(' · '), ' · ', D.label(bid)]));
    }
    if (e.copyOf) {
      const c = e.copyOf;
      const go = (ev) => { ev.preventDefault(); D.ensure(c.book).then(() => open(c.hash)); };
      box.appendChild(el('div', { class: 'muted small copyof' }, ['As printed here; defined in ', el('a', { class: 'ref', href: '#', onclick: go }, [c.name]), ' (' + D.label(c.book) + ')']));
    }
    let props = (e.props || []).slice();
    // a drawn table and a quotation are laid out as the book sets them; their rows are theirs
    if (e.type === 'Table') {
      if (e.desc) box.appendChild(prose(e.desc, 'prose', bid, P));
      box.appendChild(drawnTable(e, bid, P));
      props = [];
    } else if (e.type === 'Quotation') {
      box.appendChild(quotation(e, bid, P));
      props = [];
    }
    let extra = null;
    if (profile && e.form !== 'ACTOR') {
      box.appendChild(profileHead(e));
      const hide = hiddenByPrinted(e);
      props = props.filter((p) => CHARS.indexOf(p.name) === -1 && p.name !== 'Name' && p.name !== 'Statistics' && !hide[p.name]);
      if (e.type === 'Stat Block') {
        props = props.filter((p) => ['Attack Columns', 'Attacks', 'Fields', 'Byline'].indexOf(p.name) === -1);
        extra = [statAttacks(e, bid, P), statFields(e, bid, P)];
      }
      const rank = (p) => { const i = PROFILE_ORDER.indexOf(p.name); return i === -1 ? PROFILE_ORDER.length : i; };
      props.sort((a, b) => rank(a) - rank(b));
    }
    if (extra) extra.filter(Boolean).forEach((x) => box.appendChild(x));
    if (e.desc && e.type !== 'Table') box.appendChild(prose(e.desc, 'prose', bid, P));
    const isText = (p) => TEXTY.indexOf(p.name) !== -1 && typeof p.value === 'string';
    const rest = props.filter((p) => !isText(p));
    if (rest.length) box.appendChild(fields(rest, bid, P));
    props.filter(isText).forEach((p) => {
      box.appendChild(el('div', { class: 'kwpara' }, [p.name === 'Description' ? null : el('div', { class: 'prop-k' }, [p.name]), prose(p.value, 'prose', bid, P)]));
    });
    if (e.table) box.appendChild(table(e.table, bid));
    const rl = rules(e.rules, bid);
    if (rl) box.appendChild(rl);
    const inBlocks = new Set();
    (e.blocks || []).forEach((b) => {
      if (b && 'ent' in b) inBlocks.add(b.ent);
    });
    // a Table's rows are drawn by the table; a shallow render (the creator's step texts) is the entity's
    // own text, nothing nested in it
    const blk = e.type === 'Table' || o.shallow ? (e.blocks || []).filter((b) => !(b && 'ent' in b && (o.shallow || (D.entity(b.ent) || {}).type === 'Table Row'))) : e.blocks;
    if (blk && blk.length) box.appendChild(nodes(blk, bid, o.depth || 0, P));
    guidance(D.guidanceFor(e.id), bid).forEach((g) => box.appendChild(g));
    const er = corrections(e);
    if (er) box.appendChild(er);
    if (!o.noKids && !o.shallow) {
      D.children(e.id).filter((k) => !inBlocks.has(k.id) && !(e.type === 'Table' && k.type === 'Table Row')).forEach((k) => box.appendChild(el('div', { class: 'nested' }, [render(k, { depth: (o.depth || 0) + 1 })])));
    }
    return box;
  }

  // A card for a grid: the name, what it is, the start of its text.
  function card(e, onclick, meta) {
    const t = e.desc || D.text(e, 'Text') || D.text(e, 'Situation') || D.text(e, 'Byline') || '';
    return el('button', { class: 'card', type: 'button', onclick }, [
      el('div', { class: 'card-name' }, [e.name]),
      el('div', { class: 'card-meta muted small' }, [meta || subtitle(e).join(' · ')]),
      t ? el('div', { class: 'card-text' }, [String(t).split(/\n\s*\n/)[0].slice(0, 280)]) : null,
    ]);
  }

  return { render, card, prose, inline, span, link, table, fields, value, nodes, node, subtitle, kwLabel, ruleText, guidance, wire, pool, marked, profileHead, drawnTable };
})();
