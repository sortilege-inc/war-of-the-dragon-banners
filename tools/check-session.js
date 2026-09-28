// tools/check-session.js — M5's proof: two pages, two origins, one room, through the real controls.
//
// The Gamemaster (http://localhost:8750) sets up a knight, a scene with two tracked Bandits, a copy's
// Hit Points and private notes, and starts a session; a player (http://127.0.0.1:8750 — another origin,
// its own storage) follows the join link, claims the knight, plays (Hit Points −, a Trait roll), sees
// the Gamemaster's change, is refused what a player may not do, opens its table, and keeps its seat on
// a reload. Every line printed is a result; any exception exits 1.
//
// The repo is served from disk for both origins (no site server needed). The Worker must be running:
//   (cd worker && npx wrangler dev --port 8805)      — or the launch entry vtt-pendragon6e-worker
//   NODE_PATH=~/App/ray-so/scripts/node_modules node tools/check-session.js
// (Playwright is not a dependency of this repo; the family's harness uses ray-so's install.)
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.md': 'text/markdown' };
const out = [];
const say = (k, v) => { out.push([k, v]); console.log(k + ': ' + (typeof v === 'string' ? v : JSON.stringify(v))); };
const errors = [];
const fails = [];
const expect = (label, ok) => { if (!ok) fails.push(label); };

async function serve(ctx, origin) {
  await ctx.route(origin + '/**', (route) => {
    let p = new URL(route.request().url()).pathname;
    if (p.endsWith('/')) p += 'index.html';
    const f = path.join(ROOT, decodeURIComponent(p));
    if (!f.startsWith(ROOT) || !fs.existsSync(f)) return route.fulfill({ status: 404, body: 'no' });
    route.fulfill({ status: 200, contentType: TYPES[path.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f) });
  });
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  // pages served from disk have no address, so Chromium would count them public and block their calls to
  // the loopback Worker (Local Network Access); a real localhost page is loopback itself
  const browser = await chromium.launch({ args: ['--disable-features=LocalNetworkAccessChecks,PrivateNetworkAccessRespectPreflightResults,BlockInsecurePrivateNetworkRequests'] });
  const gmCtx = await browser.newContext({ viewport: { width: 1500, height: 900 } });
  const plCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await serve(gmCtx, 'http://localhost:8750');
  await serve(plCtx, 'http://127.0.0.1:8750');
  const gm = await gmCtx.newPage();
  const pl = await plCtx.newPage();
  for (const [n, p] of [['gm', gm], ['player', pl]]) {
    p.on('console', (m) => { if (m.type() === 'error') errors.push(n + ': ' + m.text()); });
    p.on('pageerror', (e) => errors.push(n + ' pageerror: ' + e.message));
  }

  // ── the Gamemaster sets up: a knight, a scene with two Bandits, a copy's Hit Points, private notes ──
  await gm.goto('http://localhost:8750/gm/');
  await gm.getByRole('button', { name: 'Enter' }).click();
  // Knights is already a region of the default layout
  const party = gm.locator('.slot-party').first();
  const pick = party.locator('select[aria-label="A knight from the books"]');
  await pick.selectOption({ label: 'The Hardy Knight · Core Rulebook' });
  await party.locator('input[placeholder="Player"]').fill('Sam');
  await party.locator('button', { hasText: /^Add$/ }).click();
  await gm.waitForFunction(() => (VttState.state.party || []).length === 1, null, { timeout: 15000 });
  await gm.locator('.navbtn', { hasText: 'Scenes' }).click();
  await gm.locator('input[aria-label="New scene"]').fill('Ambush on the Salisbury road');
  await gm.locator('input[aria-label="New scene"]').press('Enter');
  await gm.locator('.slot-scenes button', { hasText: '+ Encounter' }).click();
  await gm.locator('input[aria-label="Add a character to this encounter"]').fill('Bandit');
  await wait(400);
  await gm.locator('.slot-scenes button', { hasText: /^\+ Bandit$/ }).click();
  await gm.locator('.slot-scenes button[aria-label="One more Bandit"]').click();
  await gm.locator('.slot-scenes button', { hasText: 'Put on the table' }).click();
  await gm.waitForSelector('.slot-scenes .inst-row input[aria-label^="Hit Points"]', { timeout: 15000 });
  await wait(600);
  const h1 = gm.locator('.slot-scenes .inst-row').first().locator('input[aria-label^="Hit Points"]');
  await h1.fill('4');
  await h1.press('Tab');
  await gm.locator('.navbtn', { hasText: 'Overview' }).click();
  await gm.locator('textarea.notes-free').fill('The bandits are in Sir Ulfius’s pay.');
  await wait(600);
  const gmDoc = await gm.evaluate(() => ({ party: VttState.state.party.map((m) => m.name), cast: VttState.state.cast, npcState: VttState.state.npcState, gmNotes: VttState.state.gmNotes }));
  say('GM set up', { party: gmDoc.party, copies: Object.values(gmDoc.cast)[0].map((c) => c.label), npcState: gmDoc.npcState, gmNotes: !!gmDoc.gmNotes });

  // ── the Gamemaster starts a session ──
  await gm.getByRole('button', { name: 'Start session' }).click();
  await gm.waitForSelector('.session-code b', { timeout: 15000 });
  await gm.waitForSelector('.session-code .chip.on', { timeout: 15000 });
  const code = (await gm.locator('.session-code b').textContent()).trim();
  say('room', code + ' · ' + (await gm.locator('.session-code .chip').textContent()));
  expect('the room is live', /live/.test(await gm.locator('.session-code .chip').textContent()));

  // ── the player joins from another origin, and claims the knight ──
  await pl.goto('http://127.0.0.1:8750/gm/play.html?s=' + code);
  // the join link (Session.joinUrl, ?s=CODE) joins its room on load
  await pl.waitForSelector('.cards .card', { timeout: 15000 });
  const claimable = await pl.locator('.cards .card .card-name').allTextContents();
  say('player sees to claim', claimable);
  expect('the player can claim the knight', claimable.some((n) => /Hardy Knight/.test(n)));
  await pl.locator('.cards .card', { hasText: 'The Hardy Knight' }).getByRole('button', { name: 'Claim' }).click();
  await pl.waitForSelector('.sheet.live', { timeout: 20000 });
  const view = await pl.evaluate(() => ({ keys: Object.keys(VttState.state).sort(), npcState: VttState.state.npcState, gmNotes: VttState.state.gmNotes, arc: VttState.state.arc, cast: VttState.state.cast, head: document.querySelector('.sheet-head').innerText }));
  say('player view', { head: view.head, hasNpcState: view.npcState !== undefined && Object.keys(view.npcState || {}).length > 0, hasGmNotes: !!view.gmNotes, hasArc: !!(view.arc && view.arc.length), castShared: !!(view.cast && Object.keys(view.cast).length) });
  expect('the player’s view holds none of the Gamemaster’s own state', view.npcState === undefined || !Object.keys(view.npcState || {}).length);
  expect('no GM notes in the player’s view', !view.gmNotes);
  expect('no arc in the player’s view', !(view.arc && view.arc.length));
  const gmClaims = await gm.locator('.session-code').innerText();
  say('GM sees', gmClaims.replace(/\n/g, ' '));

  // ── the player plays: Hit Points −, a Valorous roll (the d20 pinned to 10) ──
  await pl.locator('.tracker', { hasText: 'Hit Points' }).getByRole('button', { name: '−' }).click();
  await pl.evaluate(() => { window.__q = [9]; crypto.getRandomValues = (a) => { a[0] = window.__q.length ? window.__q.shift() : 0; return a; }; });
  await pl.getByRole('button', { name: 'Valorous 16' }).click();
  await pl.getByRole('button', { name: 'Roll d20' }).click();
  await wait(1500);
  const gmSees = await gm.evaluate(() => { const m = VttState.state.party[0]; return { live: m.live, log: VttState.state.log.slice(-2).map((x) => x.text || (x.label + ' ' + x.face + ' vs ' + x.value + ' · ' + x.outcome)) }; });
  say('GM receives the player’s play', gmSees);
  expect('the player’s Hit Points change reaches the GM', gmSees.live.hp === 29);
  expect('the player’s roll reaches the GM', gmSees.log.some((x) => /Valorous 10 vs 16 · Success/.test(x)));

  // ── the Gamemaster awards Glory; the player sees it ──
  // (the click into Knights selected that region, so Scenes and Overview opened there: bring it back)
  await gm.locator('.navbtn', { hasText: 'Knights' }).click();
  await gm.locator('.slot-party .card').first().click();
  await wait(800);
  const glory = gm.locator('.slot-inspector').first().locator('input[aria-label="Glory"]');
  await glory.fill('100');
  await glory.press('Tab');
  await wait(1500);
  const got = await pl.evaluate(() => ({ glory: VttState.state.party[0].live.glory, shown: document.querySelector('input[aria-label="Glory"]').value }));
  say('player receives the Gamemaster’s change', got);
  expect('the Gamemaster’s change reaches the player', got.glory === 100 && got.shown === '100');

  // ── the room refuses what a player may not do ──
  const before = await gm.evaluate(() => JSON.stringify({ n: VttState.state.npcState, notes: VttState.state.gmNotes, cast: VttState.state.cast }));
  await pl.evaluate(() => { window.__errs = []; VttBus.on('session:error', (p) => window.__errs.push(p.message)); });
  await pl.evaluate(() => {
    const iid = Object.values(VttState.state.cast || {})[0][0].iid;
    VttState.commit('setNpcState', [iid, { hp: 99 }]);              // the Gamemaster's own
    VttState.commit('setSceneCast', [Object.keys(VttState.state.cast)[0], []]);   // the Gamemaster's to set
    VttState.commit('setGmNotes', ['hacked']);                     // local to the Gamemaster
  });
  await wait(1500);
  const after = await gm.evaluate(() => JSON.stringify({ n: VttState.state.npcState, notes: VttState.state.gmNotes, cast: VttState.state.cast }));
  say('refused: the GM’s state unchanged by the player’s forbidden ops', before === after);
  const answers = await pl.evaluate(() => window.__errs);
  say('the room’s answers to the player', answers);
  expect('the room refuses the forbidden ops', before === after && answers.indexOf('not allowed: setNpcState') !== -1 && answers.indexOf('not allowed: setSceneCast') !== -1);
  say('the player’s own copy after the room’s snapshot (the cast put back; npcState is not a shared key, so the refused edit stays in that browser alone)', await pl.evaluate(() => ({ npcState: VttState.state.npcState || null, castLen: Object.values(VttState.state.cast || {})[0].length })));

  // ── the table: the GM places the wounded copy; the player's table follows, without its Hit Points ──
  const gmTable = await gmCtx.newPage();
  gmTable.on('pageerror', (e) => errors.push('gm table pageerror: ' + e.message));
  await gmTable.goto('http://localhost:8750/gm/vtt.html');
  await gmTable.waitForSelector('#vtt-toolbar select');
  const tokSel = gmTable.locator('#vtt-toolbar select').filter({ hasText: 'add token…' });
  await tokSel.selectOption({ label: 'Bandit 1' });
  await tokSel.selectOption({ label: 'The Hardy Knight' });
  await gmTable.waitForFunction(() => document.querySelectorAll('svg#map .token').length >= 2, null, { timeout: 15000 });
  const gmToks = await gmTable.locator('svg#map .token').allTextContents();
  say('GM table tokens', gmToks);
  expect('the GM’s table shows the copy’s Hit Points', gmToks.some((t) => /Bandit 1 · Hit Points 4/.test(t)));
  await pl.locator('.play-menu > summary').click().catch(() => {});
  const [plTable] = await Promise.all([plCtx.waitForEvent('page'), pl.getByRole('link', { name: 'Open the table' }).click()]);
  plTable.on('pageerror', (e) => errors.push('player table pageerror: ' + e.message));
  await plTable.waitForFunction(() => document.querySelectorAll('svg#map .token').length >= 2, null, { timeout: 20000 });
  const plToks = await plTable.locator('svg#map .token').allTextContents();
  expect('the players’ table never shows a copy’s Hit Points', plToks.some((t) => /Bandit 1/.test(t)) && !plToks.some((t) => /Bandit 1 · Hit Points/.test(t)));
  say('player table tokens', { url: plTable.url().replace(/^https?:\/\/[^/]+/, ''), player: await plTable.evaluate(() => document.body.classList.contains('player')), tokens: await plTable.locator('svg#map .token').allTextContents() });

  // ── a reload keeps the seat ──
  await pl.reload();
  await pl.waitForSelector('.sheet.live', { timeout: 20000 });
  const again = await pl.locator('.sheet-head h2').textContent();
  say('player after reload', again);
  expect('a reload keeps the seat', /Hardy Knight/.test(again));

  say('console errors', errors);
  expect('no console errors', !errors.length);
  await browser.close();
  console.log('check-session: ' + (fails.length ? fails.length + ' FAILED — ' + fails.join('; ') : 'OK'));
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error('HARNESS FAILED:', e.message); console.error(errors); process.exit(1); });
