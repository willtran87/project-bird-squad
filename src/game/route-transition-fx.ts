import Phaser from 'phaser';
import { uiIconAssets, birdAudio, activeMapIndex, currentMap, prefersReducedMotion, clamp } from '../main';
import { prefersLeanEffects } from './graphics-quality';
import { UI_FONT, UI_BOLD } from './theme';
const ROUTE_COMMIT_STREAK_TEXTURE = 'route-commit-streak';

export function renderRouteBossBeaconRing(scene: Phaser.Scene, x: number, y: number, completed: boolean) {
  const key = uiIconAssets['route-boss-beacon-ring'].key;
  if (!scene.textures.exists(key)) return;
  scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);
  const reduced = prefersReducedMotion();
  const beacon = scene.add.image(x, y, key).setDisplaySize(204, 204)
    .setAlpha(completed ? 0.24 : reduced ? 0.36 : 0.46).setName('route-boss-beacon-ring');
  if (!completed && !reduced) scene.tweens.add({
    targets: beacon, alpha: 0.64, scaleX: beacon.scaleX * 1.045, scaleY: beacon.scaleY * 1.045,
    duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
  });
}

export function renderDistrictAdvanceFlourish(scene: any) {
    if (!scene.shouldShowDistrictAdvanceFlourish()) return;
    const key = uiIconAssets['district-advance-flourish'].key;
    if (!scene.textures.exists(key)) return;
    const plaqueKey = uiIconAssets['district-advance-title-plaque'].key;

    scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);
    if (!scene.districtAdvanceFlourishShown) {
      scene.districtAdvanceFlourishShown = true;
      scene.districtAdvanceFlourishBursts += 1;
      birdAudio.play('districtAdvance', 1);
      scene.time.delayedCall(2600, () => {
        scene.districtAdvanceNotice = undefined;
      });
    }

    const layout = scene.routeLayout();
    const x = layout.map.cx;
    const y = layout.map.cy - 34;
    const reduced = prefersReducedMotion();
    const leanEffects = prefersLeanEffects();
    const glow = scene.add.ellipse(x, y + 10, 760, 248, 0x26d5dc, reduced ? 0.08 : 0.12)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setName('district-advance-flourish');
    const base = scene.add.image(x, y, key)
      .setDisplaySize(742, 348)
      .setAlpha(reduced ? 0.34 : 0.42)
      .setName('district-advance-flourish');
    const glint = scene.add.image(x, y - 2, key)
      .setDisplaySize(768, 360)
      .setAlpha(reduced ? 0.12 : 0.2)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setName('district-advance-flourish');
    const plaqueParts: Phaser.GameObjects.GameObject[] = [];
    if (scene.textures.exists(plaqueKey)) {
      scene.textures.get(plaqueKey).setFilter(Phaser.Textures.FilterMode.LINEAR);
      const plaqueY = y - 36;
      const plaque = scene.add.image(x, plaqueY, plaqueKey)
        .setDisplaySize(610, 134)
        .setAlpha(reduced ? 0.78 : 0.92)
        .setName('district-advance-title-plaque');
      const title = scene.add.text(x, plaqueY - 15, `DISTRICT ${scene.districtAdvanceNotice?.toMapIndex ?? activeMapIndex + 1}`, {
        fontFamily: UI_FONT,
        fontSize: '22px',
        fontStyle: UI_BOLD,
        color: '#ffe3a8',
        align: 'center',
        stroke: '#02060b',
        strokeThickness: 4,
        fixedWidth: 420
      }).setOrigin(0.5).setName('district-advance-title-plaque');
      const subtitle = scene.add.text(x, plaqueY + 20, scene.districtAdvanceNotice?.toMapName ?? currentMap().name, {
        fontFamily: UI_FONT,
        fontSize: '15px',
        fontStyle: UI_BOLD,
        color: '#dffbff',
        align: 'center',
        stroke: '#02060b',
        strokeThickness: 3,
        fixedWidth: 432
      }).setOrigin(0.5).setName('district-advance-title-plaque');
      plaqueParts.push(plaque, title, subtitle);
    }
    const particleBurst = scene.add.particles(x, y, key, {
      lifespan: 720,
      speedX: { min: -260, max: 260 },
      speedY: { min: -44, max: 54 },
      scale: { start: 0.028, end: 0 },
      alpha: { start: 0.26, end: 0 },
      rotate: { min: -18, max: 18 },
      blendMode: Phaser.BlendModes.ADD,
      emitting: false
    }).setName('district-advance-flourish');
    particleBurst.explode(reduced ? 8 : leanEffects ? 10 : 18);

    const motes: Phaser.GameObjects.GameObject[] = [];
    const moteCount = leanEffects ? 8 : 18;
    for (let i = 0; i < moteCount; i += 1) {
      const side = i % 2 === 0 ? -1 : 1;
      const startX = x + side * Phaser.Math.Between(72, 332);
      const startY = y + Phaser.Math.Between(-86, 106);
      const color = i % 3 === 0 ? 0x8df4ff : i % 3 === 1 ? 0xf0c36f : 0xc98bff;
      const mote = scene.add.rectangle(startX, startY, Phaser.Math.Between(12, 24), 3, color, reduced ? 0.42 : 0.68)
        .setAngle(side > 0 ? -8 : 8)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setName('district-advance-flourish');
      motes.push(mote);
      if (!reduced) {
        scene.tweens.add({
          targets: mote,
          x: startX + side * Phaser.Math.Between(36, 92),
          y: startY + Phaser.Math.Between(-12, 12),
          alpha: 0,
          scaleX: 0.45,
          duration: 720,
          delay: i * 18,
          ease: 'Cubic.easeOut',
          onComplete: () => mote.destroy()
        });
      }
    }

    if (reduced) {
      scene.time.delayedCall(2600, () => {
        [glow, base, glint, particleBurst, ...plaqueParts, ...motes].forEach(part => { if (part.active) part.destroy(); });
      });
      return;
    }
    scene.tweens.add({
      targets: [glow, base, glint, ...plaqueParts],
      alpha: { value: 0, duration: 700, delay: 1700 },
      scaleX: '+=0.018',
      scaleY: '+=0.018',
      duration: 2400,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        glow.destroy();
        base.destroy();
        glint.destroy();
        plaqueParts.forEach((part) => part.destroy());
        particleBurst.destroy();
      }
    });
  }

export function routeCommitStreakFx(scene: any, routeNodeId: string) {
    const targetNode = currentMap().nodes.find((candidate) => candidate.id === routeNodeId);
    let to = targetNode ? scene.nodePosition(targetNode) : { x: scene.routeLayout().map.cx, y: scene.routeLayout().map.cy };
    const fromNode = currentMap().nodes.find((candidate) => candidate.id === scene.runState.currentRouteNodeId);
    let from = fromNode ? scene.nodePosition(fromNode) : undefined;
    if (!from && targetNode?.id === currentMap().entryNodeId) {
      const onwardEdge = currentMap().edges.find((edge) => edge.from === targetNode.id && !edge.locked);
      const onwardNode = onwardEdge ? currentMap().nodes.find((candidate) => candidate.id === onwardEdge.to) : undefined;
      if (onwardNode) {
        from = to;
        to = scene.nodePosition(onwardNode);
      }
    }
    from ??= { x: to.x - 220, y: to.y + 14 };
    if (Math.hypot(to.x - from.x, to.y - from.y) < 24) {
      from = { x: to.x - 230, y: to.y + 18 };
    }
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const angle = Math.atan2(dy, dx);
    const distance = Math.max(160, Math.hypot(dx, dy));
    const rawCenterX = from.x + dx * 0.58;
    const rawCenterY = from.y + dy * 0.58;
    const reduced = prefersReducedMotion();
    const leanEffects = prefersLeanEffects();
    scene.routeCommitStreakBursts += 1;

    const rail = scene.add.graphics().setName('route-commit-streak');
    rail.lineStyle(3, 0x8df4ff, reduced ? 0.5 : 0.72);
    rail.lineBetween(from.x, from.y, to.x, to.y);
    rail.lineStyle(1, 0xf0c36f, reduced ? 0.42 : 0.58);
    rail.lineBetween(from.x + Math.sin(angle) * 5, from.y - Math.cos(angle) * 5, to.x + Math.sin(angle) * 5, to.y - Math.cos(angle) * 5);
    scene.tweens.add({
      targets: rail,
      alpha: 0,
      duration: reduced ? 120 : 460,
      ease: 'Sine.easeIn',
      onComplete: () => rail.destroy()
    });

    const motes: Phaser.GameObjects.Shape[] = [];
    const moteCount = reduced ? 4 : leanEffects ? 6 : 10;
    for (let i = 0; i < moteCount; i += 1) {
      const t = i / Math.max(1, moteCount - 1);
      const wobble = (i % 2 === 0 ? 1 : -1) * Phaser.Math.Between(5, 18);
      const mote = scene.add.rectangle(
        from.x + dx * t + Math.sin(angle) * wobble,
        from.y + dy * t - Math.cos(angle) * wobble,
        Phaser.Math.Between(10, 24),
        3,
        i % 3 === 0 ? 0xf0c36f : i % 3 === 1 ? 0x8df4ff : 0xc98bff,
        reduced ? 0.48 : 0.72
      )
        .setAngle(Phaser.Math.RadToDeg(angle))
        .setBlendMode(Phaser.BlendModes.ADD)
        .setName('route-commit-streak');
      motes.push(mote);
      scene.tweens.add({
        targets: mote,
        x: mote.x + Math.cos(angle) * Phaser.Math.Between(18, 54),
        y: mote.y + Math.sin(angle) * Phaser.Math.Between(18, 54),
        alpha: 0,
        duration: reduced ? 120 : Phaser.Math.Between(260, 500),
        ease: 'Sine.easeOut',
        onComplete: () => mote.destroy()
      });
    }

    if (!scene.textures.exists(ROUTE_COMMIT_STREAK_TEXTURE)) return;
    scene.textures.get(ROUTE_COMMIT_STREAK_TEXTURE).setFilter(Phaser.Textures.FilterMode.LINEAR);
    const displayWidth = clamp(distance * 1.08, 390, 540);
    const displayHeight = displayWidth / 3;
    const graph = scene.routeLayout().graph;
    const centerX = clamp(rawCenterX, graph.left + displayWidth / 2 + 18, graph.right - displayWidth / 2 - 18);
    const centerY = clamp(rawCenterY, graph.top + displayHeight / 2 + 12, graph.bottom - displayHeight / 2 - 12);
    const offsetBack = reduced ? 0 : 34;
    const launchPlate = scene.add.rectangle(
      centerX,
      centerY,
      displayWidth * 0.76,
      displayHeight * 0.36,
      0x07101c,
      reduced ? 0.28 : 0.48
    )
      .setRotation(angle)
      .setStrokeStyle(2, 0x8df4ff, reduced ? 0.28 : 0.46)
      .setName('route-commit-streak');
    const streak = scene.add.image(
      centerX - Math.cos(angle) * offsetBack,
      centerY - Math.sin(angle) * offsetBack,
      ROUTE_COMMIT_STREAK_TEXTURE
    )
      .setDisplaySize(displayWidth, displayHeight)
      .setRotation(angle)
      .setAlpha(reduced ? 0.64 : 0.18)
      .setName('route-commit-streak');
    const glow = scene.add.image(centerX, centerY, ROUTE_COMMIT_STREAK_TEXTURE)
      .setDisplaySize(displayWidth * 1.05, displayHeight * 1.05)
      .setRotation(angle)
      .setAlpha(reduced ? 0.14 : 0.2)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setName('route-commit-streak');

    if (reduced) {
      scene.time.delayedCall(150, () => {
        launchPlate.destroy();
        streak.destroy();
        glow.destroy();
      });
      return;
    }
    scene.tweens.add({
      targets: streak,
      x: centerX + Math.cos(angle) * 28,
      y: centerY + Math.sin(angle) * 28,
      alpha: 0.96,
      scaleX: streak.scaleX * 1.08,
      scaleY: streak.scaleY * 1.08,
      duration: 150,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        scene.tweens.add({
          targets: streak,
          x: centerX + Math.cos(angle) * 72,
          y: centerY + Math.sin(angle) * 72,
          alpha: 0,
          duration: 360,
          ease: 'Cubic.easeIn',
          onComplete: () => streak.destroy()
        });
      }
    });
    scene.tweens.add({
      targets: launchPlate,
      x: centerX + Math.cos(angle) * 42,
      y: centerY + Math.sin(angle) * 42,
      alpha: 0,
      scaleX: launchPlate.scaleX * 1.2,
      scaleY: launchPlate.scaleY * 1.35,
      duration: 520,
      ease: 'Sine.easeOut',
      onComplete: () => launchPlate.destroy()
    });
    scene.tweens.add({
      targets: glow,
      alpha: 0,
      scaleX: glow.scaleX * 1.18,
      scaleY: glow.scaleY * 1.18,
      duration: 520,
      ease: 'Sine.easeOut',
      onComplete: () => glow.destroy()
    });
  }


