import Phaser from 'phaser';
import { UI_TYPE } from './theme';

export interface RouteMapNodeView {
  id: string;
  type: string;
  x: number;
  y: number;
  radius: number;
  iconSize: number;
  completed: boolean;
  current: boolean;
  selected: boolean;
  selectable: boolean;
  boss: boolean;
}

export interface RouteMapEdgeView {
  from: string;
  to: string;
  key: string;
  lit: boolean;
  primaryPreview: boolean;
  secondaryPreview: boolean;
  available: boolean;
}

export interface RouteMapRendererContext {
  scene: Phaser.Scene;
  nodes: RouteMapNodeView[];
  edges: RouteMapEdgeView[];
  activeMapIndex: number;
  fontFamily: string;
  boldFontStyle: string;
  renderNodeIcon: (node: RouteMapNodeView, alpha: number) => Phaser.GameObjects.GameObject;
  renderBossBeacon: (node: RouteMapNodeView, subdued: boolean) => void;
  renderSelectedFocus: (node: RouteMapNodeView) => void;
  showNodeTooltip: (nodeId: string, x: number, anchorY: number) => Phaser.GameObjects.Container | undefined;
  selectNode: (nodeId: string) => void;
  inspectNode: (nodeId: string) => void;
  confirm?: {
    cx: number;
    cy: number;
    labelCx: number;
    labelWidth: number;
    hitSize: number;
    goldColor: number;
    goldText: string;
    addIcon: () => Phaser.GameObjects.Image | undefined;
    showTooltip: () => Phaser.GameObjects.Container;
    commit: () => void;
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function hashSeed(value: string, salt: number) {
  let hash = (2166136261 ^ salt) >>> 0;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function drawEdgePath(
  graphics: Phaser.GameObjects.Graphics,
  from: RouteMapNodeView,
  to: RouteMapNodeView,
  edgeKey: string,
  color: number,
  alpha: number,
  dotRadius: number,
  activeMapIndex: number,
) {
  const { Vector2 } = Phaser.Math;
  const start = new Vector2(from.x + from.iconSize / 2, from.y);
  const end = new Vector2(to.x - to.iconSize / 2, to.y);
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.max(1, Math.hypot(dx, dy));
  const side = (hashSeed(edgeKey, activeMapIndex) & 1) === 0 ? 1 : -1;
  const bend = clamp(length * 0.16, 14, 34) * side;
  const control = new Vector2(
    (start.x + end.x) / 2 + (-dy / length) * bend,
    (start.y + end.y) / 2 + (dx / length) * bend,
  );
  const curve = new Phaser.Curves.QuadraticBezier(start, control, end);
  const points = curve.getSpacedPoints(Math.max(7, Math.ceil(length / 16)));

  graphics.lineStyle(Math.max(1.6, dotRadius * 1.4), color, alpha * 0.86);
  points.slice(1).forEach((point, index) => {
    const previous = points[index];
    graphics.lineBetween(previous.x, previous.y, point.x, point.y);
  });
  points.slice(1, -1).forEach((point, index) => {
    const pulse = index % 3 === 1 ? 0.9 : 1;
    graphics.fillStyle(0x06111a, Math.min(0.56, alpha * 0.8));
    graphics.fillCircle(point.x, point.y, dotRadius * pulse + 0.62);
    graphics.fillStyle(color, alpha);
    graphics.fillCircle(point.x, point.y, dotRadius * pulse);
  });
  return curve;
}

function renderNode(context: RouteMapRendererContext, node: RouteMapNodeView) {
  const { scene } = context;
  if (node.boss) context.renderBossBeacon(node, node.completed || (!node.selectable && !node.selected));

  if (node.current) {
    scene.add.circle(node.x, node.y, node.radius + 3, 0x06131d, 0.94)
      .setStrokeStyle(3, 0xe7eef7, 1).setName('route-node-current-backplate');
  } else if (!node.completed && (node.selected || node.selectable)) {
    const haloColor = node.selected ? 0xd8a840 : 0x24d0d6;
    scene.add.circle(node.x, node.y, node.radius + (node.selected ? 7 : 3), 0x06131d, node.selected ? 0.84 : 0.58)
      .setStrokeStyle(node.selected ? 3 : 2, haloColor, node.selected ? 0.98 : 0.82)
      .setName(node.selected ? 'route-node-selected-backplate' : 'route-node-selectable-backplate');
  } else if (!node.completed) {
    scene.add.circle(node.x, node.y, node.radius + 1, 0x10222b, 0.24)
      .setName('route-node-future-backplate');
  }
  if (node.selected) context.renderSelectedFocus(node);

  // Explicit circular bounds avoid the overlapping rectangular default hit
  // areas of neighboring map medallions. Both sizes exceed 44 CSS px.
  const hitRadius = node.boss ? 44 : 38;
  const hitTarget = scene.add.circle(node.x, node.y, hitRadius, 0x000000, 0)
    .setInteractive(new Phaser.Geom.Circle(hitRadius, hitRadius, hitRadius), Phaser.Geom.Circle.Contains)
    .setName('route-node-hit');
  hitTarget.input!.cursor = 'pointer';
  hitTarget.on('pointerdown', () => node.selectable ? context.selectNode(node.id) : context.inspectNode(node.id));
  let tip: Phaser.GameObjects.Container | undefined;
  hitTarget.on('pointerover', () => { tip = context.showNodeTooltip(node.id, node.x, node.y - node.radius - 8); });
  hitTarget.on('pointerout', () => { tip?.destroy(true); tip = undefined; });

  const visualState = node.current ? 'current' : node.completed ? 'completed' : node.selected ? 'selected' : node.selectable ? 'selectable' : 'future';
  const visualAlpha = node.current ? 1 : node.completed ? 0.32 : node.selected ? 1 : node.selectable ? 0.96 : 0.9;
  hitTarget.setData('routeNodeId', node.id).setData('routeNodeState', visualState);
  context.renderNodeIcon(node, visualAlpha)
    .setName('route-node-icon')
    .setData('routeNodeId', node.id)
    .setData('routeNodeState', visualState);

  if (node.completed) {
    const x = node.x + node.radius * 0.65, y = node.y + node.radius * 0.65;
    scene.add.circle(x, y, 11, 0x0b151f, 1).setStrokeStyle(1, 0xadc9d2, 0.9)
      .setName('route-node-completed-mark').setData('routeNodeId', node.id);
    const mark = scene.add.graphics().setName('route-node-completed-check');
    mark.lineStyle(3, 0xe7f4e7, 1);
    mark.lineBetween(x - 5, y, x - 1, y + 4);
    mark.lineBetween(x - 1, y + 4, x + 6, y - 5);
  }

  if (node.current || node.selected) {
    const name = node.current ? 'route-node-current-label' : 'route-node-selected-label';
    const labelY = node.y + node.radius + 18;
    scene.add.rectangle(node.x, labelY, 104, 28, 0x06111a, 0.98)
      .setStrokeStyle(1, node.current ? 0xe7eef7 : 0xd8a840, 0.88)
      .setName(name);
    scene.add.text(node.x, labelY, node.current ? 'Here' : 'Selected', {
      fontFamily: context.fontFamily,
      fontSize: `${UI_TYPE.primary}px`,
      fontStyle: context.boldFontStyle,
      color: node.current ? '#e7eef7' : '#fff0b8',
      resolution: 2,
    }).setOrigin(0.5).setName(name);
  }
}

function renderConfirmButton(context: RouteMapRendererContext) {
  const { scene, confirm } = context;
  if (!confirm) return;
  const hitLeft = confirm.labelCx - confirm.labelWidth / 2;
  const hitRight = confirm.cx + confirm.hitSize / 2;
  const hit = scene.add.rectangle(
    (hitLeft + hitRight) / 2,
    confirm.cy,
    hitRight - hitLeft,
    confirm.hitSize,
    0x000000,
    0.01,
  ).setName('route-commit-hit').setInteractive({ useHandCursor: true });
  const icon = confirm.addIcon();
  icon?.setAlpha(0.98);
  scene.add.rectangle(confirm.labelCx, confirm.cy, confirm.labelWidth, 44, 0x06111a, 0.96)
    .setStrokeStyle(1, confirm.goldColor, 0.72)
    .setName('route-commit-label');
  scene.add.text(confirm.labelCx, confirm.cy, 'TAKE ROUTE', {
    fontFamily: context.fontFamily,
    fontSize: `${UI_TYPE.primary}px`,
    fontStyle: context.boldFontStyle,
    color: confirm.goldText,
  }).setOrigin(0.5).setName('route-commit-label');
  const iconBaseScaleX = icon?.scaleX ?? 1;
  const iconBaseScaleY = icon?.scaleY ?? 1;
  let tip: Phaser.GameObjects.Container | undefined;
  hit.on('pointerover', () => {
    icon?.setScale(iconBaseScaleX * 1.1, iconBaseScaleY * 1.1);
    tip = confirm.showTooltip();
  });
  hit.on('pointerout', () => {
    icon?.setScale(iconBaseScaleX, iconBaseScaleY);
    tip?.destroy(true);
    tip = undefined;
  });
  hit.on('pointerdown', confirm.commit);
}

export function renderRouteMap(context: RouteMapRendererContext) {
  const nodes = new Map(context.nodes.map((node) => [node.id, node]));
  const lines = context.scene.add.graphics().setName('route-edge-layer');
  context.edges.forEach((edge) => {
    const from = nodes.get(edge.from);
    const to = nodes.get(edge.to);
    if (!from || !to) return;
    const color = edge.lit ? 0x87b884 : edge.primaryPreview ? 0xd8a840 : edge.available ? 0x77d9df : edge.secondaryPreview ? 0xb3c8d2 : 0x9cb3bf;
    const alpha = edge.lit ? 0.88 : edge.primaryPreview ? 1 : edge.available ? 0.94 : edge.secondaryPreview ? 0.86 : 0.78;
    const dotRadius = edge.lit ? 1.5 : edge.primaryPreview ? 2.2 : edge.available ? 1.8 : edge.secondaryPreview ? 1.5 : 1.3;
    const curve = drawEdgePath(lines, from, to, edge.key, color, alpha, dotRadius, context.activeMapIndex);
    if (edge.available || edge.primaryPreview) {
      const marker = curve.getPointAt(0.65);
      const tangent = curve.getTangentAt(0.65);
      const arrow = context.scene.add.graphics().setName('route-edge-direction')
        .setData('routeEdgeKey', edge.key);
      arrow.lineStyle(3, edge.primaryPreview ? 0xd8a840 : 0x77d9df, 1);
      for (const side of [-1, 1]) arrow.lineBetween(marker.x, marker.y,
        marker.x - tangent.x * 8 - tangent.y * 5 * side,
        marker.y - tangent.y * 8 + tangent.x * 5 * side);
    }
  });
  context.nodes.forEach((node) => renderNode(context, node));
  renderConfirmButton(context);
}

export function renderRouteGuidance(context: {
  scene: Phaser.Scene;
  text: string;
  name: string;
  selected: boolean;
  fontFamily: string;
  boldFontStyle: string;
  goldColor: number;
  cyanColor: number;
}) {
  context.scene.add.rectangle(382, 104, 650, 48, 0x06111a, 0.96)
    .setStrokeStyle(1, context.selected ? context.goldColor : context.cyanColor, 0.65)
    .setName(context.name);
  context.scene.add.text(382, 104, context.text, {
    fontFamily: context.fontFamily,
    fontSize: '18px',
    fontStyle: context.boldFontStyle,
    color: '#e7fbff',
    fixedWidth: 620,
    align: 'left',
    wordWrap: { width: 620, useAdvancedWrap: true },
  }).setOrigin(0.5).setResolution(2).setName(context.name);
}
