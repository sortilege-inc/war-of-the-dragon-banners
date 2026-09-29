// system/pendragon6e/chargen.js — making a player-knight, as *Creating Your Player-knight* states its
// Constructed method: the rules only (no page), so build/check_chargen.js runs them under node against
// the book's own examples and its printed knights.
//
// Every number is read from the corpus at runtime — the chapter's sentences (each pattern below
// cites the entity it reads, and a sentence that no longer matches is reported, never guessed) and
// its tables (3.3 cultural maximums, 3.5 beginning Skill values, 3.6 Family Characteristics, 3.8
// starting horses; the Weapons chapter's Table 8.1 for an attack's damage). What comes out is a
// knight's values in the shape ACTOR "Player Knight" declares (D1) — the Knight's panels as the
// pre-generated knights print them, then the character sheet's own — so one sheet shows a printed
// knight and a made one.
//
// `src` is how the rules reach the corpus, so the page and node share this file:
//   src.text(name)   the DESCRIPTION of the chapter's entity of that name ('Constructed Method#2' is
//                    the second of that name, in the chapter's order), or null
//   src.guide(name)  its sidebars' text, joined
//   src.table(name)  { columns: [...], rows: [[cells]] } of a Table, or null
//   src.pairs()      [{ Virtue, Vice }] — the Core's Trait Pairs
//   src.courts()     [{ name, Passions: [...] }] — the Core's Passion Courts
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PDChargen = api;
})(typeof self !== 'undefined' ? self : this, function () {
  const CHARS = ['SIZ', 'DEX', 'STR', 'CON', 'APP'];
  // "Round up decimal remainders of 0.5 or higher, as usual." (Derived Characteristics); "If the
  // decimal portion of a number is 0.1 to 0.4, it is dropped. If it is 0.5 or higher, then it is
  // rounded up" (Rounding Numbers)
  const round = (x) => Math.floor(x + 0.5);
  const num = (s) => { const m = /-?\d+/.exec(String(s == null ? '' : s).replace(/[–−]/g, '-')); return m ? Number(m[0]) : null; };
  const words = (s) => String(s).split(/,\s*(?:and\s+)?|\s+and\s+/).map((x) => x.trim()).filter(Boolean);

  // ── the rules, read from the chapter ───────────────────────────────
  function rules(src) {
    const missing = [];
    const grab = (name, rx, what) => {
      const t = src.text(name) || '';
      const m = rx.exec(t);
      if (!m) missing.push(what + ' (' + name + ')');
      return m;
    };
    const R = { missing };

    // "Distribute 60 points among the Characteristics as you desire, but with no final value lower than
    // 8 or higher than 15" (Characteristics ▸ Constructed Method)
    let m = grab('Constructed Method', /Distribute (\d+) points among the Characteristics[\s\S]*?no final value lower than (\d+) or higher than (\d+)/, 'the Characteristic points');
    R.charPoints = m ? Number(m[1]) : null;
    R.charMin = m ? Number(m[2]) : null;
    R.charMax = m ? Number(m[3]) : null;
    // "Cymric characters receive a Cultural Characteristic Modifier of +3 CON" (same)
    m = grab('Constructed Method', /Cymric characters receive a Cultural Characteristic Modifier of \+(\d+) (SIZ|DEX|STR|CON|APP)/, 'the Cultural Characteristic Modifier');
    R.culturalChar = m ? { [m[2]]: Number(m[1]) } : {};
    // Table 3.3: the Cultural Maximum of each Characteristic
    const t33 = src.table('Table 3.3: Random Cymric Characteristic Values');
    R.charCap = {};
    if (t33) t33.rows.forEach((r) => { if (CHARS.indexOf(r[0]) !== -1) R.charCap[r[0]] = num(r[2]); });
    else missing.push('Table 3.3');

    // Traits (Personality Traits ▸ Constructed Method, the second of that name)
    const tr = 'Constructed Method#2';
    m = grab(tr, /Traits all start at (\d+)/, 'the Traits’ start');
    R.traitStart = m ? Number(m[1]) : null;
    m = grab(tr, /religion favors to (\d+)/, 'the religion’s Traits');
    R.traitReligion = m ? Number(m[1]) : null;
    m = grab(tr, /The (\w+) Trait always begins at (\d+)/, 'the martial Trait');
    R.traitMartial = m ? { name: m[1], value: Number(m[2]) } : null;
    m = grab(tr, /Raise one Trait to (\d+)/, 'the one Trait raised');
    R.traitOne = m ? Number(m[1]) : null;
    m = grab(tr, /Distribute (\d+) points as you wish\. You may not raise a Trait above (\d+)/, 'the Trait points');
    R.traitPoints = m ? Number(m[1]) : null;
    R.traitCap = m ? Number(m[2]) : null;
    // "Christian Virtues: Chaste, …" / "Pagan Virtues: …" (Religious Virtues)
    R.religions = {};
    const rv = src.text('Religious Virtues') || '';
    const rx = /(\w+) Virtues: ([A-Z][a-z]+(?:, [A-Z][a-z]+)+)/g;
    let v;
    while ((v = rx.exec(rv))) R.religions[v[1]] = words(v[2]);
    if (Object.keys(R.religions).length < 2) missing.push('the religions’ virtues (Religious Virtues)');
    // "Trait pairs must always sum to 20." (Religious Virtues, its sidebar)
    m = /Trait pairs must always sum to (\d+)/.exec(src.guide('Religious Virtues') || '');
    R.traitSum = m ? Number(m[1]) : null;
    if (!m) missing.push('the Trait pairs’ sum (Religious Virtues)');
    // the pairs in the order Personality Traits lists them ("Chaste/Lustful" …), each a Trait Pair of the Core
    const known = src.pairs();
    R.pairs = [];
    const lp = /^(\w+)\/(\w+)$/gm;
    let pr;
    while ((pr = lp.exec(src.text('Personality Traits') || ''))) {
      const hit = known.find((k) => k.Virtue === pr[1] && k.Vice === pr[2]);
      if (hit) R.pairs.push({ Virtue: pr[1], Vice: pr[2] });
    }
    if (!R.pairs.length || R.pairs.length !== new Set(known.map((k) => k.Virtue)).size) missing.push('the Trait pairs (Personality Traits)');

    // Passions (Passions ▸ Constructed Method, the third of that name)
    const ps = 'Constructed Method#3';
    const pt = src.text(ps) || '';
    R.passions = [];
    const start = /All characters start with ([\s\S]*?)\. Player-knights from (\w+) also start with ([^.]*?) at (\d+)\. Distribute an additional (\d+) points/.exec(pt);
    if (start) {
      // "Honor and the Homage (Lord) Passion at a value of 15, Love (Family), Station, and Hospitality
      // each at a value of 10, and Devotion (Deity) at a value of 5"
      const grp = /(?:,\s*(?:and\s+)?)?([^,]*?(?:, [^,]*?)*?)(?: each)? at a value of (\d+)/g;
      let g;
      while ((g = grp.exec(start[1]))) {
        const names = g[1].replace(/^and\s+/, '').replace(/ Passion$/, '').split(/,\s*(?:and\s+)?|\s+and\s+(?:the\s+)?/).map((x) => x.replace(/^the\s+/, '').replace(/ Passion$/, '').trim()).filter(Boolean);
        names.forEach((n) => R.passions.push({ name: n, value: Number(g[2]) }));
      }
      R.homeland = start[2];
      R.homelandPassion = { name: start[3], value: Number(start[4]) };
      R.passionPoints = Number(start[5]);
    } else missing.push('the starting Passions (Passions ▸ Constructed Method)');
    m = /No Passion value may be raised above (\d+)/.exec(pt);
    R.passionCap = m ? Number(m[1]) : null;
    if (!m) missing.push('the Passions’ cap');
    // "mercenary knights start with Fealty in place of Homage"
    m = /mercenary knights start with (\w+) in place of (\w+)/.exec(pt);
    R.mercenarySwap = m ? { from: m[2], to: m[1] } : null;
    if (!m) missing.push('the mercenary’s Passion');
    // "Passions are grouped into “courts,” which limit the total value of all Passions in each court to 40."
    m = /limit the total value of all Passions in each court to (\d+)/.exec(src.guide(ps) || '');
    R.courtCap = m ? Number(m[1]) : null;
    R.courts = src.courts();

    // Skills: Table 3.5 (a starred Skill is Knightly; "Combat Skills" and "Weapon Skills" are its heads)
    const t35 = src.table('Table 3.5: Beginning Knight Skill Values');
    R.skills = [];
    if (t35) {
      let group = 'Skills';
      t35.rows.forEach((r) => {
        if (/Starting Value/.test(r[1])) { group = r[0]; return; }
        R.skills.push({ name: r[0].replace(/\*$/, ''), knightly: /\*$/.test(r[0]), base: r[1], group });
      });
    } else missing.push('Table 3.5');
    // "Cymric knights begin play with Cultural Skill Modifiers of +3 to Charge, Horsemanship, and Courtesy."
    m = grab('Cultural Skill Modifiers', /Cultural Skill Modifiers of \+(\d+) to ([^.]+)\./, 'the Cultural Skill Modifiers');
    R.culturalSkill = {};
    if (m) words(m[2]).forEach((n) => (R.culturalSkill[n] = Number(m[1])));
    // Table 3.6: each Family Characteristic and the Skill its bonus goes to ("+3 Bonus to Skill");
    // "(Note that “Gifted” may not be chosen by this method.)" (Family Characteristic ▸ Constructed)
    const t36 = src.table('Table 3.6: Family Characteristics');
    R.families = [];
    if (t36) {
      const bonus = num(t36.columns[2]);
      const barred = /Note that “(\w+)” may not be chosen/.exec(src.text('Constructed#2') || '');
      R.familyTable = [];
      t36.rows.forEach((r) => {
        const f = { roll: num(r[0]), name: r[1], skill: r[2].replace(/ \(.*\)$/, ''), printed: r[2], bonus };
        R.familyTable.push(f);
        if (!barred || r[1] !== barred[1]) R.families.push(f);
      });
      R.familyBarred = barred ? barred[1] : null;
      if (!barred) missing.push('the Family Characteristic not chosen (Family Characteristic ▸ Constructed)');
    } else missing.push('Table 3.6');
    // "distribute 10 points among your Skills" (Personal Skill Additions) and its Limitations
    m = grab('Personal Skill Additions', /distribute (\d+) points among your Skills/, 'the personal Skill points');
    R.skillPoints = m ? Number(m[1]) : null;
    m = grab('Limitations', /You may not raise a Skill above (\d+)/, 'the Skills’ cap');
    R.skillCap = m ? Number(m[1]) : null;
    R.noRaiseFromZero = /You may not raise any Skill with a starting value of 0/.test(src.text('Limitations') || '');
    R.appCap = /Skills with starting values based on APP may not exceed the value of the Appeal Characteristic/.test(src.text('Limitations') || '');
    if (!R.noRaiseFromZero || !R.appCap) missing.push('the Limitations');

    // Training & Practice: "invest up to seven years" (Attaining Knighthood); per year one of: 5 Skill
    // points, +1 to a Trait (max 19) or Passion (max 20), +1 to a Characteristic (Cultural Maximum)
    m = grab('Training & Practice', /Distribute (\d+) points among the character’s Skills[\s\S]*?Add (\d+) point to any Trait \(to a maximum of (\d+)\) or Passion \(maximum of (\d+)\)[\s\S]*?Add (\d+) point to STR/, 'the training choices');
    R.training = m ? { skills: Number(m[1]), trait: Number(m[2]), traitMax: Number(m[3]), passionMax: Number(m[4]), char: Number(m[5]) } : null;
    const years = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8 };
    m = grab('Attaining Knighthood#2', /invest up to (\w+) years of Training & Practice/, 'the years of training');
    R.trainingYears = m ? years[m[1]] || num(m[1]) : null;
    // "squires must be at least 18 years of age and have Skill values of 10 in each of Sword, Charge,
    // Brawling, and two non-weapon Knightly Skills of choice" (Attaining Knighthood)
    m = grab('Attaining Knighthood#2', /at least (\d+) years of age and have Skill values of (\d+) in each of ([\w, ]+?), and (\w+) non-weapon Knightly Skills/, 'the qualification for knighthood');
    R.qualify = m ? { age: Number(m[1]), value: Number(m[2]), skills: words(m[3]), others: years[m[4]] || num(m[4]) } : null;
    m = grab('Attaining Knighthood#2', /default age of (\d+)/, 'the default age');
    R.age = m ? Number(m[1]) : null;
    // "knights require an Honor of at least 5" (Passions)
    m = grab('Passions', /Honor of at least (\d+)/, 'the Honor required');
    R.honorMin = m ? Number(m[1]) : null;

    // Glory: "one-quarter of their parent’s Glory … up to an inherited maximum of 4,000 points" (Parent’s
    // Glory); "1,000 Glory for being knighted", "One-hundredth of the Glory of the lord who knighted them,
    // to a maximum of 1,000", "50 points if the new knight is a household knight" (Being Knighted ▸ Glory)
    m = grab('Parent’s Glory', /equal to one-quarter of their parent’s Glory[\s\S]*?inherited maximum of ([\d,]+) points/, 'the inherited Glory');
    R.inheritMax = m ? num(m[1].replace(/,/g, '')) : null;
    R.inheritShare = 1 / 4;
    m = grab('Glory', /([\d,]+) Glory for being knighted\s*One-hundredth of the Glory of the lord who knighted them, to a maximum of ([\d,]+)\.\s*(\d+) points if the new knight is a household knight/, 'the Glory of knighting');
    R.knightGlory = m ? num(m[1].replace(/,/g, '')) : null;
    R.lordShare = 1 / 100;
    R.lordMax = m ? num(m[2].replace(/,/g, '')) : null;
    R.householdGlory = m ? Number(m[3]) : null;

    // Personal information: "Core Player-knights are all Cymric." "The default homeland is the county of
    // Salisbury" (Culture and Homeland); "All starting knights have the same liege lord, Robert of
    // Salisbury." (Liege Lord and Current Home); "Starting characters begin as squires but are soon
    // knighted as household knights or mercenary knights." (Class)
    m = grab('Culture and Homeland', /Core Player-knights are all (\w+)\./, 'the culture');
    R.culture = m ? m[1] : null;
    m = grab('Culture and Homeland', /The default homeland is the county of (\w+)/, 'the homeland');
    R.homelandDefault = m ? m[1] : null;
    m = grab('Liege Lord and Current Home', /the same liege lord, ([^.]+)\./, 'the liege lord');
    R.lord = m ? m[1] : null;
    m = grab('Class', /knighted as (\w+) knights or (\w+) knights/, 'the classes');
    R.classes = m ? [cap(m[1]) + ' Knight', cap(m[2]) + ' Knight'] : [];
    R.heir = /always the designated heir/.test(src.text('Heir') || '');
    // "hauberk (mail coat), aketon (padding), and nasal helm (10 Armor Protection points total); one kite
    // shield (6 Armor Protection points); a sword, four spears and one lance, a dagger" (Starting Knightly Gear)
    m = grab('Starting Knightly Gear', /knights begin with a (\w+) \([^)]*\), (\w+) \([^)]*\), and ([\w ]+?) \((\d+) Armor Protection points total\); one ([\w ]+?) \((\d+) Armor Protection points\)/, 'the starting armor');
    R.armor = m ? { mail: m[1], textile: m[2], helm: m[3], total: Number(m[4]), shield: m[5], shieldPoints: Number(m[6]) } : null;
    randomRules(src, R, grab, missing);
    R.horses = src.table('Table 3.8: Starting Horses');
    R.weapons = src.table('Table 8.1: Melee & Brawling Weapons');
    if (!R.horses) missing.push('Table 3.8');
    if (!R.weapons) missing.push('Table 8.1');
    return R;
  }
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  // ── the Random method, read from the chapter ───────────────────────
  // "Pendragon provides three methods of character creation. Players choose one and use only that one
  // and do not cherrypick parts from the others." (Character Creation) — so a draft is one method or the
  // other throughout; what the Random method rolls is recorded in the draft (d.rolled), never re-rolled
  // by the rules, and every other step (Distinctive Features, Skills, Training, being knighted) is the
  // same for both ("Regardless of whether you are following the Random or Constructed methods",
  // Personal Skill Additions).
  const DICE = /(\d*)D(\d+)(?:\s*([+\-–])\s*(\d+))?/i;
  function dice(s) {
    const m = DICE.exec(String(s || ''));
    return m ? { n: m[1] === '' ? 1 : Number(m[1]), sides: Number(m[2]), add: m[3] ? (m[3] === '+' ? 1 : -1) * Number(m[4]) : 0, text: m[0].replace(/\s+/g, '') } : null;
  }
  // a roll of a printed expression with an injected die, recorded: { expr, faces, total }
  function roll(expr, rollSide) {
    const d = typeof expr === 'string' ? dice(expr) : expr;
    const faces = [];
    for (let i = 0; i < d.n; i++) faces.push(rollSide(d.sides));
    return { expr: d.text, faces, total: faces.reduce((a, b) => a + b, 0) + d.add };
  }
  // the row of a table whose first cell's range ("1–5", "6", "19 or more") holds a roll
  function rowFor(rows, n) {
    return rows.find((r) => {
      const t = String(r[0]).replace(/[–−]/g, '-');
      let m;
      if ((m = /^(\d+)\s*-\s*(\d+)$/.exec(t))) return n >= Number(m[1]) && n <= Number(m[2]);
      if ((m = /^(\d+) or more$/.exec(t))) return n >= Number(m[1]);
      if ((m = /^(\d+) or less$/.exec(t))) return n <= Number(m[1]);
      return /^\d+$/.test(t) && Number(t) === n;
    }) || null;
  }
  function randomRules(src, R, grab, missing) {
    const X = (R.random = {});
    // "Roll the indicated number of dice as shown in Table 3.3 … Cymric characters receive a Cultural
    // Characteristic Modifier of +3 CON after the rolling is done." (Characteristics ▸ Random Method)
    const t33 = src.table('Table 3.3: Random Cymric Characteristic Values');
    X.chars = {};
    if (t33) t33.rows.forEach((r) => { if (CHARS.indexOf(r[0]) !== -1) X.chars[r[0]] = dice(r[1]) ? r[1] : null; });
    let m = grab('Random Method', /Cymric characters receive a Cultural Characteristic Modifier of \+(\d+) (SIZ|DEX|STR|CON|APP) after the rolling is done/, 'the Random Cultural Characteristic Modifier');
    X.culturalChar = m ? { [m[2]]: Number(m[1]) } : {};
    // Table 3.2: Starting Religion, by its head's die
    const t32 = src.table('Table 3.2: Starting Religion');
    X.religion = t32 && dice(t32.columns[0]) ? { die: dice(t32.columns[0]).text, rows: t32.rows } : null;
    if (!X.religion) missing.push('Table 3.2');
    // "Roll 2D6+3 for each left-hand Trait, except for Valorous, which is 2D6+8. … If you roll a Religious
    // Trait …, add +3 to the value … when you roll the opposite of a Religious Trait …, reduce the value you
    // enter by –3." (Religious Virtues ▸ Random Method)
    m = grab('Random Method#2', /Roll (\d+D\d+\+\d+) for each left-hand Trait, except for (\w+), which is (\d+D\d+\+\d+)[\s\S]*?add \+(\d+) to the value[\s\S]*?reduce the value you enter by [–-](\d+)/, 'the random Traits');
    X.traits = m ? { each: m[1], except: m[2], exceptRoll: m[3], religious: Number(m[4]), opposite: Number(m[5]) } : null;
    // Passions ▸ Random Method: "Knights start with Honor and Homage (Lord) at 2D6+8 and Love (Family),
    // Hospitality, and Station at 2D6+3. Devotion (Deity) starts at 1D6+2."; "Distribute no more than
    // another 4D6+1 points"; "All knights of Salisbury begin with the Hate (Saxons) Passion at a value of
    // 1D6+2."; "you may not raise a Passion above 15"
    const pt = src.text('Random Method#3') || '';
    X.passions = [];
    const start = /Knights start with ([\s\S]*?)\. ([^.]*?) starts at (\d+D\d+\+\d+)\./.exec(pt);
    if (start) {
      const grp = /(?:^|\s+and\s+)([^]*?) at (\d+D\d+\+\d+)/g;
      let g;
      while ((g = grp.exec(start[1]))) g[1].split(/,\s*(?:and\s+)?|\s+and\s+/).map((x) => x.trim()).filter(Boolean).forEach((n) => X.passions.push({ name: n, roll: g[2] }));
      X.passions.push({ name: start[2].trim(), roll: start[3] });
    } else missing.push('the random Passions (Passions ▸ Random Method)');
    m = /Distribute no more than another (\d+D\d+\+\d+) points/.exec(pt);
    X.pool = m ? m[1] : null;
    if (!m) missing.push('the random Passion points');
    m = /All knights of (\w+) begin with the ([^.]+?) Passion at a value of (\d+D\d+\+\d+)/.exec(pt);
    X.homeland = m ? { homeland: m[1], name: m[2], roll: m[3] } : null;
    if (!m) missing.push('the random homeland Passion');
    m = /may not raise a Passion above (\d+)/.exec(pt);
    X.passionCap = m ? Number(m[1]) : null;
    if (!m) missing.push('the random Passions’ cap');
    // "Roll 1D20 on Table 3.6: Family Characteristics and apply the bonus." (Cultural Skill Modifiers ▸
    // Random); Gifted: "Roll twice more*" (its row), and its note: "A second roll of 20 means the character
    // is a Transcendent Beauty …; if both rolls are 20, the Adoration bonus increases to +10."
    m = grab('Random#2', /Roll (\d*D\d+) on Table 3\.6/, 'the random Family Characteristic');
    X.family = m ? m[1] : null;
    const gifted = (R.familyTable || []).find((f) => /Roll twice more/.test(f.printed)) || null;
    X.gifted = gifted ? { name: gifted.name, roll: gifted.roll, again: 2 } : null;
    const note = (src.tableNote && src.tableNote('Table 3.6: Family Characteristics')) || '';
    m = /A second roll of (\d+) means the character is a ([^(]+?) \(/.exec(note);
    X.giftedSecond = m ? { roll: Number(m[1]), name: m[2].trim() } : null;
    // Parent's Glory: "roll 6D6 and multiply the result by 100, then add 2,000"
    m = grab('Parent’s Glory', /roll (\d+D\d+) and multiply the result by ([\d,]+), then add ([\d,]+)/, 'the parent’s Glory roll');
    R.parentRoll = m ? { roll: m[1], times: num(m[2].replace(/,/g, '')), add: num(m[3].replace(/,/g, '')) } : null;
    // Quick Family History: "(2D6×100)+2,000 Glory …"; "an additional (3D6×100)+500 Glory. For each full
    // 500 Glory from this additional Glory, roll once on Table 3.1: Heroic Events."
    const q = src.text('Quick Family History') || '';
    m = /start with \((\d+D\d+)×([\d,]+)\)\+([\d,]+) Glory[\s\S]*?additional \((\d+D\d+)×([\d,]+)\)\+([\d,]+) Glory\. For each full ([\d,]+) Glory from this additional Glory, roll once on Table 3\.1/.exec(q);
    R.quickHistory = m ? { start: { roll: m[1], times: num(m[2].replace(/,/g, '')), add: num(m[3].replace(/,/g, '')) }, more: { roll: m[4], times: num(m[5].replace(/,/g, '')), add: num(m[6].replace(/,/g, '')) }, per: num(m[7].replace(/,/g, '')) } : null;
    if (!m) missing.push('the Quick Family History');
    R.heroic = src.table('Table 3.1: Heroic Events');
    // Transcendent Beauty's bonus: "When generating an Adoration Passion for a character with Transcendent
    // Beauty, add +5 to the random roll." (Involuntary Adoration); "if both rolls are 20, the Adoration
    // bonus increases to +10" (Table 3.6's note)
    m = /with Transcendent Beauty, add \+(\d+) to the random roll/.exec((src.coreText && src.coreText('Involuntary Adoration')) || '');
    const m2 = /if both rolls are \d+, the Adoration bonus increases to \+(\d+)/.exec(note);
    X.beauty = m && m2 ? { one: Number(m[1]), both: Number(m2[1]) } : null;
    if (!X.beauty) missing.push('Transcendent Beauty’s Adoration bonus (Involuntary Adoration, Table 3.6’s note)');
  }

  // ── rolling the Random method's parts (the page's die, or a test's) ──
  // what: 'religion' | 'chars' | 'traits' | 'passions' | 'family'. A part is rolled one die-roll at a
  // time, in the book's order ("Start at the top and work your way down the left column"), or all
  // together — the same rolls in the same order either way. `part` is what is rolled so far, in the
  // shape the draft keeps (d.rolled[what]) once nextRoll finds nothing left.
  function emptyPart(what) {
    if (what === 'passions') return { start: {}, pool: null, homeland: null };
    if (what === 'family') return { rolls: [] };
    return what === 'religion' ? null : {};
  }
  // the next roll of a part: { key, label, expr }, or null when the part is whole
  function nextRoll(R, what, part) {
    const X = R.random;
    const p = part == null ? emptyPart(what) : part;
    if (what === 'religion') return p ? null : { key: 'religion', label: 'Religion', expr: X.religion.die };
    if (what === 'chars') { const k = CHARS.find((c) => !p[c]); return k ? { key: k, label: k, expr: X.chars[k] } : null; }
    if (what === 'traits') {
      const t = R.pairs.find((x) => !p[x.Virtue]);
      return t ? { key: t.Virtue, label: t.Virtue, expr: t.Virtue === X.traits.except ? X.traits.exceptRoll : X.traits.each } : null;
    }
    if (what === 'passions') {
      const s = X.passions.find((x) => !p.start[x.name]);
      if (s) return { key: 'start:' + s.name, label: s.name, expr: s.roll };
      if (X.homeland && !p.homeland) return { key: 'homeland', label: X.homeland.name, expr: X.homeland.roll };
      return p.pool ? null : { key: 'pool', label: 'Points to distribute', expr: X.pool };
    }
    if (what === 'family') {
      const n = p.rolls.length;
      const more = X.gifted && n && p.rolls[0].total === X.gifted.roll ? X.gifted.again : 0;
      return n < 1 + more ? { key: String(n), label: n ? 'Roll ' + (n + 1) : 'Family Characteristic', expr: X.family } : null;
    }
    return null;
  }
  // a part with its next roll made (a copy; the draft's is not touched)
  function rollNext(R, what, part, rollSide) {
    const nx = nextRoll(R, what, part);
    const p = part == null ? emptyPart(what) : JSON.parse(JSON.stringify(part));
    if (!nx) return p;
    const r = roll(nx.expr, rollSide);
    if (what === 'religion') { const row = rowFor(R.random.religion.rows, r.total); return Object.assign(r, { value: row ? row[1] : null }); }
    if (what === 'passions') { if (nx.key === 'homeland') p.homeland = r; else if (nx.key === 'pool') p.pool = r; else p.start[nx.label] = r; return p; }
    if (what === 'family') { p.rolls.push(r); return p; }
    p[nx.key] = r;
    return p;
  }
  function rollPart(R, what, d, rollSide) {
    let p = emptyPart(what);
    while (nextRoll(R, what, p)) p = rollNext(R, what, p, rollSide);
    return p;
  }
  // a parent's Glory rolled: "roll 6D6 and multiply the result by 100, then add 2,000"
  function rollParentGlory(R, rollSide) {
    const r = roll(R.parentRoll.roll, rollSide);
    return { rolls: [r], total: r.total * R.parentRoll.times + R.parentRoll.add, events: [] };
  }
  // the Quick Family History: the start and the additional Glory, and a Heroic Event (Table 3.1, 1D6) for
  // each full 500 of the additional. How Table 3.1 prints its events, and how each is read:
  //   * "Battle of Mount Damen. Second roll: Rescued Count Roderick …*" — the first time the number comes
  //     up it is the first part, the second time the "Second roll:" part;
  //   * "Saxon Raid (roll 1D6): 1–3: … 4: … 5: … 6: …" — its outcomes in the cell, each after its number:
  //     a 1D6 picks one; "Variable Battle of... (roll 1d6): 1: Terrabil. …" likewise, its Year cell
  //     listing one year per outcome ("491 500 505 505 505 506–507");
  //   * "Variable Quest (roll 1D6):" — its outcomes on the rows beneath it ("1: Went on …");
  //   * a Year cell "498+1d6" is rolled;
  //   * "*Reroll if you already have this event" (the table's note): an outcome marked * that the family
  //     already has is rolled again, and the roll does not count as an event.
  function heroicEvent(R, rows, row, had, rollSide) {
    const k = rows.indexOf(row);
    const n = Number(row[0]);
    const cell = row[2];
    const star = (t) => /\*/.test(t);
    const key = (x) => n + ':' + x;
    const ev = { roll: n, year: row[1], head: null, text: cell, key: key('') };
    let m;
    const opts = /^(.*?\(roll 1[dD]6\):)\s*(.*)$/.exec(cell);
    if ((m = /^(.*?)\s*Second roll:\s*(.*)$/.exec(cell))) {
      // the first part, else the second
      const second = had.some((h) => h.key === key('first'));
      ev.text = second ? 'Second roll: ' + m[2] : m[1];
      ev.key = key(second ? 'second' : 'first');
    } else if (opts && opts[2]) {
      // outcomes inline: "1–3: …", "4: …"
      ev.head = opts[1];
      const parts = [];
      const rx = /(?:^|\s)(\d+)(?:[–-](\d+))?: /g;
      let hit;
      const marks = [];
      while ((hit = rx.exec(opts[2]))) marks.push({ at: hit.index + (hit[0].startsWith(' ') ? 1 : 0), lo: Number(hit[1]), hi: Number(hit[2] || hit[1]) });
      marks.forEach((mk, i) => parts.push({ lo: mk.lo, hi: mk.hi, i, text: opts[2].slice(mk.at, i + 1 < marks.length ? marks[i + 1].at : undefined).trim() }));
      const sub = roll('1D6', rollSide);
      const part = parts.find((x) => sub.total >= x.lo && sub.total <= x.hi);
      ev.sub = sub.total;
      ev.text = part ? part.text : opts[2];
      ev.key = key(part ? part.lo : '?');
      const years = String(row[1]).split(/\s+/).filter(Boolean);
      if (part && years.length === parts.length) ev.year = years[part.i];
    } else if (opts) {
      // outcomes on the rows beneath it
      ev.head = opts[1];
      const sub = roll('1D6', rollSide);
      const line = rows.slice(k + 1).find((x) => !/^\d+$/.test(x[0]) && new RegExp('^' + sub.total + ':').test(x[2]));
      ev.sub = sub.total;
      ev.text = line ? line[2] : cell;
      ev.year = line ? line[1] : row[1];
      ev.key = key(sub.total);
    }
    // a year printed as a roll: "498+1d6"
    if ((m = /^(\d+)\s*\+\s*(\d*[dD]\d+)$/.exec(String(ev.year)))) {
      const y = roll(m[2], rollSide);
      ev.year = String(Number(m[1]) + y.total);
      ev.yearRoll = y.total;
    }
    const again = star(ev.text) && had.some((h) => h.key === ev.key);
    return again ? null : ev;
  }
  function rollQuickHistory(R, rollSide) {
    const Q = R.quickHistory;
    const a = roll(Q.start.roll, rollSide);
    const b = roll(Q.more.roll, rollSide);
    const more = b.total * Q.more.times + Q.more.add;
    const events = [];
    const rows = R.heroic ? R.heroic.rows : [];
    const die = R.heroic ? dice(R.heroic.columns[0]) : null;
    const main = rows.filter((r) => /^\d+$/.test(r[0]));
    const want = Math.floor(more / Q.per);
    for (let guard = 0; events.length < want && die && guard < 100; guard++) {
      const r = roll(die, rollSide);
      const row = main.find((x) => Number(x[0]) === r.total);
      const ev = row ? heroicEvent(R, rows, row, events, rollSide) : null;
      if (ev) events.push(ev);
    }
    return { rolls: [a, b], total: a.total * Q.start.times + Q.start.add + more, more, events };
  }

  // ── the derived Characteristics (Derived Characteristics, each with its printed Formula) ──
  function derived(c) {
    const wd = round((c.STR + c.SIZ) / 6);                // "Weapon Damage = (STR + SIZ)/6"
    const hp = c.CON + c.SIZ;                              // "Total Hit Points = CON + SIZ"
    return {
      Knockdown: c.SIZ,                                    // "Your SIZ Characteristic is also the threshold value for Knockdown"
      'Major Wound': c.CON,                                // "Your CON Characteristic is also the value for the Major Wound threshold"
      'Weapon Damage': wd,
      'Brawling Damage': wd,                               // "equal to (STR+SIZ)/6"
      'Healing Rate': round(c.CON / 5),                    // "Healing Rate = CON/5"
      'Movement Rate': round((c.STR + c.DEX) / 2) + 5,     // "Movement Rate = [(STR + DEX ) /2] + 5"
      'Total Hit Points': hp,
      Unconscious: round(hp / 4),                          // "Unconscious = Total Hit Points/4"
    };
  }

  // a Skill's beginning value, from Table 3.5's printed cell: "5", "APP–5", "DEX/2", "STR/2", "0"
  function beginning(cell, c) {
    const s = String(cell).replace(/[–−]/g, '-');
    let m;
    if ((m = /^(SIZ|DEX|STR|CON|APP)\s*\/\s*(\d+)$/.exec(s))) return round(c[m[1]] / Number(m[2]));
    if ((m = /^(SIZ|DEX|STR|CON|APP)\s*-\s*(\d+)$/.exec(s))) return c[m[1]] - Number(m[2]);
    if (/^\d+$/.test(s)) return Number(s);
    return null;
  }

  // an attack's damage from Table 8.1's printed Damage: "Character" (Weapon Damage D6), "Brawling"
  // (Brawling Damage), "+2D6" added dice, "Horse" (the charger's Charge Damage, Table 3.8); a note in
  // parentheses stays with the attack
  function damage(printed, dv, horseCharge) {
    const s = String(printed);
    const extra = /\+(\d+)D6/.exec(s.replace(/\(.*\)/, ''));
    const add = extra ? Number(extra[1]) : 0;
    if (/^Horse/.test(s)) return horseCharge || null;
    if (/^Character/.test(s)) return (dv['Weapon Damage'] + add) + 'D6';
    if (/^Brawling/.test(s)) return add ? add + 'D6+' + dv['Brawling Damage'] : String(dv['Brawling Damage']);
    return null;
  }

  // ── a knight from the draft ────────────────────────────────────────
  // draft: { name, religion, knightClass, chars:{SIZ…}, sixteen, traitPoints:{trait:n}, passionPoints:
  // {passion:n}, extraPassions:[name], family, skillPoints:{skill:n}, training:[{kind, name, points}],
  // age, year, parentGlory, lordGlory, extraWeapon, homeland, lord, distinctive, blazon, parentName }
  function build(R, d) {
    const errors = [];
    const notes = [];
    const pts = (o) => Object.keys(o || {}).reduce((a, k) => a + (Number(o[k]) || 0), 0);

    const random = d.method === 'random';
    const rolled = d.rolled || {};
    const need = (what, step, label) => { if (random && !rolled[what]) errors.push({ step, text: 'Roll ' + label + '.' }); return random && rolled[what]; };
    // the religion: chosen, or rolled on Table 3.2
    const religion = random ? (rolled.religion ? rolled.religion.value : '') : d.religion;
    need('religion', 'knight', 'the religion on Table 3.2');

    // Characteristics: the 60 points (Constructed) or Table 3.3's dice (Random), then the culture's
    // modifier, then training
    const c0 = {};
    let charSum = null;
    if (random) {
      const rc = need('chars', 'characteristics', 'the Characteristics') || {};
      CHARS.forEach((k) => (c0[k] = rc[k] ? rc[k].total : 0));
    } else {
      CHARS.forEach((k) => (c0[k] = Number((d.chars || {})[k]) || 0));
      charSum = CHARS.reduce((a, k) => a + c0[k], 0);
      if (charSum !== R.charPoints) errors.push({ step: 'characteristics', text: charSum + ' of ' + R.charPoints + ' points distributed.' });
      CHARS.forEach((k) => { if (c0[k] < R.charMin || c0[k] > R.charMax) errors.push({ step: 'characteristics', text: k + ' ' + c0[k] + ' is outside ' + R.charMin + '–' + R.charMax + '.' }); });
    }
    const culturalChar = random ? R.random.culturalChar : R.culturalChar;
    const c = {};
    CHARS.forEach((k) => (c[k] = c0[k] + (culturalChar[k] || 0)));
    // "Later changes to Characteristics do not affect beginning Skill values" (Beginning Values); and
    // "Characteristics raised in this manner do not affect Skill values" (Training & Practice)
    const cSkills = Object.assign({}, c);
    const training = (d.training || []).slice(0, R.trainingYears || 0);
    if ((d.training || []).length > (R.trainingYears || 0)) errors.push({ step: 'training', text: (d.training || []).length + ' years of training; up to ' + R.trainingYears + '.' });
    training.forEach((y, i) => {
      if (y.kind === 'char' && CHARS.indexOf(y.name) !== -1) {
        c[y.name] += R.training.char;
        if (R.charCap[y.name] != null && c[y.name] > R.charCap[y.name]) errors.push({ step: 'training', text: 'Year ' + (i + 1) + ': ' + y.name + ' ' + c[y.name] + ' is over its Cultural Maximum of ' + R.charCap[y.name] + '.' });
      }
    });
    const dv = derived(c);

    // Traits: each pair as its virtue's value; the religion's virtues, the martial Trait, the one raised,
    // the points; then the Trait training years
    const favored = R.religions[religion] || [];
    const rt = need('traits', 'traits', 'the Traits') || {};
    const pairs = R.pairs.map((p) => {
      let v = R.traitStart;
      if (random) {
        // the roll, +3 for a Religious Trait, –3 for the opposite of one
        v = rt[p.Virtue] ? rt[p.Virtue].total : R.traitStart;
        if (rt[p.Virtue] && favored.indexOf(p.Virtue) !== -1) v += R.random.traits.religious;
        if (rt[p.Virtue] && favored.indexOf(p.Vice) !== -1) v -= R.random.traits.opposite;
        return { Virtue: p.Virtue, Vice: p.Vice, v };
      }
      if (favored.indexOf(p.Virtue) !== -1) v = R.traitReligion;
      if (favored.indexOf(p.Vice) !== -1) v = R.traitSum - R.traitReligion;
      if (R.traitMartial && p.Virtue === R.traitMartial.name) v = R.traitMartial.value;
      return { Virtue: p.Virtue, Vice: p.Vice, v };
    });
    const pairOf = (t) => pairs.find((p) => p.Virtue === t || p.Vice === t);
    const side = (p, t) => (p.Virtue === t ? p.v : R.traitSum - p.v);
    const setSide = (p, t, n) => { p.v = p.Virtue === t ? n : R.traitSum - n; };
    if (random) { /* the Random method raises no Trait to 16 and distributes no Trait points */ } else if (d.sixteen) {
      const p = pairOf(d.sixteen);
      if (p) setSide(p, d.sixteen, R.traitOne);
    } else errors.push({ step: 'traits', text: 'Raise one Trait to ' + R.traitOne + '.' });
    const tp = random ? {} : d.traitPoints || {};
    if (!random && pts(tp) !== R.traitPoints) errors.push({ step: 'traits', text: pts(tp) + ' of ' + R.traitPoints + ' Trait points distributed.' });
    Object.keys(tp).forEach((t) => {
      const n = Number(tp[t]) || 0;
      const p = pairOf(t);
      if (!p || !n) return;
      if (t === d.sixteen || (p && d.sixteen && pairOf(d.sixteen) === p)) errors.push({ step: 'traits', text: t + ': the Trait raised to ' + R.traitOne + ' takes no more points.' });
      setSide(p, t, side(p, t) + n);
      if (side(p, t) > R.traitCap) errors.push({ step: 'traits', text: t + ' ' + side(p, t) + ' is above ' + R.traitCap + '.' });
    });

    // Passions: the starting ones (a mercenary's Fealty for Homage; Salisbury's Hate), the 15 points,
    // any others named
    const homageName = (n) => (d.knightClass && R.mercenarySwap && /^Mercenary/.test(d.knightClass) && n.indexOf(R.mercenarySwap.from) === 0 ? n.replace(R.mercenarySwap.from, R.mercenarySwap.to) : n);
    const home = d.homeland || R.homelandDefault;
    let passions;
    let pool = R.passionPoints;
    let passionCap = R.passionCap;
    if (random) {
      const rp = need('passions', 'passions', 'the Passions') || { start: {} };
      passions = R.random.passions.map((p) => ({ Name: homageName(p.name), Value: rp.start[p.name] ? rp.start[p.name].total : 0 }));
      if (R.random.homeland && home === R.random.homeland.homeland) passions.push({ Name: R.random.homeland.name, Value: rp.homeland ? rp.homeland.total : 0 });
      pool = rp.pool ? rp.pool.total : 0;
      passionCap = R.random.passionCap;
    } else {
      passions = R.passions.map((p) => ({ Name: homageName(p.name), Value: p.value }));
      if (R.homelandPassion && home === R.homeland) passions.push({ Name: R.homelandPassion.name, Value: R.homelandPassion.value });
    }
    (d.extraPassions || []).forEach((n) => { if (n && !passions.some((p) => p.Name === n)) passions.push({ Name: n, Value: 0 }); });
    const pp = d.passionPoints || {};
    // Constructed: "Distribute an additional 15 points"; Random: "Distribute no more than another 4D6+1 points"
    if (!random && pts(pp) !== pool) errors.push({ step: 'passions', text: pts(pp) + ' of ' + pool + ' Passion points distributed.' });
    if (random && pts(pp) > pool) errors.push({ step: 'passions', text: pts(pp) + ' Passion points; no more than ' + pool + '.' });
    passions.forEach((p) => {
      const k = Number(pp[p.Name]) || 0;
      p.Value += k;
      // "No Passion value may be raised above 15" / "you may not raise a Passion above 15" — a rolled
      // start may be higher; points may not take it there
      if (k && p.Value > passionCap) errors.push({ step: 'passions', text: p.Name + ' ' + p.Value + ' is above ' + passionCap + '.' });
      if (!random && !k && p.Value > passionCap) errors.push({ step: 'passions', text: p.Name + ' ' + p.Value + ' is above ' + passionCap + '.' });
    });

    // Skills: Table 3.5's beginning values, the culture's modifiers, the family's, the 10 points
    // the Family Characteristic: chosen (Constructed), or rolled on Table 3.6 (Random) — Gifted rolls twice
    // more, and a second 20 is a Transcendent Beauty
    let fams = [];
    let familyName = '';
    if (random) {
      const rf = need('family', 'skills', 'the Family Characteristic') || { rolls: [] };
      const at = (n) => (R.familyTable || []).find((f) => f.roll === n) || null;
      const first = rf.rolls[0] ? at(rf.rolls[0].total) : null;
      if (first && R.random.gifted && first.roll === R.random.gifted.roll) {
        const more = rf.rolls.slice(1).map((r) => at(r.total)).filter(Boolean);
        fams = more.filter((f) => f.roll !== R.random.gifted.roll);
        const twenties = more.length - fams.length;
        familyName = first.name + (fams.length ? ' (' + fams.map((f) => f.name).join(', ') + ')' : '');
        // a second 20 is a Transcendent Beauty, kept on the knight with its Adoration bonus: +5, or +10
        // when both rolls are 20
        if (twenties && R.random.giftedSecond) {
          const b = R.random.beauty ? ' (+' + (twenties > 1 ? R.random.beauty.both : R.random.beauty.one) + ')' : '';
          familyName += ' — ' + R.random.giftedSecond.name + b;
          notes.push(familyName + ': when a character first sees them, the Gamemaster may call for an Adoration roll (Involuntary Adoration)' + (b ? '; the Adoration gained adds' + b.replace(/[()]/g, ' ').replace(/\s+$/, '') : '') + '.');
        }
      } else if (first) { fams = [first]; familyName = first.name; }
    } else {
      const fam = R.families.find((f) => f.name === d.family) || null;
      if (!fam) errors.push({ step: 'skills', text: 'Choose a Family Characteristic.' });
      else { fams = [fam]; familyName = fam.name; }
    }
    const skills = R.skills.map((s) => {
      const b = beginning(s.base, cSkills);
      const bonus = (R.culturalSkill[s.name] || 0) + fams.filter((f) => f.skill === s.name).reduce((a, f) => a + f.bonus, 0);
      return { name: s.name, group: s.group, knightly: s.knightly, base: s.base, begin: b, bonus, value: b + bonus, appBased: /APP/.test(s.base) };
    });
    const skillAt = (n) => skills.find((s) => s.name === n);
    const addSkills = (o, label) => Object.keys(o || {}).forEach((n) => {
      const k = Number(o[n]) || 0;
      const s = skillAt(n);
      if (!s || !k) return;
      if (R.noRaiseFromZero && s.begin === 0) errors.push({ step: label, text: n + ' starts at 0 and may not be raised.' });
      s.value += k;
      s.raised = (s.raised || 0) + k;
    });
    const sp = d.skillPoints || {};
    if (pts(sp) !== R.skillPoints) errors.push({ step: 'skills', text: pts(sp) + ' of ' + R.skillPoints + ' Skill points distributed.' });
    addSkills(sp, 'skills');

    // Training & Practice, year by year
    training.forEach((y, i) => {
      if (y.kind === 'skills') {
        if (pts(y.points) !== R.training.skills) errors.push({ step: 'training', text: 'Year ' + (i + 1) + ': ' + pts(y.points) + ' of ' + R.training.skills + ' Skill points.' });
        addSkills(y.points, 'training');
      } else if (y.kind === 'trait') {
        const p = pairOf(y.name);
        if (!p) errors.push({ step: 'training', text: 'Year ' + (i + 1) + ': choose a Trait.' });
        else {
          setSide(p, y.name, side(p, y.name) + R.training.trait);
          if (side(p, y.name) > R.training.traitMax) errors.push({ step: 'training', text: 'Year ' + (i + 1) + ': ' + y.name + ' ' + side(p, y.name) + ' is above ' + R.training.traitMax + '.' });
        }
      } else if (y.kind === 'passion') {
        const p = passions.find((x) => x.Name === y.name);
        if (!p) errors.push({ step: 'training', text: 'Year ' + (i + 1) + ': choose a Passion.' });
        else {
          p.Value += R.training.trait;
          if (p.Value > R.training.passionMax) errors.push({ step: 'training', text: 'Year ' + (i + 1) + ': ' + y.name + ' ' + p.Value + ' is above ' + R.training.passionMax + '.' });
        }
      } else if (y.kind !== 'char') errors.push({ step: 'training', text: 'Year ' + (i + 1) + ': choose what it trains.' });
    });
    // the Limitations, over everything the points and bonuses reached
    skills.forEach((s) => {
      if (s.value > R.skillCap && (s.raised || s.bonus)) errors.push({ step: 'skills', text: s.name + ' ' + s.value + ' is above ' + R.skillCap + '.' });
      if (R.appCap && s.appBased && s.raised && s.value - s.bonus > c0.APP + (R.culturalChar.APP || 0)) errors.push({ step: 'skills', text: s.name + ' may not exceed APP (' + (c0.APP + (R.culturalChar.APP || 0)) + ') but for its bonuses.' });
    });

    // Court limits: "limit the total value of all Passions in each court to 40"
    (R.courts || []).forEach((ct) => {
      const inCourt = passions.filter((p) => ct.Passions.some((n) => p.Name === n || p.Name.indexOf(n.replace(/ \(.*\)$/, '') + ' (') === 0 || p.Name === n.replace(/ \(.*\)$/, '')));
      const total = inCourt.reduce((a, p) => a + p.Value, 0);
      if (R.courtCap && total > R.courtCap) errors.push({ step: 'passions', text: 'The Court of ' + ct.name + ': ' + total + ' is over ' + R.courtCap + '.' });
    });

    // qualifying for knighthood (a note, not an error: "Players who wish to begin as knights always do so")
    const age = Number(d.age) || R.age;
    if (R.qualify) {
      const low = R.qualify.skills.filter((n) => (skillAt(n) || {}).value < R.qualify.value);
      const others = skills.filter((s) => s.knightly && s.group !== 'Weapon Skills' && R.qualify.skills.indexOf(s.name) === -1 && s.value >= R.qualify.value).length;
      if (low.length) notes.push('Not yet ' + R.qualify.value + ': ' + low.join(', ') + '.');
      if (others < R.qualify.others) notes.push(others + ' non-weapon Knightly Skills at ' + R.qualify.value + '; ' + R.qualify.others + ' qualify.');
      if (age < R.qualify.age) notes.push('Under ' + R.qualify.age + '.');
    }
    const honor = passions.find((p) => p.Name === 'Honor');
    if (honor && R.honorMin != null && honor.Value < R.honorMin) errors.push({ step: 'passions', text: 'Honor ' + honor.Value + ' is under ' + R.honorMin + '.' });

    // Glory
    const household = /^Household/.test(d.knightClass || '');
    const inherited = Math.min(R.inheritMax, round((Number(d.parentGlory) || 0) * R.inheritShare));
    const fromLord = Math.min(R.lordMax, round((Number(d.lordGlory) || 0) * R.lordShare));
    const glory = inherited + R.knightGlory + fromLord + (household ? R.householdGlory : 0);

    // the gear and the attacks: a sword, four spears and one lance, a dagger, and a weapon of choice
    const weaponRow = (n) => (R.weapons ? R.weapons.rows.find((r) => r[0] === n) : null);
    const horse = (n) => (R.horses ? R.horses.rows.find((r) => r[0] === n) : null);
    const charger = horse('Charger');
    const chargerDamage = charger ? charger[1] : null;
    const attackOf = (weapon) => {
      const r = weaponRow(weapon);
      if (!r) return null;
      const skill = r[2];
      const s = skillAt(skill === 'Two-Handed Hafted' ? 'Two-Handed Hafted' : skill);
      return { Weapon: weapon, Skill: skill, Value: s ? s.value : null, Damage: damage(r[4], dv, chargerDamage) };
    };
    const attacks = ['Arming Sword', 'Lance', 'Spear', 'Dagger'].concat(d.extraWeapon ? [d.extraWeapon] : []).map(attackOf).filter(Boolean);

    const statistics = [
      ['Health', 'Hit Points', dv['Total Hit Points']], ['Health', 'Knockdown', dv.Knockdown], ['Health', 'Major Wound', dv['Major Wound']], ['Health', 'Unconscious', dv.Unconscious],
      ['Other', 'Movement', dv['Movement Rate']], ['Other', 'Armor Points', R.armor ? R.armor.total + '+' + R.armor.shieldPoints : ''], ['Other', 'Healing Rate', dv['Healing Rate']], ['Other', 'Weapon Damage', dv['Weapon Damage'] + 'D6'],
    ].map((x) => ({ Panel: x[0], Statistic: x[1], Value: String(x[2]) }));
    const horses = [];
    // "Lords provide four horses to each of their household knights: One charger …, two rouncys …, and a
    // sumpter" (Horses); each as Table 3.8 prints it
    if (household && R.horses) ['Charger', 'Rouncy', 'Rouncy', 'Sumpter'].forEach((n, i) => {
      const r = horse(n);
      const panel = n + (n === 'Rouncy' ? ' ' + (i === 1 ? '1' : '2') : '');
      if (r) R.horses.columns.slice(1).forEach((col, j) => horses.push({ Panel: panel, Statistic: col, Value: r[j + 1] }));
    });

    const values = {
      Name: d.name || '',
      SIZ: c.SIZ, DEX: c.DEX, STR: c.STR, CON: c.CON, APP: c.APP,
      Attacks: attacks,
      Statistics: statistics,
      Traits: pairs.map((p) => ({ Virtue: p.Virtue, 'Virtue Value': p.v, Vice: p.Vice, 'Vice Value': R.traitSum - p.v })),
      Armor: R.armor ? [R.armor.mail, R.armor.textile, R.armor.helm, R.armor.shield].map(cap).join(', ') : '',
      Passions: passions,
      Skills: skills.filter((s) => s.group !== 'Weapon Skills').map((s) => ({ Name: s.name, Value: s.value })),
      'Weapon Skills': skills.filter((s) => s.group === 'Weapon Skills').map((s) => ({ Name: s.name, Value: s.value })),
      Blazon: d.blazon || '',
      Born: d.year ? Number(d.year) - age : null,
      Heir: R.heir,
      Homeland: d.homeland || R.homelandDefault,
      Lord: d.lord || R.lord,
      Class: d.knightClass || '',
      Culture: R.culture,
      Religion: religion || '',
      'Distinctive Features': d.distinctive || '',
      'Current Hit Points': dv['Total Hit Points'],
      Wounds: [],
      'Mail/Plate': R.armor ? cap(R.armor.mail) : '',
      Textile: R.armor ? cap(R.armor.textile) : '',
      Helm: R.armor ? cap(R.armor.helm) : '',
      Shield: R.armor ? cap(R.armor.shield) : '',
      'Total Armor Protection': R.armor ? R.armor.total : null,
      Glory: glory,
      Horses: horses,
      Parents: d.parentName ? [{ Name: d.parentName, Value: Number(d.parentGlory) || 0 }] : [],
      'Family Characteristic': familyName,
    };
    return { values, errors, notes, method: random ? "random" : "constructed", religion, passionPool: pool, derived: dv, skills, pairs, passions, glory: { inherited, knighted: R.knightGlory, fromLord, household: household ? R.householdGlory : 0, total: glory }, chars: c, charsBase: c0, charSum };
  }

  // ── what each step quotes from the chapter ─────────────────────────
  // Only the book's words that govern a step's choices and that its controls do not already show (a
  // table the step draws, a list its select holds, the setting's prose are left to the reader). Each
  // pick is verbatim: an entity's whole text, its paragraphs matching `para`, or its sentences matching
  // `sentence`; `guide` reads its sidebars, `note` a table's note. A pick that no longer matches is
  // reported, as a rule is. `for` limits a pick to one method; `after` sets it below the step's controls.
  const GUIDE = {
    knight: [
      { from: 'Character Creation', sentence: /Players choose one and use only that one/ },
      { from: 'Constructed Characters', sentence: /^This method gives a set number of points/, label: 'Constructed' },
      { from: 'Random Characters', sentence: /^Random character generation often creates/, label: 'Random' },
      { from: 'Class', sentence: /household knights or mercenary knights/ },
    ],
    characteristics: [
      { from: 'Constructed Method', for: 'constructed' },
      { guide: 'Sample Distinctive Features', para: /^Your first character’s STR and SIZ should sum/, for: 'constructed' },
      { from: 'Random Method', sentence: /^Roll the indicated number of dice/, for: 'random' },
    ],
    features: [
      { from: 'Sample Distinctive Features', para: /^You may come up with any Distinctive Feature/ },
      { from: 'Physique', label: 'Physique', after: true }, { from: 'Limbs', label: 'Limbs', after: true }, { from: 'Hair', label: 'Hair', after: true }, { from: 'Face', label: 'Face', after: true }, { from: 'Speech', label: 'Speech', after: true },
    ],
    traits: [
      { from: 'Constructed Method#2', for: 'constructed' },
      { from: 'Random Method#2', for: 'random' },
    ],
    passions: [
      { from: 'Constructed Method#3', for: 'constructed' },
      { guide: 'Constructed Method#3', para: /limit the total value of all Passions in each court/ },
      { from: 'Random Method#3', for: 'random' },
    ],
    skills: [
      { from: 'Constructed#2', for: 'constructed' },
      { from: 'Random#2', for: 'random' },
      { from: 'Personal Skill Additions', para: /distribute 10 points among your Skills/ },
      { from: 'Limitations', para: /^You may not raise a Skill above/ },
      { note: 'Table 3.5: Beginning Knight Skill Values' },
    ],
    training: [
      { from: 'Attaining Knighthood#2', para: /^To qualify for knighthood/ },
      { from: 'Training & Practice', para: /^Distribute 5 points among the character’s Skills/ },
      { from: 'Training & Practice', para: /^You may not raise any Characteristic/ },
    ],
    knighted: [
      { from: 'Parent’s Glory', para: /^When a character becomes a squire/ },
      { from: 'Starting Knightly Gear', para: /^For their armor/ },
      { from: 'Horses', para: /^Lords provide four horses/ },
    ],
  };
  const paras = (t) => String(t || '').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const sentences = (p) => p.split(/(?<=[.!?])\s+(?=[A-Z“])/);
  // guide(src, step, method) → { quotes: [{ label, text }], missing: [...] }
  function guide(src, step, method) {
    const quotes = [];
    const missing = [];
    (GUIDE[step] || []).filter((g) => !g.for || g.for === (method || 'constructed')).forEach((g) => {
      const whose = g.from || g.guide || g.note;
      const t = g.note ? src.tableNote(g.note) : g.guide ? src.guide(g.guide) : src.text(g.from);
      let text = null;
      if (g.para) text = paras(t).filter((p) => g.para.test(p)).join('\n\n') || null;
      else if (g.sentence) text = paras(t).map((p) => sentences(p).filter((s) => g.sentence.test(s)).join(' ')).filter(Boolean).join(' ') || null;
      else text = t && String(t).trim() ? String(t).trim() : null;
      if (text) quotes.push({ label: g.label || null, text, after: !!g.after });
      else missing.push(step + ': ' + whose);
    });
    return { quotes, missing };
  }

  return { CHARS, round, num, rules, derived, beginning, damage, build, dice, roll, rowFor, rollPart, nextRoll, rollNext, rollParentGlory, rollQuickHistory, heroicEvent, GUIDE, guide };
});
