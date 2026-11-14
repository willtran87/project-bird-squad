import type Phaser from 'phaser';
import { UI_FONT, UI_DISPLAY_FONT } from './ui-tokens';

/** The same arrival hierarchy in every district; decorative and never modal. */
export const districtFraming = [
  { place: 'Rooftop Blocks', premise: 'Bring the flock across the rooftops.',
    question: 'Read each Tell. Protect the flock or interrupt the threat.', accent: '#edba72' },
  { place: 'Canal Markets', premise: 'Reopen the crossings that feed the city.',
    question: 'Attack the support bird or prepare for the strike it strengthens.', accent: '#86d8d4' },
  { place: 'Signal Spires', premise: 'Carry the warning above the city.',
    question: 'Disrupt preparations or save protection for the next heavy hit.', accent: '#b5bcea' },
  { place: 'High Roost', premise: 'Bring the city’s final call home.',
    question: 'Read the phase change. Earlier promises may help at the summit.', accent: '#f3deb1' },
] as const;

export function renderDistrictFraming(scene: Phaser.Scene, index: number) {
  const district = districtFraming[index] ?? districtFraming[0];
  // The route's HUD and risk summary remain behind the modal. Give the arrival
  // copy its own opaque reading surface so neither can show through its lines.
  scene.add.rectangle(640, 88, 1120, 88, 0x07101a, 1)
    .setDepth(24001).setName('district-arrival-header');
  scene.add.text(640, 78, `DISTRICT ${index + 1} · ${district.place}`, {
    fontFamily: UI_DISPLAY_FONT, fontSize: '28px', color: district.accent,
    align: 'center', resolution: 2,
  }).setOrigin(.5).setDepth(24002).setName('district-arrival-title');
  scene.add.text(640, 116, district.premise, {
    fontFamily: UI_FONT, fontSize: '20px', color: '#e8f1f7', resolution: 2,
  }).setOrigin(.5).setDepth(24002).setName('district-arrival-premise');
  scene.add.text(640, 615, district.question, {
    fontFamily: UI_FONT, fontSize: '20px', color: '#d1dce4', resolution: 2,
    wordWrap: { width: 1030 }, align: 'center', backgroundColor: '#07101a', padding: { x: 14, y: 10 },
  }).setOrigin(.5).setDepth(24002).setName('district-arrival-question');
}
