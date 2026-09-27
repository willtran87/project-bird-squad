import Phaser from 'phaser';

export interface EncounterIntroOptions {
  reduced: boolean;
  holdScale: number;
  minimumReadableMs: number;
  width: number;
  height: number;
  district: string;
  encounter: string;
  confirm: string;
  texture: string;
  plaque: string;
  font: string;
  bold: string;
  gold: string;
  cyan: string;
  soft: string;
  dismiss(): void;
  finish(dismissed: boolean): void;
  accent(): void;
}

/** Pure presentation, fetched with the encounter's existing FX bundle. */
export function playEncounterIntro(scene: Phaser.Scene, layer: Phaser.GameObjects.Container, o: EncounterIntroOptions) {
  const c = scene.add.container(0, 0);
  const { width: w, height: h } = o;
  c.add([
    scene.add.rectangle(w / 2, h / 2, w, h, 0x020409, 0.54),
    scene.add.rectangle(w / 2, 106, w, 70, 0x05080e, 0.84),
    scene.add.rectangle(w / 2, 610, w, 70, 0x05080e, 0.78),
  ]);
  if (scene.textures.exists(o.texture)) {
    scene.textures.get(o.texture).setFilter(Phaser.Textures.FilterMode.LINEAR);
    c.add([
      scene.add.image(w / 2, 356, o.texture).setDisplaySize(706, 282)
        .setAlpha(o.reduced ? 0.34 : 0.48).setBlendMode(Phaser.BlendModes.ADD).setName('combat-encounter-intro'),
      scene.add.image(w / 2, 356, o.texture).setDisplaySize(566, 226)
        .setAlpha(o.reduced ? 0.76 : 0.9).setName('combat-encounter-intro'),
    ]);
  }
  // The authored crest supplies the accent; no diagonal flat line across art.
  c.add([
    scene.add.text(74, 86, 'ROOFLINE CONTACT', { fontFamily: o.font, fontSize: '14px', fontStyle: o.bold, color: o.cyan }),
    scene.add.text(74, 112, o.district, { fontFamily: 'Georgia, serif', fontSize: '23px', fontStyle: o.bold,
      color: o.gold, stroke: '#000000', strokeThickness: 4 }),
  ]);
  if (scene.textures.exists(o.plaque)) {
    scene.textures.get(o.plaque).setFilter(Phaser.Textures.FilterMode.LINEAR);
    c.add(scene.add.image(w - 180, 614, o.plaque).setDisplaySize(328, 88)
      .setAlpha(o.reduced ? 0.66 : 0.76).setName('combat-encounter-plaque'));
  }
  c.add([
    scene.add.text(w - 74, 594, o.encounter, { fontFamily: o.font, fontSize: '17px', fontStyle: o.bold,
      color: '#ffd5cc', stroke: '#000000', strokeThickness: 4 }).setOrigin(1, 0),
    scene.add.text(w - 74, 620, 'Enemies sighted on the roofline.', { fontFamily: o.font, fontSize: '12px', color: o.soft }).setOrigin(1, 0),
  ]);
  const hit = scene.add.rectangle(w / 2, h / 2, w, h, 0, 0.001)
    .setInteractive({ useHandCursor: true }).setName('combat-intro-dismiss-hit').on('pointerdown', o.dismiss);
  c.add([
    hit,
    scene.add.text(w / 2, h - 44, `${o.confirm.toUpperCase()} / TAP  TAKE THE BEAT`, {
      fontFamily: o.font, fontSize: '12px', fontStyle: o.bold, color: '#dffbff', stroke: '#020409', strokeThickness: 3,
    }).setOrigin(0.5).setName('combat-intro-dismiss-label'),
  ]);
  layer.add(c);
  let finished = false;
  let timer: Phaser.Time.TimerEvent | undefined;
  const finish = (dismissed: boolean) => {
    if (finished) return;
    finished = true;
    timer?.remove(false);
    scene.tweens.killTweensOf(c);
    c.destroy(true);
    o.finish(dismissed);
  };
  c.once(Phaser.GameObjects.Events.DESTROY, () => { timer?.remove(false); scene.tweens.killTweensOf(c); });
  if (o.reduced) timer = scene.time.delayedCall(o.minimumReadableMs, () => finish(false));
  else {
    c.setAlpha(0);
    scene.tweens.add({ targets: c, alpha: 1, duration: 180, ease: 'Quad.easeOut', yoyo: true,
      hold: Math.round(1360 * o.holdScale), onComplete: () => finish(false) });
    o.accent();
  }
  return () => finish(true);
}
