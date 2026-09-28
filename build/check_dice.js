// build/check_dice.js — the d20 rules (system/pendragon6e/dice.js) replayed against the book's own
// worked examples. Each case quotes the sentence it replays, and that sentence must be in the
// corpus (data/core.js) as quoted: a case cannot drift from the book, and the book cannot change
// under a case unseen.
//
//   node build/check_dice.js
const path = require('path');
const G = require('../system/pendragon6e/dice.js');

global.window = {};
require(path.join(__dirname, '../data/core.js'));
const E = window.PENDRAGON6E.entities;
const TEXT = Object.values(E).map((e) => [e.desc || '', JSON.stringify(e.props || []), JSON.stringify(e.guidance || []), JSON.stringify(e.blocks || [])].join('\n')).join('\n')
  .replace(/\\n/g, '\n').replace(/\\"/g, '"');

let n = 0;
const fails = [];
function said(sentence) {
  if (TEXT.indexOf(sentence) === -1) fails.push('not in the corpus as quoted: ' + JSON.stringify(sentence));
}
function check(label, got, want) {
  n++;
  if (JSON.stringify(got) !== JSON.stringify(want)) fails.push(label + ': got ' + JSON.stringify(got) + ', the book ' + JSON.stringify(want));
}
const R = (v, m, face) => G.resolve(v, m, face);

said('A roll of 17 for a character with Charge 17 is a critical success.');
check('Charge 17, a roll of 17', R(17, 0, 17).outcome, 'Critical Success');

said('A Skill with a value of 6, for example, receives a +5 modifier for a final value of 11; a die result of 11 now scores a critical, while a result of 6 (normally a critical) counts as a regular success.');
check('Skill 6 +5, a roll of 11', R(6, 5, 11).outcome, 'Critical Success');
check('Skill 6 +5, a roll of 6', R(6, 5, 6).outcome, 'Success');

said('A fumble occurs whenever a character rolls a natural 20 unless the Statistic value is 20 (in which case, a result of 20 becomes a critical success).');
check('value 16, a natural 20', R(16, 0, 20).outcome, 'Fumble');
check('value 20, a natural 20', R(20, 0, 20).outcome, 'Critical Success');

said('For instance, a knight with Sword 20 (+4) has a +4 critical bonus. If the Player rolls a 16, the final result is modified as 16+4 = 20; a critical success.');
check('Sword 20 (+4), a roll of 16', [R(24, 0, 16).bonus, R(24, 0, 16).total, R(24, 0, 16).outcome], [4, 20, 'Critical Success']);
said('the knight scores a critical on any roll for that Skill that is greater than or equal to 16');
check('Sword 20 (+4), a roll of 15', R(24, 0, 15).outcome, 'Success');

said('For example, if your Sword Skill is normally 18 and you receive a +5 Height Advantage modifier, adding 5 to 18 yields 23. The difference between 23 and 20 then becomes a +3 critical bonus');
check('Sword 18 +5', [G.effective(18, 5).value, G.effective(18, 5).bonus], [20, 3]);

said('Thus, a knight with Sword 16 normally fumbles on a roll of 20, but if they were mounted and fighting a footman (+5/–5 modifier), the modified Skill becomes Sword 20 (+1), making it impossible to fumble');
check('Sword 16 +5, a natural 20', [G.effective(16, 5).value, G.effective(16, 5).bonus, R(16, 5, 20).outcome], [20, 1, 'Critical Success']);

said('If a Player-knight’s modified roll is 21, and their opponent has a roll of 30, both count as criticals of 20—a tie.');
check('21 against 30', G.opposed(R(20, 1, 20), R(20, 10, 20)), 'Tie');

said('For example, a character with a Dancing Skill of 8 receives a –10 modifier. The effective value counts as 0 (not –2); their fumble range is now 18–20.');
check('Dancing 8 −10', [G.effective(8, -10).value, G.effective(8, -10).fumbleFrom], [0, 18]);
check('Dancing 8 −10, a roll of 17', R(8, -10, 17).outcome, 'Failure');
check('Dancing 8 −10, a roll of 18', R(8, -10, 18).outcome, 'Fumble');
check('Dancing 8 −10, a roll of 1', R(8, -10, 1).outcome, 'Failure');

said('For example, a door may have a fixed value of 15, requiring a successful STR roll to knock it in. The roll must therefore succeed and beat the value of 15 to win; perceptive readers will note that characters of STR 15 or less have no chance of knocking in the door unless they score a critical success.');
check('STR 15 against the door, a roll of 14', G.fixed(R(15, 0, 14), 15), 'Partial Success');
check('STR 15 against the door, a roll of 15', G.fixed(R(15, 0, 15), 15), 'Win');
check('STR 15 against the door, a roll of 16', G.fixed(R(15, 0, 16), 15), 'Loss');

said('A critical success beats any other outcome in an opposed resolution and guarantees a win (or at least a tie). This is true even if a character with a Statistic of 1 rolls a 1');
check('Statistic 1, a roll of 1, against a 19 of 20', G.opposed(R(1, 0, 1), R(20, 0, 19)), 'Win');
said('It is possible for both parties involved to lose.');
check('both fail', G.opposed(R(5, 0, 12), R(5, 0, 9)), 'Mutual Failure');
check('the higher success wins', [G.opposed(R(15, 0, 12), R(15, 0, 9)), G.opposed(R(15, 0, 9), R(15, 0, 12))], ['Win', 'Partial Success']);

said('1D3 indicates the roll of a six-sided die, where a roll of 1–2 counts as a 1, 3–4 counts as a 2, and 5–6 counts as a 3.');
const seq = (xs) => { let i = 0; return () => xs[i++]; };
check('1D3 from 1..6', [1, 2, 3, 4, 5, 6].map((f) => G.rollDice('1D3', seq([f])).total), [1, 1, 2, 2, 3, 3]);
said('In this instance, a character’s Damage Characteristic with a sword becomes 5D6+2.');
check('5D6+2', G.rollDice('5D6+2', seq([1, 2, 3, 4, 5])).total, 17);
check('the printed 7D6†', G.parseDice('7D6†').text, '7D6');

console.log('check_dice: ' + (fails.length ? fails.length + ' FAILED' : 'OK') + ' (' + n + ' assertions)');
fails.forEach((f) => console.log('  ' + f));
process.exit(fails.length ? 1 : 0);
