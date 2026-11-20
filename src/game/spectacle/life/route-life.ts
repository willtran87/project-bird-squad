import Phaser from 'phaser';
import type { RouteMapNodeView, RouteMapRendererContext } from '../../route-map-renderer';
import { UI_TYPE } from '../../theme';
import { birdTexture, eachFrame, easeOut, motion, sceneNow } from './kit';

/**
 * Route map life: a compact legend, pulsing reachable nodes, motes drifting
 * along flown paths and the flock marker. The route scene destroys and redraws
 * everything on each state change, so every moving part is a pure function of
 * the scene clock: a redraw mid-pulse continues where the last one stopped.
 */

type Curve = Phaser.Curves.QuadraticBezier;
interface RouteLifeState {
  pulses: Phaser.GameObjects.Arc[];
  motes: Array<{ dot: Phaser.GameObjects.Arc; curve: Curve }>;
  marker?: Phaser.GameObjects.Container;
  home: { x: number; y: number };
  curves: Map<string, Curve>;
  /** Glide in along the edge just flown, measured on the scene clock. */
  arrive?: { curve: Curve; until: number };
  arrived: boolean;
  flying: boolean;
}

const states = new WeakMap<Phaser.Scene, RouteLifeState>();
const LEGEND: ReadonlyArray<readonly [type: string, label: string]> = [
  ['street', 'Fight'], ['rival', 'Rival'], ['signal', 'Signal'], ['basin', 'Roost'],
  ['nest', 'Nest'], ['cache', 'Cache'], ['market', 'Market'], ['boss', 'Boss'],
];
const ARRIVE_MS = 620;
const TRAIL = 0xbfe8c0;

export const edgeCurveKey = (from: string, to: string) => `${from}>${to}`;

/** Where the flock rests on a node: on the medallion's upper-left rim, clear
 * of the "Here" label below it. */
function rim(node: Pick<RouteMapNodeView, 'x' | 'y' | 'radius'>, outside = 0) {
  const reach = node.radius * 0.72 + outside;
  return { x: node.x - reach, y: node.y - reach };
}

function stateFor(scene: Phaser.Scene) {
  let state = states.get(scene);
  if (state) return state;
  const created: RouteLifeState = { pulses: [], motes: [], home: { x: 0, y: 0 }, curves: new Map(), arrived: false, flying: false };
  states.set(scene, created);
  eachFrame(scene, () => animate(scene, created), () => states.delete(scene));
  return created;
}

function animate(scene: Phaser.Scene, state: RouteLifeState) {
  if (motion() !== 'full') return;
  const now = sceneNow(scene);
  state.pulses.forEach((ring, index) => {
    if (!ring.active) return;
    const phase = (now / 1500 + index * 0.37) % 1;
    ring.setScale(1 + 0.24 * easeOut(phase)).setAlpha(0.78 * (1 - phase));
  });
  state.motes.forEach(({ dot, curve }, index) => {
    if (!dot.active) return;
    const phase = (now / 2600 + index * 0.31) % 1;
    const point = curve.getPoint(phase);
    dot.setPosition(point.x, point.y).setAlpha(Math.sin(Math.PI * phase) * 0.85);
  });
  const marker = state.marker;
  if (!marker?.active || state.flying) return;
  let { x, y } = state.home;
  if (state.arrive && now < state.arrive.until) {
    const progress = easeOut(1 - (state.arrive.until - now) / ARRIVE_MS);
    const point = state.arrive.curve.getPoint(0.5 + 0.5 * progress);
    x += point.x - state.arrive.curve.p2.x;
    y += point.y - state.arrive.curve.p2.y;
  }
  marker.setPosition(x, y + Math.sin(now / 520) * 3);
  const flap = 1 + 0.3 * Math.sin(now / 130);
  marker.list.forEach((child, index) => {
    if (index > 0) (child as Phaser.GameObjects.Image).scaleY = (child.getData('scale') as number) * flap;
  });
}

function buildMarker(scene: Phaser.Scene, x: number, y: number) {
  const bird = birdTexture(scene);
  const marker = scene.add.container(x, y).setName('route-flock-marker');
  marker.add(scene.add.circle(0, 0, 22, 0x06111a, 0.86).setStrokeStyle(2, 0xffe1a3, 0.9));
  ([[6, 0, 0.82], [-11, -10, 0.6], [-11, 10, 0.6]] as const).forEach(([dx, dy, scale]) => {
    marker.add(scene.add.image(dx, dy, bird).setScale(scale).setTint(0xfff3d0).setData('scale', scale));
  });
  return marker;
}

function renderLegend(context: RouteMapRendererContext) {
  const { scene } = context;
  const present = new Set(context.nodes.map(node => node.type));
  const rows = LEGEND.filter(([type]) => present.has(type));
  if (!rows.length) return;
  const rowHeight = 40, left = 40, width = 122;
  const top = Math.round(407 - (rows.length * rowHeight) / 2);
  scene.add.rectangle(left + width / 2, top + (rows.length * rowHeight) / 2, width, rows.length * rowHeight + 16, 0x06111a, 0.78)
    .setStrokeStyle(1, 0x49606d, 0.7).setName('route-legend');
  rows.forEach(([type, label], index) => {
    const y = top + rowHeight * (index + 0.5);
    context.renderNodeIcon({ type, x: left + 20, y, iconSize: 30 } as RouteMapNodeView, 1)
      .setName('route-legend-icon').setData('routeNodeType', type);
    scene.add.text(left + 40, y, label, {
      fontFamily: context.fontFamily, fontSize: `${UI_TYPE.secondary}px`, color: '#cfdde6', resolution: 2,
    }).setOrigin(0, 0.5).setName('route-legend-label').setData('routeNodeType', type);
  });
}

/** Called by the route map renderer after edges are drawn and before nodes. */
export function renderRouteLifeUnder(context: RouteMapRendererContext, curves: Map<string, Curve>) {
  const { scene } = context;
  const state = stateFor(scene);
  const mode = motion();
  state.curves = curves;
  state.pulses = [];
  state.motes = [];
  renderLegend(context);
  if (mode !== 'full') return;
  context.edges.filter(edge => edge.lit).slice(-8).forEach((edge) => {
    const curve = curves.get(edgeCurveKey(edge.from, edge.to));
    if (!curve) return;
    const dot = scene.add.circle(curve.p0.x, curve.p0.y, 3, 0xf4fff0, 1)
      .setBlendMode(Phaser.BlendModes.ADD).setAlpha(0).setName('route-trail-mote');
    state.motes.push({ dot, curve });
  });
  context.nodes.filter(node => node.selectable && !node.selected && !node.completed && !node.current).forEach((node) => {
    state.pulses.push(scene.add.circle(node.x, node.y, node.radius + 5, 0x000000, 0)
      .setStrokeStyle(2, 0x5fe6ea, 1).setAlpha(0).setName('route-node-pulse').setData('routeNodeId', node.id));
  });
}

/** Called after nodes are drawn, so the flock sits on top of its medallion. */
export function renderRouteLifeOver(context: RouteMapRendererContext) {
  const { scene } = context;
  const state = stateFor(scene);
  const current = context.nodes.find(node => node.current);
  const entry = current ?? context.nodes.find(node => node.selectable) ?? context.nodes[0];
  if (!entry) return;
  state.home = rim(entry, current ? 0 : 12);
  state.flying = false;
  state.marker = buildMarker(scene, state.home.x, state.home.y)
    .setData({ routeNodeId: current?.id ?? '', perched: !current });
  if (!state.arrived) {
    state.arrived = true;
    const flown = current && context.edges.find(edge => edge.lit && edge.to === current.id);
    const curve = flown && state.curves.get(edgeCurveKey(flown.from, flown.to));
    if (curve && motion() === 'full') state.arrive = { curve, until: sceneNow(scene) + ARRIVE_MS };
  }
  animate(scene, state);
}

/** Draw a flown edge as a flight trail: a soft wake, a bright line and small
 * wing-marks pointing the way the flock went. */
export function drawFlightTrail(graphics: Phaser.GameObjects.Graphics, curve: Curve) {
  const length = Math.max(1, curve.getLength());
  const points = curve.getSpacedPoints(Math.max(8, Math.ceil(length / 12)));
  const stroke = (width: number, color: number, alpha: number) => {
    graphics.lineStyle(width, color, alpha);
    points.slice(1).forEach((point, index) => graphics.lineBetween(points[index].x, points[index].y, point.x, point.y));
  };
  stroke(9, 0x87b884, 0.16);
  stroke(2.6, TRAIL, 0.92);
  const marks = Math.max(1, Math.floor(length / 46));
  graphics.lineStyle(2, 0xf4fff0, 0.95);
  for (let index = 1; index <= marks; index += 1) {
    const t = index / (marks + 1);
    const at = curve.getPointAt(t), tangent = curve.getTangentAt(t);
    for (const side of [-1, 1]) graphics.lineBetween(at.x, at.y,
      at.x - tangent.x * 7 - tangent.y * 5 * side, at.y - tangent.y * 7 + tangent.x * 5 * side);
  }
}

/** The flock leaves its node and flies the chosen edge during the commit beat.
 * The route scene holds its redraw until the beat ends, so tweens are safe. */
export function flyFlockMarker(scene: Phaser.Scene, to: Pick<RouteMapNodeView, 'x' | 'y' | 'radius'> & { id: string },
  fromId: string | undefined, duration: number) {
  const state = states.get(scene);
  const marker = state?.marker;
  if (!state || !marker?.active || motion() !== 'full' || duration <= 0) return;
  const target = rim(to);
  const start = new Phaser.Math.Vector2(marker.x, marker.y);
  const curve = fromId ? state.curves.get(edgeCurveKey(fromId, to.id)) : undefined;
  const control = curve
    ? new Phaser.Math.Vector2(curve.p1.x + (start.x - curve.p0.x + target.x - curve.p2.x) / 2,
      curve.p1.y + (start.y - curve.p0.y + target.y - curve.p2.y) / 2)
    : new Phaser.Math.Vector2((start.x + target.x) / 2, Math.min(start.y, target.y) - 26);
  const path = new Phaser.Curves.QuadraticBezier(start, control, new Phaser.Math.Vector2(target.x, target.y));
  const wake = scene.add.graphics().setName('route-flock-wake').setBlendMode(Phaser.BlendModes.ADD);
  const point = new Phaser.Math.Vector2();
  state.flying = true;
  marker.setData('flyingTo', to.id);
  scene.children.bringToTop(marker);
  scene.tweens.addCounter({
    from: 0, to: 1, duration, ease: 'Sine.easeInOut',
    onUpdate: (tween) => {
      if (!marker.active) return;
      const t = tween.getValue() ?? 0;
      path.getPoint(t, point);
      marker.setPosition(point.x, point.y).setScale(1 + 0.3 * Math.sin(Math.PI * t));
      wake.clear();
      for (let step = 0; step < 10; step += 1) {
        const back = t - step * 0.035;
        if (back <= 0) break;
        path.getPoint(back, point);
        wake.fillStyle(0xfff3d0, 0.5 * (1 - step / 10));
        wake.fillCircle(point.x, point.y, 4 * (1 - step / 12));
      }
    },
    onComplete: () => { if (marker.active) marker.setData({ routeNodeId: to.id, perched: false }); },
  });
}

/** Read-only summary for tests and the debug overlay. */
export function routeLifeState(scene: Phaser.Scene) {
  const state = states.get(scene);
  const marker = state?.marker?.active ? state.marker : undefined;
  return {
    marker: marker ? { x: marker.x, y: marker.y, nodeId: marker.getData('routeNodeId') as string,
      perched: Boolean(marker.getData('perched')), flying: Boolean(state?.flying) } : undefined,
    pulses: state?.pulses.filter(ring => ring.active).map(ring => ({
      nodeId: ring.getData('routeNodeId') as string, scale: ring.scaleX, alpha: ring.alpha })) ?? [],
    motes: state?.motes.filter(mote => mote.dot.active).length ?? 0,
  };
}
