import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const source = await readFile(new URL('../../src/game/card-contributions.ts', import.meta.url), 'utf8');
const javascript = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const rules = await import(`data:text/javascript;base64,${Buffer.from(javascript).toString('base64')}`);

test('Observed contributions preserve legacy absence and reject malformed, duplicate and unknown save entries', () => {
  const known = id => id === 'major_00';
  assert.equal(rules.sanitizeContributions(undefined, known), undefined);
  assert.equal(rules.sanitizeContributions({}, known), undefined);
  const rows = rules.sanitizeContributions([null, {}, { cardId: '__proto__', plays: 99 },
    { cardId: 'major_00', plays: 2, damage: 1e12, cover: -4, healing: NaN, drawn: '3', wingbeats: 1.7 },
    { cardId: 'major_00', plays: 200 }], known);
  assert.deepEqual(rows, [{ ...rules.emptyContribution('major_00'), plays: 2, damage: 1_000_000, wingbeats: 1 }]);
  assert.deepEqual(rules.sanitizeContributions(JSON.parse(JSON.stringify(rows)), known), rows);
});

test('Observed contribution reports combine encounters without changing saved records or inventing older evidence', () => {
  const rows = [{ cardContributions: [{ ...rules.emptyContribution('major_00'), plays: 1, damage: 4 }] }, {},
    { cardContributions: [{ ...rules.emptyContribution('major_00'), plays: 2, damage: 6, cover: 3 }] }];
  const before = JSON.stringify(rows), result = rules.totalContributions(rows);
  assert.equal(result[0].plays, 3); assert.equal(result[0].damage, 10); assert.equal(result[0].cover, 3);
  assert.equal(JSON.stringify(rows), before);
  assert.match(rules.contributionReading(rows, () => 'First Flight'), /First Flight · 3 plays\n10 damage · 3 Cover gained/);
  assert.match(rules.contributionReading([{}], () => ''), /No card contributions recorded yet/);
  assert.match(rules.contributionReading(rows, () => ''), /Cover gained is not damage prevented/);
});

test('Observed contribution accumulation ignores non-finite values and keeps numeric counters bounded', () => {
  const rows = [];
  for (const value of [NaN, Infinity, -5, 0]) rules.recordContribution(rows, 'major_00', 'damage', value);
  assert.deepEqual(rows, []);
  rules.recordContribution(rows, 'major_00', 'damage', 999999);
  rules.recordContribution(rows, 'major_00', 'damage', 9);
  assert.equal(rows[0].damage, 1_000_000);
});
