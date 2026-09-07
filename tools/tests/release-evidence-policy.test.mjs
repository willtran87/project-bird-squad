import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { freshPlayerGate } from '../release-evidence-policy.mjs';

const policy = JSON.parse(readFileSync(new URL('../../docs/game/release-evidence-policy.json', import.meta.url), 'utf8'));
const { version } = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));

test('recorded owner waiver is scoped to this release and explicitly disclaims human evidence', () => {
  const gate = freshPlayerGate(policy, version);
  assert.equal(gate.waived, true);
  assert.match(gate.notice, /Not passing human evidence/);
  assert.match(gate.notice, /Physical-device and assistive-technology requirements remain unchanged/);
});

test('strict mode requires human evidence without changing the stored policy', () => {
  assert.equal(freshPlayerGate(policy, version, true).waived, false);
  assert.equal(policy.freshPlayerGate.status, 'waived');
});

test('missing, malformed, or future-release policies fail closed', () => {
  for (const candidate of [undefined, {}, { ...policy, releaseVersion: 'future' }, { ...policy, freshPlayerGate: { status: 'waived' } }]) {
    const gate = freshPlayerGate(candidate, version);
    assert.equal(gate.waived, false);
    assert.ok(gate.error);
  }
});

test('required policy does not apply an old waiver', () => {
  assert.deepEqual(freshPlayerGate({ ...policy, freshPlayerGate: { status: 'required' } }, version), { waived: false });
});
