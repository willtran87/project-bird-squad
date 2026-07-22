import Phaser from 'phaser';
import { MIN_SUPPORTED_TOUCH_TARGET } from './theme';
import {
  activateRenderedAudioToggleControl, addCodexDossierFrame, addCodexEntryFrame, addSupplyArtImage,
  addUiIconImage, addWaymarkArtImage,
  advanceGameTime, alphaEnemyLibrary, alphaRouteMarkLibrary, alphaRouteMarkSet, alphaSupplyLibrary,
  bindControlActions, birdAudio, cardArtAssets, cardCompactArtAsset, cardLabel, cardLibrary, clamp,
  codexIconForLabel, codexLeaderArtAssets, codexUiIconIds, compactCardArtKey, compactEffectSummary,
  controlActionForCode, controlBindingLabel,
  countTextureInGameObjects, displayName, enemyArtAssets, enemyCodexIconForLabel, flockLeaders,
  GAME_HEIGHT, GAME_WIDTH, getLeader, hideKwTooltip, isAviaryCard, isLeaderUnlocked, isSnagCard,
  itemTypeCodexIconForLabel, KEYWORDS, killTweensForTree, LAZY_LOAD_FAILED, leaderUnlockHints,
  loadAccount, loadBossDossierModule, loadedCardArtKey, playUiSound, queueReserveEnemyArtAssets,
  queueRuntimeImageAssets, queueUiIconAssets, renderAudioToggleControl, renderRichText,
  renderSnagCardBorder, reserveEnemyArtAsset, routeMarkEffectGrammar, routeMarkEffectText,
  showKwTooltip, suitAccentColor, supplyArtAssets, supplyCodexIconForLabel, supplyCompactArtAssets,
  supplySynergyTags, UI_BODY, UI_BOLD, UI_CYAN, UI_FIELD, UI_FONT, UI_GOLD, UI_MUTED, UI_SOFT,
  uiIconAssets, waymarkArtAssets, waymarkCodexIconForLabel, waymarkCompactArtAssets, waymarkGlyph,
  waymarkSynergyTags,
  type BossDossierModule, type Card, type CodexDataModule, type CodexEnemyEntry,
  type CodexEnemySource, type CodexGlossaryTerm, type CodexItemEntry, type CodexItemTab,
  type CodexSection, type ReserveEnemyContract, type RuntimeEnemy, type RuntimeImageAsset,
  type RuntimeRouteMark, type RuntimeSupply, type TextureVisibleBounds, type UiIconId,
} from '../main';

type CodexFocusZone = 'sections' | 'primaryTabs' | 'secondaryTabs' | 'entries' | 'back' | 'detail';

interface CodexFocusEntry {
  id: string;
  label: string;
  canOpen: boolean;
}

interface CodexFocusGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
}

export class CodexScene extends Phaser.Scene {
  private root!: Phaser.GameObjects.Container;
  private activeSection: CodexSection = 'cards';
  private activeTab = 0;
  private activeEnemyTab = 0;
  private activeItemTypeTab = 0;
  private activeItemFilterTab = 0;
  private discovered = new Set<string>();
  private observedEnemyMoves = new Set<string>();
  private detailId?: string;
  private detailScroll = 0;
  private detailMaxScroll = 0;
  private detailScrollTarget = 0;
  private gridScroll = 0;
  private gridMaxScroll = 0;
  private gridScrollTarget = 0;
  private gridLayer?: Phaser.GameObjects.Container;
  private gridRenderScroll = 0;
  private gridRenderCellH = 0;
  private lastScrollRenderAt = 0;
  private codexData?: CodexDataModule;
  private codexBossDossierModule?: BossDossierModule;
  private codexDataLoad?: Promise<void>;
  private codexDataFailed = false;
  private activationId = 0;
  private textureBoundsCache = new Map<string, TextureVisibleBounds>();
  private focusZone: CodexFocusZone = 'sections';
  private entryFocusIndex = 0;
  private focusRing?: Phaser.GameObjects.Rectangle;
  private detailClosePoint?: { x: number; y: number };
  private static readonly GRID_TOP = 158;
  private static readonly ITEM_GRID_TOP = 190;
  private static readonly GRID_BOTTOM = 690;
  private readonly tabs: Array<{ label: string; match: (c: Card) => boolean }> = [
    { label: 'Major', match: (c) => c.id.startsWith('major_') },
    { label: 'Aviary', match: (c) => c.id.startsWith('aviary_') },
    { label: 'Plumes', match: (c) => c.runtime.suit === 'plumes' },
    { label: 'Quills', match: (c) => c.runtime.suit === 'quills' },
    { label: 'Basins', match: (c) => c.runtime.suit === 'basins' },
    { label: 'Nests', match: (c) => c.runtime.suit === 'nests' },
    { label: 'Snags', match: (c) => c.runtime.kind === 'snag' },
  ];
  private readonly enemyTabs: Array<{ label: string; match: (e: CodexEnemyEntry) => boolean }> = [
    { label: 'All', match: () => true },
    { label: 'Rooftops', match: (e) => e.district === 'Rooftop Blocks' },
    { label: 'Canals', match: (e) => e.district === 'Canal Markets' },
    { label: 'Signals', match: (e) => e.district === 'Signal Spires' },
    { label: 'Roost', match: (e) => e.district === 'High Roost' },
  ];
  private readonly itemTypeTabs: CodexItemTab[] = [
    { label: 'All', match: () => true },
    { label: 'Waymarks', match: (item) => item.kind === 'waymark' },
    { label: 'Supplies', match: (item) => item.kind === 'supply' },
  ];
  private readonly waymarkFilterTabs: CodexItemTab[] = [
    { label: 'All', match: (item) => item.kind === 'waymark' },
    { label: 'Shelter', match: (item) => item.kind === 'waymark' && item.mark.family === 'safety' },
    { label: 'Tempo', match: (item) => item.kind === 'waymark' && item.mark.family === 'route' },
    { label: 'Economy', match: (item) => item.kind === 'waymark' && item.mark.family === 'economy' },
    { label: 'Suit', match: (item) => item.kind === 'waymark' && item.mark.family === 'suit' },
    { label: 'Molt', match: (item) => item.kind === 'waymark' && item.mark.family === 'molt' },
    { label: 'Boss', match: (item) => item.kind === 'waymark' && item.mark.family === 'bossPrep' },
  ];
  private readonly supplyFilterTabs: CodexItemTab[] = [
    { label: 'All', match: (item) => item.kind === 'supply' },
    { label: 'Combat', match: (item) => item.kind === 'supply' && item.supply.timing === 'combat' },
    { label: 'Route', match: (item) => item.kind === 'supply' && item.supply.timing === 'route' },
    { label: 'Flexible', match: (item) => item.kind === 'supply' && item.supply.timing === 'either' },
    { label: 'Defense', match: (item) => item.kind === 'supply' && (['coverNow', 'openSkySafety', 'cleanseNow'] as RuntimeSupply['answerType'][]).includes(item.supply.answerType) },
    { label: 'Recovery', match: (item) => item.kind === 'supply' && (['healNow', 'cleanseNow'] as RuntimeSupply['answerType'][]).includes(item.supply.answerType) },
    { label: 'Momentum', match: (item) => item.kind === 'supply' && (['drawNow', 'wingbeatNow', 'handFix', 'moltNow'] as RuntimeSupply['answerType'][]).includes(item.supply.answerType) },
    { label: 'Pressure', match: (item) => item.kind === 'supply' && (['damageNow', 'antiCover', 'burstNow'] as RuntimeSupply['answerType'][]).includes(item.supply.answerType) },
    { label: 'Plan', match: (item) => item.kind === 'supply' && item.supply.answerType === 'tellControl' },
  ];
  private readonly sections: Array<{ id: CodexSection; label: string }> = [
    { id: 'cards', label: 'Cards' },
    { id: 'items', label: 'Items' },
    { id: 'leaders', label: 'Leaders' },
    { id: 'enemies', label: 'Enemies' },
    { id: 'glossary', label: 'Glossary' },
  ];
  private get glossaryTerms(): CodexGlossaryTerm[] {
    return this.codexData?.codexGlossaryTerms ?? [];
  }

  constructor() {
    super('CodexScene');
  }

  init() {
    this.activationId += 1;
  }

  get activeItemTab() {
    if (this.activeItemTypeTab === 2) return 1;
    if (this.activeItemTypeTab === 1) return 2;
    return 0;
  }

  set activeItemTab(value: number) {
    // Legacy smoke/debug hook: old tab indexes were 1 = Supplies, 2 = Waymarks.
    this.activeItemTypeTab = value === 1 ? 2 : value === 2 ? 1 : 0;
    this.activeItemFilterTab = 0;
  }

  create() {
    birdAudio.setMood('menu');
    this.cameras.main.fadeIn(180);
    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'splash').setDisplaySize(GAME_WIDTH, GAME_HEIGHT).setAlpha(0.32);
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x05070c, 0.82);
    this.root = this.add.container(0, 0);
    const account = loadAccount();
    this.discovered = new Set(account.discoveredCards);
    this.observedEnemyMoves = new Set(account.observedEnemyMoves);
    void this.ensureCodexData();
    queueUiIconAssets(this, codexUiIconIds, 'Codex UI', () => this.renderAll());
    this.queueArt();
    this.renderAll();
    bindControlActions(this, {
      confirm: () => this.activateCodexFocus(),
      previous: () => this.moveCodexHorizontal(-1),
      next: () => this.moveCodexHorizontal(1),
      back: () => this.handleCodexBack(),
      mute: () => {
        if (!activateRenderedAudioToggleControl(this)) birdAudio.toggleMute();
      },
      fullscreen: () => this.scale.toggleFullscreen(),
    });
    const onTab = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();
      this.cycleCodexFocusZone(event.shiftKey ? -1 : 1);
    };
    const onUp = (event?: KeyboardEvent) => {
      if (event?.code && controlActionForCode(event.code)) return;
      this.moveCodexVertical(-1);
    };
    const onDown = (event?: KeyboardEvent) => {
      if (event?.code && controlActionForCode(event.code)) return;
      this.moveCodexVertical(1);
    };
    const onGamepadDown = (_pad: Phaser.Input.Gamepad.Gamepad, button: Phaser.Input.Gamepad.Button) => {
      if (button.index === 12) this.moveCodexVertical(-1);
      else if (button.index === 13) this.moveCodexVertical(1);
      else if (button.index === 14) this.moveCodexHorizontal(-1);
      else if (button.index === 15) this.moveCodexHorizontal(1);
      else if (button.index === 0) this.activateCodexFocus();
      else if (button.index === 1) this.handleCodexBack();
    };
    this.input.keyboard?.on('keydown-TAB', onTab);
    this.input.keyboard?.on('keydown-UP', onUp);
    this.input.keyboard?.on('keydown-DOWN', onDown);
    this.input.gamepad?.on('down', onGamepadDown);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.off('keydown-TAB', onTab);
      this.input.keyboard?.off('keydown-UP', onUp);
      this.input.keyboard?.off('keydown-DOWN', onDown);
      this.input.gamepad?.off('down', onGamepadDown);
    });
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => {
      if (this.detailId) {
        if (this.detailMaxScroll <= 0) return;
        this.detailScrollTarget = clamp(
          this.detailScrollTarget + this.normalizedWheelDelta(dy),
          0,
          this.detailMaxScroll
        );
        return;
      }
      if (this.gridMaxScroll <= 0) return;
      this.gridScrollTarget = clamp(
        this.gridScrollTarget + this.normalizedWheelDelta(dy),
        0,
        this.gridMaxScroll
      );
    });
  }

  update(time: number, delta: number) {
    if (this.detailId) {
      this.updateDetailScroll(time, delta);
      return;
    }
    this.updateGridScroll(delta);
  }

  private updateDetailScroll(time: number, delta: number) {
    if (this.detailMaxScroll <= 0) return;
    const target = clamp(this.detailScrollTarget, 0, this.detailMaxScroll);
    const distance = target - this.detailScroll;
    if (Math.abs(distance) < 0.1) return;

    const ease = 1 - Math.pow(0.0015, Math.min(delta, 50) / 180);
    const next = Math.abs(distance) < 0.75 ? target : this.detailScroll + distance * ease;
    this.detailScroll = clamp(next, 0, this.detailMaxScroll);
    if (time - this.lastScrollRenderAt >= 16 || next === target) {
      this.lastScrollRenderAt = time;
      this.renderAll();
    }
  }

  private updateGridScroll(delta: number) {
    if (this.gridMaxScroll <= 0) return;
    const target = clamp(this.gridScrollTarget, 0, this.gridMaxScroll);
    const distance = target - this.gridScroll;
    if (Math.abs(distance) < 0.1) return;

    const ease = 1 - Math.pow(0.0015, Math.min(delta, 50) / 180);
    const next = Math.abs(distance) < 0.75 ? target : this.gridScroll + distance * ease;
    this.gridScroll = clamp(next, 0, this.gridMaxScroll);
    if (this.gridLayer?.active) {
      this.gridLayer.y = -this.gridScroll;
    }

    const drift = Math.abs(this.gridScroll - this.gridRenderScroll);
    const rerenderDistance = Math.max(128, this.gridRenderCellH * 1.5);
    if (drift >= rerenderDistance || (next === target && drift > 1)) {
      this.renderAll();
    }
  }

  private normalizedWheelDelta(dy: number) {
    if (!Number.isFinite(dy) || dy === 0) return 0;
    const magnitude = clamp(Math.abs(dy) * 0.78, 4, 128);
    return Math.sign(dy) * magnitude;
  }

  private resetCodexScroll() {
    this.detailScroll = 0;
    this.detailScrollTarget = 0;
    this.gridScroll = 0;
    this.gridScrollTarget = 0;
  }

  private openCodexDetail(id: string, sound = true) {
    const entryIndex = this.codexFocusEntries().findIndex((entry) => entry.id === id);
    if (entryIndex >= 0) this.entryFocusIndex = entryIndex;
    this.detailId = id;
    this.focusZone = 'detail';
    this.detailScroll = 0;
    this.detailScrollTarget = 0;
    if (sound) playUiSound('confirm');
    this.renderAll();
  }

  private closeCodexDetail(sound = true) {
    this.detailId = undefined;
    this.focusZone = 'entries';
    this.detailScroll = 0;
    this.detailScrollTarget = 0;
    this.ensureFocusedEntryVisible();
    if (sound) playUiSound('close');
    this.renderAll();
  }

  private allCards(): Card[] {
    return Object.values(cardLibrary);
  }

  private allReserveEnemies(): CodexEnemyEntry[] {
    return (this.codexData?.reserveEnemyContracts ?? [])
      .filter((enemy) => !alphaEnemyLibrary.has(enemy.id))
      .map((enemy) => this.reserveEnemyEntry(enemy));
  }

  private allEncounterEnemies(): CodexEnemyEntry[] {
    return [...alphaEnemyLibrary.values()].map((enemy) => this.runtimeEnemyEntry(enemy));
  }

  private allCodexEnemies(): CodexEnemyEntry[] {
    const entries = this.allEncounterEnemies();
    const seen = new Set(entries.map((enemy) => enemy.id));
    this.allReserveEnemies().forEach((enemy) => {
      if (!seen.has(enemy.id)) entries.push(enemy);
    });
    return entries;
  }

  private allLeaders() {
    return [...flockLeaders];
  }

  private currentCodexEnemies(): CodexEnemyEntry[] {
    const sourceOrder: Record<CodexEnemySource, number> = { encounter: 0, reserve: 1 };
    return this.allCodexEnemies()
      .filter(this.enemyTabs[this.activeEnemyTab].match)
      .sort((a, b) => (
        a.district.localeCompare(b.district)
        || sourceOrder[a.source] - sourceOrder[b.source]
        || a.name.localeCompare(b.name)
      ));
  }

  private reserveEnemyEntry(enemy: ReserveEnemyContract): CodexEnemyEntry {
    return {
      ...enemy,
      moveKit: enemy.moveKit.map((text) => ({ text })),
      source: 'reserve',
    };
  }

  private runtimeEnemyEntry(enemy: RuntimeEnemy): CodexEnemyEntry {
    const typeLabel = this.runtimeEnemyTypeLabel(enemy);
    return {
      id: enemy.id,
      name: enemy.name,
      species: 'Encounter cast',
      district: this.runtimeEnemyDistrict(enemy.id),
      role: `${typeLabel} / ${enemy.health} HP`,
      typeHint: typeLabel,
      varietyContribution: enemy.lesson ?? `${typeLabel} enemy from the playable encounter roster.`,
      description: enemy.description,
      visualBrief: enemy.visualBrief,
      silhouette: enemy.silhouette,
      artPose: enemy.artPose,
      moveKit: enemy.moves.map((move) => ({ id: move.id, text: `${move.label}: ${compactEffectSummary(move.effects, 132, 3)}` })),
      source: 'encounter',
      health: enemy.health,
    };
  }

  private runtimeEnemyDistrict(enemyId: string) {
    if (enemyId.startsWith('canal_')) return 'Canal Markets';
    if (enemyId.startsWith('spire_')) return 'Signal Spires';
    if (enemyId.startsWith('roost_')) return 'High Roost';
    return 'Rooftop Blocks';
  }

  private runtimeEnemyTypeLabel(enemy: RuntimeEnemy) {
    switch (enemy.type) {
      case 'boss': return 'Boss';
      case 'elite': return 'Elite';
      case 'rival': return 'Rival';
      default: return 'Encounter';
    }
  }

  private allWaymarks(): RuntimeRouteMark[] {
    return [...alphaRouteMarkSet.routeMarks];
  }

  private allSupplies(): RuntimeSupply[] {
    return [...alphaSupplyLibrary.values()];
  }

  private allCodexItems(): CodexItemEntry[] {
    return [
      ...this.allWaymarks().map((mark) => ({ kind: 'waymark' as const, id: mark.id, mark })),
      ...this.allSupplies().map((supply) => ({ kind: 'supply' as const, id: supply.id, supply })),
    ];
  }

  private currentGridTop() {
    return this.activeSection === 'items' ? CodexScene.ITEM_GRID_TOP : CodexScene.GRID_TOP;
  }

  private activeItemTypeDef() {
    return this.itemTypeTabs[this.activeItemTypeTab] ?? this.itemTypeTabs[0];
  }

  private currentItemFilterTabs(): CodexItemTab[] {
    const type = this.itemTypeTabs[this.activeItemTypeTab]?.label;
    if (type === 'Waymarks') return this.waymarkFilterTabs;
    if (type === 'Supplies') return this.supplyFilterTabs;
    return [];
  }

  private activeItemFilterDef() {
    const tabs = this.currentItemFilterTabs();
    return tabs[this.activeItemFilterTab] ?? tabs[0];
  }

  private normalizeItemTabs() {
    this.activeItemTypeTab = clamp(this.activeItemTypeTab, 0, this.itemTypeTabs.length - 1);
    const filters = this.currentItemFilterTabs();
    this.activeItemFilterTab = filters.length > 0 ? clamp(this.activeItemFilterTab, 0, filters.length - 1) : 0;
  }

  private currentCodexItems(): CodexItemEntry[] {
    const rarityOrder: Record<string, number> = { common: 0, uncommon: 1, rare: 2, boss: 3 };
    const kindOrder: Record<CodexItemEntry['kind'], number> = { supply: 0, waymark: 1 };
    const itemName = (item: CodexItemEntry) => item.kind === 'waymark' ? item.mark.name : item.supply.name;
    const itemRarity = (item: CodexItemEntry) => item.kind === 'waymark' ? item.mark.rarity : item.supply.rarity;
    const itemType = this.activeItemTypeDef();
    const itemFilter = this.activeItemFilterDef();
    return this.allCodexItems()
      .filter((item) => itemType.match(item) && (!itemFilter || itemFilter.match(item)))
      .sort((a, b) => (
        kindOrder[a.kind] - kindOrder[b.kind]
        || (rarityOrder[itemRarity(a)] ?? 9) - (rarityOrder[itemRarity(b)] ?? 9)
        || itemName(a).localeCompare(itemName(b))
      ));
  }

  private codexFocusEntries(): CodexFocusEntry[] {
    if (this.activeSection === 'cards') {
      const family = this.tabs[this.activeTab]?.label ?? 'Card';
      return this.allCards()
        .filter(this.tabs[this.activeTab]?.match ?? (() => true))
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((card, index) => ({
          id: card.id,
          label: this.discovered.has(card.id) ? displayName(card) : `Undiscovered ${family} card ${index + 1}`,
          canOpen: this.discovered.has(card.id),
        }));
    }
    if (this.activeSection === 'items') {
      return this.currentCodexItems().map((item) => ({
        id: item.id,
        label: item.kind === 'waymark' ? item.mark.name : item.supply.name,
        canOpen: true,
      }));
    }
    if (this.activeSection === 'leaders') {
      return this.allLeaders().map((leader) => ({ id: leader.id, label: leader.name, canOpen: true }));
    }
    if (this.activeSection === 'enemies') {
      return this.currentCodexEnemies().map((enemy) => ({ id: enemy.id, label: enemy.name, canOpen: true }));
    }
    return this.glossaryTerms.map((term) => ({ id: term.term, label: `${term.term}. ${term.summary}`, canOpen: false }));
  }

  private codexFocusZones(): CodexFocusZone[] {
    if (this.detailId) return ['detail'];
    const zones: CodexFocusZone[] = ['sections'];
    if (this.activeSection === 'cards' || this.activeSection === 'items' || this.activeSection === 'enemies') {
      zones.push('primaryTabs');
    }
    if (this.activeSection === 'items' && this.currentItemFilterTabs().length > 0) zones.push('secondaryTabs');
    if (this.codexFocusEntries().length > 0) zones.push('entries');
    zones.push('back');
    return zones;
  }

  private normalizeCodexFocus() {
    if (this.activeSection === 'items') this.normalizeItemTabs();
    if (this.detailId) {
      this.focusZone = 'detail';
      return;
    }
    if (this.focusZone === 'detail') this.focusZone = 'entries';
    const zones = this.codexFocusZones();
    if (!zones.includes(this.focusZone)) this.focusZone = zones[0];
    const entries = this.codexFocusEntries();
    this.entryFocusIndex = entries.length > 0
      ? clamp(Math.round(this.entryFocusIndex), 0, entries.length - 1)
      : 0;
  }

  private primaryTabLabels(): string[] {
    if (this.activeSection === 'cards') return this.tabs.map((tab) => tab.label);
    if (this.activeSection === 'items') return this.itemTypeTabs.map((tab) => tab.label);
    if (this.activeSection === 'enemies') return this.enemyTabs.map((tab) => tab.label);
    return [];
  }

  private activePrimaryTabIndex(): number {
    if (this.activeSection === 'cards') return this.activeTab;
    if (this.activeSection === 'items') return this.activeItemTypeTab;
    if (this.activeSection === 'enemies') return this.activeEnemyTab;
    return 0;
  }

  private detailFocusLabel() {
    if (!this.detailId) return 'Detail';
    const entry = this.codexFocusEntries().find((candidate) => candidate.id === this.detailId);
    if (entry) return `Close ${entry.label} detail`;
    if (cardLibrary[this.detailId]) return `Close ${displayName(cardLibrary[this.detailId])} detail`;
    if (alphaRouteMarkLibrary.has(this.detailId)) return `Close ${alphaRouteMarkLibrary.get(this.detailId)?.name ?? 'Waymark'} detail`;
    if (alphaSupplyLibrary.has(this.detailId)) return `Close ${alphaSupplyLibrary.get(this.detailId)?.name ?? 'Supply'} detail`;
    const leader = flockLeaders.find((candidate) => candidate.id === this.detailId);
    if (leader) return `Close ${leader.name} detail`;
    const enemy = this.allCodexEnemies().find((candidate) => candidate.id === this.detailId);
    return `Close ${enemy?.name ?? 'Codex'} detail`;
  }

  private codexFocusState() {
    this.normalizeCodexFocus();
    const entries = this.codexFocusEntries();
    const sectionIndex = Math.max(0, this.sections.findIndex((section) => section.id === this.activeSection));
    const primaryLabels = this.primaryTabLabels();
    const secondaryLabels = this.currentItemFilterTabs().map((tab) => tab.label);
    let index = 0;
    let count = 1;
    let label = 'Codex';
    if (this.focusZone === 'sections') {
      index = sectionIndex;
      count = this.sections.length;
      label = `${this.sections[index]?.label ?? 'Cards'} section`;
    } else if (this.focusZone === 'primaryTabs') {
      index = this.activePrimaryTabIndex();
      count = primaryLabels.length;
      label = `${primaryLabels[index] ?? 'All'} filter`;
    } else if (this.focusZone === 'secondaryTabs') {
      index = this.activeItemFilterTab;
      count = secondaryLabels.length;
      label = `${secondaryLabels[index] ?? 'All'} filter`;
    } else if (this.focusZone === 'entries') {
      index = this.entryFocusIndex;
      count = entries.length;
      label = entries[index]?.label ?? 'Codex entry';
    } else if (this.focusZone === 'back') {
      label = 'Back to title';
    } else {
      label = this.detailFocusLabel();
    }
    return {
      zone: this.focusZone,
      index,
      count,
      label,
      previous: controlBindingLabel('previous'),
      next: controlBindingLabel('next'),
      confirm: controlBindingLabel('confirm'),
      back: controlBindingLabel('back'),
      ringRendered: Boolean(this.focusRing?.active),
      gridScroll: Math.round(this.gridScroll),
      gridMaxScroll: Math.round(this.gridMaxScroll),
      detailScroll: Math.round(this.detailScroll),
      detailMaxScroll: Math.round(this.detailMaxScroll),
    };
  }

  private codexGridShape() {
    const cardMode = this.activeSection === 'cards';
    const itemMode = this.activeSection === 'items';
    const leaderMode = this.activeSection === 'leaders';
    const glossaryMode = this.activeSection === 'glossary';
    return {
      top: this.currentGridTop(),
      bottom: CodexScene.GRID_BOTTOM,
      cols: cardMode ? 5 : leaderMode ? 3 : glossaryMode ? 2 : 4,
      cellW: cardMode ? 202 : leaderMode ? 360 : glossaryMode ? 580 : 274,
      cellH: cardMode ? 286 : itemMode ? 176 : leaderMode ? 238 : glossaryMode ? 94 : 228,
    };
  }

  private entryFocusGeometry(): CodexFocusGeometry | undefined {
    const entries = this.codexFocusEntries();
    if (entries.length === 0) return undefined;
    const shape = this.codexGridShape();
    const index = clamp(this.entryFocusIndex, 0, entries.length - 1);
    const gridLeft = (GAME_WIDTH - shape.cols * shape.cellW) / 2;
    const cardMode = this.activeSection === 'cards';
    const itemMode = this.activeSection === 'items';
    const leaderMode = this.activeSection === 'leaders';
    const glossaryMode = this.activeSection === 'glossary';
    return {
      x: gridLeft + (index % shape.cols) * shape.cellW + shape.cellW / 2,
      y: shape.top + Math.floor(index / shape.cols) * shape.cellH + shape.cellH / 2 - this.gridScroll,
      width: cardMode ? 198 : itemMode ? 258 : leaderMode ? 338 : glossaryMode ? shape.cellW - 16 : 258,
      height: cardMode ? 290 : itemMode ? 160 : leaderMode ? 220 : glossaryMode ? shape.cellH - 10 : 212,
    };
  }

  private ensureFocusedEntryVisible() {
    const entries = this.codexFocusEntries();
    if (entries.length === 0) return;
    const shape = this.codexGridShape();
    const row = Math.floor(clamp(this.entryFocusIndex, 0, entries.length - 1) / shape.cols);
    const rowTop = shape.top + row * shape.cellH;
    const rowBottom = rowTop + shape.cellH;
    const rows = Math.ceil(entries.length / shape.cols);
    const maxScroll = Math.max(0, rows * shape.cellH - (shape.bottom - shape.top) + 12);
    let next = this.gridScroll;
    if (rowTop - next < shape.top + 6) next = rowTop - shape.top;
    if (rowBottom - next > shape.bottom - 6) next = rowBottom - shape.bottom + 6;
    next = clamp(next, 0, maxScroll);
    this.gridScroll = next;
    this.gridScrollTarget = next;
  }

  private setActiveSection(index: number) {
    const next = this.sections[(index + this.sections.length) % this.sections.length];
    if (!next) return;
    this.activeSection = next.id;
    this.detailId = undefined;
    this.entryFocusIndex = 0;
    this.resetCodexScroll();
  }

  private setActivePrimaryTab(index: number) {
    const labels = this.primaryTabLabels();
    if (labels.length === 0) return;
    const next = (index + labels.length) % labels.length;
    if (this.activeSection === 'cards') this.activeTab = next;
    else if (this.activeSection === 'items') {
      this.activeItemTypeTab = next;
      this.activeItemFilterTab = 0;
    } else if (this.activeSection === 'enemies') this.activeEnemyTab = next;
    this.detailId = undefined;
    this.entryFocusIndex = 0;
    this.resetCodexScroll();
  }

  private setActiveSecondaryTab(index: number) {
    const tabs = this.currentItemFilterTabs();
    if (tabs.length === 0) return;
    this.activeItemFilterTab = (index + tabs.length) % tabs.length;
    this.detailId = undefined;
    this.entryFocusIndex = 0;
    this.resetCodexScroll();
  }

  private cycleCodexFocusZone(direction: -1 | 1, sound = true) {
    this.normalizeCodexFocus();
    const zones = this.codexFocusZones();
    if (zones.length <= 1) return;
    const current = Math.max(0, zones.indexOf(this.focusZone));
    this.focusZone = zones[(current + direction + zones.length) % zones.length];
    if (this.focusZone === 'entries') this.ensureFocusedEntryVisible();
    if (sound) playUiSound('confirm');
    this.renderAll();
  }

  private moveCodexHorizontal(direction: -1 | 1) {
    this.normalizeCodexFocus();
    if (this.focusZone === 'detail') {
      this.scrollCodexDetail(direction);
      return;
    }
    playUiSound('confirm');
    if (this.focusZone === 'sections') {
      const current = Math.max(0, this.sections.findIndex((section) => section.id === this.activeSection));
      this.setActiveSection(current + direction);
    } else if (this.focusZone === 'primaryTabs') {
      this.setActivePrimaryTab(this.activePrimaryTabIndex() + direction);
    } else if (this.focusZone === 'secondaryTabs') {
      this.setActiveSecondaryTab(this.activeItemFilterTab + direction);
    } else if (this.focusZone === 'entries') {
      const entries = this.codexFocusEntries();
      if (entries.length > 0) this.entryFocusIndex = (this.entryFocusIndex + direction + entries.length) % entries.length;
      this.ensureFocusedEntryVisible();
    } else {
      this.cycleCodexFocusZone(direction, false);
      return;
    }
    this.renderAll();
  }

  private moveCodexVertical(direction: -1 | 1) {
    this.normalizeCodexFocus();
    if (this.focusZone === 'detail') {
      this.scrollCodexDetail(direction);
      return;
    }
    if (this.focusZone !== 'entries') {
      this.cycleCodexFocusZone(direction);
      return;
    }
    const entries = this.codexFocusEntries();
    const cols = this.codexGridShape().cols;
    const next = this.entryFocusIndex + direction * cols;
    if (next < 0 || next >= entries.length) {
      this.cycleCodexFocusZone(direction);
      return;
    }
    playUiSound('confirm');
    this.entryFocusIndex = next;
    this.ensureFocusedEntryVisible();
    this.renderAll();
  }

  private activateCodexFocus() {
    this.normalizeCodexFocus();
    if (this.focusZone === 'detail') {
      this.closeCodexDetail(true);
      return;
    }
    if (this.focusZone === 'back') {
      playUiSound('close');
      this.scene.start('MenuScene');
      return;
    }
    if (this.focusZone !== 'entries') {
      this.cycleCodexFocusZone(1);
      return;
    }
    const entry = this.codexFocusEntries()[this.entryFocusIndex];
    if (!entry?.canOpen) {
      playUiSound(this.activeSection === 'glossary' ? 'confirm' : 'locked');
      return;
    }
    this.openCodexDetail(entry.id, true);
  }

  private handleCodexBack() {
    if (this.detailId) {
      this.closeCodexDetail(true);
      return;
    }
    playUiSound('close');
    this.scene.start('MenuScene');
  }

  private scrollCodexDetail(direction: -1 | 1) {
    if (this.detailMaxScroll <= 0) return;
    this.detailScrollTarget = clamp(this.detailScrollTarget + direction * 180, 0, this.detailMaxScroll);
  }

  private ensureCodexData() {
    if (this.codexData) return Promise.resolve();
    if (!this.codexDataLoad) {
      this.codexDataFailed = false;
      const request = Promise.all([import('./codex-data'), loadBossDossierModule()])
        .then(([data, dossier]) => {
          this.codexData = data;
          this.codexBossDossierModule = dossier;
          this.codexDataFailed = false;
        })
        .catch((error) => {
          this.codexDataFailed = true;
          console.warn(LAZY_LOAD_FAILED, error);
          if (this.codexDataLoad === request) this.codexDataLoad = undefined;
        });
      this.codexDataLoad = request;
    }
    const activationId = this.activationId;
    return this.codexDataLoad.then(() => {
      if (activationId !== this.activationId || !this.sys.settings.active || !this.root?.active) return;
      this.renderAll();
    });
  }

  private codexBossView(enemy: CodexEnemyEntry) {
    return this.codexBossDossierModule?.codexBossDossier(
      enemy.id,
      enemy.moveKit,
      this.observedEnemyMoves,
      enemy.typeHint === 'Boss'
    ) ?? {
      observed: 0,
      total: enemy.moveKit.length,
      rows: enemy.moveKit.map((move) => ({
        text: enemy.typeHint === 'Boss' ? '- Undocumented tactic - face this boss to reveal' : `- ${move.text}`,
        revealed: enemy.typeHint !== 'Boss'
      }))
    };
  }

  private codexDataPending(): boolean {
    return !this.codexData && Boolean(this.codexDataLoad) && !this.codexDataFailed;
  }

  private visibleGridEntries<T>(entries: T[], cols: number, cellH: number): T[] {
    const top = this.currentGridTop();
    const overscan = cellH * 2;
    return entries.filter((_entry, i) => {
      const cy = top + Math.floor(i / cols) * cellH + cellH / 2;
      return cy - this.gridScroll >= top - overscan && cy - this.gridScroll <= CodexScene.GRID_BOTTOM + overscan;
    });
  }

  private currentDetailArtAsset(): RuntimeImageAsset | undefined {
    if (!this.detailId) return undefined;
    if (this.activeSection === 'items') {
      if (alphaRouteMarkLibrary.has(this.detailId)) return waymarkArtAssets[this.detailId];
      if (alphaSupplyLibrary.has(this.detailId)) return supplyArtAssets[this.detailId];
      return undefined;
    }
    if (this.activeSection === 'leaders') return codexLeaderArtAssets[this.detailId];
    if (this.activeSection === 'enemies') {
      const enemy = this.currentCodexEnemies().find((candidate) => candidate.id === this.detailId);
      return enemy ? this.enemyArtAsset(enemy) : undefined;
    }
    return this.discovered.has(this.detailId) ? cardArtAssets[this.detailId] : undefined;
  }

  private queueArt() {
    const cards = this.allCards().filter(this.tabs[this.activeTab].match).sort((a, b) => a.id.localeCompare(b.id));
    const items = this.currentCodexItems();
    const leaders = this.allLeaders();
    const enemies = this.currentCodexEnemies();
    const reserveEnemyIds = new Set<string>();
    const enemyGridArtAsset = (enemy: CodexEnemyEntry) => {
      if (enemy.source === 'reserve') {
        reserveEnemyIds.add(enemy.id);
        return undefined;
      }
      return this.enemyArtAsset(enemy);
    };
    const source = this.activeSection === 'items'
      ? this.visibleGridEntries(items, 4, 176).map((item) => item.kind === 'waymark' ? waymarkCompactArtAssets[item.id] : supplyCompactArtAssets[item.id])
      : this.activeSection === 'leaders'
        ? this.visibleGridEntries(leaders, 3, 238).map((leader) => codexLeaderArtAssets[leader.id])
        : this.activeSection === 'enemies'
          ? this.visibleGridEntries(enemies, 4, 228).map((enemy) => enemyGridArtAsset(enemy))
          : this.activeSection === 'glossary'
            ? []
            : this.visibleGridEntries(cards, 5, 286)
            .filter((c) => this.discovered.has(c.id))
            .map((c) => cardCompactArtAsset(c));
    let detailArt = this.currentDetailArtAsset();
    if (this.activeSection === 'enemies' && this.detailId) {
      const enemy = enemies.find((candidate) => candidate.id === this.detailId);
      if (enemy?.source === 'reserve') {
        reserveEnemyIds.add(enemy.id);
        detailArt = undefined;
      }
    }
    queueRuntimeImageAssets(this, [...source, detailArt], 'Codex art', () => this.renderAll());
    queueReserveEnemyArtAssets(this, [...reserveEnemyIds], 'Codex enemy art', () => this.renderAll());
  }

  private renderAll() {
    hideKwTooltip();
    killTweensForTree(this, this.root);
    this.root.removeAll(true);
    this.gridLayer = undefined;
    this.focusRing = undefined;
    this.detailClosePoint = undefined;
    this.normalizeCodexFocus();
    this.queueArt();
    const all = this.allCards();
    const found = all.filter((c) => this.discovered.has(c.id)).length;
    const enemyAll = this.allCodexEnemies();
    const reserveEnemyCount = this.allReserveEnemies().length;
    const encounterEnemyCount = this.allEncounterEnemies().length;
    const enemies = this.currentCodexEnemies();
    const waymarkAll = this.allWaymarks();
    const supplyAll = this.allSupplies();
    const itemAll = this.allCodexItems();
    if (this.activeSection === 'items') this.normalizeItemTabs();
    const items = this.currentCodexItems();
    const leaders = this.allLeaders();
    const top = this.currentGridTop();
    const bottom = CodexScene.GRID_BOTTOM;
    const glossaryTerms = this.glossaryTerms;
    const cardMode = this.activeSection === 'cards';
    const itemMode = this.activeSection === 'items';
    const leaderMode = this.activeSection === 'leaders';
    const activeCardCollection = cardMode
      ? this.codexBossDossierModule?.cardDiscoverySets(
        all,
        this.discovered
      )[this.activeTab]
      : undefined;
    window.advanceTime = (ms: number) => advanceGameTime(this.game, ms);
    window.render_game_to_text = () => JSON.stringify({
      mode: 'codex',
      section: this.activeSection,
      audio: birdAudio.snapshot(),
      cardsDiscovered: found,
      cardsTotal: all.length,
      itemCount: itemAll.length,
      leaderCount: leaders.length,
      enemyCount: enemyAll.length,
      detailOpen: this.detailId ?? '',
      codexFocus: this.codexFocusState(),
      cardCollection: activeCardCollection,
      bossDossier: this.activeSection === 'enemies' && this.detailId
        ? (() => {
          const enemy = enemyAll.find((candidate) => candidate.id === this.detailId);
          if (enemy?.typeHint !== 'Boss') return undefined;
          const { observed, total } = this.codexBossView(enemy);
          return { enemyId: enemy.id, observed, total };
        })()
        : undefined,
      codexDossierFrame: {
        loaded: this.textures.exists(uiIconAssets['codex-dossier-frame'].key),
        rendered: countTextureInGameObjects(this.root?.list ?? [], uiIconAssets['codex-dossier-frame'].key) > 0,
        count: countTextureInGameObjects(this.root?.list ?? [], uiIconAssets['codex-dossier-frame'].key)
      },
      codexEntryFrame: {
        loaded: this.textures.exists(uiIconAssets['codex-entry-frame'].key),
        rendered: countTextureInGameObjects(this.root?.list ?? [], uiIconAssets['codex-entry-frame'].key) > 0,
        count: countTextureInGameObjects(this.root?.list ?? [], uiIconAssets['codex-entry-frame'].key)
      },
      codexArtPreviewFrame: {
        loaded: this.textures.exists(uiIconAssets['codex-art-preview-frame'].key),
        rendered: countTextureInGameObjects(this.root?.list ?? [], uiIconAssets['codex-art-preview-frame'].key) > 0,
        count: countTextureInGameObjects(this.root?.list ?? [], uiIconAssets['codex-art-preview-frame'].key)
      },
      codexBackCommandFrame: {
        loaded: this.textures.exists(uiIconAssets['codex-back-command-frame'].key),
        rendered: countTextureInGameObjects(this.root?.list ?? [], uiIconAssets['codex-back-command-frame'].key) > 0,
        count: countTextureInGameObjects(this.root?.list ?? [], uiIconAssets['codex-back-command-frame'].key)
      },
      codexTabFrame: {
        loaded: this.textures.exists(uiIconAssets['codex-tab-frame'].key),
        rendered: countTextureInGameObjects(this.root?.list ?? [], uiIconAssets['codex-tab-frame'].key) > 0,
        count: countTextureInGameObjects(this.root?.list ?? [], uiIconAssets['codex-tab-frame'].key)
      },
      codexCloseCommandFrame: {
        loaded: this.textures.exists(uiIconAssets['codex-close-command-frame'].key),
        rendered: countTextureInGameObjects(this.root?.list ?? [], uiIconAssets['codex-close-command-frame'].key) > 0,
        count: countTextureInGameObjects(this.root?.list ?? [], uiIconAssets['codex-close-command-frame'].key)
      },
      codexScrollCueFrame: {
        loaded: this.textures.exists(uiIconAssets['codex-scroll-cue-frame'].key),
        rendered: countTextureInGameObjects(this.root?.list ?? [], uiIconAssets['codex-scroll-cue-frame'].key) > 0,
        count: countTextureInGameObjects(this.root?.list ?? [], uiIconAssets['codex-scroll-cue-frame'].key)
      },
      codexGridScrollCueFrame: {
        loaded: this.textures.exists(uiIconAssets['codex-grid-scroll-cue-frame'].key),
        rendered: countTextureInGameObjects(this.root?.list ?? [], uiIconAssets['codex-grid-scroll-cue-frame'].key) > 0,
        count: countTextureInGameObjects(this.root?.list ?? [], uiIconAssets['codex-grid-scroll-cue-frame'].key)
      },
      keywordTooltipFrame: {
        loaded: this.textures.exists(uiIconAssets['keyword-tooltip-frame'].key),
        rendered: ((this as Phaser.Scene & { keywordTooltipFrameCount?: number }).keywordTooltipFrameCount ?? 0) > 0,
        count: (this as Phaser.Scene & { keywordTooltipFrameCount?: number }).keywordTooltipFrameCount ?? 0
      },
      glossaryTerms: this.activeSection === 'glossary'
        ? glossaryTerms.map((term) => term.term)
        : undefined,
    });

    // 1) Scrollable grid. Drawn FIRST so the
    //    header/footer curtains below can hide anything scrolled out of view
    //    (WebGL doesn't support geometry masks, so we clip with opaque strips).
    const cards = cardMode
      ? this.allCards().filter(this.tabs[this.activeTab].match).sort((a, b) => a.id.localeCompare(b.id))
      : [];
    const glossaryMode = this.activeSection === 'glossary';
    const cols = cardMode ? 5 : leaderMode ? 3 : glossaryMode ? 2 : 4;
    const cellW = cardMode ? 202 : leaderMode ? 360 : glossaryMode ? 580 : 274;
    const cellH = cardMode ? 286 : itemMode ? 176 : leaderMode ? 238 : glossaryMode ? 94 : 228;
    const gridLeft = (GAME_WIDTH - cols * cellW) / 2;
    const rows = Math.ceil((cardMode ? cards.length : itemMode ? items.length : leaderMode ? leaders.length : glossaryMode ? glossaryTerms.length : enemies.length) / cols);
    this.gridMaxScroll = Math.max(0, rows * cellH - (bottom - top) + 12);
    this.gridScrollTarget = clamp(this.gridScrollTarget, 0, this.gridMaxScroll);
    this.gridScroll = clamp(this.gridScroll, 0, this.gridMaxScroll);

    const gridOverscan = cellH * 2;
    const grid = this.add.container(0, -this.gridScroll);
    this.gridLayer = grid;
    this.gridRenderScroll = this.gridScroll;
    this.gridRenderCellH = cellH;
    if (cardMode) {
      cards.forEach((card, i) => {
        const cx = gridLeft + (i % cols) * cellW + cellW / 2;
        const cy = top + Math.floor(i / cols) * cellH + cellH / 2;
        // Cull rows fully outside the viewport (cheap + avoids drawing offscreen).
        if (cy - this.gridScroll < top - gridOverscan || cy - this.gridScroll > bottom + gridOverscan) return;
        this.renderThumb(grid, card, cx, cy);
      });
    } else if (itemMode) {
      items.forEach((item, i) => {
        const cx = gridLeft + (i % cols) * cellW + cellW / 2;
        const cy = top + Math.floor(i / cols) * cellH + cellH / 2;
        if (cy - this.gridScroll < top - gridOverscan || cy - this.gridScroll > bottom + gridOverscan) return;
        if (item.kind === 'waymark') this.renderWaymarkThumb(grid, item.mark, cx, cy);
        else this.renderSupplyThumb(grid, item.supply, cx, cy);
      });
    } else if (leaderMode) {
      leaders.forEach((leader, i) => {
        const cx = gridLeft + (i % cols) * cellW + cellW / 2;
        const cy = top + Math.floor(i / cols) * cellH + cellH / 2;
        if (cy - this.gridScroll < top - gridOverscan || cy - this.gridScroll > bottom + gridOverscan) return;
        this.renderLeaderThumb(grid, leader, cx, cy);
      });
    } else if (glossaryMode) {
      glossaryTerms.forEach((term, i) => {
        const cx = gridLeft + (i % cols) * cellW + cellW / 2;
        const cy = top + Math.floor(i / cols) * cellH + cellH / 2;
        if (cy - this.gridScroll < top - gridOverscan || cy - this.gridScroll > bottom + gridOverscan) return;
        this.renderGlossaryEntry(grid, term, cx, cy, cellW - 24, cellH - 16);
      });
    } else {
      enemies.forEach((enemy, i) => {
        const cx = gridLeft + (i % cols) * cellW + cellW / 2;
        const cy = top + Math.floor(i / cols) * cellH + cellH / 2;
        if (cy - this.gridScroll < top - gridOverscan || cy - this.gridScroll > bottom + gridOverscan) return;
        this.renderEnemyThumb(grid, enemy, cx, cy);
      });
    }
    this.root.add(grid);

    // 2) Curtains hide grid overflow above/below the viewport.
    this.root.add(this.add.rectangle(GAME_WIDTH / 2, top / 2, GAME_WIDTH, top, 0x070a11, 1));
    this.root.add(this.add.rectangle(GAME_WIDTH / 2, (bottom + GAME_HEIGHT) / 2, GAME_WIDTH, GAME_HEIGHT - bottom, 0x070a11, 1));

    // 3) Header (title / counter / Back / tabs) on top of the curtain.
    const headerH = itemMode ? 188 : 156;
    this.root.add(this.add.rectangle(GAME_WIDTH / 2, headerH / 2, GAME_WIDTH, headerH, 0x08111e, 0.96));
    this.root.add(this.add.rectangle(GAME_WIDTH / 2, headerH - 6, GAME_WIDTH - 80, 2, 0x1b2c3e, 0.82));
    this.root.add(this.add.rectangle(838, 42, 486, 54, 0x05080e, 0.64).setStrokeStyle(1, 0x22364d, 0.72));
    this.root.add(this.add.text(40, 24, 'Codex', { fontFamily: 'Georgia, serif', fontSize: '34px', fontStyle: UI_BOLD, color: UI_GOLD, stroke: '#000000', strokeThickness: 4 }));
    const subtitle = cardMode
      ? `${found} / ${all.length} cards discovered`
      : itemMode
        ? `${itemAll.length} items (${waymarkAll.length} Waymarks / ${supplyAll.length} Supplies)`
        : glossaryMode
          ? `${glossaryTerms.length} keywords`
          : leaderMode
            ? `${flockLeaders.filter((leader) => isLeaderUnlocked(loadAccount(), leader.id)).length} / ${flockLeaders.length} Flock Leaders rallied`
            : this.codexDataPending()
            ? `${encounterEnemyCount} enemies (loading reserves)`
            : `${enemyAll.length} enemies (${encounterEnemyCount} playable / ${reserveEnemyCount} reserve)`;
    this.root.add(this.add.text(42, 66, subtitle, { fontFamily: UI_FONT, fontSize: '15px', color: UI_MUTED }));
    const codexStatus = this.codexDataFailed
      ? 'Extended Codex notes unavailable'
      : this.codexDataPending()
        ? 'Loading extended Codex notes...'
        : '';
    if (codexStatus) {
      this.root.add(this.add.text(42, 84, codexStatus, {
        fontFamily: UI_FONT,
        fontSize: '12px',
        color: this.codexDataFailed ? '#ff9b6a' : '#8df4ff'
      }));
    }

    const backX = GAME_WIDTH - 76;
    const backFrameKey = uiIconAssets['codex-back-command-frame'].key;
    const hasBackFrame = this.textures.exists(backFrameKey);
    const back = this.add.rectangle(backX, 42, 132, 44, 0x122235, hasBackFrame ? 0.14 : 0.96)
      .setStrokeStyle(2, 0xd8a840, hasBackFrame ? 0.24 : 1);
    this.root.add(back);
    const backHit = this.add.rectangle(backX, 42, 132, MIN_SUPPORTED_TOUCH_TARGET, 0x020409, 0.001)
      .setInteractive({ useHandCursor: true })
      .setName('codex-back-hit');
    backHit.on('pointerdown', () => { playUiSound('close'); this.scene.start('MenuScene'); });
    this.root.add(backHit);
    if (hasBackFrame) {
      this.textures.get(backFrameKey).setFilter(Phaser.Textures.FilterMode.LINEAR);
      this.root.add(this.add.image(backX, 42, backFrameKey)
        .setDisplaySize(132, 42)
        .setAlpha(0.9)
        .setName('codex-back-command-frame'));
    }
    this.root.add(this.add.text(backX, 42, 'Back', {
      fontFamily: UI_FONT,
      fontSize: '18px',
      fontStyle: UI_BOLD,
      color: UI_GOLD,
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5));
    renderAudioToggleControl(this, (obj) => this.root.add(obj), GAME_WIDTH - 174, 42);

    const sectionMeta: Record<CodexSection, string> = {
      cards: `${found}/${all.length}`,
      items: `${itemAll.length}`,
      glossary: `${glossaryTerms.length}`,
      leaders: `${flockLeaders.filter((leader) => isLeaderUnlocked(loadAccount(), leader.id)).length}/${flockLeaders.length}`,
      enemies: `${enemyAll.length}`,
    };
    const sectionAccent: Record<CodexSection, number> = {
      cards: 0x7ab8d6,
      items: 0xc9a6ff,
      glossary: 0x8df4ff,
      leaders: 0xe8c24a,
      enemies: 0xff9b6a,
    };
    this.sections.forEach(({ id: section, label }, i) => {
      const tx = 568 + i * 110;
      const active = section === this.activeSection;
      this.renderCodexTab(tx, 42, 104, 42, label, sectionMeta[section], active, sectionAccent[section], () => {
        this.focusZone = 'sections';
        playUiSound('confirm');
        this.setActiveSection(i);
        this.renderAll();
      }, 14);
    });

    if (cardMode) {
      this.tabs.forEach((tab, i) => {
        const tx = 64 + i * 124;
        const active = i === this.activeTab;
        const tabCards = this.allCards().filter(tab.match);
        const got = tabCards.filter((c) => this.discovered.has(c.id)).length;
        const sampleCard = tabCards[0];
        const accent = sampleCard ? this.cardAccent(sampleCard) : 0x7ab8d6;
        this.renderCodexTab(tx, 116, 116, 40, tab.label, `${got}/${tabCards.length}`, active, accent, () => {
          this.focusZone = 'primaryTabs';
          playUiSound('confirm');
          this.setActivePrimaryTab(i);
          this.renderAll();
        }, 13);
      });
      if (activeCardCollection) {
        const activeCards = this.allCards().filter(this.tabs[this.activeTab].match);
        this.codexBossDossierModule?.renderCardCollectionRail(this, this.root, activeCardCollection, {
          x: 1074,
          y: 116,
          width: 330,
          accent: activeCards[0] ? this.cardAccent(activeCards[0]) : 0x7ab8d6,
          fontFamily: UI_FONT,
          boldStyle: UI_BOLD
        });
      }
    } else if (itemMode) {
      this.itemTypeTabs.forEach((tab, i) => {
        const tx = 72 + i * 132;
        const active = i === this.activeItemTypeTab;
        const tabItems = this.allCodexItems().filter(tab.match);
        const accent = tab.label === 'Supplies' ? 0xffb86b : tab.label === 'Waymarks' ? 0xc9a6ff : 0xd8a840;
        const iconOverride = itemTypeCodexIconForLabel(tab.label);
        this.renderCodexTab(tx, 102, 120, 32, tab.label, `${tabItems.length}`, active, accent, () => {
          this.focusZone = 'primaryTabs';
          playUiSound('confirm');
          this.setActivePrimaryTab(i);
          this.renderAll();
        }, 11, iconOverride);
      });
      const contextTabs = this.currentItemFilterTabs();
      const typeDef = this.activeItemTypeDef();
      const typeItems = this.allCodexItems().filter(typeDef.match);
      contextTabs.forEach((tab, i) => {
        const tx = 62 + i * 108;
        const active = i === this.activeItemFilterTab;
        const tabItems = typeItems.filter(tab.match);
        const accent = tabItems[0]
          ? tabItems[0].kind === 'waymark' ? this.waymarkAccent(tabItems[0].mark) : this.supplyAccent(tabItems[0].supply)
          : typeDef.label === 'Supplies' ? 0xffb86b : 0xc9a6ff;
        const iconOverride = typeDef.label === 'Waymarks'
          ? waymarkCodexIconForLabel(tab.label)
          : typeDef.label === 'Supplies'
            ? supplyCodexIconForLabel(tab.label)
            : undefined;
        this.renderCodexTab(tx, 160, 100, 30, tab.label, `${tabItems.length}`, active, accent, () => {
          this.focusZone = 'secondaryTabs';
          playUiSound('confirm');
          this.setActiveSecondaryTab(i);
          this.renderAll();
        }, 10, iconOverride);
      });
    } else if (!leaderMode && !glossaryMode) {
      this.enemyTabs.forEach((tab, i) => {
        const tx = 72 + i * 150;
        const active = i === this.activeEnemyTab;
        const tabEnemies = this.allCodexEnemies().filter(tab.match);
        const accent = tabEnemies[0] ? this.enemyAccent(tabEnemies[0]) : 0x7ab8d6;
        this.renderCodexTab(tx, 116, 140, 40, tab.label, `${tabEnemies.length}`, active, accent, () => {
          this.focusZone = 'primaryTabs';
          playUiSound('confirm');
          this.setActivePrimaryTab(i);
          this.renderAll();
        }, 13, enemyCodexIconForLabel(tab.label));
      });
    }

    if (this.gridMaxScroll > 0) {
      this.renderCodexGridScrollCue(GAME_WIDTH - 88, bottom + 11, this.gridScroll >= this.gridMaxScroll);
    }

    if (this.detailId) {
      if (this.activeSection === 'items') {
        if (alphaSupplyLibrary.has(this.detailId)) this.renderSupplyDetail(this.detailId);
        else this.renderWaymarkDetail(this.detailId);
      }
      else if (this.activeSection === 'leaders') this.renderLeaderDetail(this.detailId);
      else if (this.activeSection === 'enemies') this.renderEnemyDetail(this.detailId);
      else this.renderDetail(this.detailId);
    }
    this.renderCodexFocusRing();
    this.renderCodexInputHint();
  }

  private hexColor(color: number) {
    return `#${color.toString(16).padStart(6, '0')}`;
  }

  private renderCodexDossierHeader(
    left: number,
    right: number,
    mTop: number,
    label: string,
    meta: string,
    accent: number,
    accentText: string
  ) {
    const x = (left + right) / 2;
    const headerW = right - left - 40;
    const headerY = mTop + 36;
    this.root.add(this.add.rectangle(x, headerY, headerW, 48, 0x07101c, 0.98).setStrokeStyle(1, accent, 0.72));
    this.root.add(this.add.rectangle(left + 31, headerY, 5, 30, accent, 0.9));
    this.root.add(this.add.text(left + 48, headerY - 7, label, {
      fontFamily: UI_FONT,
      fontSize: '12px',
      fontStyle: UI_BOLD,
      color: accentText,
      fixedWidth: 228,
      maxLines: 1
    }).setResolution(2).setOrigin(0, 0.5));
    this.root.add(this.add.text(left + 296, headerY - 7, meta, {
      fontFamily: UI_FONT,
      fontSize: '10px',
      fontStyle: UI_BOLD,
      color: '#7f93a8',
      fixedWidth: headerW - 360,
      maxLines: 1
    }).setResolution(2).setOrigin(0, 0.5));
    this.root.add(this.add.rectangle(x, mTop + 68, headerW - 26, 2, accent, 0.42));
  }

  private addCodexChip(
    layer: Phaser.GameObjects.Container,
    x: number,
    y: number,
    w: number,
    label: string,
    accent: number,
    active = false,
  ) {
    const chip = this.add.rectangle(x, y, w, 22, active ? 0x1d3047 : 0x08111e, active ? 0.98 : 0.9)
      .setStrokeStyle(1, accent, active ? 0.95 : 0.68);
    layer.add(chip);
    layer.add(this.add.text(x, y, label, {
      fontFamily: UI_FONT,
      fontSize: '10px',
      fontStyle: UI_BOLD,
      color: active ? '#ffe1a3' : '#aebed0',
      align: 'center',
      fixedWidth: w - 8,
    }).setResolution(2).setOrigin(0.5));
  }

  private addCodexTagRow(
    layer: Phaser.GameObjects.Container,
    x: number,
    y: number,
    tags: string[],
    accent: number,
    maxWidth: number,
    active = false,
  ) {
    let cursor = x;
    tags.slice(0, 4).forEach((tag) => {
      const w = clamp(tag.length * 7 + 24, 72, 138);
      if (cursor + w > x + maxWidth) return;
      this.addCodexChip(layer, cursor + w / 2, y, w, tag, accent, active);
      cursor += w + 8;
    });
  }

  private renderCodexCloseControl(x: number, y: number, onClick: () => void) {
    this.detailClosePoint = { x, y };
    const frameKey = uiIconAssets['codex-close-command-frame'].key;
    const hasFrame = this.textures.exists(frameKey);
    const close = this.add.rectangle(x, y, 38, 38, 0x3d2a2d, hasFrame ? 0.22 : 0.97)
      .setStrokeStyle(2, 0xff6b57, hasFrame ? 0.38 : 1);
    this.root.add(close);
    const closeHit = this.add.rectangle(x, y, MIN_SUPPORTED_TOUCH_TARGET, MIN_SUPPORTED_TOUCH_TARGET, 0x020409, 0.001)
      .setInteractive({ useHandCursor: true })
      .setName('codex-detail-close-hit');
    closeHit.on('pointerdown', onClick);
    this.root.add(closeHit);

    let frame: Phaser.GameObjects.Image | undefined;
    if (hasFrame) {
      this.textures.get(frameKey).setFilter(Phaser.Textures.FilterMode.LINEAR);
      frame = this.add.image(x, y, frameKey)
        .setDisplaySize(46, 46)
        .setAlpha(0.92)
        .setName('codex-close-command-frame');
      this.root.add(frame);
    }

    closeHit.on('pointerover', () => {
      close.setFillStyle(0x4d3034, hasFrame ? 0.34 : 1);
      frame?.setAlpha(1);
      frame?.setDisplaySize(48, 48);
    });
    closeHit.on('pointerout', () => {
      close.setFillStyle(0x3d2a2d, hasFrame ? 0.22 : 0.97);
      frame?.setAlpha(0.92);
      frame?.setDisplaySize(46, 46);
    });

    this.root.add(this.add.text(x, y, 'X', {
      fontFamily: UI_FONT, fontSize: '17px', fontStyle: UI_BOLD, color: '#ffd5cc',
      stroke: '#000000', strokeThickness: 3
    }).setOrigin(0.5));
  }

  private codexFocusGeometry(): CodexFocusGeometry | undefined {
    this.normalizeCodexFocus();
    if (this.focusZone === 'entries') return this.entryFocusGeometry();
    if (this.focusZone === 'back') return { x: GAME_WIDTH - 76, y: 42, width: 140, height: MIN_SUPPORTED_TOUCH_TARGET };
    if (this.focusZone === 'detail') {
      const point = this.detailClosePoint ?? { x: GAME_WIDTH - 206, y: 74 };
      return { x: point.x, y: point.y, width: MIN_SUPPORTED_TOUCH_TARGET, height: MIN_SUPPORTED_TOUCH_TARGET };
    }
    if (this.focusZone === 'sections') {
      const index = Math.max(0, this.sections.findIndex((section) => section.id === this.activeSection));
      return { x: 568 + index * 110, y: 42, width: 110, height: MIN_SUPPORTED_TOUCH_TARGET };
    }
    if (this.focusZone === 'primaryTabs') {
      const index = this.activePrimaryTabIndex();
      if (this.activeSection === 'cards') return { x: 64 + index * 124, y: 116, width: 122, height: MIN_SUPPORTED_TOUCH_TARGET };
      if (this.activeSection === 'items') return { x: 72 + index * 132, y: 102, width: 126, height: MIN_SUPPORTED_TOUCH_TARGET };
      return { x: 72 + index * 150, y: 116, width: 146, height: MIN_SUPPORTED_TOUCH_TARGET };
    }
    if (this.focusZone === 'secondaryTabs') {
      return { x: 62 + this.activeItemFilterTab * 108, y: 160, width: 106, height: MIN_SUPPORTED_TOUCH_TARGET };
    }
    return undefined;
  }

  private renderCodexFocusRing() {
    const geometry = this.codexFocusGeometry();
    if (!geometry) return;
    const state = this.codexFocusState();
    const accent = this.focusZone === 'back' || this.focusZone === 'detail' ? UI_FIELD.gold : UI_FIELD.cyan;
    this.focusRing = this.add.rectangle(geometry.x, geometry.y, geometry.width, geometry.height, 0x06151b, 0.04)
      .setStrokeStyle(3, accent, 0.98)
      .setName('codex-focus-ring')
      .setData('zone', state.zone)
      .setData('index', state.index)
      .setData('label', state.label);
    this.root.add(this.focusRing);
  }

  private renderCodexInputHint() {
    const detail = Boolean(this.detailId);
    const label = detail
      ? `Up / Down: Scroll   |   ${controlBindingLabel('confirm')}: Close   |   ${controlBindingLabel('back')}: Back`
      : `Tab: Focus   |   ${controlBindingLabel('previous')} / ${controlBindingLabel('next')}: Navigate   |   ${controlBindingLabel('confirm')}: Select   |   ${controlBindingLabel('back')}: Back`;
    const width = detail ? 530 : 710;
    this.root.add(this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 13, width, 22, 0x05070c, 0.86)
      .setStrokeStyle(1, UI_FIELD.cyan, 0.34)
      .setName('codex-input-hint-backdrop'));
    this.root.add(this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 13, label, {
      fontFamily: UI_FONT,
      fontSize: '11px',
      fontStyle: UI_BOLD,
      color: '#a9d9e8',
      stroke: '#05070c',
      strokeThickness: 2,
    }).setResolution(2).setOrigin(0.5).setName('codex-input-hint'));
  }

  private renderCodexScrollCue(x: number, y: number, atTop: boolean) {
    const frameKey = uiIconAssets['codex-scroll-cue-frame'].key;
    const hasFrame = this.textures.exists(frameKey);
    if (hasFrame) {
      this.textures.get(frameKey).setFilter(Phaser.Textures.FilterMode.LINEAR);
      this.root.add(this.add.image(x, y, frameKey)
        .setDisplaySize(118, 30)
        .setAlpha(0.62)
        .setName('codex-scroll-cue-frame'));
    } else {
      this.root.add(this.add.rectangle(x, y, 104, 24, 0x07101c, 0.86).setStrokeStyle(1, UI_FIELD.cyan, 0.45));
    }
    this.root.add(this.add.text(x, y, atTop ? 'TOP' : 'SCROLL', {
      fontFamily: UI_FONT,
      fontSize: '10px',
      fontStyle: UI_BOLD,
      color: atTop ? '#f5d38a' : UI_MUTED,
      align: 'center',
      fixedWidth: 82,
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5));
  }

  private renderCodexGridScrollCue(x: number, y: number, atEnd: boolean) {
    const frameKey = uiIconAssets['codex-grid-scroll-cue-frame'].key;
    const hasFrame = this.textures.exists(frameKey);
    if (hasFrame) {
      this.textures.get(frameKey).setFilter(Phaser.Textures.FilterMode.LINEAR);
      this.root.add(this.add.image(x, y, frameKey)
        .setDisplaySize(150, 34)
        .setAlpha(0.7)
        .setName('codex-grid-scroll-cue-frame'));
    } else {
      this.root.add(this.add.rectangle(x, y, 132, 28, 0x07101c, 0.88).setStrokeStyle(1, UI_FIELD.cyan, 0.5));
    }
    this.root.add(this.add.text(x, y, atEnd ? 'UP' : 'SCROLL', {
      fontFamily: UI_FONT,
      fontSize: '10px',
      fontStyle: UI_BOLD,
      color: atEnd ? '#f5d38a' : UI_MUTED,
      align: 'center',
      fixedWidth: 104,
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5));
  }

  private renderCodexTab(
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    meta: string,
    active: boolean,
    accent: number,
    onClick: () => void,
    labelSize = 13,
    iconOverride?: UiIconId,
  ) {
    const fill = active ? 0x1d3047 : 0x0d1420;
    const tabFrameKey = uiIconAssets['codex-tab-frame'].key;
    const hasTabFrame = this.textures.exists(tabFrameKey);
    const rect = this.add.rectangle(x, y, w, h, fill, hasTabFrame ? (active ? 0.22 : 0.1) : (active ? 1 : 0.9))
      .setStrokeStyle(active ? 2 : 1, active ? accent : 0x2a3a4d, hasTabFrame ? (active ? 0.36 : 0.18) : (active ? 1 : 0.82));
    this.root.add(rect);
    const hit = this.add.rectangle(x, y, Math.max(w, MIN_SUPPORTED_TOUCH_TARGET), MIN_SUPPORTED_TOUCH_TARGET, 0x020409, 0.001)
      .setInteractive({ useHandCursor: true })
      .setName('codex-tab-hit')
      .setData('label', label);
    hit.on('pointerover', () => rect.setFillStyle(active ? 0x243954 : 0x121d2b, hasTabFrame ? 0.24 : 0.98));
    hit.on('pointerout', () => rect.setFillStyle(fill, hasTabFrame ? (active ? 0.22 : 0.1) : (active ? 1 : 0.9)));
    hit.on('pointerdown', onClick);
    this.root.add(hit);
    if (hasTabFrame) {
      this.textures.get(tabFrameKey).setFilter(Phaser.Textures.FilterMode.LINEAR);
      this.root.add(this.add.image(x, y, tabFrameKey)
        .setDisplaySize(w, h + 5)
        .setAlpha(active ? 0.72 : 0.46)
        .setName('codex-tab-frame'));
    }
    const iconId = iconOverride ?? codexIconForLabel(label);
    const icon = iconId ? addUiIconImage(this, iconId, x - w / 2 + 18, y - 2, Math.min(26, h - 10)) : undefined;
    if (icon) {
      icon.setAlpha(active ? 0.96 : 0.56);
      this.root.add(icon);
    }
    this.root.add(this.add.text(x + (icon ? 8 : 0), y - 8, label, {
      fontFamily: UI_FONT,
      fontSize: `${labelSize}px`,
      fontStyle: UI_BOLD,
      color: active ? '#ffe1a3' : '#9fb1c4',
    }).setResolution(2).setOrigin(0.5));
    this.root.add(this.add.text(x, y + 10, meta, {
      fontFamily: UI_FONT,
      fontSize: '9px',
      color: active ? this.hexColor(accent) : '#708296',
    }).setResolution(2).setOrigin(0.5));
  }

  private renderGlossaryEntry(
    layer: Phaser.GameObjects.Container,
    term: CodexGlossaryTerm,
    cx: number,
    cy: number,
    w: number,
    h: number,
  ) {
    const accent = 0x8df4ff;
    layer.add(this.add.rectangle(cx, cy, w, h, 0x0b121d, 0.96).setStrokeStyle(1, accent, 0.68));
    addCodexEntryFrame(this, (obj) => layer.add(obj), { cx, cy, w, h }, { alpha: 0.38, padX: 18, padY: 16 });
    layer.add(this.add.text(cx - w / 2 + 24, cy - h / 2 + 18, term.term, {
      fontFamily: UI_FONT,
      fontSize: '17px',
      fontStyle: UI_BOLD,
      color: '#ffe1a3',
    }).setResolution(2).setOrigin(0, 0.5));
    this.addCodexChip(layer, cx + w / 2 - 68, cy - h / 2 + 18, 126, term.category, accent, true);
    layer.add(this.add.text(cx - w / 2 + 24, cy - h / 2 + 42, term.summary, {
      fontFamily: UI_FONT,
      fontSize: '12px',
      fontStyle: UI_BOLD,
      color: this.hexColor(accent),
    }).setResolution(2));
  }

  private cardAccent(card: Card) {
    if (isSnagCard(card)) return 0xff6b57;
    if (isAviaryCard(card)) return 0xe8c24a;
    if (card.type === 'major') return 0xd8a840;
    if (card.type === 'molt') return 0xc56cff;
    return suitAccentColor(card);
  }

  private cardFamilyLabel(card: Card) {
    if (isSnagCard(card)) return 'Snag';
    if (isAviaryCard(card)) return 'Aviary';
    if (card.type === 'major') return 'Major Arcana';
    if (card.type === 'molt') return 'Molt';
    switch (card.runtime.suit) {
      case 'plumes': return 'Plumes';
      case 'quills': return 'Quills';
      case 'basins': return 'Basins';
      case 'nests': return 'Nests';
      default: return 'Aviary';
    }
  }

  private cardDossierLabel(card: Card) {
    if (isSnagCard(card)) return 'SNAG DOSSIER';
    if (isAviaryCard(card)) return 'AVIARY DOSSIER';
    if (card.type === 'major') return 'LEGEND DOSSIER';
    if (card.type === 'molt') return 'MOLT DOSSIER';
    return `${this.cardFamilyLabel(card).toUpperCase()} DOSSIER`;
  }

  private drawLockedCardBack(layer: Phaser.GameObjects.Container, card: Card, cx: number, cy: number, aw: number, ah: number, accent: number) {
    layer.add(this.add.rectangle(cx, cy, aw, ah, 0x08101b, 0.98).setStrokeStyle(1, 0x1b2c3e, 0.9));
    layer.add(this.add.rectangle(cx, cy, aw - 18, ah - 18, 0x0d1420, 0.68).setStrokeStyle(1, accent, 0.46));
    layer.add(this.add.rectangle(cx, cy - ah / 2 + 34, aw - 34, 2, accent, 0.42));
    layer.add(this.add.rectangle(cx, cy + ah / 2 - 34, aw - 34, 2, accent, 0.42));
    layer.add(this.add.triangle(cx - aw / 2 + 22, cy - ah / 2 + 22, 0, 0, 28, 0, 0, 28, accent, 0.8));
    layer.add(this.add.triangle(cx + aw / 2 - 22, cy + ah / 2 - 22, 0, 0, -28, 0, 0, -28, accent, 0.62));
    layer.add(this.add.text(cx, cy - 52, this.cardFamilyLabel(card).toUpperCase(), {
      fontFamily: UI_FONT,
      fontSize: '12px',
      fontStyle: UI_BOLD,
      color: this.hexColor(accent),
      align: 'center',
      fixedWidth: aw - 34,
    }).setResolution(2).setOrigin(0.5));
    const lockedIcon = addUiIconImage(this, 'codex-locked-card-medallion', cx, cy - 4, 28);
    if (lockedIcon) {
      layer.add(lockedIcon.setAlpha(0.42).setTint(0x7f93a8));
    } else {
      layer.add(this.add.text(cx, cy - 6, '?', {
        fontFamily: 'Georgia, serif',
        fontSize: '68px',
        fontStyle: UI_BOLD,
        color: '#344558',
        stroke: '#05070c',
        strokeThickness: 2,
      }).setResolution(2).setOrigin(0.5));
    }
    layer.add(this.add.text(cx, cy + 66, 'UNFOUND', {
      fontFamily: UI_FONT,
      fontSize: '12px',
      fontStyle: UI_BOLD,
      color: UI_MUTED,
      align: 'center',
      fixedWidth: aw - 34,
    }).setResolution(2).setOrigin(0.5));
  }

  private renderThumb(layer: Phaser.GameObjects.Container, card: Card, cx: number, cy: number) {
    // The art is a complete 2:3 card illustration - show it whole, undistorted.
    const aw = 184;
    const ah = Math.round(aw * 1.5); // exact 2:3, no smashing
    const w = aw + 8;
    const h = ah + 8;
    const found = this.discovered.has(card.id);
    const accent = this.cardAccent(card);
    const bg = this.add.rectangle(cx, cy, w, h, found ? 0x0e131d : 0x0a0d13, found ? 1 : 0.9)
      .setStrokeStyle(found ? 3 : 2, found ? accent : 0x232b35, found ? 1 : 0.7)
      .setInteractive({ useHandCursor: found });
    bg.on('pointerover', () => bg.setFillStyle(found ? 0x162235 : 0x0d1420, found ? 1 : 0.94));
    bg.on('pointerout', () => bg.setFillStyle(found ? 0x0e131d : 0x0a0d13, found ? 1 : 0.9));
    if (found) bg.on('pointerdown', () => this.openCodexDetail(card.id));
    layer.add(bg);
    addCodexEntryFrame(this, (obj) => layer.add(obj), { cx, cy, w, h }, {
      alpha: found ? 0.38 : 0.26,
      tint: found ? undefined : 0x7f93a8,
      padX: 18,
      padY: 20
    });

    const key = compactCardArtKey(card);
    if (found && key && this.textures.exists(key)) {
      layer.add(this.add.image(cx, cy, key).setDisplaySize(aw, ah).setAlpha(0.99));
      // Cost badge (gameplay info not shown in the illustration).
      layer.add(this.add.circle(cx - aw / 2 + 18, cy - ah / 2 + 18, 15, card.cost === 0 ? 0x24d0d6 : 0xe8b830, 1).setStrokeStyle(2, 0x05080e, 0.95));
      layer.add(this.add.text(cx - aw / 2 + 18, cy - ah / 2 + 18, `${card.cost}`, { fontFamily: UI_FONT, fontSize: '16px', fontStyle: UI_BOLD, color: '#06101c' }).setOrigin(0.5));
    } else if (found && renderSnagCardBorder(this, (obj) => layer.add(obj), card, cx, cy, aw, ah, 0.99)) {
      // Snag cards use their own border template even before full illustration art exists.
    } else if (found) {
      layer.add(this.add.text(cx, cy, displayName(card), { fontFamily: UI_FONT, fontSize: '15px', fontStyle: UI_BOLD, color: UI_BODY, align: 'center', wordWrap: { width: aw - 16 } }).setOrigin(0.5));
      this.addCodexChip(layer, cx, cy + 72, 118, this.cardFamilyLabel(card), accent, true);
    } else {
      this.drawLockedCardBack(layer, card, cx, cy, aw, ah, accent);
    }
  }

  private waymarkAccent(mark: RuntimeRouteMark) {
    switch (mark.family) {
      case 'safety': return 0x8fd6a0;
      case 'route': return 0x7ab8d6;
      case 'economy': return 0xe8c24a;
      case 'suit': return 0xc9a6ff;
      case 'molt': return 0xff9b6a;
      case 'bossPrep': return 0xff6b57;
      default: return 0x8fa3b6;
    }
  }

  private waymarkFamilyLabel(mark: RuntimeRouteMark) {
    switch (mark.family) {
      case 'safety': return 'Shelter';
      case 'route': return 'Tempo';
      case 'economy': return 'Economy';
      case 'suit': return 'Suit Engine';
      case 'molt': return 'Molt';
      case 'bossPrep': return 'Boss';
      default: return mark.family;
    }
  }

  private supplyAccent(supply: RuntimeSupply) {
    switch (supply.category) {
      case 'snack': return 0x8fd6a0;
      case 'flare': return 0xffb86b;
      case 'tool': return 0x7ab8d6;
      case 'call': return 0xc9a6ff;
      default: return 0x8fa3b6;
    }
  }

  private supplyCategoryLabel(supply: RuntimeSupply) {
    switch (supply.category) {
      case 'snack': return 'Snack';
      case 'flare': return 'Flare';
      case 'tool': return 'Tool';
      case 'call': return 'Call';
      default: return supply.category;
    }
  }

  private supplyTimingLabel(supply: RuntimeSupply) {
    switch (supply.timing) {
      case 'combat': return 'Combat';
      case 'route': return 'Route';
      case 'either': return 'Either';
      default: return supply.timing;
    }
  }

  private supplyAnswerLabel(supply: RuntimeSupply) {
    switch (supply.answerType) {
      case 'coverNow': return 'Cover';
      case 'drawNow': return 'Draw';
      case 'wingbeatNow': return 'Wingbeat';
      case 'healNow': return 'Healing';
      case 'openSkySafety': return 'Open Sky';
      case 'tellControl': return 'Plan';
      case 'damageNow': return 'Damage';
      case 'antiCover': return 'Anti-Cover';
      case 'cleanseNow': return 'Cleanse';
      case 'handFix': return 'Hand Fix';
      case 'moltNow': return 'Molt';
      case 'burstNow': return 'Burst';
      default: return supply.answerType;
    }
  }

  private supplyGlyph(supply: RuntimeSupply) {
    switch (supply.category) {
      case 'snack': return 'S';
      case 'flare': return 'F';
      case 'tool': return 'T';
      case 'call': return 'C';
      default: return '?';
    }
  }

  private renderSupplyThumb(layer: Phaser.GameObjects.Container, supply: RuntimeSupply, cx: number, cy: number) {
    const w = 252;
    const h = 154;
    const accent = this.supplyAccent(supply);
    const bg = this.add.rectangle(cx, cy, w, h, 0x0d1720, 0.96)
      .setStrokeStyle(2, accent, 0.9)
      .setInteractive({ useHandCursor: true });
    bg.on('pointerover', () => bg.setFillStyle(0x142334, 0.98));
    bg.on('pointerout', () => bg.setFillStyle(0x0d1720, 0.96));
    bg.on('pointerdown', () => this.openCodexDetail(supply.id));
    layer.add(bg);
    addCodexEntryFrame(this, (obj) => layer.add(obj), { cx, cy, w, h }, { alpha: 0.42, padX: 18, padY: 18 });
    layer.add(this.add.rectangle(cx, cy - h / 2 + 7, w - 16, 4, accent, 0.82));
    const artAsset = supplyCompactArtAssets[supply.id];
    if (artAsset && this.textures.exists(artAsset.key)) {
      layer.add(addSupplyArtImage(this, cx - 92, cy - 34, artAsset.key).setDisplaySize(70, 70));
    } else {
      layer.add(this.add.text(cx - 92, cy - 35, this.supplyGlyph(supply), {
        fontFamily: UI_FONT, fontSize: '22px', fontStyle: UI_BOLD, color: '#e7eef7'
      }).setOrigin(0.5));
    }
    layer.add(this.add.text(cx - 48, cy - 58, supply.name, {
      fontFamily: UI_FONT, fontSize: '16px', fontStyle: UI_BOLD, color: UI_GOLD,
      wordWrap: { width: 168 }
    }).setOrigin(0, 0));
    layer.add(this.add.text(cx - 48, cy - 20, `${this.supplyCategoryLabel(supply)} / ${supply.rarity}`, {
      fontFamily: UI_FONT, fontSize: '11px', fontStyle: UI_BOLD, color: UI_CYAN,
      wordWrap: { width: 168 }
    }).setOrigin(0, 0));
    this.addCodexChip(layer, cx - 58, cy + 11, 98, this.supplyTimingLabel(supply), accent);
    this.addCodexChip(layer, cx + 52, cy + 11, 106, this.supplyAnswerLabel(supply), accent);
    layer.add(this.add.text(cx - 112, cy + 38, compactEffectSummary(supply.effects, 94), {
      fontFamily: UI_FONT, fontSize: '12px', color: UI_BODY,
      align: 'center', wordWrap: { width: w - 28 },
      maxLines: 2
    }).setOrigin(0, 0));
  }

  private renderSupplyDetail(id: string) {
    const supply = alphaSupplyLibrary.get(id);
    if (!supply) return;
    const scrim = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x05070c, 0.76).setInteractive();
    scrim.on('pointerdown', () => this.closeCodexDetail());
    this.root.add(scrim);

    const px = GAME_WIDTH / 2;
    const py = GAME_HEIGHT / 2;
    const MW = 780;
    const MH = 560;
    const left = px - MW / 2;
    const top = py - MH / 2;
    const accent = this.supplyAccent(supply);
    const accentText = `#${accent.toString(16).padStart(6, '0')}`;
    const artAsset = supplyArtAssets[supply.id];
    this.root.add(this.add.rectangle(px, py, MW, MH, 0x0c1420, 0.995).setStrokeStyle(2, accent, 1));
    addCodexDossierFrame(this, (obj) => this.root.add(obj), { cx: px, cy: py, w: MW, h: MH }, { alpha: 0.88 });
    if (artAsset && this.textures.exists(artAsset.key)) {
      this.root.add(addSupplyArtImage(this, left + 92, top + 92, artAsset.key).setDisplaySize(126, 126));
    } else {
      this.root.add(this.add.text(left + 92, top + 91, this.supplyGlyph(supply), {
        fontFamily: UI_FONT, fontSize: '38px', fontStyle: UI_BOLD, color: '#e7eef7'
      }).setOrigin(0.5));
    }

    const tx = left + 168;
    const wrap = MW - 214;
    let yy = top + 48;
    this.root.add(this.add.text(tx, yy, supply.name, {
      fontFamily: UI_FONT, fontSize: '30px', fontStyle: UI_BOLD, color: UI_GOLD,
      wordWrap: { width: wrap }
    }));
    yy += 42;
    this.root.add(this.add.text(tx, yy, `${this.supplyCategoryLabel(supply)} Supply / ${supply.rarity} / ${this.supplyTimingLabel(supply)}`, {
      fontFamily: UI_FONT, fontSize: '13px', fontStyle: UI_BOLD, color: UI_MUTED,
      wordWrap: { width: wrap }
    }));
    yy += 28;
    this.root.add(this.add.text(tx, yy, 'TAGS', { fontFamily: UI_FONT, fontSize: '11px', fontStyle: UI_BOLD, color: accentText }));
    yy += 22;
    this.addCodexTagRow(this.root, tx, yy, supplySynergyTags(supply), accent, wrap, true);
    yy += 34;
    this.root.add(this.add.text(tx, yy, 'USE', { fontFamily: UI_FONT, fontSize: '11px', fontStyle: UI_BOLD, color: accentText }));
    yy += 18;
    const effect = this.add.text(tx, yy, supply.description, {
      fontFamily: UI_FONT, fontSize: '17px', fontStyle: UI_BOLD, color: '#cfe0ef',
      lineSpacing: 4, wordWrap: { width: wrap }
    });
    this.root.add(effect);
    yy += effect.height + 24;
    this.root.add(this.add.text(tx, yy, 'SUMMARY', { fontFamily: UI_FONT, fontSize: '11px', fontStyle: UI_BOLD, color: accentText }));
    yy += 18;
    const summary = this.add.text(tx, yy, compactEffectSummary(supply.effects, 168, 2), {
      fontFamily: UI_FONT, fontSize: '14px', fontStyle: UI_BOLD, color: '#ffe1a3',
      lineSpacing: 3, wordWrap: { width: wrap }, maxLines: 3
    });
    this.root.add(summary);
    yy += summary.height + 18;
    this.root.add(this.add.text(tx, yy, 'RULES', { fontFamily: UI_FONT, fontSize: '11px', fontStyle: UI_BOLD, color: accentText }));
    yy += 18;
    this.root.add(this.add.text(tx, yy, supply.effects.join(' -> '), {
      fontFamily: UI_FONT, fontSize: '13px', color: '#9fb1c4',
      wordWrap: { width: wrap },
      maxLines: 2
    }));
    yy += 38;
    this.root.add(this.add.text(tx, yy, 'ROLE', { fontFamily: UI_FONT, fontSize: '11px', fontStyle: UI_BOLD, color: accentText }));
    yy += 18;
    this.root.add(this.add.text(tx, yy, `${this.supplyAnswerLabel(supply)} answer. Can be packed in a supply slot and consumed once.`, {
      fontFamily: 'Georgia, serif', fontSize: '15px', fontStyle: 'italic', color: '#d9c8ff',
      lineSpacing: 4, wordWrap: { width: wrap }
    }));
    this.renderCodexCloseControl(left + MW - 30, top + 30, () => this.closeCodexDetail());
  }

  private renderWaymarkThumb(layer: Phaser.GameObjects.Container, mark: RuntimeRouteMark, cx: number, cy: number) {
    const w = 252;
    const h = 154;
    const accent = this.waymarkAccent(mark);
    const bg = this.add.rectangle(cx, cy, w, h, 0x0d1420, 0.96)
      .setStrokeStyle(2, accent, 0.9)
      .setInteractive({ useHandCursor: true });
    bg.on('pointerover', () => bg.setFillStyle(0x142033, 0.98));
    bg.on('pointerout', () => bg.setFillStyle(0x0d1420, 0.96));
    bg.on('pointerdown', () => this.openCodexDetail(mark.id));
    layer.add(bg);
    addCodexEntryFrame(this, (obj) => layer.add(obj), { cx, cy, w, h }, { alpha: 0.42, padX: 18, padY: 18 });
    layer.add(this.add.rectangle(cx, cy - h / 2 + 7, w - 16, 4, accent, 0.82));

    const artAsset = waymarkCompactArtAssets[mark.id];
    if (artAsset && this.textures.exists(artAsset.key)) {
      layer.add(addWaymarkArtImage(this, cx - 92, cy - 34, artAsset.key).setDisplaySize(70, 70));
    } else {
      layer.add(this.add.text(cx - 92, cy - 35, waymarkGlyph(mark), {
        fontFamily: UI_FONT, fontSize: '22px', fontStyle: UI_BOLD, color: '#e7eef7'
      }).setOrigin(0.5));
    }
    layer.add(this.add.text(cx - 48, cy - 58, mark.name, {
      fontFamily: UI_FONT, fontSize: '16px', fontStyle: UI_BOLD, color: UI_GOLD,
      wordWrap: { width: 168 }
    }).setOrigin(0, 0));
    layer.add(this.add.text(cx - 48, cy - 20, `${this.waymarkFamilyLabel(mark)} / ${mark.rarity}`, {
      fontFamily: UI_FONT, fontSize: '11px', fontStyle: UI_BOLD, color: UI_CYAN,
      wordWrap: { width: 168 }
    }).setOrigin(0, 0));
    this.addCodexChip(layer, cx - 58, cy + 11, 98, this.waymarkFamilyLabel(mark), accent);
    this.addCodexChip(layer, cx + 52, cy + 11, 106, mark.source, accent);
    layer.add(this.add.text(cx - 112, cy + 38, compactEffectSummary(routeMarkEffectText(mark), 94), {
      fontFamily: UI_FONT, fontSize: '12px', color: UI_BODY,
      align: 'center', wordWrap: { width: w - 28 },
      maxLines: 2
    }).setOrigin(0, 0));
  }

  private renderWaymarkDetail(id: string) {
    const mark = alphaRouteMarkLibrary.get(id);
    if (!mark) return;
    const scrim = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x05070c, 0.76).setInteractive();
    scrim.on('pointerdown', () => this.closeCodexDetail());
    this.root.add(scrim);

    const px = GAME_WIDTH / 2;
    const py = GAME_HEIGHT / 2;
    const MW = 780;
    const MH = 520;
    const left = px - MW / 2;
    const top = py - MH / 2;
    const accent = this.waymarkAccent(mark);
    const accentText = `#${accent.toString(16).padStart(6, '0')}`;
    this.root.add(this.add.rectangle(px, py, MW, MH, 0x0c1420, 0.995).setStrokeStyle(2, accent, 1));
    addCodexDossierFrame(this, (obj) => this.root.add(obj), { cx: px, cy: py, w: MW, h: MH }, { alpha: 0.88 });
    const artAsset = waymarkArtAssets[mark.id];
    if (artAsset && this.textures.exists(artAsset.key)) {
      this.root.add(addWaymarkArtImage(this, left + 92, top + 92, artAsset.key).setDisplaySize(126, 126));
    } else {
      this.root.add(this.add.text(left + 92, top + 91, waymarkGlyph(mark), {
        fontFamily: UI_FONT, fontSize: '36px', fontStyle: UI_BOLD, color: '#e7eef7'
      }).setOrigin(0.5));
    }

    const tx = left + 168;
    const wrap = MW - 214;
    let yy = top + 48;
    this.root.add(this.add.text(tx, yy, mark.name, {
      fontFamily: UI_FONT, fontSize: '30px', fontStyle: UI_BOLD, color: UI_GOLD,
      wordWrap: { width: wrap }
    }));
    yy += 42;
    this.root.add(this.add.text(tx, yy, `${this.waymarkFamilyLabel(mark)} Waymark / ${mark.rarity} / ${mark.source}`, {
      fontFamily: UI_FONT, fontSize: '13px', fontStyle: UI_BOLD, color: UI_MUTED,
      wordWrap: { width: wrap }
    }));
    yy += 28;
    this.root.add(this.add.text(tx, yy, 'TAGS', { fontFamily: UI_FONT, fontSize: '11px', fontStyle: UI_BOLD, color: accentText }));
    yy += 22;
    this.addCodexTagRow(this.root, tx, yy, waymarkSynergyTags(mark), accent, wrap, true);
    yy += 34;
    this.root.add(this.add.text(tx, yy, 'EFFECT', { fontFamily: UI_FONT, fontSize: '11px', fontStyle: UI_BOLD, color: accentText }));
    yy += 18;
    const effect = this.add.text(tx, yy, mark.description, {
      fontFamily: UI_FONT, fontSize: '17px', fontStyle: UI_BOLD, color: '#cfe0ef',
      lineSpacing: 4, wordWrap: { width: wrap }
    });
    this.root.add(effect);
    yy += effect.height + 24;
    this.root.add(this.add.text(tx, yy, 'SUMMARY', { fontFamily: UI_FONT, fontSize: '11px', fontStyle: UI_BOLD, color: accentText }));
    yy += 18;
    const summary = this.add.text(tx, yy, compactEffectSummary(routeMarkEffectText(mark), 168, 2), {
      fontFamily: UI_FONT, fontSize: '14px', fontStyle: UI_BOLD, color: '#ffe1a3',
      lineSpacing: 3, wordWrap: { width: wrap }, maxLines: 3
    });
    this.root.add(summary);
    yy += summary.height + 18;
    this.root.add(this.add.text(tx, yy, 'TRIGGER', { fontFamily: UI_FONT, fontSize: '11px', fontStyle: UI_BOLD, color: accentText }));
    yy += 18;
    this.root.add(this.add.text(tx, yy, `${mark.trigger} -> ${routeMarkEffectGrammar(mark)}`, {
      fontFamily: UI_FONT, fontSize: '13px', color: '#9fb1c4',
      wordWrap: { width: wrap },
      maxLines: 2
    }));
    yy += 38;
    this.root.add(this.add.text(tx, yy, 'OBJECT', { fontFamily: UI_FONT, fontSize: '11px', fontStyle: UI_BOLD, color: accentText }));
    yy += 18;
    const flavor = this.add.text(tx, yy, mark.flavorText ?? 'A real route artifact carried by the flock.', {
      fontFamily: 'Georgia, serif', fontSize: '15px', fontStyle: 'italic', color: '#d9c8ff',
      lineSpacing: 4, wordWrap: { width: wrap }
    });
    this.root.add(flavor);

    this.renderCodexCloseControl(left + MW - 30, top + 30, () => this.closeCodexDetail());
  }

  private leaderAccent(leader: typeof flockLeaders[number]) {
    switch (leader.suit) {
      case 'Plumes': return 0xf2a54a;
      case 'Quills': return 0x9fb7d7;
      case 'Basins': return 0x2fc6c9;
      case 'Nests': return 0xe8c24a;
      default: return 0x8fd6a0;
    }
  }

  private renderLeaderThumb(layer: Phaser.GameObjects.Container, leader: typeof flockLeaders[number], cx: number, cy: number) {
    const account = loadAccount();
    const unlocked = isLeaderUnlocked(account, leader.id);
    const wins = account.winsByLeader[leader.id] ?? 0;
    const lore = this.codexData?.getLeaderLore(leader.id);
    const w = 332;
    const h = 214;
    const accent = this.leaderAccent(leader);
    const bg = this.add.rectangle(cx, cy, w, h, unlocked ? 0x0d1420 : 0x0a0d13, unlocked ? 0.98 : 0.92)
      .setStrokeStyle(2, unlocked ? accent : 0x2a3a4d, unlocked ? 0.9 : 0.72)
      .setInteractive({ useHandCursor: true });
    bg.on('pointerover', () => bg.setFillStyle(unlocked ? 0x142033 : 0x0d1420, unlocked ? 1 : 0.94));
    bg.on('pointerout', () => bg.setFillStyle(unlocked ? 0x0d1420 : 0x0a0d13, unlocked ? 0.98 : 0.92));
    bg.on('pointerdown', () => this.openCodexDetail(leader.id));
    layer.add(bg);
    addCodexEntryFrame(this, (obj) => layer.add(obj), { cx, cy, w, h }, {
      alpha: unlocked ? 0.42 : 0.26,
      tint: unlocked ? undefined : 0x7f93a8,
      padX: 20,
      padY: 18
    });
    layer.add(this.add.rectangle(cx, cy - h / 2 + 8, w - 18, 4, unlocked ? accent : 0x2a3a4d, unlocked ? 0.84 : 0.6));

    const art = codexLeaderArtAssets[leader.id];
    if (art && this.textures.exists(art.key)) {
      const fit = this.fittedTextureSize(art.key, 132, 160);
      layer.add(this.add.image(cx - 104, cy - 8, art.key).setDisplaySize(fit.w, fit.h).setAlpha(unlocked ? 0.99 : 0.38));
    } else {
      layer.add(this.add.rectangle(cx - 104, cy - 8, 116, 154, 0x141d2b, 0.9).setStrokeStyle(1, 0x2a3a4d, 0.8));
      layer.add(this.add.text(cx - 104, cy - 12, leader.bird, {
        fontFamily: UI_FONT, fontSize: '13px', fontStyle: UI_BOLD, color: UI_BODY,
        align: 'center', wordWrap: { width: 98 }
      }).setOrigin(0.5));
    }

    layer.add(this.add.text(cx + 26, cy - 86, leader.name, {
      fontFamily: UI_FONT, fontSize: '17px', fontStyle: UI_BOLD, color: unlocked ? '#ffe1a3' : '#6f7d8c',
      wordWrap: { width: 176 }
    }).setOrigin(0.5, 0));
    layer.add(this.add.text(cx + 26, cy - 42, lore?.epithet ?? leader.signatureName, {
      fontFamily: 'Georgia, serif', fontSize: '13px', fontStyle: 'italic', color: unlocked ? '#d9c8ff' : '#657385',
      align: 'center', wordWrap: { width: 176 }
    }).setOrigin(0.5, 0));
    this.addCodexChip(layer, cx - 24, cy + 8, 86, leader.suit, accent, unlocked);
    this.addCodexChip(layer, cx + 72, cy + 8, 86, unlocked ? 'Rallied' : 'Locked', accent, unlocked);
    layer.add(this.add.text(cx + 26, cy + 20, lore?.codexSummary ?? leader.blurb, {
      fontFamily: UI_FONT, fontSize: '12px', color: unlocked ? '#cdd9e6' : '#7f93a8',
      align: 'center', wordWrap: { width: 178 }
    }).setOrigin(0.5, 0));
    layer.add(this.add.text(cx + 26, cy + 76, unlocked ? `${wins} ${wins === 1 ? 'win' : 'wins'}` : 'Locked', {
      fontFamily: UI_FONT, fontSize: '11px', fontStyle: UI_BOLD, color: unlocked ? '#ffe1a3' : '#6f7d8c',
      align: 'center', wordWrap: { width: 176 }
    }).setOrigin(0.5, 0));
  }

  private renderLeaderDetail(id: string) {
    const leader = getLeader(id);
    const lore = this.codexData?.getLeaderLore(leader.id);
    if (!lore) return;
    const account = loadAccount();
    const unlocked = isLeaderUnlocked(account, leader.id);
    const wins = account.winsByLeader[leader.id] ?? 0;
    const scrim = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x05070c, 0.76).setInteractive();
    scrim.on('pointerdown', () => this.closeCodexDetail());
    this.root.add(scrim);

    const px = GAME_WIDTH / 2;
    const py = GAME_HEIGHT / 2;
    const MW = 980;
    const MH = 624;
    const left = px - MW / 2;
    const right = px + MW / 2;
    const mTop = py - MH / 2;
    const mBottom = py + MH / 2;
    const accent = this.leaderAccent(leader);
    const accentText = `#${accent.toString(16).padStart(6, '0')}`;
    this.root.add(this.add.rectangle(px, py, MW, MH, 0x0c1420, 0.995).setStrokeStyle(2, accent, 1));
    addCodexDossierFrame(this, (obj) => this.root.add(obj), { cx: px, cy: py, w: MW, h: MH }, { alpha: 0.9 });

    const art = codexLeaderArtAssets[leader.id];
    const artBoxX = left + 205;
    const artBoxY = py + 24;
    this.renderCodexArtPreviewBacking(artBoxX, artBoxY, 348, 516, accent);
    if (art && this.textures.exists(art.key)) {
      const fit = this.fittedTextureSize(art.key, 340, 500);
      this.root.add(this.add.image(artBoxX, artBoxY, art.key).setDisplaySize(fit.w, fit.h).setAlpha(unlocked ? 0.99 : 0.42));
    } else {
      this.root.add(this.add.rectangle(artBoxX, artBoxY, 320, 480, 0x141d2b, 0.9).setStrokeStyle(1, 0x2a3a4d, 0.8));
      this.root.add(this.add.text(artBoxX, artBoxY, leader.bird, {
        fontFamily: UI_FONT, fontSize: '20px', fontStyle: UI_BOLD, color: UI_BODY,
        align: 'center', wordWrap: { width: 260 }
      }).setOrigin(0.5));
    }
    this.renderCodexArtPreviewFrame(artBoxX, artBoxY, 348, 516, unlocked ? 0.82 : 0.52);
    if (!unlocked) {
      this.root.add(this.add.rectangle(artBoxX, artBoxY + 224, 260, 36, 0x05070c, 0.8).setStrokeStyle(1, 0x2a3a4d, 0.85));
      this.root.add(this.add.text(artBoxX, artBoxY + 224, leaderUnlockHints[leader.id] ?? 'Locked', {
        fontFamily: UI_FONT, fontSize: '13px', fontStyle: UI_BOLD, color: UI_GOLD,
        align: 'center', wordWrap: { width: 238 }
      }).setOrigin(0.5));
    }

    const tx = left + 410;
    const wrap = right - tx - 118;
    const viewTop = mTop + 86;
    const viewBottom = mBottom - 124;
    const viewH = viewBottom - viewTop;
    let yy = viewTop - this.detailScroll;
    const heading = (t: string, color: string) => {
      this.root.add(this.add.text(tx, yy, t, { fontFamily: UI_FONT, fontSize: '11px', fontStyle: UI_BOLD, color }));
      yy += 17;
    };
    const para = (t: string, opts: { color?: string; size?: number; italic?: boolean; bold?: boolean } = {}) => {
      const o = this.add.text(tx, yy, t, {
        fontFamily: opts.italic ? 'Georgia, serif' : 'Arial',
        fontSize: `${opts.size ?? 13}px`,
        fontStyle: opts.bold ? 'bold' : opts.italic ? 'italic' : 'normal',
        color: opts.color ?? '#cfe0ef',
        lineSpacing: 3,
        wordWrap: { width: wrap }
      });
      this.root.add(o);
      yy += o.height;
    };

    this.root.add(this.add.text(tx, yy, leader.name, {
      fontFamily: UI_FONT, fontSize: '29px', fontStyle: UI_BOLD, color: UI_GOLD,
      wordWrap: { width: wrap }
    }));
    yy += 38;
    this.root.add(this.add.text(tx, yy, lore.epithet, {
      fontFamily: 'Georgia, serif', fontSize: '17px', fontStyle: 'italic', color: '#d9c8ff',
      wordWrap: { width: wrap }
    }));
    yy += 29;
    this.root.add(this.add.text(tx, yy, `${leader.bird} / ${leader.suit} Leader / ${unlocked ? `${wins} career ${wins === 1 ? 'win' : 'wins'}` : 'Locked'}`, {
      fontFamily: UI_FONT, fontSize: '13px', fontStyle: UI_BOLD, color: UI_MUTED,
      wordWrap: { width: wrap }
    }));
    yy += 28;

    heading('ROLE', accentText);
    para(lore.flockRole, { size: 14, bold: true, color: '#dbe6f0' });
    yy += 12;

    heading('BACKSTORY', '#7f93a8');
    para(lore.backstory, { size: 13 });
    yy += 12;

    heading('NARRATIVE BEATS', '#8df4ff');
    lore.narrativeBeats.forEach((beat) => {
      para(`- ${beat}`, { size: 13, color: '#dbe6f0' });
      yy += 5;
    });
    yy += 8;

    heading('COMBAT READ', '#e8c24a');
    para(lore.playstyleRead, { size: 13, bold: true, color: UI_GOLD });
    yy += 12;

    heading('SIGNATURE', '#c9a6ff');
    para(`${leader.signatureName}: ${leader.signatureText}`, { size: 13, color: '#d9c8ff' });
    yy += 12;

    heading('STARTING DECK', '#7f93a8');
    const starterNames = leader.startingDeckIds
      .map((cardId) => cardLibrary[cardId])
      .filter((card): card is Card => Boolean(card))
      .map((card) => displayName(card));
    para(starterNames.join(' / '), { size: 12, color: UI_SOFT });
    yy += 12;

    heading(unlocked ? 'FIELD QUOTE' : 'LOCKED NOTE', unlocked ? '#8fd6a0' : '#ff9b6a');
    para(unlocked ? `"${lore.quote}"` : lore.unlockFlavor, { size: 14, italic: true, color: unlocked ? '#bfe9cc' : '#ffd5cc' });

    const contentBottom = yy + this.detailScroll;
    const SCROLL_PAD = 16;
    this.detailMaxScroll = Math.max(0, (contentBottom - viewTop) - viewH + SCROLL_PAD);
    this.detailScrollTarget = clamp(this.detailScrollTarget, 0, this.detailMaxScroll);
    this.detailScroll = clamp(this.detailScroll, 0, this.detailMaxScroll);

    const closeDetail = () => this.closeCodexDetail();
    const curtainX = tx - 24;
    const curtainW = right - curtainX - 1;
    this.root.add(this.add.rectangle(0, 0, GAME_WIDTH, mTop, 0x070a11, 1).setOrigin(0, 0).setInteractive().on('pointerdown', closeDetail));
    this.root.add(this.add.rectangle(0, mBottom, GAME_WIDTH, GAME_HEIGHT - mBottom, 0x070a11, 1).setOrigin(0, 0).setInteractive().on('pointerdown', closeDetail));
    this.root.add(this.add.rectangle(curtainX, mTop + 1, curtainW, viewTop - mTop - 1, 0x0c1420, 1).setOrigin(0, 0).setInteractive());
    this.root.add(this.add.rectangle(curtainX, viewBottom, curtainW, mBottom - viewBottom - 1, 0x0c1420, 1).setOrigin(0, 0).setInteractive());
    this.root.add(this.add.rectangle(px, py, MW, MH, 0x000000, 0).setStrokeStyle(2, accent, 1));
    this.renderCodexDossierHeader(left, right, mTop, 'FLOCK LEADER DOSSIER', `ID ${leader.id.toUpperCase().replace(/_/g, '-')}`, accent, accentText);
    this.root.add(this.add.rectangle(tx - 18, (viewTop + viewBottom) / 2, 2, viewH - 8, accent, 0.5));

    if (this.detailMaxScroll > 0) {
      this.renderCodexScrollCue(right - 64, mBottom - 18, this.detailScroll >= this.detailMaxScroll);
    }

    this.renderCodexCloseControl(right - 26, mTop + 26, closeDetail);
  }

  private fittedTextureSize(key: string, maxW: number, maxH: number) {
    const src = this.textures.get(key).getSourceImage() as { width?: number; height?: number };
    const iw = Math.max(1, src.width ?? maxW);
    const ih = Math.max(1, src.height ?? maxH);
    const scale = Math.min(maxW / iw, maxH / ih);
    return { w: iw * scale, h: ih * scale };
  }

  private renderCodexArtPreviewBacking(cx: number, cy: number, w: number, h: number, accent: number) {
    const key = uiIconAssets['codex-art-preview-frame'].key;
    const hasFrame = this.textures.exists(key);
    this.root.add(this.add.rectangle(cx, cy, w, h, 0x05080e, hasFrame ? 0.42 : 0.78)
      .setStrokeStyle(hasFrame ? 1 : 2, accent, hasFrame ? 0.28 : 0.72));
  }

  private renderCodexArtPreviewFrame(cx: number, cy: number, w: number, h: number, alpha = 0.86) {
    const key = uiIconAssets['codex-art-preview-frame'].key;
    const hasFrame = this.textures.exists(key);
    if (!hasFrame) return;
    this.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);
    const frame = this.add.image(cx, cy, key)
      .setDisplaySize(w + 24, h + 40)
      .setAlpha(alpha)
      .setName('codex-art-preview-frame');
    this.root.add(frame);
  }

  private textureVisibleBounds(key: string): TextureVisibleBounds {
    const cached = this.textureBoundsCache.get(key);
    if (cached) return cached;

    const src = this.textures.get(key).getSourceImage() as CanvasImageSource & { width?: number; height?: number };
    const width = Math.max(1, Number(src.width ?? 1));
    const height = Math.max(1, Number(src.height ?? 1));
    let bounds: TextureVisibleBounds = { left: 0, right: 1, top: 0, bottom: 1 };

    try {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        ctx.drawImage(src, 0, 0, width, height);
        const alpha = ctx.getImageData(0, 0, width, height).data;
        let minX = width;
        let minY = height;
        let maxX = -1;
        let maxY = -1;
        const alphaThreshold = 28;
        for (let y = 0; y < height; y += 1) {
          for (let x = 0; x < width; x += 1) {
            if (alpha[(y * width + x) * 4 + 3] <= alphaThreshold) continue;
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
          }
        }
        if (maxX >= minX && maxY >= minY) {
          bounds = {
            left: minX / width,
            right: (maxX + 1) / width,
            top: minY / height,
            bottom: (maxY + 1) / height,
          };
        }
      }
    } catch {
      // Fall back to the full texture box if the browser refuses pixel reads.
    }

    this.textureBoundsCache.set(key, bounds);
    return bounds;
  }

  private enemyShadowMetrics(key: string, imageX: number, imageY: number, fitW: number, fitH: number, maxW: number, maxH: number) {
    const bounds = this.textureVisibleBounds(key);
    const visibleW = fitW * Math.max(0.05, bounds.right - bounds.left);
    const visibleH = fitH * Math.max(0.05, bounds.bottom - bounds.top);
    const visibleCenterX = imageX - fitW / 2 + fitW * ((bounds.left + bounds.right) / 2);
    const visibleBottom = imageY - fitH / 2 + fitH * bounds.bottom;
    const shadowW = Math.max(maxW * 0.34, Math.min(maxW * 0.84, visibleW * 0.78));
    const shadowH = Math.max(8, Math.min(maxH * 0.18, visibleH * 0.11));
    return {
      x: visibleCenterX,
      y: Math.min(imageY + maxH / 2 - shadowH * 0.45, visibleBottom - shadowH * 0.18),
      w: shadowW,
      h: shadowH,
    };
  }

  private enemyArtAsset(enemy: CodexEnemyEntry) {
    return enemy.source === 'reserve' ? reserveEnemyArtAsset(enemy.id) : enemyArtAssets[enemy.id];
  }

  private renderEnemyThumb(layer: Phaser.GameObjects.Container, enemy: CodexEnemyEntry, cx: number, cy: number) {
    const w = 252;
    const h = 206;
    const accent = this.enemyAccent(enemy);
    const artX = cx - 68;
    const artY = cy - 22;
    const artW = 108;
    const artH = 124;
    const textX = cx + 42;
    const textW = 122;
    const bg = this.add.rectangle(cx, cy, w, h, 0x0d1420, 0.96)
      .setStrokeStyle(1, 0x22364d, 0.84)
      .setInteractive({ useHandCursor: true });
    bg.on('pointerover', () => bg.setFillStyle(0x142033, 0.98));
    bg.on('pointerout', () => bg.setFillStyle(0x0d1420, 0.96));
    bg.on('pointerdown', () => this.openCodexDetail(enemy.id));
    layer.add(bg);
    addCodexEntryFrame(this, (obj) => layer.add(obj), { cx, cy, w, h }, { alpha: 0.42, padX: 18, padY: 18 });
    layer.add(this.add.rectangle(cx, cy - h / 2 + 7, w - 18, 3, accent, 0.62));
    layer.add(this.add.rectangle(cx - w / 2 + 8, cy - h / 2 + 28, 3, 42, accent, 0.7));

    const art = this.enemyArtAsset(enemy);
    if (art && this.textures.exists(art.key)) {
      const fit = this.fittedTextureSize(art.key, artW, artH);
      const shadow = this.enemyShadowMetrics(art.key, artX, artY, fit.w, fit.h, artW, artH);
      layer.add(this.add.ellipse(shadow.x, shadow.y, shadow.w, shadow.h, 0x020409, 0.3));
      layer.add(this.add.image(artX, artY, art.key).setDisplaySize(fit.w, fit.h).setAlpha(0.99));
    } else {
      layer.add(this.add.rectangle(artX, artY, artW, artH, 0x141d2b, 0.9).setStrokeStyle(1, 0x22364d, 0.8));
      layer.add(this.add.text(artX, artY - 2, enemy.typeHint, {
        fontFamily: UI_FONT, fontSize: '13px', fontStyle: UI_BOLD, color: UI_BODY,
        align: 'center', wordWrap: { width: artW - 14 }
      }).setOrigin(0.5));
    }

    layer.add(this.add.text(textX, cy - 82, enemy.name, {
      fontFamily: UI_FONT, fontSize: '16px', fontStyle: UI_BOLD, color: UI_GOLD,
      align: 'center', wordWrap: { width: textW }
    }).setOrigin(0.5, 0));
    layer.add(this.add.text(textX, cy - 30, enemy.role, {
      fontFamily: UI_FONT, fontSize: '12px', fontStyle: UI_BOLD, color: UI_CYAN,
      align: 'center', wordWrap: { width: textW }
    }).setOrigin(0.5, 0));
    this.addCodexChip(layer, textX, cy - 1, 108, enemy.source === 'encounter' ? enemy.typeHint : 'Concept', accent);
    layer.add(this.add.text(textX, cy + 8, enemy.district, {
      fontFamily: UI_FONT, fontSize: '11px', color: UI_MUTED,
      align: 'center', wordWrap: { width: textW }
    }).setOrigin(0.5, 0));
    const bossProgress = this.codexBossView(enemy);
    const footer = enemy.typeHint === 'Boss'
      ? `DOSSIER  ${bossProgress.observed} / ${bossProgress.total} TACTICS`
      : enemy.varietyContribution;
    layer.add(this.add.text(cx, cy + 76, footer, {
      fontFamily: UI_FONT, fontSize: '11px', color: UI_SOFT,
      fontStyle: enemy.typeHint === 'Boss' ? UI_BOLD : '',
      align: 'center', wordWrap: { width: w - 24 }
    }).setOrigin(0.5, 0.5));
  }

  private enemyAccent(enemy: CodexEnemyEntry) {
    if (enemy.district === 'Canal Markets') return 0x2fc6c9;
    if (enemy.district === 'Signal Spires') return 0xc9a6ff;
    if (enemy.district === 'High Roost') return 0xe8c24a;
    return 0x7ab8d6;
  }

  private renderDetail(id: string) {
    const card = cardLibrary[id];
    if (!card) return;
    const scrim = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x05070c, 0.76).setInteractive();
    scrim.on('pointerdown', () => this.closeCodexDetail());
    this.root.add(scrim);

    const px = GAME_WIDTH / 2;
    const py = GAME_HEIGHT / 2;
    const MW = 920;
    const MH = 624;
    const left = px - MW / 2;
    const right = px + MW / 2;
    const mTop = py - MH / 2;
    const mBottom = py + MH / 2;
    const accentColor = this.cardAccent(card);
    const accentText = this.hexColor(accentColor);
    const isAviary = isAviaryCard(card);
    this.root.add(this.add.rectangle(px, py, MW, MH, 0x0c1420, 0.995).setStrokeStyle(2, accentColor, 1));
    addCodexDossierFrame(this, (obj) => this.root.add(obj), { cx: px, cy: py, w: MW, h: MH }, { alpha: 0.9 });

    // Large card art on the left, at the art's true 2:3 aspect (no distortion).
    const key = loadedCardArtKey(this, card);
    const artW = 320;
    const artH = artW * 1.5;
    const artX = left + 24 + artW / 2;
    this.renderCodexArtPreviewBacking(artX, py, artW + 14, artH + 14, accentColor);
    if (key && this.textures.exists(key)) {
      this.root.add(this.add.image(artX, py, key).setDisplaySize(artW, artH).setAlpha(0.99));
    } else {
      this.root.add(this.add.rectangle(artX, py, artW, artH, 0x141d2b, 0.9));
    }
    this.renderCodexArtPreviewFrame(artX, py, artW + 14, artH + 14, 0.86);

    // Right column is a scrollable viewport (lots of content now). Text is drawn
    // in absolute coords offset by -detailScroll, then clipped by opaque curtains
    // top & bottom (WebGL has no geometry masks).
    const tx = artX + artW / 2 + 26;
    const wrap = right - tx - 108;
    const viewTop = mTop + 16;
    const viewBottom = mBottom - 44;
    const viewH = viewBottom - viewTop;
    const flav = this.codexData?.getCardFlavor(card.id);
    const meaning = this.codexData?.getCardMeaning(card.id);
    const accent = accentText;
    let yy = viewTop - this.detailScroll;
    const heading = (t: string, color: string) => { this.root.add(this.add.text(tx, yy, t, { fontFamily: UI_FONT, fontSize: '11px', fontStyle: UI_BOLD, color })); yy += 17; };
    const para = (t: string, opts: { color?: string; size?: number; italic?: boolean }) => {
      const o = this.add.text(tx, yy, t, { fontFamily: opts.italic ? 'Georgia, serif' : 'Arial', fontSize: `${opts.size ?? 13}px`, fontStyle: opts.italic ? 'italic' : 'normal', color: opts.color ?? '#cfe0ef', lineSpacing: 3, wordWrap: { width: wrap } });
      this.root.add(o); yy += o.height;
    };

    // Title block.
    const title = this.add.text(tx, yy, displayName(card), {
      fontFamily: UI_FONT, fontSize: '27px', fontStyle: UI_BOLD, color: UI_GOLD, wordWrap: { width: wrap }
    });
    this.root.add(title);
    yy += Math.max(38, title.height + 7);
    const meta = this.add.text(tx, yy, `${cardLabel(card)} / Cost ${card.cost}${flav?.bird ? ` / ${flav.bird}` : ''}`, {
      fontFamily: UI_FONT, fontSize: '13px', fontStyle: UI_BOLD, color: UI_MUTED, wordWrap: { width: wrap }
    });
    this.root.add(meta);
    yy += Math.max(26, meta.height + 8);

    // Effect - base + preened (keywords highlighted, hoverable).
    heading('EFFECT', '#7f93a8');
    yy += renderRichText(this, this.root, tx, yy, card.text, { wrap, fontSize: 15, tooltips: true }) + 6;
    if (card.upgradedText && card.upgradedText !== card.text) {
      this.root.add(this.add.text(tx, yy, 'PREENED  +', { fontFamily: UI_FONT, fontSize: '11px', fontStyle: UI_BOLD, color: '#7fe39a' })); yy += 16;
      yy += renderRichText(this, this.root, tx, yy, card.upgradedText, { wrap, fontSize: 14, baseColor: '#bfe9cc', tooltips: true }) + 12;
    } else { yy += 6; }

    // Molt ability - base + preened.
    if (card.moltText) {
      heading('MOLT ABILITY', '#c8923a');
      yy += renderRichText(this, this.root, tx, yy, card.moltText, { wrap, fontSize: 14, baseColor: '#ffc78f', bold: true, tooltips: true }) + 6;
      if (card.moltTextUpgraded && card.moltTextUpgraded !== card.moltText) {
        this.root.add(this.add.text(tx, yy, 'PREENED  +', { fontFamily: UI_FONT, fontSize: '11px', fontStyle: UI_BOLD, color: '#7fe39a' })); yy += 16;
        yy += renderRichText(this, this.root, tx, yy, card.moltTextUpgraded, { wrap, fontSize: 13, baseColor: '#f0b487', tooltips: true }) + 12;
      } else { yy += 6; }
    }

    // Flock Stats this card contributes to the flock.
    const statLabels: Record<string, string> = {
      cohesion: 'Cohesion', damage: 'Damage', cover: 'Cover', draw: 'Hand Size',
      resonance: 'Resonance/turn', regen: 'Regen/turn', moltPower: 'Molt Power', openSkyGuard: 'Open Sky Guard',
    };
    const statStr = Object.entries(card.runtime.flockStats).map(([k, v]) => `${statLabels[k] ?? k} +${v}`).join(' / ') || 'None';
    heading('FLOCK STATS', '#7f93a8');
    const statText = this.add.text(tx, yy, statStr, { fontFamily: UI_FONT, fontSize: '14px', fontStyle: UI_BOLD, color: UI_CYAN, wordWrap: { width: wrap } });
    const statKw = Object.keys(card.runtime.flockStats).map((k) => statLabels[k] ?? k).find((label) => KEYWORDS[label]);
    if (statKw) {
      statText.setInteractive({ useHandCursor: true });
      statText.on('pointerover', () => showKwTooltip(this, statKw, tx + statText.width / 2, yy));
      statText.on('pointerout', () => hideKwTooltip());
    }
    this.root.add(statText);
    yy += Math.max(30, statText.height + 10);

    if (!this.codexData && this.codexDataPending()) {
      heading(isAviary ? 'AVIARY LEGEND' : 'TAROT MEANING', '#c9a6ff');
      para(isAviary ? 'Loading Aviary notes and bird facts...' : 'Loading tarot notes and bird facts...', { color: '#d9c8ff', italic: true, size: 13 });
      yy += 8;
      this.root.add(this.add.text(tx, yy, isAviary ? 'SIGNAL' : 'UPRIGHT', { fontFamily: UI_FONT, fontSize: '10px', fontStyle: UI_BOLD, color: '#9d86c8' })); yy += 15;
      para('Loading note...', { color: '#cfd9ea', size: 13 }); yy += 8;
      this.root.add(this.add.text(tx, yy, isAviary ? 'SHADOW' : 'REVERSED', { fontFamily: UI_FONT, fontSize: '10px', fontStyle: UI_BOLD, color: '#9d86c8' })); yy += 15;
      para('Loading note...', { color: '#b9a7bd', size: 13 }); yy += 14;
      heading(`ABOUT THE ${(flav?.bird ?? card.bird).toUpperCase()}`, '#e8c24a');
      para('Loading field note...', { color: '#cfe0ef', size: 13 });
      yy += 14;
    } else if (this.codexDataFailed) {
      heading('CODEX NOTES', '#ff9b6a');
      para('Extended Codex notes are unavailable. Gameplay data is still ready.', { color: '#ffd0bd', size: 13 });
      yy += 14;
    }

    // Card meaning - keyword line plus orientation variants.
    if (meaning) {
      heading(isAviary ? 'AVIARY LEGEND' : 'TAROT MEANING', '#c9a6ff');
      if (meaning.core) { para(meaning.core, { color: '#d9c8ff', italic: true, size: 13 }); yy += 8; }
      this.root.add(this.add.text(tx, yy, isAviary ? 'SIGNAL' : 'UPRIGHT', { fontFamily: UI_FONT, fontSize: '10px', fontStyle: UI_BOLD, color: '#9d86c8' })); yy += 15;
      para(meaning.upright, { color: '#cfd9ea', size: 13 }); yy += 8;
      this.root.add(this.add.text(tx, yy, isAviary ? 'SHADOW' : 'REVERSED', { fontFamily: UI_FONT, fontSize: '10px', fontStyle: UI_BOLD, color: '#9d86c8' })); yy += 15;
      para(meaning.reversed, { color: '#b9a7bd', size: 13 }); yy += 14;
    }

    // Real-world bird facts.
    const fact = this.codexData?.getBirdFact(flav?.bird ?? card.bird);
    if (fact) {
      heading(`ABOUT THE ${(flav?.bird ?? card.bird).toUpperCase()}`, '#e8c24a');
      para(fact, { color: '#cfe0ef', size: 13 }); yy += 14;
    }

    const contentBottom = yy + this.detailScroll; // absolute end if scroll were 0
    const SCROLL_PAD = 16; // breathing room below the last line at max scroll
    this.detailMaxScroll = Math.max(0, (contentBottom - viewTop) - viewH + SCROLL_PAD);
    this.detailScrollTarget = clamp(this.detailScrollTarget, 0, this.detailMaxScroll);
    this.detailScroll = clamp(this.detailScroll, 0, this.detailMaxScroll);

    // Clip the scroll viewport (WebGL has no geometry masks, so we paint over the
    // overflow). Two layers: opaque "outside" covers hide anything that bled past
    // the panel edges (above mTop / below mBottom), and panel-bg "inside" curtains
    // restore the panel face over the header/footer scroll gaps. All interactive so
    // they also swallow hovers on keyword tokens scrolled out of view; the outside
    // covers double as click-to-close, matching the scrim.
    const closeDetail = () => this.closeCodexDetail();
    this.root.add(this.add.rectangle(0, 0, GAME_WIDTH, mTop, 0x070a11, 1).setOrigin(0, 0).setInteractive().on('pointerdown', closeDetail));
    this.root.add(this.add.rectangle(0, mBottom, GAME_WIDTH, GAME_HEIGHT - mBottom, 0x070a11, 1).setOrigin(0, 0).setInteractive().on('pointerdown', closeDetail));
    this.root.add(this.add.rectangle(left + 1, mTop + 1, MW - 2, viewTop - mTop - 1, 0x0c1420, 1).setOrigin(0, 0).setInteractive());
    this.root.add(this.add.rectangle(left + 1, viewBottom, MW - 2, mBottom - viewBottom - 1, 0x0c1420, 1).setOrigin(0, 0).setInteractive());
    // Redraw the panel border crisply over the covers.
    this.root.add(this.add.rectangle(px, py, MW, MH, 0x000000, 0).setStrokeStyle(2, accentColor, 1));
    const dossierLabel = this.cardDossierLabel(card);
    const dossierW = Math.max(150, Math.min(190, dossierLabel.length * 9 + 30));
    const dossierX = left + 24 + dossierW / 2;
    this.root.add(this.add.rectangle(dossierX, mTop + 28, dossierW, 28, 0x07101c, 0.96).setStrokeStyle(1, accentColor, 0.9));
    this.root.add(this.add.text(dossierX, mTop + 28, dossierLabel, {
      fontFamily: UI_FONT, fontSize: '11px', fontStyle: UI_BOLD, color: accentText,
      align: 'center', fixedWidth: dossierW - 18,
    }).setResolution(2).setOrigin(0.5));
    // Thin accent rule between art and text column (clipped to the viewport band).
    this.root.add(this.add.rectangle(tx - 14, (viewTop + viewBottom) / 2, 2, viewH - 8, Phaser.Display.Color.HexStringToColor(accent).color, 0.5));

    if (this.detailMaxScroll > 0) {
      this.renderCodexScrollCue(right - 64, mBottom - 18, this.detailScroll >= this.detailMaxScroll);
    }

    this.renderCodexCloseControl(right - 26, mTop + 26, closeDetail);
  }

  private renderEnemyDetail(id: string) {
    const enemy = this.allCodexEnemies().find((entry) => entry.id === id);
    if (!enemy) return;
    const scrim = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x05070c, 0.76).setInteractive();
    scrim.on('pointerdown', () => this.closeCodexDetail());
    this.root.add(scrim);

    const px = GAME_WIDTH / 2;
    const py = GAME_HEIGHT / 2;
    const MW = 980;
    const MH = 624;
    const left = px - MW / 2;
    const right = px + MW / 2;
    const mTop = py - MH / 2;
    const mBottom = py + MH / 2;
    const accent = this.enemyAccent(enemy);
    const accentText = `#${accent.toString(16).padStart(6, '0')}`;
    this.root.add(this.add.rectangle(px, py, MW, MH, 0x0c1420, 0.995).setStrokeStyle(2, accent, 1));
    addCodexDossierFrame(this, (obj) => this.root.add(obj), { cx: px, cy: py, w: MW, h: MH }, { alpha: 0.9 });

    const art = this.enemyArtAsset(enemy);
    const artBoxX = left + 220;
    const artBoxY = py + 24;
    this.renderCodexArtPreviewBacking(artBoxX, artBoxY, 372, 516, accent);
    if (art && this.textures.exists(art.key)) {
      const fit = this.fittedTextureSize(art.key, 360, 500);
      const shadow = this.enemyShadowMetrics(art.key, artBoxX, artBoxY, fit.w, fit.h, 360, 500);
      this.root.add(this.add.ellipse(shadow.x, shadow.y, shadow.w, shadow.h, 0x020409, 0.34));
      this.root.add(this.add.image(artBoxX, artBoxY, art.key).setDisplaySize(fit.w, fit.h).setAlpha(0.99));
    } else {
      this.root.add(this.add.rectangle(artBoxX, artBoxY, 340, 480, 0x141d2b, 0.9).setStrokeStyle(1, 0x2a3a4d, 0.8));
      this.root.add(this.add.text(artBoxX, artBoxY, enemy.typeHint, {
        fontFamily: UI_FONT, fontSize: '20px', fontStyle: UI_BOLD, color: UI_BODY,
        align: 'center', wordWrap: { width: 280 }
      }).setOrigin(0.5));
    }
    this.renderCodexArtPreviewFrame(artBoxX, artBoxY, 372, 516, 0.84);

    const tx = left + 430;
    const wrap = right - tx - 118;
    const viewTop = mTop + 86;
    const viewBottom = mBottom - 124;
    const viewH = viewBottom - viewTop;
    let yy = viewTop - this.detailScroll;
    const heading = (t: string, color: string) => {
      this.root.add(this.add.text(tx, yy, t, { fontFamily: UI_FONT, fontSize: '11px', fontStyle: UI_BOLD, color }));
      yy += 17;
    };
    const para = (t: string, opts: { color?: string; size?: number; italic?: boolean; bold?: boolean } = {}) => {
      const o = this.add.text(tx, yy, t, {
        fontFamily: opts.italic ? 'Georgia, serif' : 'Arial',
        fontSize: `${opts.size ?? 13}px`,
        fontStyle: opts.bold ? 'bold' : opts.italic ? 'italic' : 'normal',
        color: opts.color ?? '#cfe0ef',
        lineSpacing: 3,
        wordWrap: { width: wrap }
      });
      this.root.add(o);
      yy += o.height;
    };

    this.root.add(this.add.text(tx, yy, enemy.name, {
      fontFamily: UI_FONT, fontSize: '29px', fontStyle: UI_BOLD, color: UI_GOLD,
      wordWrap: { width: wrap }
    }));
    yy += 40;
    this.root.add(this.add.text(tx, yy, `${enemy.source === 'encounter' ? 'Playable encounter' : enemy.species} / ${enemy.district} / ${enemy.role}`, {
      fontFamily: UI_FONT, fontSize: '13px', fontStyle: UI_BOLD, color: UI_MUTED,
      wordWrap: { width: wrap }
    }));
    yy += 28;

    heading('FIELD NOTE', '#7f93a8');
    para(enemy.description, { size: 14 });
    yy += 12;

    heading(enemy.source === 'encounter' ? 'COMBAT ROLE' : 'VARIETY ROLE', '#8df4ff');
    para(enemy.varietyContribution, { size: 13, bold: true, color: '#bceff4' });
    yy += 12;

    const dossier = this.codexBossView(enemy);
    heading(
      enemy.typeHint === 'Boss'
        ? `COMBAT KIT  /  ${dossier.observed} OF ${dossier.total} OBSERVED`
        : enemy.source === 'encounter' ? 'COMBAT KIT' : 'MOVE KIT',
      accentText
    );
    dossier.rows.forEach((move) => {
      para(move.text, {
        size: 13,
        color: move.revealed ? '#dbe6f0' : '#788694',
        italic: !move.revealed
      });
      yy += 5;
    });
    yy += 8;

    heading('SILHOUETTE', '#e8c24a');
    para(enemy.silhouette, { size: 13 });
    yy += 12;

    heading('FASHION DIRECTION', '#c9a6ff');
    const fashionDirection = enemy.source === 'reserve'
      ? this.codexData?.reserveEnemyFashionDirections[enemy.id]
        ?? (this.codexDataPending() ? 'Loading reserve fashion direction...' : enemy.visualBrief)
      : enemy.visualBrief;
    para(fashionDirection, { size: 13 });
    yy += 12;

    heading('ART CONTRACT', '#7f93a8');
    para(enemy.artPose, { size: 12, italic: true, color: UI_SOFT });

    const contentBottom = yy + this.detailScroll;
    const SCROLL_PAD = 16;
    this.detailMaxScroll = Math.max(0, (contentBottom - viewTop) - viewH + SCROLL_PAD);
    this.detailScrollTarget = clamp(this.detailScrollTarget, 0, this.detailMaxScroll);
    this.detailScroll = clamp(this.detailScroll, 0, this.detailMaxScroll);

    const closeDetail = () => this.closeCodexDetail();
    const curtainX = tx - 24;
    const curtainW = right - curtainX - 1;
    this.root.add(this.add.rectangle(0, 0, GAME_WIDTH, mTop, 0x070a11, 1).setOrigin(0, 0).setInteractive().on('pointerdown', closeDetail));
    this.root.add(this.add.rectangle(0, mBottom, GAME_WIDTH, GAME_HEIGHT - mBottom, 0x070a11, 1).setOrigin(0, 0).setInteractive().on('pointerdown', closeDetail));
    this.root.add(this.add.rectangle(curtainX, mTop + 1, curtainW, viewTop - mTop - 1, 0x0c1420, 1).setOrigin(0, 0).setInteractive());
    this.root.add(this.add.rectangle(curtainX, viewBottom, curtainW, mBottom - viewBottom - 1, 0x0c1420, 1).setOrigin(0, 0).setInteractive());
    this.root.add(this.add.rectangle(px, py, MW, MH, 0x000000, 0).setStrokeStyle(2, accent, 1));
    this.renderCodexDossierHeader(
      left,
      right,
      mTop,
      'ENEMY FIELD DOSSIER',
      `${enemy.source === 'encounter' ? 'PLAYABLE ENCOUNTER' : 'RESERVE CONCEPT'} / ${enemy.district.toUpperCase()}`,
      accent,
      accentText
    );
    this.root.add(this.add.rectangle(tx - 18, (viewTop + viewBottom) / 2, 2, viewH - 8, accent, 0.5));

    if (this.detailMaxScroll > 0) {
      this.renderCodexScrollCue(right - 64, mBottom - 18, this.detailScroll >= this.detailMaxScroll);
    }

    this.renderCodexCloseControl(right - 26, mTop + 26, closeDetail);
  }
}
