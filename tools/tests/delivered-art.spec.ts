import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

test('every delivered raster decodes at its inventoried dimensions with preserved alpha', async ({ page }, info) => {
  test.setTimeout(180000);
  const inventory = JSON.parse(readFileSync(process.env.BIRD_SQUAD_ART_INVENTORY
    ?? 'docs/art/runtime-art-inventory.json', 'utf8'));
  expect(inventory.unresolved).toEqual([]);
  expect(inventory.assets.length).toBeGreaterThan(800);
  await page.goto('./');
  const result = await page.evaluate(async entries => {
    const failures: any[] = [];
    let decoded = 0;
    // Bounded memory: close each decoded bitmap before processing the next.
    for (let start = 0; start < entries.length; start += 4) {
      await Promise.all(entries.slice(start, start + 4).map(async (entry: any) => {
        try {
          const response = await fetch(new URL(`assets/${entry.delivered}`, document.baseURI));
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const bitmap = await createImageBitmap(await response.blob());
          try {
            if (bitmap.width !== entry.dimensions[0] || bitmap.height !== entry.dimensions[1])
              throw new Error(`Dimensions ${bitmap.width}x${bitmap.height}`);
            const canvas = document.createElement('canvas');
            canvas.width = bitmap.width; canvas.height = bitmap.height;
            const context = canvas.getContext('2d', {willReadFrequently:true})!;
            context.drawImage(bitmap, 0, 0);
            const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
            let low = 255, high = 0;
            for (let index = 3; index < pixels.length; index += 4) {
              low = Math.min(low, pixels[index]); high = Math.max(high, pixels[index]);
            }
            if (low !== entry.alphaRange[0] || high !== entry.alphaRange[1])
              throw new Error(`Alpha ${low}..${high}`);
            if (high === 0) throw new Error('Empty artwork');
            decoded++;
          } finally { bitmap.close(); }
        } catch (error) { failures.push({asset:entry.export, error:String(error)}); }
      }));
    }
    return {decoded, failures};
  }, inventory.assets);
  await info.attach('delivered-art-decoding', {body:JSON.stringify(result),contentType:'application/json'});
  expect(result.failures).toEqual([]);
  expect(result.decoded).toBe(inventory.assets.length);
});
