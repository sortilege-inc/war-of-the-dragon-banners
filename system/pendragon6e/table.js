// system/pendragon6e/table.js — what Pendragon tells the table (engine/vtt.js) and the player's page
// (engine/play.js): which scenes are in play, what can stand on the table, what a token's state reads
// as, and how a knight file becomes a knight at the table. The engine never asks the corpus directly.
// Ported from sortilege-vtt-marvelmultiverse (itself VtM5e's, with Coyote & Crow's workbench cast).
//
// The scenes are the Gamemaster's arc (the Scenes outline, op `setArc`): no book ships an .arc.
// One scene is running (the engine's `current`, under the module id 'adventure'), and the table,
// the Cast and the player's page follow it. It ships no maps: a map is whatever image the Gamemaster
// sets on a scene.
//
// A scene's cast is a list of instances (op setSceneCast): { iid, id, label } is one tracked copy of
// stat block (or a knight), so three Bandits are three trackers; a bare string is one copy whose iid
// is its id. A copy's Hit Points stand in npcState[iid] (the Gamemaster's own).
window.VttSystem = (function () {
  const D = window.PDData;
  const Sheet = window.PDSheet;
  const State = window.VttState;
  const Bus = window.VttBus;
  const S = () => State.state;

  const MODULE = 'adventure';
  const moduleId = () => MODULE;

  const scenes = () => (S().arc || []).map((x) => ({ id: x.id, name: x.title || 'A scene', phase: x.session || null, moduleId: MODULE, own: true }));
  function scene(id) {
    const a = (S().arc || []).find((x) => x.id === id);
    return a ? { id: a.id, name: a.title || 'A scene', own: true, arc: a } : null;
  }
  function currentSceneId() {
    const cur = (S().current || {})[MODULE];
    const all = scenes();
    if (!all.length) return cur || null;                       // a player's page: no arc, only the id
    return (all.find((s) => s.id === cur) || all[0] || {}).id || null;
  }

  // ── the cast, as instances ─────────────────────────────────────────
  const castRaw = (sceneId) => ((S().cast || {})[sceneId] || []).slice();
  const castEntries = (sceneId) => castRaw(sceneId).map((c) => (typeof c === 'string' ? { iid: c, id: c } : { iid: c.iid || c.id, id: c.id, label: c.label }));
  const castIds = (sceneId) => castEntries(sceneId).map((c) => c.id);
  const byRecord = (id) => D.entity(id) || D.record(id) || null;
  const cast = (sceneId) => { const seen = {}; return castIds(sceneId).filter((id) => (seen[id] ? false : (seen[id] = 1))).map(byRecord).filter(Boolean); };
  const instLabel = (c) => c.label || ((byRecord(c.id) || {}).name || c.id);
  // a copy of a stat block put in a scene: one more instance, numbered when several go in at once
  function addToScene(sceneId, id, count) {
    const cur = castRaw(sceneId);
    const name = (byRecord(id) || {}).name || id;
    const n = count || 1;
    const already = castEntries(sceneId).filter((c) => c.id === id).length;
    for (let k = 1; k <= n; k++) cur.push({ iid: State.genId('inst'), id, label: n > 1 || already ? name + ' ' + (already + k) : name });
    State.commit('setSceneCast', [sceneId, cur]);
  }
  const removeFromScene = (sceneId, iid) => State.commit('setSceneCast', [sceneId, castRaw(sceneId).filter((c) => (typeof c === 'string' ? c : c.iid) !== iid)]);

  // a copy's Hit Points as they stand: its own, else the block's printed number (its Health panel's
  // "Hit Points" — read from the entity, so a copy asks for its book the first time it is drawn)
  const COPY_TRACKS = ['hp'];
  function copyState(iid, id) {
    const st = (S().npcState || {})[iid] || {};
    const e = D.entity(id);
    if (!e) { const r = D.record(id); if (r && !D.loaded(r.book)) D.ensure(r.book).then(() => Bus.emit('state:changed', {})); }
    const max = e ? Sheet.maxHp(Sheet.entityValues(e)) : null;
    return { hp: { label: 'Hit Points', cur: st.hp != null ? st.hp : max, max } };
  }
  function setCopy(iid, id, key, n) {
    const st = Object.assign({}, (S().npcState || {})[iid] || {});
    st[key] = n;
    State.commit('setNpcState', [iid, st]);
  }

  const maps = () => [];
  const mapDef = () => null;
  const defaultMapId = (sceneId) => sceneId;
  const legend = () => null;
  const mapAssets = () => [];

  // ── tokens: the knights, and the running scene's cast ──────────────
  function tokenSources() {
    const groups = [];
    const party = (S().party || []).map((m) => ({ id: 'tk-' + m.id, label: m.name, kind: 'party', owner: m.id, ref: m.id }));
    if (party.length) groups.push({ label: 'The knights', items: party });
    const sid = currentSceneId();
    const sc = scene(sid);
    const here = sc ? castEntries(sid).map((c) => ({ id: 'tk-' + c.iid, label: instLabel(c), kind: 'cast', ref: c.id, iid: c.iid })) : [];
    if (here.length) groups.push({ label: sc.name, items: here });
    return groups;
  }

  // the players' side: the table's player view (engine/vtt.js marks it body.player) or the player's page
  const playerSide = () => typeof document !== 'undefined' && (document.body.classList.contains('player') || document.body.classList.contains('play'));
  const COLORS = { party: '#9e1b1b', cast: '#1f3f7a', marker: '#6a5b48' };

  // the rings a token may wear (the table's options menu) and a dozen generic faces for an NPC with
  // no art (assets/tokens/npc/) — ported from sortilege-vtt-teeth (2026-10-09)
  const PALETTE = [
    { name: 'Green', color: '#4f6b3a' }, { name: 'Red', color: '#8f1d22' }, { name: 'Black', color: '#1a1613' }, { name: 'Grey', color: '#6b6154' },
    { name: 'Ochre', color: '#b9842a' }, { name: 'Blue', color: '#2f4f6b' }, { name: 'Violet', color: '#5b3a6b' }, { name: 'Teal', color: '#2f6b5e' }, { name: 'Rust', color: '#a1481e' }, { name: 'Bone', color: '#efe6d3' },
  ];
  function tokenPalette() {
    return PALETTE.map((c) => Object.assign({}, c));
  }
  const ICONS = ['person', 'hood', 'helm', 'crown', 'mitre', 'hat', 'skull', 'wolf', 'crow', 'boar', 'hound', 'purse'];
  function tokenIcons() {
    return ICONS.map((id) => ({ id, label: id[0].toUpperCase() + id.slice(1), image: 'assets/tokens/npc/' + id + '.svg' }));
  }
  const tokenColor = (t) => COLORS[t.kind] || COLORS.marker;
  // a token's words: a knight's Hit Points and Glory as they stand; a copy's, the Gamemaster's view of it
  function tokenStatus(t) {
    if (t.kind === 'party') {
      const m = (S().party || []).find((x) => x.id === t.owner);
      if (!m) return null;
      const hp = Sheet.hpOf(m);
      return { text: (hp != null ? 'Hit Points ' + hp + ' · ' : '') + 'Glory ' + Sheet.gloryOf(m).toLocaleString('en'), pips: [] };
    }
    const r = t.kind === 'cast' && t.ref ? D.record(t.ref) : null;
    if (!r) return null;
    // a copy's Hit Points are the Gamemaster's own (npcState is never in a player's view): the players'
    // table shows the block's byline, never a number that would read as its Hit Points
    const by = (r.fields || {}).Byline || '';
    if (playerSide()) return { text: by, pips: [] };
    const cs = copyState(t.iid || t.ref, t.ref);
    return { text: cs.hp.cur != null ? 'Hit Points ' + cs.hp.cur : by, pips: [] };
  }

  function selectToken(t) {
    if (t.kind === 'party') Bus.emit('select', { kind: 'party', id: t.owner });
    else if (t.kind === 'cast' && t.ref) Bus.emit('select', { kind: 'entity', id: t.ref, iid: t.iid, label: t.label });
  }
  const tokenMenu = () => null;

  const readCharacter = (obj, fileName) => Sheet.readMember(obj, fileName);
  const downloadCharacter = (m) => Sheet.downloadMember(m);
  // the sheet reads its ACTOR (the Core's BASE; a folio's is the Starter's types) and the knight's
  // own book; until they are in memory the panel says so and fills in when they arrive
  function liveSheet(m, opts) {
    const books = ['core'].concat(Sheet.booksFor(m));
    if (books.every((b) => D.loaded(b))) return Sheet.live(m, opts);
    const box = window.VttRender.el('div', { class: 'muted' }, ['Opening the sheet…']);
    D.ensure(books).then(() => { if (box.parentNode) box.replaceWith(Sheet.live(m, opts)); });
    return box;
  }
  const memberSubtitle = (m) => Sheet.sentence(m);
  // the player makes a knight here, with the site's creator, and it takes its seat (engine/play.js)
  const makeCharacter = window.PDCreator ? (container, seat) => window.PDCreator.render(container, null, null, { embedded: true, onDone: (v) => seat(Sheet.fromValues(v, '')), doneLabel: 'Take my knight to the table' }) : null;

  // an entity or record by id, for the Gamemaster's notes (engine/gm-text.js "About")
  const byId = (id) => { const r = D.record(id); if (r) return { id: r.id, name: r.name }; const e = D.entity(id); return e ? { id: e.id, name: e.name } : null; };

  return {
    byId, MODULE, moduleId, scenes, scene, currentSceneId,
    cast, castIds, castEntries, castRaw, instLabel, addToScene, removeFromScene, copyState, setCopy, COPY_TRACKS,
    maps, mapDef, defaultMapId, legend, mapAssets,
    tokenSources, tokenColor, tokenPalette, tokenIcons, tokenStatus, selectToken, tokenMenu,
    liveSheet, readCharacter, downloadCharacter, memberSubtitle, makeCharacter,
  };
})();
