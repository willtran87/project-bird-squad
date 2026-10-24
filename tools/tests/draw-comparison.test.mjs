import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const source = await readFile(new URL('../../src/game/draw-comparison.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const { singleCardDrawChance, drawComparison } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);

test('single-card benchmark agrees with exhaustive combinations of small decks', () => {
  for (let size = 1; size <= 9; size++) for (let hand = 0; hand <= size; hand++) {
    let total = 0, containing = 0;
    for (let bits = 0; bits < 2 ** size; bits++) if (bits.toString(2).replaceAll('0', '').length === hand) {
      total++; if (bits & 1) containing++;
    }
    assert.equal(singleCardDrawChance(size, hand), containing / total);
  }
});
test('dilution, removal and increased hand size remain distinct with explicit assumptions', () => {
  assert.ok(singleCardDrawChance(11, 4) < singleCardDrawChance(10, 4));
  assert.ok(singleCardDrawChance(11, 5) > singleCardDrawChance(10, 4));
  assert.equal(singleCardDrawChance(3, 7), 1); assert.equal(singleCardDrawChance(0, 4), 0);
  assert.equal(singleCardDrawChance(0.5, 4), 0); assert.equal(singleCardDrawChance(5, -1), 0);
  assert.match(drawComparison(10, 11, 4, 4), /40.0% > 36.4%/);
  assert.match(drawComparison(10, 9, 4, 4), /Protected opening draws/);
  assert.match(drawComparison(10, 10, 4, 4), /removed card has 0%/);
});
