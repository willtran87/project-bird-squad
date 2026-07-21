import type Phaser from 'phaser';

export type BattleBackdropMood = 'street' | 'rival' | 'boss';

export interface BattleBackdropRenderContext {
  scene: Phaser.Scene;
  target: Phaser.GameObjects.Container;
  width: number;
  height: number;
  battlefieldTextureKey: string;
  atmosphereTextureKey: string;
  mapIndex: number;
  mood: BattleBackdropMood;
  leanEffects: boolean;
  reducedMotion: boolean;
}

function renderFallbackBackdrop(context: BattleBackdropRenderContext) {
  const { scene, target, width, height } = context;
  const background = scene.add.graphics();
  background.fillStyle(0x0f1b2a, 1);
  background.fillRect(0, 0, width, height);
  background.fillStyle(0x15263a, 0.75);
  for (let index = 0; index < 14; index += 1) {
    const x = index * 96;
    const buildingHeight = 80 + ((index * 47) % 130);
    background.fillRect(x, 64 + (index % 3) * 20, 62, buildingHeight);
  }
  target.add(background);
}

function renderEncounterTreatment(context: BattleBackdropRenderContext) {
  const { scene, target, width, height, mood } = context;
  const treatment = scene.add.graphics();

  if (mood === 'boss') {
    treatment.fillStyle(0x2a0808, 0.18);
    treatment.fillRect(0, 0, width, height);
    treatment.lineStyle(2, 0xff7a6e, 0.22);
    for (let x = 64; x < width; x += 176) {
      treatment.lineBetween(x, 0, x + 96, 116);
    }
    treatment.fillStyle(0xff3d3d, 0.34);
    for (let x = 196; x < width; x += 196) {
      treatment.fillCircle(x, 18, 4);
      treatment.fillCircle(x, 26, 2);
    }
    treatment.fillStyle(0x020409, 0.34);
    treatment.fillRect(0, 0, width, 72);
  } else if (mood === 'rival') {
    treatment.fillStyle(0x241508, 0.13);
    treatment.fillRect(0, 0, width, height);
    treatment.lineStyle(3, 0xffcf6b, 0.18);
    for (let x = -120; x < width + 160; x += 150) {
      treatment.lineBetween(x, 452, x + 280, 248);
    }
    treatment.fillStyle(0xff9d4d, 0.16);
    treatment.fillRect(0, 130, 142, 286);
    treatment.fillRect(width - 142, 116, 142, 320);
  } else {
    treatment.lineStyle(1, 0x8df4ff, 0.12);
    for (let x = 160; x < width; x += 220) {
      treatment.lineBetween(x, 114, x - 74, 438);
    }
    treatment.fillStyle(0x8df4ff, 0.06);
    treatment.fillRect(150, 116, 3, 324);
    treatment.fillRect(width - 153, 116, 3, 324);
  }

  target.add(treatment);
}

function renderAtmosphere(context: BattleBackdropRenderContext) {
  const {
    scene,
    target,
    atmosphereTextureKey,
    mapIndex,
    leanEffects,
    reducedMotion
  } = context;
  if (!scene.textures.exists(atmosphereTextureKey)) return;

  const frame = Math.max(0, Math.min(3, mapIndex));
  const rows = mapIndex === 1
    ? [160, 252, 344, 414]
    : mapIndex === 3
      ? [138, 224, 314]
      : [134, 226, 318];
  const atmosphere = scene.add.container(0, 0);
  const visibleRows = leanEffects ? rows.slice(0, 2) : rows;
  visibleRows.forEach((y, row) => {
    const firstColumn = leanEffects ? 0 : -1;
    const lastColumn = leanEffects ? 4 : 5;
    for (let column = firstColumn; column <= lastColumn; column += 1) {
      const tile = scene.add.image(
        column * 256 + 128 + row * 37,
        y,
        atmosphereTextureKey,
        frame
      )
        .setAlpha(mapIndex === 2 ? 0.3 : 0.24)
        .setScale(1)
        .setName('combat-atmosphere-strip');
      atmosphere.add(tile);
    }
  });
  target.add(atmosphere);

  if (reducedMotion || leanEffects) return;
  scene.tweens.add({
    targets: atmosphere,
    x: mapIndex === 1 ? -42 : 46,
    alpha: mapIndex === 2 ? 0.54 : 0.44,
    duration: 2600 + mapIndex * 260,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut'
  });
}

/** Render the battle-only district art, mood treatment, and atmosphere layer. */
export function renderBattleBackdrop(context: BattleBackdropRenderContext) {
  const { scene, target, width, height, battlefieldTextureKey } = context;
  if (scene.textures.exists(battlefieldTextureKey)) {
    const background = scene.add.image(width / 2, height / 2, battlefieldTextureKey)
      .setDisplaySize(width, height)
      .setAlpha(0.82);
    target.add(background);
  } else {
    renderFallbackBackdrop(context);
  }

  const shade = scene.add.graphics();
  shade.fillStyle(0x06101d, 0.3);
  shade.fillRect(0, 0, width, height);
  shade.fillStyle(0x020409, 0.42);
  shade.fillRect(0, 0, width, 116);
  shade.fillStyle(0x020409, 0.5);
  shade.fillRect(0, 452, width, 268);
  shade.fillStyle(0x02060c, 0.28);
  shade.fillRect(0, 0, 150, height);
  shade.fillRect(width - 150, 0, 150, height);
  target.add(shade);

  renderEncounterTreatment(context);
  renderAtmosphere(context);
}
