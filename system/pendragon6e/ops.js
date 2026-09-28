// system/pendragon6e/ops.js — the ops Pendragon adds to the engine's, registered with the same
// call and shared the same way (engine/ops.js). Loaded by the browser after engine/ops.js, and
// imported by the Worker beside it, so the room applies the very same functions. Ids travel in the
// args; applying an op is deterministic everywhere, and the room never rolls. The GM workbench's
// shape (PLAYBOOK §4c) is sortilege-vtt-marvelmultiverse's (itself Coyote & Crow's and
// Daggerheart's).
//
//   cast      { [sceneId]: [instance] }   who the Gamemaster has put in a scene. An instance is
//                                         { iid, id, label } — one tracked copy of a stat block, so
//                                         three Bandits are three trackers; a bare string is one
//                                         copy whose iid is its id
//   npcState  { [iid]: {hp} }             a copy's Hit Points as they stand (each starts at the
//                                         block's printed number) — the Gamemaster's own
//   gm, gmNotes, arc, threads             the Gamemaster's own pack state (PLAYBOOK §4b.2). The arc
//                                         (the Scenes outline) is the campaign's scenes, which the
//                                         table runs (system/pendragon6e/table.js)
//   A knight's live state is the engine's setPartyLive (system/pendragon6e/sheet.js).
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory(require('../../engine/ops.js'));
  else factory(root.VttOps);
})(typeof self !== 'undefined' ? self : this, function (Ops) {
  Ops.shared(['cast']);

  Ops.register('setSceneCast', (s, sceneId, list) => {
    if (!s.cast) s.cast = {};
    s.cast[sceneId] = (list || []).slice();
  });

  // A knight's archived versions: a copy, appended, never edited. A player may archive their own.
  Ops.register('archivePartyVersion', (s, id, version) => {
    const m = (s.party || []).find((x) => x.id === id);
    if (!m || !version || !version.id) return;
    if (!m.versions) m.versions = [];
    if (!m.versions.some((x) => x.id === version.id)) m.versions.push(version);
  }, (s, me, a) => a[0] === me);

  // The Gamemaster's own: a copy's state, and the pack state. No player may send them, none is in a
  // player's view, and the pack state is never forwarded to the room (local ops).
  const gmOnly = () => null;
  const LOCAL = { local: true };
  const copy = (x) => JSON.parse(JSON.stringify(x == null ? null : x));
  Ops.register('setNpcState', (s, iid, st) => {
    if (!s.npcState) s.npcState = {};
    s.npcState[iid] = Object.assign({}, st || {});
  }, null, gmOnly);
  Ops.register('setGm', (s, where, value) => { if (!s.gm) s.gm = {}; s.gm[String(where)] = copy(value); }, null, gmOnly, LOCAL);
  Ops.register('setGmNotes', (s, text) => { s.gmNotes = String(text || ''); }, null, gmOnly, LOCAL);
  Ops.register('setArc', (s, list) => { s.arc = copy(list || []); }, null, gmOnly, LOCAL);
  Ops.register('setThreads', (s, list) => { s.threads = copy(list || []); }, null, gmOnly, LOCAL);

  return Ops;
});
