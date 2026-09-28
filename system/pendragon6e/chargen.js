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
      t36.rows.forEach((r) => { if (!barred || r[1] !== barred[1]) R.families.push({ name: r[1], skill: r[2].replace(/ \(.*\)$/, ''), printed: r[2], bonus }); });
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
    R.horses = src.table('Table 3.8: Starting Horses');
    R.weapons = src.table('Table 8.1: Melee & Brawling Weapons');
    if (!R.horses) missing.push('Table 3.8');
    if (!R.weapons) missing.push('Table 8.1');
    return R;
  }
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

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

    // Characteristics: the 60 points, then the culture's modifier, then training
    const c0 = {};
    CHARS.forEach((k) => (c0[k] = Number((d.chars || {})[k]) || 0));
    const charSum = CHARS.reduce((a, k) => a + c0[k], 0);
    if (charSum !== R.charPoints) errors.push({ step: 'characteristics', text: charSum + ' of ' + R.charPoints + ' points distributed.' });
    CHARS.forEach((k) => { if (c0[k] < R.charMin || c0[k] > R.charMax) errors.push({ step: 'characteristics', text: k + ' ' + c0[k] + ' is outside ' + R.charMin + '–' + R.charMax + '.' }); });
    const c = {};
    CHARS.forEach((k) => (c[k] = c0[k] + (R.culturalChar[k] || 0)));
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
    const favored = R.religions[d.religion] || [];
    const pairs = R.pairs.map((p) => {
      let v = R.traitStart;
      if (favored.indexOf(p.Virtue) !== -1) v = R.traitReligion;
      if (favored.indexOf(p.Vice) !== -1) v = R.traitSum - R.traitReligion;
      if (R.traitMartial && p.Virtue === R.traitMartial.name) v = R.traitMartial.value;
      return { Virtue: p.Virtue, Vice: p.Vice, v };
    });
    const pairOf = (t) => pairs.find((p) => p.Virtue === t || p.Vice === t);
    const side = (p, t) => (p.Virtue === t ? p.v : R.traitSum - p.v);
    const setSide = (p, t, n) => { p.v = p.Virtue === t ? n : R.traitSum - n; };
    if (d.sixteen) {
      const p = pairOf(d.sixteen);
      if (p) setSide(p, d.sixteen, R.traitOne);
    } else errors.push({ step: 'traits', text: 'Raise one Trait to ' + R.traitOne + '.' });
    const tp = d.traitPoints || {};
    if (pts(tp) !== R.traitPoints) errors.push({ step: 'traits', text: pts(tp) + ' of ' + R.traitPoints + ' Trait points distributed.' });
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
    const passions = R.passions.map((p) => ({ Name: homageName(p.name), Value: p.value }));
    if (R.homelandPassion && (d.homeland || R.homelandDefault) === R.homeland) passions.push({ Name: R.homelandPassion.name, Value: R.homelandPassion.value });
    (d.extraPassions || []).forEach((n) => { if (n && !passions.some((p) => p.Name === n)) passions.push({ Name: n, Value: 0 }); });
    const pp = d.passionPoints || {};
    if (pts(pp) !== R.passionPoints) errors.push({ step: 'passions', text: pts(pp) + ' of ' + R.passionPoints + ' Passion points distributed.' });
    passions.forEach((p) => {
      p.Value += Number(pp[p.Name]) || 0;
      if (p.Value > R.passionCap) errors.push({ step: 'passions', text: p.Name + ' ' + p.Value + ' is above ' + R.passionCap + '.' });
    });

    // Skills: Table 3.5's beginning values, the culture's modifiers, the family's, the 10 points
    const fam = R.families.find((f) => f.name === d.family) || null;
    if (!fam) errors.push({ step: 'skills', text: 'Choose a Family Characteristic.' });
    const skills = R.skills.map((s) => {
      const b = beginning(s.base, cSkills);
      const bonus = (R.culturalSkill[s.name] || 0) + (fam && fam.skill === s.name ? fam.bonus : 0);
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
      Religion: d.religion || '',
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
      'Family Characteristic': fam ? fam.name : '',
    };
    return { values, errors, notes, derived: dv, skills, pairs, passions, glory: { inherited, knighted: R.knightGlory, fromLord, household: household ? R.householdGlory : 0, total: glory }, chars: c, charsBase: c0, charSum };
  }

  return { CHARS, round, num, rules, derived, beginning, damage, build };
});
