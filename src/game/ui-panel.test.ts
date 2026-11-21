import { describe, expect, it } from 'vitest';
import { panelLayout } from './ui-panel';

describe('shared panel layout', () => {
  it('stacks the header from the top and leaves the body between header and footer', () => {
    const layout = panelLayout({ x: 640, y: 360, width: 600, height: 400, eyebrow: 'Across the city', title: 'Loading', subtitle: 'Reading the map', actions: [{ label: 'Close', name: 'x', onActivate: () => {} }] });
    expect(layout.frame).toMatchObject({ left: 340, top: 160, right: 940, bottom: 560 });
    expect(layout.header.map(part => part.part)).toEqual(['eyebrow', 'title', 'subtitle']);
    expect(layout.header[0].y).toBeGreaterThan(layout.frame.top);
    expect(layout.body.top).toBeGreaterThan(layout.header[2].y);
    expect(layout.body.bottom).toBeLessThan(layout.footerY);
    expect(layout.footerY).toBeLessThan(layout.frame.bottom);
  });

  it('gives a headerless, actionless panel nearly all of its height', () => {
    const layout = panelLayout({ x: 100, y: 100, width: 200, height: 200 });
    expect(layout.header).toEqual([]);
    expect(layout.body.height).toBe(200 - 56);
  });
});
