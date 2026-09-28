// build/check_chargen.js — the creator's rules (system/pendragon6e/chargen.js) against the book.
//
//  1. Every rule reads from the corpus: no pattern of chargen.rules() may miss (a sentence that no
//     longer reads as the rule it was is reported, never guessed around).
//  2. The derived Characteristics against the chapter's own "average Cymric knight" sentences (each
//     quoted, and each must be in the corpus as quoted).
//  3. The Hardy Knight (Appendix C): his Traits made by the Constructed method from choices the book
//     allows — his religion's six virtues, Valorous raised to 16, six points — come out as printed;
//     his untrained Skills equal Table 3.5's beginning values plus the culture's and his family's; his
//     attacks' damage from Table 8.1 and his Weapon and Brawling Damage.
//  4. Every printed knight (the Core's six, the Starter's eight folios): its Health and Other panels
//     derived from its printed Characteristics. A knight the rules cannot explain is listed; the count
//     may not change (KNOWN_UNEXPLAINED).
//
//   node build/check_chargen.js [--list]
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const G = require('../system/pendragon6e/chargen.js');

const ROOT = path.join(__dirname, '..');
const win = {};
const ctx = vm.createContext({ window: win });
['data/index.js', 'data/records.js', 'data/core.js', 'data/starter.js'].forEach((f) => vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx));
const T = win.PENDRAGON6E;
const E = T.entities;
const prop = (e, n) => (e.props || []).find((p) => p.name === n);
const val = (e, n) => { const p = prop(e, n); return p ? (p.value !== undefined ? p.value : p.items ? p.items.map((i) => (i.d ? rowOf(i) : i.s !== undefined ? i.s : i.i)) : undefined) : undefined; };
const rowOf = (it) => { const o = {}; (it.d || []).forEach((f) => (o[f.name] = f.value !== undefined ? f.value : f.items ? f.items.map((x) => x.s) : undefined)); return o; };

// the chapter's entities, in its order (a name printed twice is 'Name#2')
const chapter = T.books.core.chapters.find((c) => /creating-your-player-knight/.test(c.file));
const order = [];
(function walk(ids) { ids.forEach((id) => { order.push(E[id]); walk(E[id].children || []); }); })(chapter.roots);
function inChapter(name) {
  const m = /^(.*)#(\d+)$/.exec(name);
  const hits = order.filter((e) => e.name === (m ? m[1] : name));
  return hits[m ? Number(m[2]) - 1 : 0] || null;
}
const core = Object.values(E).filter((e) => e.book === 'core');
const src = {
  text: (n) => (inChapter(n) || {}).desc || null,
  guide: (n) => ((inChapter(n) || {}).guidance || []).map((g) => g.text).join('\n'),
  table: (n) => {
    const t = core.find((e) => e.type === 'Table' && e.name === n);
    if (!t) return null;
    return { columns: val(t, 'Columns'), rows: (t.children || []).map((k) => E[k]).filter((r) => r.type === 'Table Row').map((r) => val(r, 'Cells')) };
  },
  pairs: () => core.filter((e) => e.type === 'Trait Pair').map((e) => ({ Virtue: val(e, 'Virtue'), Vice: val(e, 'Vice') })),
  courts: () => core.filter((e) => e.type === 'Passion Court').map((e) => ({ name: e.name, Passions: val(e, 'Passions') })),
};
const TEXT = core.map((e) => (e.desc || '') + '\n' + JSON.stringify(e.props || []) + JSON.stringify(e.guidance || [])).join('\n').replace(/\\n/g, '\n').replace(/\\"/g, '"');

let n = 0;
const fails = [];
function check(label, got, want) {
  n++;
  if (JSON.stringify(got) !== JSON.stringify(want)) fails.push(label + ': got ' + JSON.stringify(got) + ', the book ' + JSON.stringify(want));
}
function said(s) { n++; if (TEXT.indexOf(s) === -1) fails.push('not in the corpus as quoted: ' + JSON.stringify(s)); }

// ── 1. the rules ───────────────────────────────────────────────────
const R = G.rules(src);
check('every rule reads from the corpus', R.missing, []);
check('the Characteristic points', [R.charPoints, R.charMin, R.charMax, R.culturalChar], [60, 8, 15, { CON: 3 }]);
check('the Traits', [R.traitStart, R.traitReligion, R.traitMartial, R.traitOne, R.traitPoints, R.traitCap, R.traitSum], [10, 13, { name: 'Valorous', value: 15 }, 16, 6, 15, 20]);
check('the religions', Object.keys(R.religions), ['Christian', 'Pagan']);
check('the Passions', R.passions.map((p) => p.name + ' ' + p.value), ['Honor 15', 'Homage (Lord) 15', 'Love (Family) 10', 'Station 10', 'Hospitality 10', 'Devotion (Deity) 5']);
check('the homeland’s Passion, the points, the caps', [R.homeland, R.homelandPassion, R.passionPoints, R.passionCap, R.courtCap, R.mercenarySwap], ['Salisbury', { name: 'Hate (Saxons)', value: 5 }, 15, 15, 40, { from: 'Homage', to: 'Fealty' }]);
check('Table 3.5', [R.skills.length, R.skills.filter((s) => s.knightly).map((s) => s.name)], [30, ['Awareness', 'Courtesy', 'First Aid', 'Hunting', 'Recognize', 'Battle', 'Horsemanship', 'Brawling', 'Charge', 'Sword']]);
check('the cultural Skills, the families, the points', [R.culturalSkill, R.families.length, R.families.some((f) => f.name === 'Gifted'), R.skillPoints, R.skillCap], [{ Charge: 3, Horsemanship: 3, Courtesy: 3 }, 19, false, 10, 15]);
check('training and knighthood', [R.training, R.trainingYears, R.qualify, R.age, R.honorMin], [{ skills: 5, trait: 1, traitMax: 19, passionMax: 20, char: 1 }, 7, { age: 18, value: 10, skills: ['Sword', 'Charge', 'Brawling'], others: 2 }, 21, 5]);
check('Glory', [R.inheritMax, R.knightGlory, R.lordMax, R.householdGlory], [4000, 1000, 1000, 50]);
check('who a starting knight is', [R.culture, R.homelandDefault, R.lord, R.classes, R.heir, R.armor], ['Cymric', 'Salisbury', 'Robert of Salisbury', ['Household Knight', 'Mercenary Knight'], true, { mail: 'hauberk', textile: 'aketon', helm: 'nasal helm', total: 10, shield: 'kite shield', shieldPoints: 6 }]);

// ── 2. the average Cymric knight ───────────────────────────────────
said('For example, an average Cymric knight has STR 12 and SIZ 12, so (12 + 12)/6 = 4.');
said('For example, an average Cymric knight has a STR 12 and DEX 12, so [(12 + 12)/2] + 5 = 17.');
said('For example, an average Cymric knight with CON 15 and SIZ 12 has 27 Hit Points.');
said('For example, for an average Cymric knight with 27 Hit Points, 27/4 = 6.75, rounding up to 7.');
said('For example, an average Cymric knight has CON 15, so 15/5 = 3.');
said('Thus, an average Cymric knight has a Knockdown threshold of 12.');
said('Thus, an average Cymric knight has a Major Wound threshold of 15.');
const avg = G.derived({ SIZ: 12, DEX: 12, STR: 12, CON: 15, APP: 12 });
check('the average Cymric knight', [avg['Weapon Damage'], avg['Movement Rate'], avg['Total Hit Points'], avg.Unconscious, avg['Healing Rate'], avg.Knockdown, avg['Major Wound'], avg['Brawling Damage']], [4, 17, 27, 7, 3, 12, 15, 4]);

// ── 3. the Hardy Knight ────────────────────────────────────────────
const hardy = Object.values(E).find((e) => e.name === 'The Hardy Knight' && e.type === 'Knight');
const hc = {};
G.CHARS.forEach((k) => (hc[k] = val(hardy, k)));
// his virtues at 13 are the six Pagan ones (Lustful, Energetic, Generous, Honest, Proud, Spiritual);
// Valorous is his one Trait at 16; six points: Energetic +2, Cruel +2, Reckless +2
const printedTraits = val(hardy, 'Traits').map((t) => t.Virtue + ' ' + t['Virtue Value'] + '/' + t['Vice Value']);
// his Characteristics as the 60 points and the +3 CON (15 12 13 12 8 = 60)
const made = G.build(R, {
  name: 'The Hardy Knight', religion: 'Pagan', knightClass: 'Household Knight',
  chars: { SIZ: 15, DEX: 12, STR: 13, CON: 12, APP: 8 },
  sixteen: 'Valorous', traitPoints: { Energetic: 2, Cruel: 2, Reckless: 2 },
  passionPoints: { Station: 5, Honor: 0, 'Love (Family)': 0, Hospitality: 10 }, family: 'Clever',
  skillPoints: { Battle: 5, Horsemanship: 5 }, training: [], age: 21,
});
check('the Hardy Knight’s Characteristics (60 points, +3 CON)', G.CHARS.map((k) => made.values[k]), G.CHARS.map((k) => hc[k]));
check('the Hardy Knight’s Traits, made as the chapter says', made.values.Traits.map((t) => t.Virtue + ' ' + t['Virtue Value'] + '/' + t['Vice Value']), printedTraits);
check('no Trait error', made.errors.filter((e) => e.step === 'traits'), []);
const printedSkills = {};
val(hardy, 'Skills').concat(val(hardy, 'Weapon Skills')).forEach((s) => (printedSkills[s.Name] = s.Value));
// the Skills he leaves untrained: Table 3.5 + Cymric +3 + his family's (Clever, +3 Gaming); "Singing" and
// "Play Instrument" print as the table names them
['Compose', 'Courtesy', 'Dancing', 'Falconry', 'Flirting', 'Folklore', 'Gaming', 'Literacy', 'Orate', 'Religion', 'Singing', 'Stewardship', 'Play Instrument', 'First Aid']
  .forEach((s) => check('the Hardy Knight’s ' + s, (made.skills.find((x) => x.name === s) || {}).value, printedSkills[s]));
// his attacks' damage, by Table 8.1 ("Character", "Character +2D6", "Horse", "Brawling +2D6")
const dv = G.derived(hc);
const wrow = (w) => src.table('Table 8.1: Melee & Brawling Weapons').rows.find((r) => r[0] === w);
const charge = src.table('Table 3.8: Starting Horses').rows.find((r) => r[0] === 'Charger')[1];
const printedAttacks = {};
val(hardy, 'Attacks').forEach((a) => (printedAttacks[a.Weapon] = a.Damage.replace(/[†*]/g, '')));
['Arming Sword', 'Great Mace', 'Lance', 'Spear', 'Dagger'].forEach((w) => check('the Hardy Knight’s ' + w, G.damage(wrow(w)[4], dv, charge), printedAttacks[w]));

// ── 4. every printed knight's Health and Other panels ──────────────
// the Starter Set's folios print two knights the rules do not reach: Dame Lynelle's Hit Points 28 and
// Healing Rate 3 (her CON 19 and SIZ 10 give 29 and 4), and Cadwallon, an esquire, at 12 Hit Points and
// Unconscious 6 (his CON 15 and SIZ 12 give 27 and 7) — the folios' own numbers, not the Core's rules
const KNOWN_UNEXPLAINED = 2;
const knights = Object.values(E).filter((e) => (e.type === 'Knight' || e.type === 'Folio Knight') && /\.actor$/.test(e.file));
const unexplained = [];
knights.forEach((k) => {
  const c = {};
  G.CHARS.forEach((x) => (c[x] = val(k, x)));
  const d = G.derived(c);
  const stat = {};
  (val(k, 'Statistics') || []).forEach((s) => (stat[s.Statistic] = s.Value));
  const want = { 'Hit Points': d['Total Hit Points'], Knockdown: d.Knockdown, 'Major Wound': d['Major Wound'], Unconscious: d.Unconscious, Movement: d['Movement Rate'], 'Healing Rate': d['Healing Rate'] };
  const off = Object.keys(want).filter((s) => String(want[s]) !== String(stat[s]));
  if (stat['Weapon Damage'] && stat['Weapon Damage'] !== d['Weapon Damage'] + 'D6') off.push('Weapon Damage');
  if (off.length) unexplained.push(k.name + ': ' + off.map((s) => s + ' printed ' + stat[s] + ', derived ' + (s === 'Weapon Damage' ? d['Weapon Damage'] + 'D6' : want[s])).join('; '));
});
check('printed knights (' + knights.length + ') whose panels the rules do not explain', unexplained.length, KNOWN_UNEXPLAINED);
check('knights read', knights.length, 14);
if (process.argv.indexOf('--list') !== -1 || unexplained.length !== KNOWN_UNEXPLAINED) unexplained.forEach((u) => console.log('  unexplained: ' + u));

console.log('check_chargen: ' + (fails.length ? fails.length + ' FAILED' : 'OK') + ' (' + n + ' assertions)');
fails.forEach((f) => console.log('  ' + f));
process.exit(fails.length ? 1 : 0);
