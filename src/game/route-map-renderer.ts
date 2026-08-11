import Phaser from 'phaser';

export interface RouteMapNodeView {
  id: string;
  type: string;
  column: number;
  x: number;
  y: number;
  radius: number;
  iconSize: number;
  completed: boolean;
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
  graph: { left: number; right: number; top: number; bottom: number };
  columnCount: number;
  activeMapIndex: number;
  fontFamily: string;
  boldFontStyle: string;
  renderNodeIcon: (node: RouteMapNodeView, alpha: number) => Phaser.GameObjects.GameObject;
  renderBossBeacon: (node: RouteMapNodeView, subdued: boolean) => void;
  renderSelectedFocus: (node: RouteMapNodeView) => void;
  showNodeTooltip: (nodeId: string, x: number, anchorY: number) => Phaser.GameObjects.Container | undefined;
  selectNode: (nodeId: string) => void;
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
  const start = new Phaser.Math.Vector2(from.x + from.iconSize / 2, from.y);
  const end = new Phaser.Math.Vector2(to.x - to.iconSize / 2, to.y);
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.max(1, Math.hypot(dx, dy));
  const side = (hashSeed(edgeKey, activeMapIndex) & 1) === 0 ? 1 : -1;
  const bend = clamp(length * 0.16, 14, 34) * side;
  const control = new Phaser.Math.Vector2(
    (start.x + end.x) / 2 + (-dy / length) * bend,
    (start.y + end.y) / 2 + (dx / length) * bend,
  );
  const curve = new Phaser.Curves.QuadraticBezier(start, control, end);
  const points = curve.getSpacedPoints(Math.max(7, Math.ceil(length / 16)));

  graphics.lineStyle(Math.max(1, dotRadius * 1.2), color, Math.min(0.64, alpha * 0.64));
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

function renderColumnGuides(context: RouteMapRendererContext) {
  const { scene, graph, columnCount, nodes } = context;
  const count = Math.max(1, columnCount);
  const graphics = scene.add.graphics().setName('route-column-guides');
  for (let column = 0; column < count; column += 1) {
    const columnNodes = nodes.filter((node) => node.column === column);
    const x = columnNodes.length
      ? columnNodes.reduce((sum, node) => sum + node.x, 0) / columnNodes.length
      : count > 1 ? graph.left + (column * (graph.right - graph.left)) / (count - 1) : (graph.left + graph.right) / 2;
    graphics.lineStyle(1, 0x2a3a4d, column === 0 || column === count - 1 ? 0.1 : 0.035);
    graphics.lineBetween(x, graph.top, x, graph.bottom);
  }
}

function renderNode(context: RouteMapRendererContext, node: RouteMapNodeView) {
  const { scene } = context;
  if (node.boss) context.renderBossBeacon(node, node.completed || (!node.selectable && !node.selected));

  if (!node.completed && (node.selected || node.selectable)) {
    const haloColor = node.selected ? 0xd8a840 : 0x24d0d6;
    scene.add.circle(node.x, node.y, node.radius + (node.selected ? 7 : 3), 0x06131d, node.selected ? 0.84 : 0.58)
      .setStrokeStyle(node.selected ? 3 : 2, haloColor, node.selected ? 0.98 : 0.82)
      .setName(node.selected ? 'route-node-selected-backplate' : 'route-node-selectable-backplate');
  }
  if (node.selected) context.renderSelectedFocus(node);

  const hitTarget = scene.add.circle(node.x, node.y, node.radius + 10, 0x000000, 0)
    .setInteractive({ useHandCursor: node.selectable })
    .setName('route-node-hit');
  if (node.selectable) hitTarget.on('pointerdown', () => context.selectNode(node.id));
  let tip: Phaser.GameObjects.Container | undefined;
  hitTarget.on('pointerover', () => { tip = context.showNodeTooltip(node.id, node.x, node.y - node.radius - 8); });
  hitTarget.on('pointerout', () => { tip?.destroy(true); tip = undefined; });

  const visualState = node.completed ? 'completed' : node.selected ? 'selected' : node.selectable ? 'selectable' : 'future';
  const visualAlpha = node.completed ? 0.24 : node.selected ? 1 : node.selectable ? 0.96 : 0.22;
  context.renderNodeIcon(node, visualAlpha)
    .setName('route-node-icon')
    .setData('routeNodeId', node.id)
    .setData('routeNodeState', visualState);

  if (node.selected) {
    const labelY = node.y + node.radius + 13;
    scene.add.rectangle(node.x, labelY, 70, 18, 0x06111a, 0.96)
      .setStrokeStyle(1, 0xd8a840, 0.88)
      .setName('route-node-selected-label');
    scene.add.text(node.x, labelY, 'SELECTED', {
      fontFamily: context.fontFamily,
      fontSize: '9px',
      fontStyle: context.boldFontStyle,
      color: '#fff0b8',
      letterSpacing: 1,
    }).setOrigin(0.5).setName('route-node-selected-label');
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
  scene.add.rectangle(confirm.labelCx, confirm.cy, confirm.labelWidth, 30, 0x06111a, 0.96)
    .setStrokeStyle(1, confirm.goldColor, 0.72)
    .setName('route-commit-label');
  scene.add.text(confirm.labelCx, confirm.cy, 'TAKE ROUTE', {
    fontFamily: context.fontFamily,
    fontSize: '13px',
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
  renderColumnGuides(context);
  const lines = context.scene.add.graphics().setName('route-edge-layer');
  context.edges.forEach((edge) => {
    const from = nodes.get(edge.from);
    const to = nodes.get(edge.to);
    if (!from || !to) return;
    const color = edge.lit ? 0x87b884 : edge.primaryPreview ? 0xd8a840 : edge.available ? 0x24d0d6 : edge.secondaryPreview ? 0x7893a0 : 0x345466;
    const alpha = edge.lit ? 0.88 : edge.primaryPreview ? 0.98 : edge.available ? 0.9 : edge.secondaryPreview ? 0.22 : 0.1;
    const dotRadius = edge.lit ? 1.5 : edge.primaryPreview ? 1.8 : edge.available ? 1.55 : edge.secondaryPreview ? 1.05 : 0.9;
    const curve = drawEdgePath(lines, from, to, edge.key, color, alpha, dotRadius, context.activeMapIndex);
    if (edge.available || edge.primaryPreview) {
      const marker = curve.getPoint(0.65);
      lines.fillStyle(0x06111a, 0.62);
      lines.fillCircle(marker.x, marker.y, edge.primaryPreview ? 5 : 4.5);
      lines.fillStyle(edge.primaryPreview ? 0xd8a840 : 0x24d0d6, 0.98);
      lines.fillCircle(marker.x, marker.y, edge.primaryPreview ? 3.9 : 3.4);
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
  context.scene.add.rectangle(382, 104, 650, 42, 0x06111a, 0.96)
    .setStrokeStyle(2, context.selected ? context.goldColor : context.cyanColor, 0.86)
    .setName(context.name);
  context.scene.add.text(382, 104, context.text, {
    fontFamily: context.fontFamily,
    fontSize: '14px',
    fontStyle: context.boldFontStyle,
    color: '#e7fbff',
    fixedWidth: 620,
    align: 'center',
    maxLines: 1,
  }).setOrigin(0.5).setName(context.name);
}
