import type { Page } from '@playwright/test';
import { settleCanvas } from './settled-canvas';
import { targetGeometry, targetGeometryIssues } from './target-geometry';

/**
 * Every main screen and state, reachable from a booted page by restarting one
 * scene and calling the same scene methods the controls call. The geometry
 * sweep visits each and checks the general layout rules, so screen-specific
 * tests no longer need to pin positions, widths or row counts.
 */
export const MENU_SURFACES = ['title', 'setup', 'guide', 'settings', 'settings-audio', 'settings-access',
  'settings-controls', 'storage-recovery'] as const;
export const PROFILE_SURFACES = ['profile', 'profile-folios'] as const;
export const CODEX_SURFACES = ['collection', 'card-dossier', 'items', 'leaders', 'enemies', 'glossary', 'supply-dossier',
  'waymark-dossier', 'leader-dossier', 'enemy-dossier', 'glossary-dossier', 'collection-empty', 'collection-tools',
  'collection-atlas', 'collection-saved'] as const;
export const ROUTE_SURFACES = ['route', 'route-tooltip', 'route-feedback', 'route-contract', 'route-notice', 'route-event',
  'route-pause', 'route-confirm-exit', 'route-flock', 'deck', 'waymarks', 'supplies', 'market-cards', 'market-waymarks',
  'market-supplies', 'market-services', 'market-sold', 'picker', 'picker-read'] as const;
// Outcome surfaces finish the flight, so they run last in their group.
export const COMBAT_SURFACES = ['combat', 'combat-selected', 'combat-targeting', 'combat-tooltip', 'combat-feedback',
  'combat-intro', 'combat-pile', 'combat-log', 'combat-supplies', 'combat-waymarks', 'combat-pause', 'return-choice', 'discard-choice', 'reward', 'reward-hover',
  'outcome', 'flight-details'] as const;

export type Surface = typeof MENU_SURFACES[number] | typeof PROFILE_SURFACES[number] | typeof CODEX_SURFACES[number]
  | typeof ROUTE_SURFACES[number] | typeof COMBAT_SURFACES[number];

export function surfaceScene(surface: string) {
  if ((MENU_SURFACES as readonly string[]).includes(surface)) return 'MenuScene';
  if ((PROFILE_SURFACES as readonly string[]).includes(surface)) return 'ProfileScene';
  if ((CODEX_SURFACES as readonly string[]).includes(surface)) return 'CodexScene';
  if ((ROUTE_SURFACES as readonly string[]).includes(surface)) return 'RouteScene';
  return 'BattleScene';
}

const ACCOUNT = JSON.stringify({ discoveredCards: ['major_00', 'wands_ace'],
  cardCollection: { major_00: { timesClaimed: 1 }, wands_ace: { timesClaimed: 1 } } });

/** Boot the title with a small discovered collection and reduced motion. */
export async function bootForSurfaces(page: Page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript((account) => {
    // Reset per page load so every menu surface starts from the same save.
    localStorage.clear();
    localStorage.setItem('birdsquad.account', account);
    localStorage.setItem('birdsquad.account.backup', account);
  }, ACCOUNT);
  await page.goto('./');
  await page.waitForFunction(() => JSON.parse((window as any).render_game_to_text?.() ?? '{}').titleBoot?.ready);
}

/** Show one surface on a freshly loaded page. Scenes keep instance state
 * across restarts, so every surface reloads instead (the build is cached, so a
 * reload costs about a second, far less than a separate test). */
export async function openSurface(page: Page, surface: Surface) {
  const scene = surfaceScene(surface);
  await bootForSurfaces(page);
  if (scene !== 'MenuScene') {
    await page.evaluate(async (name) => {
      const w = window as any;
      await w.__birdSquadEnsureScene(name);
      w.__birdSquadGame.scene.stop('MenuScene');
      w.__birdSquadGame.scene.start(name, name === 'BattleScene' ? { routeNodeId: 'm1_entry' } : {});
    }, scene);
    await page.waitForFunction((name) => {
      const s = (window as any).__birdSquadGame.scene.getScene(name);
      if (!s?.scene.isActive()) return false;
      if (name === 'RouteScene') return s.routeEssentialAssetsReady && s.cardHoverDetailModule;
      if (name === 'BattleScene') return s.battleHandRendererModule && s.hand.length && !s.combatIntroActive && !s.combatAnimationPending;
      if (name === 'CodexScene') return s.codexData;
      return s.children.list.length > 5;
    }, scene);
  }
  await page.evaluate(({ surface, scene }) => {
    const w = window as any, s = w.__birdSquadGame.scene.getScene(scene);
    const all = (list: any[]): any[] => list.flatMap((o: any) => [o, ...all(o.list ?? [])]);
    if (surface === 'setup') s.children.list.find((o: any) => o.getData?.('focus') === 'configure').emit('pointerdown');
    if (surface === 'guide') s.openHelpOverlay();
    if (surface.startsWith('settings')) s.openSettingsOverlay();
    if (surface === 'storage-recovery') {
      s.storageRecoveryNotice = { outcome: 'reset', scopes: ['Flock Record', 'flight checkpoint'],
        text: 'SAVE CHECK  Damaged Flock Record and flight checkpoint isolated; safe defaults are active.' };
      s.showStorageRecoveryNotice(s.menuGeneration);
    }
    if (surface === 'profile-folios') all(s.children.list).find((o: any) => o.name === 'profile-folios-tab-hit')?.emit('pointerdown');
    if (surface === 'card-dossier') s.openCodexDetail('major_00');
    if (['items', 'leaders', 'enemies', 'glossary'].includes(surface)) { s.activeSection = surface; s.renderAll(); }
    if (surface === 'collection-empty') { s.cardSearchQuery = 'no matching card here'; s.renderAll(); }
    if (surface === 'collection-tools') s.toggleCollectionTools();
    if (surface === 'collection-atlas') s.openCollectionAtlas();
    if (surface === 'collection-saved') s.openSavedCollectionViews();
    if (['supply-dossier', 'waymark-dossier'].includes(surface)) {
      s.activeSection = 'items'; s.openCodexDetail((surface === 'supply-dossier' ? s.allSupplies() : s.allWaymarks())[0].id, false);
    }
    if (surface === 'leader-dossier') { s.activeSection = 'leaders'; s.openCodexDetail(s.allLeaders()[0].id, false); }
    if (surface === 'enemy-dossier') { s.activeSection = 'enemies'; s.openCodexDetail(s.allCodexEnemies()[0].id, false); }
    if (surface === 'glossary-dossier') { s.activeSection = 'glossary'; s.openCodexDetail(s.glossaryTerms[0].term, false); }
    if (scene === 'RouteScene') {
      const nodes = w.__birdSquadCurrentMap().nodes;
      if (surface === 'route-contract') { s.runState.districtContracts.forEach((c: any) => c.confirmed = false); s.renderAll(); }
      else { s.runState.districtContracts.forEach((c: any) => c.confirmed = true); s.renderAll(); }
      if (surface === 'route-tooltip') s.showNodeTooltip(nodes.find((n: any) => n.type === 'boss'), 350, 180);
      if (surface === 'route-feedback') { s.supplyFeedback = [{ id: 'test', name: 'Trail snack', summary: 'Restore Cohesion', timing: 'route' }]; s.renderAll(); }
      if (surface === 'route-notice') { s.districtAdvanceNotice = { fromMapName: 'Rooftops', toMapName: 'Canal Quarter', toMapIndex: 1 }; s.renderAll(); }
      if (surface === 'route-event') {
        const node = nodes.find((n: any) => s.nodeChoiceList?.(n)?.length > 1 && !['boss', 'market', 'combat', 'elite'].includes(n.type));
        if (!node) throw new Error('No choice node on the opening route');
        s.openNodeChoices(node);
      }
      if (surface === 'route-pause') s.togglePauseOverlay();
      // The pause overlay's Abandon command hands over to the confirmation.
      if (surface === 'route-confirm-exit') { s.confirmExitOpen = true; s.renderAll(); }
      if (surface === 'route-flock') s.openFlockOverlay('stats');
      if (surface === 'deck') {
        // Enough cards to page the review list.
        const seed = s.runState.deck[0];
        while (s.runState.deck.length < 13) s.runState.deck.push({ ...seed });
        s.openDeckOverlay();
      }
      if (surface === 'waymarks') s.openWaymarkDrawer();
      if (surface === 'supplies') s.openSupplyDrawer();
      if (surface.startsWith('market-') || surface.startsWith('picker')) {
        s.runState.scrap = 999; s.openMarketNode({ ...nodes.find((n: any) => n.type !== 'boss'), type: 'market' });
        if (surface.startsWith('picker')) {
          s.openMarketCardPicker(s.marketUtilityShelf.findIndex((o: any) => o.id === 'preen'), 'preen');
          if (surface === 'picker-read') s.cardHoverDetailModule.openCardPickerInspection(s, 0);
        } else if (surface === 'market-sold') { s.marketCardShelf[0].sold = true; s.setMarketCategory('cards'); }
        else s.setMarketCategory(surface.slice(7));
      }
    }
    if (scene === 'BattleScene') {
      if (surface === 'combat-feedback') { s.supplyFeedback = [{ id: 'test', name: 'Trail snack', summary: 'Restore Cohesion', turn: s.turn - 1 }]; s.renderAll(); }
      if (surface === 'combat-intro') { s.introPlayed = false; s.playBattleIntro(); s.time.paused = true; }
      if (surface === 'combat-pile') {
        const seed = s.drawPile[0] ?? s.hand[0];
        while (s.drawPile.length < 13) s.drawPile.push({ ...seed, instanceId: `sweep-${s.drawPile.length}` });
        s.openOverlay('draw');
      }
      if (surface === 'combat-log') s.openCombatHistory();
      if (surface === 'combat-supplies') { s.runSupplies = ['mirror_shard']; s.toggleBattleSupplyDrawer(); }
      if (surface === 'combat-waymarks') s.toggleBattleWaymarks();
      if (surface === 'combat-pause') s.togglePauseOverlay();
      if (surface === 'return-choice') { s.discardPile = s.hand.splice(0, 3); s.beginReturnChoice('Recall', 'any', 0, () => {}); s.renderAll(); }
      if (surface === 'discard-choice') { s.runSupplies = ['mirror_shard']; s.useSupply(0); }
      if (surface === 'reward' || surface === 'reward-hover') { s.rewardChoices = s.createRewardChoices(); s.mode = 'cardReward'; s.renderAll(); }
      if (surface === 'outcome' || surface === 'flight-details') { s.retireCombatFxForOutcome(); s.mode = 'defeat'; s.emitRunSummary('loss'); s.renderAll(); }
      if (surface === 'combat-tooltip') s.buildTooltip('Cohesion', 'The flock stays together.', 350, 120);
      if (surface === 'combat-selected' || surface === 'combat-targeting') {
        // The hand card's click handler: a self-target card, or an
        // enemy-target card (which also marks its target); the confirm is live.
        const affordable = s.hand.filter((c: any) => s.effectiveCost(c) <= s.energy);
        const wantsEnemy = surface === 'combat-targeting';
        const card = affordable.find((c: any) => (s.activeCardContract(c).target === 'enemy') === wantsEnemy) ?? affordable[0];
        s.onCardClicked(card.instanceId);
      }
    }
  }, { surface, scene });
  await page.waitForFunction(({ surface, scene }) => {
    const s = (window as any).__birdSquadGame.scene.getScene(scene);
    if (s.load.isLoading()) return false;
    if (surface === 'storage-recovery') return !!s.children.getByName('storage-recovery-notice');
    if (surface === 'reward' || surface === 'reward-hover') return s.battleRewardRendererModule && s.root.getByName('reward-card-take-hit');
    if (surface === 'deck') return !!s.children.getByName('deck-review-detail-panel');
    if (surface === 'combat-pile') return !!s.root?.getByName('combat-pile-panel');
    if (surface === 'combat-selected' || surface === 'combat-targeting') return !!s.selectedInstanceId && !!s.root.getByName('combat-selection-preview');
    if (surface === 'outcome' || surface === 'flight-details') return s.bossDossierModule && s.root.getByName('run-outcome-command-hit');
    if (surface === 'guide') return s.helpOverlay?.active;
    if (surface.startsWith('settings')) return s.settingsOverlay?.active;
    return true;
  }, { surface, scene });
  const section = ['settings', 'settings-audio', 'settings-access', 'settings-controls'].indexOf(surface);
  if (section > 0) {
    await page.waitForFunction((n) => {
      const all = (list: any[]): any[] => list.flatMap((o: any) => [o, ...all(o.list ?? [])]);
      const hit = all((window as any).__birdSquadGame.scene.getScene('MenuScene').settingsOverlay?.list ?? [])
        .find((o: any) => o.name === `system-settings-section-${n}-hit` && o.input?.enabled);
      hit?.emit('pointerdown');
      return !!hit;
    }, section);
  }
  if (surface === 'flight-details') await page.evaluate(() => (window as any).__birdSquadGame.scene.getScene('BattleScene').openOutcomeFlightDetails());
  if (surface === 'reward-hover') await page.evaluate(() => { const s = (window as any).__birdSquadGame.scene.getScene('BattleScene'); s.showCardPreview(s.rewardChoices[0]); });
  await settleCanvas(page);
  return scene;
}

export type SurfaceText = { name: string; text: string; size: number; left: number; right: number; top: number; bottom: number;
  role?: string; tier?: string; panel?: { name: string; left: number; right: number; top: number; bottom: number };
  boxWidth: number; widest: number; lines: number };

/** Visible text with its CSS size and game-space bounds, clipped by any
 * opaque surface drawn after it (scroll curtains hide list overflow that way),
 * plus the panel it was laid out on: the nearest earlier quiet Rectangle or
 * NineSlice in the same container that holds its centre and most of it. */
export async function surfaceTexts(page: Page, scene: string): Promise<SurfaceText[]> {
  return page.evaluate((sceneKey) => {
    const s = (window as any).__birdSquadGame.scene.getScene(sceneKey), scale = s.game.canvas.getBoundingClientRect().height / 720;
    const box = (o: any) => { const b = o.getBounds(); return { left: b.left, right: b.right, top: b.top, bottom: b.bottom }; };
    const area = (r: any) => Math.max(0, r.right - r.left) * Math.max(0, r.bottom - r.top);
    const intersect = (a: any, b: any) => ({ left: Math.max(a.left, b.left), right: Math.min(a.right, b.right),
      top: Math.max(a.top, b.top), bottom: Math.min(a.bottom, b.bottom) });
    const surfaceLike = (p: any) => p.type === 'Rectangle' || p.type === 'NineSlice';
    // Draw order: each display list sorted by depth, containers drawn in place.
    const drawn: Array<{ o: any; list: any[]; index: number; opaque: boolean }> = [];
    const walk = (list: any[], alpha: number) => [...list].sort((a, b) => (a.depth ?? 0) - (b.depth ?? 0)).forEach((o: any) => {
      if (!o.visible || o.alpha === 0) return;
      const a = alpha * (o.alpha ?? 1);
      drawn.push({ o, list, index: list.indexOf(o), opaque: surfaceLike(o) && o.isFilled !== false && a * (o.fillAlpha ?? 1) >= 0.85 });
      if (o.list) walk(o.list, a);
    });
    walk(s.children.list, 1);
    const out: any[] = [];
    drawn.forEach(({ o, list, index }, order) => {
      if (o.type !== 'Text' || !o.text.trim()) return;
      const m = o.getWorldTransformMatrix();
      let b = box(o);
      // Clip by later opaque surfaces spanning the text's width (curtains above
      // or below a scrolled list) or its height (side curtains).
      // A curtain reaching the stage edge also hides whatever lies beyond it.
      const toEdge = (c: any) => ({ left: c.left <= 1 ? -1e6 : c.left, right: c.right >= 1279 ? 1e6 : c.right,
        top: c.top <= 1 ? -1e6 : c.top, bottom: c.bottom >= 719 ? 1e6 : c.bottom });
      for (const cover of drawn.slice(order + 1).filter((d) => d.opaque).map((d) => toEdge(box(d.o)))) {
        if (cover.left <= b.left && cover.right >= b.right) {
          if (cover.top <= b.top && cover.bottom > b.top) b = { ...b, top: Math.min(b.bottom, cover.bottom) };
          if (cover.bottom >= b.bottom && cover.top < b.bottom) b = { ...b, bottom: Math.max(b.top, cover.top) };
        }
        if (cover.top <= b.top && cover.bottom >= b.bottom) {
          if (cover.left <= b.left && cover.right > b.left) b = { ...b, left: Math.min(b.right, cover.right) };
          if (cover.right >= b.right && cover.left < b.right) b = { ...b, right: Math.max(b.left, cover.left) };
        }
      }
      if (area(b) < 1) return; // fully hidden
      const cx = (b.left + b.right) / 2, cy = (b.top + b.bottom) / 2;
      const panel = list.slice(0, index).reverse()
        .filter((p: any) => p.visible && p.alpha > 0 && p.fillAlpha !== 0 && surfaceLike(p))
        .map((p: any) => ({ name: p.name, ...box(p) }))
        .find((p: any) => p.left <= cx && cx <= p.right && p.top <= cy && cy <= p.bottom
          && p.right - p.left < 1270 && area(intersect(p, b)) >= 0.6 * area(b));
      // A wrapped or fixed-width box must hold its longest line.
      const boxWidth = o.style.fixedWidth || (o.style.wordWrapWidth ?? 0);
      const lines: string[] = o.getWrappedText ? o.getWrappedText(o.text) : o.text.split('\n');
      const widest = Math.max(...lines.map((line) => o.context.measureText(line).width / (o.resolution || 1)));
      out.push({ name: o.name, text: o.text, size: parseFloat(o.style.fontSize) * Math.hypot(m.c, m.d) * scale, ...b,
        role: o.getData('textRole'), tier: o.getData('faceTier'), panel, boxWidth, widest, lines: Math.max(1, lines.length) });
    });
    // Text parked entirely off stage is hidden, not clipped.
    return out.filter((t) => t.right > 0 && t.left < 1280 && t.bottom > 0 && t.top < 720);
  }, scene);
}


// Primary readouts that must meet the 16 CSS px floor even without a role tag.
const PRIMARY_NAMES = new Set(['codex-card-title', 'codex-entry-title', 'codex-tab-label', 'codex-card-cost-label', 'codex-card-detail-title',
  'codex-card-detail-paragraph', 'combat-tooltip-title', 'run-flight-details-section-body', 'run-flight-details-section-title',
  'run-defeat-review-headline', 'route-collection-goal-hit-label', 'hud-value-Cohesion', 'hud-value-Scrap', 'hud-value-Deck',
  'hud-value-Supplies', 'hud-value-Waymarks', 'combat-enemy-name', 'combat-enemy-hp-value',
  'card-picker-card-name', 'card-picker-price', 'run-outcome-stat-value', 'title-leader-description-body',
  'combat-focused-card-name', 'combat-supply-feedback-name', 'route-supply-feedback-name',
  'market-service-label', 'market-service-cost-value']);

/** General rules: text floors, nothing straddling the stage edge, text inside
 * its panel. Returns readable issue strings (empty when the surface passes). */
export function textIssues(texts: SurfaceText[]) {
  const issues: string[] = [];
  const label = (t: SurfaceText) => `${t.name || 'text'} "${t.text.replace(/\s+/g, ' ').slice(0, 40)}"`;
  // Dense card faces keep every effect visible: their rules may use a 15-17px
  // face tier (>= 11.5 CSS px at 1000x560) instead of hiding a clause.
  const denseFace = (t: SurfaceText) => /-1[5-7](@|$)|overflow/.test(t.tier ?? '') && t.size >= 11.5;
  for (const t of texts) {
    if (t.size < 14 - 0.01 && !denseFace(t)) issues.push(`secondary text floor: ${label(t)} ${t.size.toFixed(1)} CSS px`);
    else if ((t.role === 'primary' || (PRIMARY_NAMES.has(t.name) && t.role !== 'secondary')) && t.size < 16 - 0.01) {
      issues.push(`primary text floor: ${label(t)} ${t.size.toFixed(1)} CSS px`);
    }
    if (t.left < -1 || t.right > 1281 || t.top < -1 || t.bottom > 721) issues.push(`text off stage: ${label(t)}`);
    // A single line may sit on a thinner plate or bar (its glyph box carries
    // leading); spilling by more than ~40% of a line means a wrapped row or
    // a long string escaped the panel.
    const p = t.panel, slack = Math.max(2, 0.4 * (t.bottom - t.top) / t.lines);
    if (p && (t.left < p.left - 2 || t.right > p.right + 2 || t.top < p.top - slack || t.bottom > p.bottom + slack)) {
      issues.push(`text overflows panel ${p.name || 'unnamed'}: ${label(t)}`);
    }
    if (t.boxWidth && t.widest > t.boxWidth + 2) issues.push(`text wider than its box: ${label(t)} ${Math.round(t.widest)} > ${t.boxWidth}`);
  }
  return issues;
}

/** All general rules for the surface currently showing. */
export async function surfaceIssues(page: Page, scene: string) {
  const texts = await surfaceTexts(page, scene);
  const targets = await targetGeometry(page, scene);
  const issues = [...textIssues(texts), ...targetGeometryIssues(targets)];
  if (!texts.length) issues.push('no visible text');
  return { issues, texts, targets };
}
