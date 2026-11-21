import { describe, expect, it } from 'vitest';
import {
  cardRarity, dragStarted, dropTarget, faceNumberTints, flightControl, flightPoint, flightProgress, locateTint,
  preenedNumberKeys, rarityHasSheen, FLIGHT_LIFT_SHARE,
} from './card-object-rules';

describe('card rarity', () => {
  it('falls back to common and gives only rare and legendary a sheen', () => {
    expect(cardRarity('rare')).toBe('rare');
    expect(cardRarity('boss')).toBe('common');
    expect(cardRarity(undefined)).toBe('common');
    expect(['common', 'uncommon', 'rare', 'legendary'].map(r => rarityHasSheen(cardRarity(r)))).toEqual([false, false, true, true]);
  });
});

describe('played card flight', () => {
  const from = { x: 640, y: 580 }, to = { x: 930, y: 225 };
  it('starts in the hand, ends on the target and never climbs into the HUD', () => {
    const control = flightControl(from, to, 57, 100);
    expect(flightPoint(from, control, to, 0)).toEqual(from);
    expect(flightPoint(from, control, to, 1)).toEqual(to);
    for (let t = 0; t <= 1.0001; t += 0.05) expect(flightPoint(from, control, to, t).y - 57).toBeGreaterThanOrEqual(100 - 0.001);
  });
  it('arcs above the straight line when there is room', () => {
    const low = { x: 230, y: 332 }, control = flightControl(from, low, 57, 100);
    const mid = flightPoint(from, control, low, 0.5);
    expect(mid.y).toBeLessThan((from.y + low.y) / 2);
  });
  it('lifts first, then travels monotonically and lands exactly at the end of the budget', () => {
    expect(flightProgress(0)).toEqual({ lift: 0, travel: 0 });
    expect(flightProgress(FLIGHT_LIFT_SHARE).travel).toBe(0);
    expect(flightProgress(FLIGHT_LIFT_SHARE).lift).toBeCloseTo(1);
    let last = 0;
    for (let share = FLIGHT_LIFT_SHARE; share <= 1; share += 0.02) {
      const { travel } = flightProgress(share);
      expect(travel).toBeGreaterThanOrEqual(last); last = travel;
    }
    expect(flightProgress(1).travel).toBeCloseTo(1);
    expect(flightProgress(4).travel).toBeCloseTo(1);
  });
});

describe('drag to play', () => {
  const enemies = [{ id: 'a', left: 700, right: 900, top: 120, bottom: 380 }, { id: 'b', left: 950, right: 1150, top: 120, bottom: 380 }];
  const field = { top: 96, bottom: 420 };
  it('a press is not a drag until the pointer travels', () => {
    expect(dragStarted({ x: 10, y: 10 }, { x: 14, y: 13 })).toBe(false);
    expect(dragStarted({ x: 10, y: 10 }, { x: 10, y: 30 })).toBe(true);
  });
  it('a targeted card only drops on an enemy', () => {
    expect(dropTarget('enemy', { x: 800, y: 200 }, enemies, field)).toEqual({ kind: 'enemy', id: 'a' });
    expect(dropTarget('enemy', { x: 1000, y: 200 }, enemies, field)).toEqual({ kind: 'enemy', id: 'b' });
    expect(dropTarget('enemy', { x: 300, y: 200 }, enemies, field)).toBeUndefined();
    expect(dropTarget('enemy', { x: 800, y: 560 }, enemies, field)).toBeUndefined();
  });
  it('an untargeted card drops anywhere on the field and returns from the hand or HUD', () => {
    for (const target of ['self', 'allEnemies', 'none', 'choice']) {
      expect(dropTarget(target, { x: 300, y: 250 }, enemies, field)).toEqual({ kind: 'field' });
      expect(dropTarget(target, { x: 300, y: 560 }, enemies, field)).toBeUndefined();
      expect(dropTarget(target, { x: 300, y: 40 }, enemies, field)).toBeUndefined();
    }
  });
});

describe('face number highlights', () => {
  it('marks only the numbers a Preen changed', () => {
    const keys = preenedNumberKeys(['Deal 9.', 'Gain 4 Cover.'], ['Deal 6.', 'Gain 4 Cover.']);
    expect(keys).toEqual(['deal 9']);
    const face = 'Deal 9 damage.\nGain 4 Cover.';
    expect(faceNumberTints(face, keys)).toEqual([{ start: 5, length: 1, tone: 'preen' }]);
  });
  it('marks every number on a line the Preen added', () => {
    expect(preenedNumberKeys(['Deal 6.', 'Draw 1.'], ['Deal 6.'])).toEqual(['draw 1']);
  });
  it('an unchanged card has no highlights', () => {
    expect(faceNumberTints('Deal 6 damage.\nGain 4 Cover.', [])).toEqual([]);
    expect(faceNumberTints('Deal 6 damage.', [], (_kind, amount) => amount)).toEqual([]);
  });
  it('status wins over Preen: buffed green, reduced red, and only damage and Cover respond', () => {
    const face = 'Deal 9 damage.\nGain 4 Cover.\nDraw 2.';
    const tints = faceNumberTints(face, ['deal 9', 'draw 2'], (kind, amount) => kind === 'damage' ? amount + 2 : amount - 1);
    expect(tints.map(tint => [face.slice(tint.start, tint.start + tint.length), tint.tone])).toEqual([['9', 'buff'], ['4', 'reduced'], ['2', 'preen']]);
  });
  it('does not treat enemy Cover or a condition as the flock\'s Cover gain', () => {
    const tints = faceNumberTints('Strip 3 Cover.\nDeal 5 damage (if target has 2 Winded).', [], (_kind, amount) => amount + 1);
    expect(tints).toEqual([{ start: 20, length: 1, tone: 'buff' }]);
  });
  it('finds a tint on its wrapped line', () => {
    const source = 'Deal 12 damage to all enemies.\nGain 4 Cover.';
    const lines = ['Deal 12 damage to', 'all enemies.', 'Gain 4 Cover.'];
    const [deal, cover] = faceNumberTints(source, [], (_kind, amount) => amount + 1);
    expect(locateTint(source, lines, deal)).toEqual({ line: 0, column: 5 });
    expect(locateTint(source, lines, cover)).toEqual({ line: 2, column: 5 });
    expect(locateTint(source, ['unrelated'], deal)).toBeUndefined();
  });
});
