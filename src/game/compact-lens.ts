import type Phaser from 'phaser';

/**
 * Compact lens: phone landscape (a window below 1000x560 held sideways).
 *
 * The 1280x720 layout is authored once. On a phone it would be drawn at about
 * 0.54 CSS px per game unit, so its 58-unit targets shrink to 31 CSS px. The
 * lens instead magnifies the scene camera to {@link COMPACT_SCALE} CSS px per
 * unit, the reading scale every screen already meets at 1000x560 plus
 * headroom, and frames what the current screen needs:
 *
 * - combat: the hand and the enemy panels, sliding to keep the selected card
 *   and its targets together; the HUD values move to the left rail;
 * - route: the selected stop and TAKE ROUTE when they fit together;
 * - overlays (anything behind a scrim): the overlay's own controls;
 * - otherwise every reachable control, aligned to its top-left.
 *
 * A drag on empty space pans; "Whole screen" in the rail shows the full layout
 * and a tap there chooses where to look. Rails beside the canvas carry the
 * vitals, Menu and the screen's commit action (Roost, TAKE ROUTE), each
 * forwarding to the real in-game control. Nothing here runs on larger windows.
 */

const WORLD_W = 1280;
const WORLD_H = 720;
/** CSS px per game unit: the 1000x560 reading scale (0.78) with headroom so
 * 15-unit dense card rules reach 12 CSS px and 58-unit targets 47 CSS px. */
export const COMPACT_SCALE = 0.8125;
const RAIL_MIN = 64;
const PLAN_MS = 120;

type Rect = { left: number; top: number; right: number; bottom: number };
type Plan = { key: string; x: number; y: number };
interface SceneLens {
  cx: number; cy: number; key: string; settled: boolean; plannedAt: number; plan?: Plan;
  manual?: { x: number; y: number };
  pan?: { id: number; x: number; y: number; cx: number; cy: number; moved: boolean };
}
type AnyObject = Phaser.GameObjects.GameObject & {
  list?: AnyObject[]; visible?: boolean; alpha?: number; text?: string;
  getBounds?: () => Phaser.Geom.Rectangle;
};

let game: Phaser.Game | undefined;
let active = false;
let overview = false;
let zoom = 1;
const lenses = new Map<Phaser.Scene, SceneLens>();
let railLeft: HTMLElement | undefined;
let railRight: HTMLElement | undefined;
let catcher: HTMLElement | undefined;
let railSignature = '';

const STATS: Array<[string, string]> = [
  ['hud-value-Cohesion', 'Cohesion'], ['combat-incoming-forecast-label', 'Incoming'],
  ['hud-value-Wingbeats', 'Wingbeats'], ['hud-value-Cover', 'Cover'],
  ['combat-flow-value', 'Flow'], ['hud-value-Scrap', 'Scrap'],
];
/** In-game controls mirrored in the right rail; each forwards to the real one. */
const PROXIES: Array<{ name: string; label: (o: AnyObject) => string; kind?: 'primary'; match?: (o: AnyObject) => boolean }> = [
  { name: 'pause-toggle-control-hit', label: () => 'Menu' },
  { name: 'combat-selection-command-frame', label: () => 'Confirm play', kind: 'primary' },
  { name: 'combat-roost-hit', label: o => shortLabel(o, 'Roost'), kind: 'primary' },
  { name: 'route-commit-hit', label: () => 'Take route', kind: 'primary' },
  { name: 'title-run-action', label: o => shortLabel(o, 'Start'), kind: 'primary', match: o => /^(Start|Continue|Fly)/.test(String(o.getData('fullLabel'))) },
  // An overlay's way out (Settings Close, a reader's Back) wherever it sits.
  { name: 'dismiss', label: o => shortLabel(o, 'Close'), match: o => interactive(o) && /^(Close|Back|Done)\b/.test(String(o.getData('fullLabel') ?? '')) },
];
const proxyTarget = (objects: AnyObject[], index: number) => {
  const proxy = PROXIES[index];
  return objects.find(o => (proxy.name === 'dismiss' || o.name === proxy.name) && (!proxy.match || proxy.match(o)));
};
const LARGER_SCREEN = new Set(['CodexScene', 'ProfileScene']);

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

function shortLabel(object: AnyObject, fallback: string) {
  const label = String(object.getData?.('fullLabel') ?? fallback);
  return label.split(' · ')[0] || fallback;
}

function union(rects: Rect[]): Rect | undefined {
  if (!rects.length) return undefined;
  return rects.reduce((a, b) => ({ left: Math.min(a.left, b.left), top: Math.min(a.top, b.top),
    right: Math.max(a.right, b.right), bottom: Math.max(a.bottom, b.bottom) }));
}

function boundsOf(object: AnyObject): Rect | undefined {
  const b = object.getBounds?.();
  if (!b || !Number.isFinite(b.left)) return undefined;
  const rect = { left: Math.max(0, b.left), top: Math.max(0, b.top), right: Math.min(WORLD_W, b.right), bottom: Math.min(WORLD_H, b.bottom) };
  return rect.right > rect.left && rect.bottom > rect.top ? rect : undefined;
}

function walk(list: AnyObject[]): AnyObject[] {
  return list.flatMap(o => o.visible !== false && o.alpha !== 0 ? [o, ...walk(o.list ?? [])] : []);
}

function findNamed(scene: Phaser.Scene, name: string) {
  return walk(scene.children.list as AnyObject[]).find(o => o.name === name);
}

function interactive(o: AnyObject) {
  return Boolean(o.input?.enabled && (o.listenerCount('pointerdown') || o.listenerCount('pointerup')));
}

/** A full-screen input catcher under an overlay (a scrim), not a command. */
function backdrop(o: AnyObject) {
  if (!o.input?.enabled) return false;
  const b = o.getBounds?.();
  return /scrim|blocker|backdrop/i.test(o.name) || Boolean(b && b.width >= 1200 && b.height >= 640);
}

/** Objects above the topmost backdrop: what an overlay leaves reachable. */
function reachable(scene: Phaser.Scene) {
  const all = walk(scene.children.list as AnyObject[]);
  let modal = -1;
  all.forEach((o, index) => { if (backdrop(o)) modal = index; });
  return { modal: modal >= 0 ? all[modal].name || 'modal' : '', objects: all.slice(modal + 1) };
}

/** Reachable controls, limited to the topmost overlay when a scrim is up. */
function actionable(scene: Phaser.Scene) {
  const { modal, objects } = reachable(scene);
  return { modal, rects: objects.filter(interactive).map(boundsOf).filter((r): r is Rect => !!r) };
}

/** Centre a window of W x H on a box; a larger box is read from its top-left. */
function fit(box: Rect, W: number, H: number) {
  return {
    x: box.right - box.left <= W ? (box.left + box.right) / 2 : box.left + W / 2,
    y: box.bottom - box.top <= H ? (box.top + box.bottom) / 2 : box.top + H / 2,
  };
}

function battlePlan(scene: Phaser.Scene, W: number, H: number): Plan | undefined {
  const b = scene as unknown as { mode?: string; selectedInstanceId?: string; handCardRects?: Map<string, AnyObject> };
  if (b.mode !== 'battle' || !b.handCardRects?.size) return undefined;
  const cards = [...b.handCardRects.entries()].filter(([, rect]) => rect.active && rect.visible !== false);
  const hand = union(cards.map(([, rect]) => boundsOf(rect)).filter((r): r is Rect => !!r));
  if (!hand) return undefined;
  const enemies = union(walk(scene.children.list as AnyObject[])
    .filter(o => o.name === 'combat-enemy-vitals' || o.name === 'combat-enemy-hit').map(boundsOf).filter((r): r is Rect => !!r));
  const selected = b.selectedInstanceId ? b.handCardRects.get(b.selectedInstanceId) : undefined;
  const card = selected && boundsOf(selected);
  let x = (hand.left + hand.right) / 2;
  if (card) {
    const both = enemies ? union([card, enemies])! : card;
    x = both.right - both.left <= W ? (both.left + both.right) / 2 : (card.left + card.right) / 2;
  }
  // The hand sits on the bottom edge; the enemy panels fit above it.
  return { key: `battle|${b.selectedInstanceId ?? ''}|${cards.length}`, x, y: WORLD_H - H / 2 };
}

function routePlan(scene: Phaser.Scene, W: number, H: number): Plan | undefined {
  const selected = findNamed(scene, 'route-node-selected-label') ?? findNamed(scene, 'route-node-current-label');
  const node = selected && boundsOf(selected);
  if (!node) return undefined;
  const commit = findNamed(scene, 'route-commit-hit');
  const both = commit ? union([node, boundsOf(commit) ?? node])! : node;
  const box = both.right - both.left <= W && both.bottom - both.top <= H ? both : node;
  const id = (scene as unknown as { selectedNodeId?: string }).selectedNodeId ?? '';
  return { key: `route|${id}`, ...fit({ ...box, top: box.top - 120, bottom: box.bottom }, W, H) };
}

/** Title: the run commands (start, continue, setup) and what sits beside them. */
function menuPlan(scene: Phaser.Scene, W: number, H: number): Plan | undefined {
  const objects = walk(scene.children.list as AnyObject[]).filter(interactive);
  const runs = objects.filter(o => o.name === 'title-run-action');
  if ((scene as unknown as { setupOpen?: boolean }).setupOpen) {
    // Setup: the run length choices and Start; Leaders and Ascension sit above and left.
    const start = runs.find(o => /^Start/.test(String(o.getData('fullLabel'))));
    const box = union([...objects.filter(o => o.name === 'title-run-mode-option'), ...(start ? [start] : [])]
      .map(boundsOf).filter((r): r is Rect => !!r));
    return box && { key: 'menu|setup', ...fit(box, W, H) };
  }
  const box = union(runs.map(boundsOf).filter((r): r is Rect => !!r));
  if (!box) return undefined;
  return { key: `menu|${runs.length}`, x: box.left - 60 + W / 2, y: Math.min(box.bottom + 120, WORLD_H) - H / 2 };
}

function plan(scene: Phaser.Scene, W: number, H: number): Plan {
  const key = scene.scene.key;
  const { modal, rects } = actionable(scene);
  if (!modal) {
    const special = key === 'BattleScene' ? battlePlan(scene, W, H) : key === 'RouteScene' ? routePlan(scene, W, H)
      : key === 'MenuScene' ? menuPlan(scene, W, H) : undefined;
    if (special) return special;
  }
  const box = union(rects) ?? { left: 0, top: 0, right: WORLD_W, bottom: WORLD_H };
  return { key: `${key}|${modal}`, ...fit(box, W, H) };
}

function attach(scene: Phaser.Scene): SceneLens {
  const lens: SceneLens = { cx: WORLD_W / 2, cy: WORLD_H / 2, key: '', settled: false, plannedAt: -Infinity };
  lenses.set(scene, lens);
  const input = scene.input;
  input.on('pointerdown', (pointer: Phaser.Input.Pointer, over: unknown[]) => {
    // Empty space or an overlay's scrim pans; a control keeps the press.
    if (!active || overview || !(over as AnyObject[]).every(backdrop)) return;
    lens.pan = { id: pointer.id, x: pointer.x, y: pointer.y, cx: lens.cx, cy: lens.cy, moved: false };
  });
  input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
    const pan = lens.pan;
    if (!pan || pointer.id !== pan.id || !pointer.isDown) return;
    const dx = pointer.x - pan.x, dy = pointer.y - pan.y;
    if (!pan.moved && Math.hypot(dx, dy) < 12) return;
    pan.moved = true;
    lens.manual = { x: pan.cx - dx / zoom, y: pan.cy - dy / zoom };
  });
  const release = () => { lens.pan = undefined; };
  input.on('pointerup', release).on('pointerupoutside', release).on('gameout', release);
  scene.events.once('shutdown', () => lenses.delete(scene));
  scene.events.once('destroy', () => lenses.delete(scene));
  return lens;
}

function applyLens(scene: Phaser.Scene, now: number) {
  const camera = scene.cameras?.main;
  if (!camera) return;
  const lens = lenses.get(scene) ?? attach(scene);
  const W = WORLD_W / zoom, H = WORLD_H / zoom;
  if (!lens.plan || now - lens.plannedAt >= PLAN_MS) {
    lens.plan = overview ? { key: lens.key, x: WORLD_W / 2, y: WORLD_H / 2 } : plan(scene, W, H);
    lens.plannedAt = now;
  }
  if (!overview && lens.plan.key !== lens.key) {
    lens.key = lens.plan.key;
    lens.manual = undefined;
  }
  const want = overview ? lens.plan : lens.manual ?? lens.plan;
  const tx = clamp(want.x, W / 2, WORLD_W - W / 2), ty = clamp(want.y, H / 2, WORLD_H - H / 2);
  if (lens.manual) lens.manual = { x: tx, y: ty };
  const ease = !lens.settled || lens.pan?.moved || overview || reducedMotion() ? 1 : 0.3;
  lens.cx += (tx - lens.cx) * ease;
  lens.cy += (ty - lens.cy) * ease;
  if (Math.abs(tx - lens.cx) < 0.5 && Math.abs(ty - lens.cy) < 0.5) { lens.cx = tx; lens.cy = ty; }
  lens.settled = true;
  if (camera.zoom !== zoom) camera.setZoom(zoom);
  camera.centerOn(lens.cx, lens.cy);
}

function topScene() {
  const scenes = game?.scene.getScenes(true).filter(s => s.scene.key !== 'BootScene') ?? [];
  return scenes[scenes.length - 1];
}

function activateProxy(index: number) {
  const scene = topScene();
  const object = scene && proxyTarget(reachable(scene).objects, index);
  if (!scene || !object?.input?.enabled) return;
  const event = { stopPropagation() {} };
  const pointer = scene.input.activePointer;
  object.emit(object.listenerCount('pointerdown') ? 'pointerdown' : 'pointerup', pointer, 0, 0, event);
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
}

function renderRails() {
  if (!railLeft || !railRight) return;
  const scene = topScene();
  const objects = scene ? walk(scene.children.list as AnyObject[]) : [];
  const named = new Map(objects.filter(o => o.name).map(o => [o.name, o] as const));
  // Only controls an open overlay leaves reachable get a rail shortcut.
  const open = scene ? reachable(scene).objects : [];
  const stats = STATS.map(([name, label]) => {
    const text = named.get(name)?.text?.replace(/\s+/g, ' ').trim();
    return [label, text?.startsWith(label) ? text.slice(label.length).trim() : text] as const;
  }).filter(([, value]) => value).slice(0, 5);
  const proxies = PROXIES.flatMap((p, index) => {
    const object = proxyTarget(open, index);
    return object ? [{ ...p, index, text: p.label(object), enabled: Boolean(object.input?.enabled) }] : [];
  });
  const note = scene && LARGER_SCREEN.has(scene.scene.key);
  const signature = JSON.stringify([stats, proxies.map(p => [p.name, p.text, p.enabled]), note, overview]);
  if (signature === railSignature) return;
  railSignature = signature;
  railLeft.innerHTML = stats.map(([label, value]) =>
    `<div class="compact-stat" data-stat="${escapeHtml(label)}"><span>${escapeHtml(label)}</span><strong>${escapeHtml(String(value))}</strong></div>`).join('')
    + '<div class="compact-spacer"></div>'
    + `<button type="button" data-lens="overview" aria-pressed="${overview}">${overview ? 'Tap to zoom' : 'Whole screen'}</button>`;
  railRight.innerHTML = proxies.map(p =>
    `<button type="button" data-proxy="${p.index}" data-name="${p.name}"${p.kind ? ` data-kind="${p.kind}"` : ''}${p.enabled ? '' : ' disabled'}>${escapeHtml(p.text)}</button>`).join('')
    + '<div class="compact-spacer"></div>'
    + (note ? '<div class="compact-note">Best on a larger screen</div>' : '');
}

function setOverview(on: boolean) {
  overview = on;
  catcher?.remove();
  catcher = undefined;
  if (on && game) {
    const rect = game.canvas.getBoundingClientRect();
    catcher = document.createElement('div');
    catcher.id = 'compact-overview-catcher';
    catcher.setAttribute('aria-label', 'Tap where to look');
    Object.assign(catcher.style, { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px` });
    catcher.addEventListener('pointerup', event => {
      const scene = topScene();
      const lens = scene && lenses.get(scene);
      if (lens) lens.manual = { x: (event.clientX - rect.left) / rect.width * WORLD_W, y: (event.clientY - rect.top) / rect.height * WORLD_H };
      setOverview(false);
    });
    document.body.append(catcher);
  }
  railSignature = '';
  renderRails();
}

function onRailClick(event: MouseEvent) {
  const button = (event.target as HTMLElement).closest('button');
  if (!button || button.disabled) return;
  if (button.dataset.lens === 'overview') setOverview(!overview);
  else if (button.dataset.proxy) { setOverview(false); activateProxy(Number(button.dataset.proxy)); }
}

function syncRailWidth() {
  const rail = Math.max(RAIL_MIN, Math.ceil((innerWidth - innerHeight * 16 / 9) / 2));
  document.documentElement.style.setProperty('--compact-rail', `${rail}px`);
}

function step() {
  if (!active || !game) return;
  const rect = game.canvas.getBoundingClientRect();
  const css = rect.height / WORLD_H || 1;
  zoom = overview ? 1 : clamp(COMPACT_SCALE / css, 1, 2.4);
  const now = performance.now();
  for (const scene of game.scene.getScenes(true)) if (scene.scene.key !== 'BootScene') applyLens(scene, now);
  renderRails();
}

function onResize() {
  syncRailWidth();
  if (overview) setOverview(false);
  game?.scale.refresh();
}

function mountRails() {
  railLeft = document.createElement('nav');
  railLeft.className = 'compact-rail compact-rail-left';
  railLeft.setAttribute('aria-label', 'Flock status and view');
  railRight = document.createElement('nav');
  railRight.className = 'compact-rail compact-rail-right';
  railRight.setAttribute('aria-label', 'Menu and actions');
  for (const rail of [railLeft, railRight]) {
    rail.addEventListener('click', onRailClick);
    // Keep the canvas as the focus owner; rails are touch shortcuts.
    rail.addEventListener('pointerdown', event => event.preventDefault());
    document.body.append(rail);
  }
}

export function syncCompactLens(next: Phaser.Game, compact: boolean) {
  game = next;
  if (compact === active) return;
  active = compact;
  if (compact) {
    syncRailWidth();
    mountRails();
    addEventListener('resize', onResize);
    next.events.on('poststep', step);
  } else {
    setOverview(false);
    removeEventListener('resize', onResize);
    next.events.off('poststep', step);
    railLeft?.remove(); railRight?.remove();
    railLeft = railRight = undefined;
    railSignature = '';
    document.documentElement.style.removeProperty('--compact-rail');
    for (const scene of lenses.keys()) {
      scene.cameras?.main?.setZoom(1).setScroll(0, 0);
    }
    lenses.clear();
    zoom = 1;
  }
  next.scale.refresh();
}

/** Test and debug view: where each scene's lens is looking. */
(window as unknown as { __birdSquadCompactLens?: () => unknown }).__birdSquadCompactLens = () => ({
  active, overview, zoom,
  cssPerUnit: game ? game.canvas.getBoundingClientRect().height / WORLD_H * zoom : 0,
  scenes: [...lenses.entries()].map(([scene, lens]) => ({
    key: scene.scene.key, frame: lens.key, manual: Boolean(lens.manual),
    settled: Boolean(lens.plan) && Math.abs(lens.cx - clamp((lens.manual ?? lens.plan!).x, WORLD_W / zoom / 2, WORLD_W - WORLD_W / zoom / 2)) < 0.5,
    view: { left: lens.cx - WORLD_W / zoom / 2, top: lens.cy - WORLD_H / zoom / 2, right: lens.cx + WORLD_W / zoom / 2, bottom: lens.cy + WORLD_H / zoom / 2 },
  })),
});
