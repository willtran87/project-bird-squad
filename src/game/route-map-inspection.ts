import type Phaser from 'phaser';
import { bindControlActions, controlActionForCode, controlBindingLabel } from './input-bindings';
import { bindChoiceHint } from './choice-input-hints';
import { quietButton } from './quiet-ui';
import { fitTextExcerpt } from './text-excerpt';
import { UI_TYPE, UI_FONT, DECISION_UI } from './theme';
import type { RouteNode, RouteNodeType, RuntimeRouteMap } from './types';

interface InspectedStop { id: string; type: string; title: string; status: string; benefit: string; risk: string }

// Narrow bridge to RouteScene's existing modal owner; no gameplay actions are exposed.
interface RouteInspectionHost extends Phaser.Scene {
  runState: { currentRouteNodeId?: string; completedRouteNodeIds: string[] };
  selectableNodeIds: Set<string>;
  mapInspectionNodeId?: string;
  mapInspectionPage: number;
  flockOverlayOpen: boolean;
  flockOverlayMode: string;
  pauseOverlayOpen: boolean;
  settingsOverlayOpen: boolean;
  confirmExitOpen: boolean;
  nodeDetail: (node: RouteNode) => { title: string };
  nodeDecisionSummary: (node: RouteNode) => { benefit: string; risk: string };
  closeFlockOverlay: () => void;
  renderRouteNodeTypeIcon: (type: RouteNodeType, x: number, y: number, size: number) => Phaser.GameObjects.GameObject;
}

/** Keep reader-only adaptation out of the title's boot bundle. */
export function renderRouteMapInspection(scene: Phaser.Scene, map: RuntimeRouteMap, typeLabel: (type: RouteNodeType) => string) {
  const route = scene as RouteInspectionHost;
  return renderMapInspection({
    scene,
    nodes: map.nodes.map(node => ({
      id: node.id, type: typeLabel(node.type), title: route.nodeDetail(node).title,
      status: node.id === route.runState.currentRouteNodeId ? 'Current stop'
        : route.runState.completedRouteNodeIds.includes(node.id) ? 'Completed'
        : route.selectableNodeIds.has(node.id) ? 'Available now' : 'Not currently reachable',
      ...route.nodeDecisionSummary(node),
    })),
    nodeId: route.mapInspectionNodeId, page: route.mapInspectionPage,
    onChange: (id, page) => { route.mapInspectionNodeId = id; route.mapInspectionPage = page; },
    onClose: () => route.closeFlockOverlay(),
    ownsInput: () => route.flockOverlayOpen && route.flockOverlayMode === 'map' && !route.pauseOverlayOpen && !route.settingsOverlayOpen && !route.confirmExitOpen,
    renderIcon: (id, x, y) => route.renderRouteNodeTypeIcon(map.nodes.find(node => node.id === id)!.type, x, y, 56),
  });
}

/** Uses the existing Flock modal ownership. It has no selection or travel callback. */
export function renderMapInspection(context: {
  scene: Phaser.Scene; nodes: InspectedStop[]; nodeId?: string; page: number;
  onChange: (id: string, page: number) => void; onClose: () => void; ownsInput: () => boolean;
  renderIcon: (id: string, x: number, y: number) => Phaser.GameObjects.GameObject;
}) {
  const { scene, nodes, ownsInput } = context;
  const root = scene.add.container(0, 0).setName('flock-stats-reader');
  root.add(scene.add.rectangle(640, 360, 1280, 720, 0x020409, 0.94).setInteractive());
  root.add(scene.add.rectangle(640, 360, 1040, 640, DECISION_UI.surface, 1)
    .setStrokeStyle(1, DECISION_UI.border, 1).setName('map-inspection-panel'));
  const text = (x: number, y: number, value: string, width: number, size: number = UI_TYPE.primary) => {
    const label = scene.add.text(x, y, value, { fontFamily: UI_FONT, fontSize: size, color: DECISION_UI.text,
      resolution: UI_TYPE.resolution, wordWrap: { width, useAdvancedWrap: true }, lineSpacing: 3 });
    root.add(label); return label;
  };
  text(156, 64, 'MAP INSPECTION · READ ONLY', 780, UI_TYPE.secondary).setColor(DECISION_UI.secondary);
  const heading = text(156, 104, '', 760, 30).setName('map-inspection-title');
  const status = text(156, 194, '', 820).setName('map-inspection-status');
  const body = text(156, 246, '', 920).setName('map-inspection-body');
  const counter = text(640, 554, '', 920, UI_TYPE.secondary).setOrigin(0.5).setName('map-inspection-counter');
  const hint = text(156, 650, '', 960, UI_TYPE.secondary).setColor(DECISION_UI.secondary);
  const button = (x: number, y: number, width: number, label: string, name: string, action: () => void) => {
    const hit = quietButton(scene, { x, y, width, label, name, kind: 'secondary',
      onActivate: () => { if (root.active && ownsInput()) action(); } });
    root.add([hit, hit.getData('labelObject')]); return hit;
  };
  button(1060, 94, 140, 'Back', 'map-inspection-close', context.onClose);
  button(290, 606, 268, 'Previous stop', 'map-inspection-previous', () => turn(-1));
  button(990, 606, 268, 'Next stop', 'map-inspection-next', () => turn(1));
  const more = button(640, 606, 268, 'More details', 'map-inspection-more', () => show(index, page + 1));
  let index = Math.max(0, nodes.findIndex(node => node.id === context.nodeId));
  let page = context.page, icon: Phaser.GameObjects.GameObject | undefined;
  let pages: string[] = [];
  bindChoiceHint(scene, hint, mode => mode === 'controller'
    ? 'D-pad: stops · Y: more details · B: back · No travel or spending.'
    : mode === 'pointer' ? 'Inspect any stop. Close to return to your unchanged route selection.'
    : `${controlBindingLabel('previous')}/${controlBindingLabel('next')}: stops · ${controlBindingLabel('roost')}: details · ${controlBindingLabel('back')}: back`);
  const show = (nextIndex: number, nextPage = 0) => {
    index = (nextIndex + nodes.length) % nodes.length;
    const node = nodes[index];
    if (!node) return;
    fitTextExcerpt(heading, node.title, 2);
    status.setText(node.title === node.type ? node.status : `${node.type} · ${node.status}`);
    const fullText = `${heading.getData('truncated') ? node.title + '\n\n' : ''}GAIN\n${node.benefit}\n\nRISK\n${node.risk}`;
    const lines = body.getWrappedText(fullText);
    pages = []; let pageLines: string[] = [];
    for (const line of lines) {
      body.setText([...pageLines, line].join('\n'));
      if (body.getBounds().bottom > 526 && pageLines.length) {
        pages.push(pageLines.join('\n')); pageLines = [];
      }
      pageLines.push(line);
    }
    if (pageLines.length) pages.push(pageLines.join('\n'));
    page = ((nextPage % pages.length) + pages.length) % pages.length;
    body.setText(pages[page]);
    counter.setText(`Stop ${index + 1} of ${nodes.length}${pages.length > 1 ? ` · Details ${page + 1} of ${pages.length}` : ''}`);
    more.setVisible(pages.length > 1); more.input!.enabled = pages.length > 1;
    more.getData('labelObject').setVisible(pages.length > 1);
    icon?.destroy(); icon = context.renderIcon(node.id, 1080, 196); root.add(icon);
    context.onChange(node.id, page);
    root.setData('mapInspection', { ...node, index, count: nodes.length, page, pages: pages.length, text: body.text });
    root.setData('summary', `Map inspection. ${node.title}. ${node.type}. ${node.status}. ${body.text}. ${counter.text}. ${hint.text}`);
  };
  const turn = (direction: number, event?: KeyboardEvent) => {
    if (root.active && ownsInput() && !event?.repeat) show(index + direction);
  };
  const unbind = bindControlActions(scene, {
    previous: event => turn(-1, event), next: event => turn(1, event),
    roost: event => { if (root.active && ownsInput() && !event?.repeat) show(index, page + 1); },
  });
  const keyboard = (event: KeyboardEvent) => {
    if (!root.active || !ownsInput() || event.repeat || controlActionForCode(event.code)) return;
    if (!['Tab', 'ArrowUp', 'ArrowDown'].includes(event.code)) return;
    event.preventDefault(); turn(event.code === 'ArrowUp' || event.shiftKey ? -1 : 1);
  };
  const pad = (_pad: unknown, button: { index?: number }) => {
    if (!root.active || !ownsInput()) return;
    if ([12, 14].includes(button.index ?? -1)) turn(-1);
    if ([13, 15].includes(button.index ?? -1)) turn(1);
    if (button.index === 3) show(index, page + 1);
  };
  scene.input.keyboard?.on('keydown', keyboard);
  scene.input.gamepad?.on('down', pad);
  root.once('destroy', () => {
    unbind(); scene.input.keyboard?.off('keydown', keyboard); scene.input.gamepad?.off('down', pad);
  });
  show(index, page);
  return root;
}
