import Phaser from 'phaser';

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
    treatment.fillStyle(0x2a0808, 0.12);
    treatment.fillRect(0, 0, width, height);
  } else if (mood === 'rival') {
    treatment.fillStyle(0x241508, 0.09);
    treatment.fillRect(0, 0, width, height);
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

  // The canonical 768x96 strip has three 256x96 frames. High Roost shares
  // the signal-wind frame; requesting frame 3 falls back to the wrong tile.
  const frame = Math.max(0, Math.min(2, mapIndex));
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
      .setAlpha(1);
    target.add(background);
  } else {
    renderFallbackBackdrop(context);
  }

  const shade = scene.add.graphics().setName('combat-stage-vignette');
  shade.fillStyle(0x06101d, 0.06);
  shade.fillRect(0, 0, width, height);
  // Soft stage-relative edges separate the controls without cutting rectangular
  // bands through the district artwork. Four static quads; no new animation.
  const ink = 0x02060c;
  if (scene.game.renderer.type === Phaser.WEBGL) {
    shade.fillGradientStyle(ink, ink, ink, ink, 0.6, 0.6, 0, 0);
    shade.fillRect(0, 0, width, height * 0.26);
    shade.fillGradientStyle(ink, ink, ink, ink, 0, 0, 0.78, 0.78);
    shade.fillRect(0, height * 0.55, width, height * 0.45);
    shade.fillGradientStyle(ink, ink, ink, ink, 0.46, 0, 0.46, 0);
    shade.fillRect(0, 0, width * 0.2, height);
    shade.fillGradientStyle(ink, ink, ink, ink, 0, 0.46, 0, 0.46);
    shade.fillRect(width * 0.8, 0, width * 0.2, height);
  }
  target.add(shade);

  renderEncounterTreatment(context);
  renderAtmosphere(context);
}
