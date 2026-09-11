import Phaser from 'phaser';
import { prefersLeanEffects } from './graphics-quality';
import {
  GAME_HEIGHT,
  GAME_WIDTH,
  SHARED_ROUTE_SEED,
  UI_FIELD,
  birdAudio,
  createInitialRunState,
  loadActiveRun,
  motionState,
  playUiSound,
} from '../main';

const TITLE_RUN_LAUNCH_DELAY_MS = 180;

export function startRunAnimated(
  scene: any,
  resume: boolean,
  confirmAlreadyPlayed = false,
  x = 780,
  y = 642,
  w = 286,
) {
  const saved = resume ? loadActiveRun() : undefined;
  if (resume && !saved) {
    startRunAnimated(scene, false, confirmAlreadyPlayed, x, y, w);
    return;
  }
  if (!confirmAlreadyPlayed) playUiSound('confirm');
  birdAudio.play('route', 0.76);
  const runState = saved ?? createInitialRunState(
    scene.selectedLeaderId,
    scene.selectedDifficulty,
    scene.selectedRunMode,
    SHARED_ROUTE_SEED,
  );
  titleRunLaunchFx(scene, x, y, w);
  scene.time.delayedCall(motionState().reduced ? 0 : TITLE_RUN_LAUNCH_DELAY_MS, () => {
    scene.titleRunLaunchPending = false;
    if (!scene.scene.isActive()) return;
    scene.storageRecoveryNotice = undefined;
    scene.scene.start('RouteScene', { runState });
  });
}

function titleRunLaunchFx(scene: any, x: number, y: number, w: number) {
  scene.titleRunLaunchFlourishBursts += 1;
  const reduced = motionState().reduced;
  const leanEffects = prefersLeanEffects();
  const texture = 'title-run-launch-flourish';
  const group = scene.add.container(0, 0).setDepth(160).setName('title-run-launch-flourish');
  const blocker = scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x020409, 0.001)
    .setInteractive({ useHandCursor: false })
    .setName('title-run-launch-flourish-blocker');
  const plate = scene.add.rectangle(x, y, w + 116, 72, 0x020409, 0.48)
    .setStrokeStyle(2, UI_FIELD.cyan, 0.34)
    .setName('title-run-launch-flourish');
  const rail = scene.add.rectangle(x, y + 2, w + 76, 3, UI_FIELD.brass, 0.68)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setName('title-run-launch-flourish');
  group.add([blocker, plate, rail]);

  if (scene.textures.exists(texture)) {
    scene.textures.get(texture).setFilter(Phaser.Textures.FilterMode.LINEAR);
    const displayW = Math.max(430, w + 220);
    const flourish = scene.add.image(x, y - 4, texture)
      .setDisplaySize(displayW, 142)
      .setAlpha(reduced ? 0.92 : 0.98)
      .setName('title-run-launch-flourish');
    const glow = scene.add.image(x, y - 4, texture)
      .setDisplaySize(displayW + 42, 154)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(reduced ? 0.12 : 0.22)
      .setName('title-run-launch-flourish');
    group.add([glow, flourish]);
    if (!reduced) {
      flourish.setScale(flourish.scaleX * 0.86, flourish.scaleY * 0.92);
      glow.setScale(glow.scaleX * 0.84, glow.scaleY * 0.92);
      scene.tweens.add({
        targets: [flourish, glow],
        scaleX: '+=0.08',
        scaleY: '+=0.035',
        alpha: { value: 0, duration: 100, delay: 80 },
        duration: TITLE_RUN_LAUNCH_DELAY_MS,
        ease: 'Cubic.easeOut',
      });
    }
  } else {
    group.add(scene.add.triangle(x, y, -44, -20, -44, 20, 76, 0, UI_FIELD.cyan, 0.68)
      .setStrokeStyle(2, UI_FIELD.brass, 0.82)
      .setName('title-run-launch-flourish'));
  }

  const moteCount = reduced ? 4 : leanEffects ? 8 : 16;
  for (let i = 0; i < moteCount; i += 1) {
    const side = i % 2 === 0 ? -1 : 1;
    const mx = x + side * Phaser.Math.Between(44, Math.max(70, Math.round(w / 2) + 62));
    const my = y + Phaser.Math.Between(-24, 24);
    const color = i % 3 === 0 ? UI_FIELD.cyan : i % 3 === 1 ? UI_FIELD.brass : 0xc98bff;
    const mote = scene.add.rectangle(mx, my, Phaser.Math.Between(12, 28), 3, color, 0.76)
      .setAngle(side > 0 ? -5 : 5)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setName('title-run-launch-flourish');
    group.add(mote);
    if (!reduced) {
      scene.tweens.add({
        targets: mote,
        x: mx + side * Phaser.Math.Between(36, 102),
        alpha: 0,
        scaleX: 0.25,
        duration: TITLE_RUN_LAUNCH_DELAY_MS,
        ease: 'Cubic.easeOut',
        onComplete: () => mote.destroy(),
      });
    }
  }

  if (!reduced) {
    scene.tweens.add({
      targets: [plate, rail],
      alpha: { value: 0, duration: 100, delay: 80 },
      scaleX: '+=0.04',
      duration: TITLE_RUN_LAUNCH_DELAY_MS,
      ease: 'Cubic.easeOut',
      onComplete: () => group.destroy(true),
    });
  }
  scene.updateMenuTextState();
}
