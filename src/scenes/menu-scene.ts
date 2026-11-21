import Phaser from 'phaser';
import { loadFlyway } from '../game/flyway-loader';
import { showSaveRecovery, consumeSaveRecoveryGamepad } from '../game/save-recovery-dialog';
import { endPracticeSession } from '../game/practice-session';
import { defaultLeaderId, flockLeaders, getLeader } from '../game/leaders';
import { difficultyLabel, MAX_DIFFICULTY, difficultyAdds, difficultyStatSummary } from '../game/difficulty';
import { type PlayerAccount, loadAccount, isLeaderUnlocked } from '../game/meta';
import { UI_DISPLAY_FONT as TOKEN_DISPLAY_FONT, UI_FONT, UI_BOLD, MIN_SUPPORTED_TOUCH_TARGET } from '../game/theme';
import { quietButton } from '../game/quiet-ui';
import { advanceGameTime } from '../game/scene-runtime';
import { consumeStorageRecoveryEvents } from '../game/safe-storage';
import { controlPanelRegistryKey, controlCaptureRegistryKey, bindControlActions, controlActionForCode, controlPanelOwnsInput, controlBindingLabel } from '../game/input-bindings';
import { screenReaderState } from '../game/screen-reader-accessibility';
import type { StorageRecoveryNotice } from '../game/storage-recovery-notice';
import { lazyModule } from '../game/lazy-module';
import type { MenuFocus, RunMode, RunState } from '../game/shared/runtime-types';
import { LAZY_LOAD_FAILED, RUN_MODE_SUMMARY, SHARED_ROUTE_MODE, SHARED_ROUTE_SEED } from '../game/shared/session-config';
import { prefersReducedMotion, syncSceneAnimationPace } from '../game/shared/preferences';
import { GAME_HEIGHT, GAME_WIDTH } from '../game/shared/layout-constants';
import { openProfileScene } from '../game/shared/lazy-modules';
import { activeSeed, generatedMapFor } from '../game/shared/run-session';
import { birdAudio } from '../game/shared/bird-audio-director';
import { createInitialRunState, futureActiveRunVersion, getMaxUnlockedTier, loadActiveRun, recoverFinishedRun } from '../game/shared/run-state';
import { futureSaveMessage } from '../game/save-migration';
import { activateRenderedAudioToggleControl, playUiSound, renderAudioToggleControl } from '../game/shared/ui-helpers';

type MenuDebugStateModule = typeof import('../game/menu-debug-state');

let menuDebugStateModulePromise: Promise<MenuDebugStateModule> | undefined;

function loadMenuDebugStateModule() {
  menuDebugStateModulePromise ??= import('../game/menu-debug-state').catch((error) => {
    menuDebugStateModulePromise = undefined;
    throw error;
  });
  return menuDebugStateModulePromise;
}


type TitleRunLaunchModule = typeof import('../game/title-run-launch');

const loadTitleRunLaunchModule = lazyModule(() => import('../game/title-run-launch'));


type MenuOptionalUiModule = typeof import('../game/menu-optional-ui');

const loadMenuOptionalUiModule = lazyModule(() => import('../game/menu-optional-ui'));


export class MenuScene extends Phaser.Scene {
  private setupOpen = false;
  leaderChoicePresented = false;
  private setupObjects: Phaser.GameObjects.GameObject[] = [];
  private selectedLeaderId = defaultLeaderId;
  private inspectedLeaderId = defaultLeaderId;
  private leaderPanels: Array<{ id: string; rect: Phaser.GameObjects.Rectangle; unlocked: boolean; selectedIcon?: Phaser.GameObjects.Image; cardFrame?: Phaser.GameObjects.Image; selectedFlourish?: Phaser.GameObjects.Image }> = [];
  private leaderTooltip?: Phaser.GameObjects.Container;
  private menuGeneration = 0;
  private menuAccount: PlayerAccount = loadAccount();
  private selectedDifficulty = 0;
  private selectedRunMode: RunMode = SHARED_ROUTE_MODE;
  private difficultyLabelText?: Phaser.GameObjects.Text;
  private difficultyDescText?: Phaser.GameObjects.Text;
  private settingsOverlay?: Phaser.GameObjects.Container;
  private helpOverlay?: Phaser.GameObjects.Container;
  private storageRecoveryNotice?: StorageRecoveryNotice;
  private titleRunLaunchPending = false;
  titleRunLaunchFlourishBursts = 0;
  codexOpening = false;
  private menuFocus: MenuFocus = 'primaryRun';
  private menuFocusTargets = new Map<MenuFocus, Phaser.GameObjects.Rectangle>();
  private runModeFocusTargets = new Map<RunMode, Phaser.GameObjects.Rectangle>();
  private runModeViews = new Map<RunMode, {
    hit: Phaser.GameObjects.Rectangle;
    label: Phaser.GameObjects.Text;
    detail: Phaser.GameObjects.Text;
  }>();
  private menuFocusRing?: Phaser.GameObjects.Rectangle;
  private primaryRunAction?: () => void;
  private secondaryRunAction?: () => void;
  /** A flight checkpoint can be continued from this title visit. */
  menuHasSavedRun = false;
  /** Focus stops added by the lazy engagement chunk (Daily Flight, Flight Recap). */
  menuExtraFocus: MenuFocus[] = [];

  constructor() {
    super('MenuScene');
  }

  create(data: { reopenSettings?: boolean; reopenHelp?: boolean; reopenLeaderTooltip?: { id: string; anchorX: number } } = {}) {
    loadFlyway(this);
    endPracticeSession();
    if (!recoverFinishedRun()) showSaveRecovery(() => {
      if (!recoverFinishedRun()) return false;
      this.scene.restart(); return true;
    });
    syncSceneAnimationPace(this);
    const generation = ++this.menuGeneration;
    if (!data.reopenSettings) {
      this.registry.set(controlPanelRegistryKey(this), false);
      this.registry.remove(controlCaptureRegistryKey(this));
    }
    birdAudio.setMood('menu');
    window.__birdSquadAudio = () => birdAudio.snapshot();
    this.settingsOverlay = undefined;
    this.helpOverlay = undefined;
    this.leaderTooltip = undefined;
    this.menuFocusTargets.clear();
    this.runModeFocusTargets.clear();
    this.runModeViews.clear();
    this.menuFocusRing = undefined;
    this.primaryRunAction = undefined;
    this.secondaryRunAction = undefined;
    this.titleRunLaunchPending = false;
    this.titleRunLaunchFlourishBursts = 0;
    this.leaderChoicePresented = false;
    this.codexOpening = false;
    this.menuExtraFocus = [];
    if (!data.reopenSettings && !data.reopenHelp && !data.reopenLeaderTooltip) {
      this.setupOpen = false;
      this.menuFocus = 'primaryRun';
    }
    this.updateMenuTextState();

    this.cameras.main.fadeIn(220);
    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'splash')
      .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
      .setAlpha(1);
    const setupSurface = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x0b1723, 1).setName('title-setup-surface');
    const scrim = this.add.graphics().setName('title-home-scrim');
    scrim.fillStyle(0x06121f, 1).fillRect(0, 0, 430, GAME_HEIGHT);
    scrim.fillGradientStyle(0x06121f, 0x06121f, 0x06121f, 0x06121f, 1, 0, 1, 0);
    scrim.fillRect(430, 0, 340, GAME_HEIGHT);
    scrim.fillGradientStyle(0x06121f, 0x06121f, 0x06121f, 0x06121f, 0, 0, 0.95, 0.95);
    scrim.fillRect(0, 560, GAME_WIDTH, 160);

    this.createAnimatedTitle();

    renderAudioToggleControl(this, () => {}, 48, 38);
    this.menuFocusTargets.set('howToPlay', this.renderTopUtilityButton(GAME_WIDTH - 536, 38, 'How to Play', 'howToPlay', () => this.openHelpOverlay()));
    this.menuFocusTargets.set('settings', this.renderTopUtilityButton(GAME_WIDTH - 388, 38, 'Settings', 'settings', () => this.openSettingsOverlay()));
    const setupStart = this.children.list.length;

    this.add.text(80, 112, 'Flight setup', {
      fontFamily: TOKEN_DISPLAY_FONT, fontSize: '40px', color: '#eee8d8',
    }).setResolution(2);
    this.add.rectangle(640, 158, 1120, 1, 0x334954);
    this.add.rectangle(640, 600, 1120, 1, 0x334954);
    this.add.text(640, 580, '', {
      fontFamily: UI_FONT, fontSize: '21px', color: '#edf2f5',
    }).setResolution(2).setOrigin(0.5).setName('title-launch-summary');
    this.selectedDifficulty = Math.min(this.selectedDifficulty, getMaxUnlockedTier());
    const difficultyPanel = this.add.rectangle(350, 496, 540, 128, 0x0b1723, 1)
      .setName('title-ascension-backplate');
    this.menuFocusTargets.set('difficulty', difficultyPanel);

    this.add.text(350, 420, 'Ascension', {
      fontFamily: UI_FONT,
      fontSize: '21px',
      fontStyle: UI_BOLD,
      color: '#eee8d8',

    }).setResolution(2).setOrigin(0.5);

    for (const direction of [-1, 1] as const) quietButton(this, {
      x: direction < 0 ? 140 : 560, y: 476, width: MIN_SUPPORTED_TOUCH_TARGET,
      label: direction < 0 ? '‹' : '›', name: `title-ascension-${direction < 0 ? 'previous' : 'next'}`,
      onActivate: () => { this.menuFocus = 'difficulty'; playUiSound('confirm'); this.stepDifficulty(direction); this.updateMenuFocusRing(); }
    });
    this.difficultyLabelText = this.add.text(350, 476, '', {
      fontFamily: UI_FONT, fontSize: '21px', fontStyle: UI_BOLD, color: '#eee8d8',
    }).setResolution(2).setOrigin(0.5);
    this.difficultyDescText = this.add.text(350, 530, '', {
      fontFamily: UI_FONT,
      fontSize: '20px',
      color: '#bfcbd0',
      align: 'center',

      wordWrap: { width: 510 }
    }).setResolution(2).setOrigin(0.5);
    this.difficultyDescText.setLineSpacing(2);
    this.updateDifficultyText();
    this.renderRunModeSelector();

    this.menuAccount = loadAccount();
    if (!isLeaderUnlocked(this.menuAccount, this.selectedLeaderId)) this.selectedLeaderId = defaultLeaderId;
    this.inspectedLeaderId = this.selectedLeaderId;

    this.add.text(80, 178, 'Choose your leader', {
      fontFamily: UI_FONT,
      fontSize: '21px',
      fontStyle: UI_BOLD,
      color: '#eee8d8',

    }).setResolution(2).setOrigin(0, 0.5);
    this.leaderPanels = [];
    flockLeaders.forEach((leader, index) => {
      const px = 188 + index * 226;
      const py = 254;
      const unlocked = isLeaderUnlocked(this.menuAccount, leader.id);
      const rect = this.add.rectangle(px, py, 216, 124, 0x0b1723, unlocked ? 0.88 : 0.68)
        .setStrokeStyle(0)
        .setInteractive({ useHandCursor: unlocked })
        .setName('title-leader-choice-backplate')
        .setData('leaderId', leader.id)
        .setData('unlocked', unlocked);

      rect.on('pointerover', () => this.showLeaderTooltip(leader.id, px));
      rect.on('pointerout', () => this.showLeaderTooltip(this.inspectedLeaderId, px));
      if (unlocked) {
         rect.on('pointerdown', () => {
           if (this.settingsOverlay || this.helpOverlay || this.titleRunLaunchPending || !this.setupOpen) return;
           this.menuFocus = 'leader';
           playUiSound('confirm');
           this.selectLeader(leader.id);
           this.showLeaderTooltip(leader.id, px);
           this.updateMenuFocusRing();
         });
      } else {
        rect.on('pointerdown', () => {
          if (this.settingsOverlay || this.helpOverlay || this.titleRunLaunchPending || !this.setupOpen) return;
          this.menuFocus = 'leader';
          this.inspectedLeaderId = leader.id;
          this.showLeaderTooltip(leader.id, px);
          this.updateMenuFocusRing();
        });
      }

      this.add.text(px, py - 38, leader.name, {
        fontFamily: UI_FONT, fontSize: '21px', fontStyle: UI_BOLD, color: unlocked ? '#eee8d8' : '#b0bdc4', align: 'center',  wordWrap: { width: 204 }
      }).setResolution(2).setOrigin(0.5).setName('title-leader-name').setData('leaderId', leader.id);

      const playstyles: Record<string, string> = { fledgling: 'Balanced\nStart here', spark_caller: 'Tempo\nResonance',
        talon: 'Pressure\nWinded', tidewarden: 'Recovery\nMolt', roostkeeper: 'Defense\nCover' };
      const detail = unlocked ? playstyles[leader.id] ?? leader.suit : 'Locked\nDetails';
      const detailText = this.add.text(px + 30, py + 26, detail, {
        fontFamily: UI_FONT,
        fontSize: '20px',
        color: unlocked ? '#bfcbd0' : '#b0bdc4',
        align: 'center',

        wordWrap: { width: 132 }
      }).setResolution(2).setOrigin(0.5).setName('title-leader-detail').setData('leaderId', leader.id);
      detailText.setLineSpacing(2);
      this.leaderPanels.push({ id: leader.id, rect, unlocked });
    });
    this.selectLeader(this.selectedLeaderId);
    this.setupObjects = [setupSurface, ...this.children.list.slice(setupStart)];

    const savedRun = loadActiveRun();
    this.menuHasSavedRun = Boolean(savedRun);
    // A checkpoint from a newer build stays in storage untouched; say why it
    // cannot be continued instead of silently offering only a new run.
    const futureFlightVersion = savedRun ? undefined : futureActiveRunVersion();
    if (futureFlightVersion !== undefined) {
      this.storageRecoveryNotice = { outcome: 'reset', scopes: ['flight checkpoint'], text: futureSaveMessage('flight', futureFlightVersion) };
    }
    const newRunLabel = SHARED_ROUTE_SEED ? 'Fly Shared Route' : 'Start Run';
    if (savedRun) {
      this.runMenuOptionalAction('renderResumeContext', savedRun, generatedMapFor(savedRun.seed ?? activeSeed, savedRun.mapIndex, savedRun.flyway?.routeRhythm === 1));
      this.primaryRunAction = () => this.continueRunAnimated(true, 676, 642, 252);
      this.secondaryRunAction = () => this.startRunAnimated(true, 962, 642, 204);
      this.menuFocusTargets.set('primaryRun', this.makeMenuButton(676, 642, 252, 'Continue Run', 'primaryRun', this.primaryRunAction));
      this.menuFocusTargets.set('secondaryRun', this.makeMenuButton(962, 642, 204, SHARED_ROUTE_SEED ? 'Shared Route' : 'Start New Run', 'secondaryRun', this.secondaryRunAction));
    } else {
      this.primaryRunAction = () => this.startRunAnimated(true, 780, 642, 286);
      this.menuFocusTargets.set('primaryRun', this.makeMenuButton(780, 642, 286, newRunLabel, 'primaryRun', this.primaryRunAction));
    }
    this.showStorageRecoveryNotice(generation);
    bindControlActions(this, {
      confirm: () => this.activateMenuFocus(),
      previous: () => this.adjustMenuFocus(-1),
      next: () => this.adjustMenuFocus(1),
      back: () => this.handleMenuBack(),
      mute: () => {
        if (!activateRenderedAudioToggleControl(this)) birdAudio.toggleMute();
      },
      fullscreen: () => this.scale.toggleFullscreen(),
      settings: () => {
        if (!this.helpOverlay) this.openSettingsOverlay();
      },
      guide: () => {
        if (!this.settingsOverlay) this.openHelpOverlay();
      },
    });

    this.menuFocusTargets.set('profile', this.renderTopUtilityButton(GAME_WIDTH - 92, 38, 'Flock Record', 'profile', () => openProfileScene(this)));
    this.menuFocusTargets.set('codex', this.renderTopUtilityButton(GAME_WIDTH - 240, 38, 'Collection', 'codex', () => this.openCodex(true)));
    this.menuFocusTargets.set('configure', this.makeMenuButton(260, 478, 286, 'Flight setup', 'configure', () => this.setSetupOpen(!this.setupOpen)));

    this.installMenuFocusInput();
    void import('../game/engagement').then((module) => {
      if (generation === this.menuGeneration && this.scene.isActive()) module.installMenuEngagement(this);
    }).catch(() => {});
    this.renderMenuFocusHint();
    this.refreshTitleLayout();
    this.updateMenuFocusRing();
    if (data.reopenSettings) this.openSettingsOverlay();
    else if (data.reopenHelp) this.openHelpOverlay();
    else if (data.reopenLeaderTooltip) this.showLeaderTooltip(data.reopenLeaderTooltip.id, data.reopenLeaderTooltip.anchorX);
  }

  private menuFocusOrder(): MenuFocus[] {
    const order: MenuFocus[] = this.setupOpen ? ['leader', 'difficulty', 'runMode', 'primaryRun'] : ['primaryRun'];
    if (this.menuHasSavedRun) order.push('secondaryRun');
    order.push('configure');
    if (!this.setupOpen) order.push('howToPlay', 'settings', 'codex', 'profile', ...this.menuExtraFocus);
    return order;
  }

  private menuFocusLabel() {
    switch (this.menuFocus) {
      case 'leader': return `Leader: ${getLeader(this.inspectedLeaderId).name}${isLeaderUnlocked(this.menuAccount, this.inspectedLeaderId) ? '' : ' — Locked'}`;
      case 'difficulty': return `Ascension: ${difficultyLabel(this.selectedDifficulty)}`;
      case 'runMode': return `Flight length: ${RUN_MODE_SUMMARY[this.selectedRunMode]}`;
      default: return (this.menuFocusTargets.get(this.menuFocus)?.getData('labelObject') as Phaser.GameObjects.Text)?.text ?? '';
    }
  }

  private menuFocusTarget() {
    if (this.menuFocus === 'leader') {
      return this.leaderPanels.find((panel) => panel.id === this.inspectedLeaderId)?.rect;
    }
    if (this.menuFocus === 'runMode') return this.runModeFocusTargets.get(this.selectedRunMode);
    return this.menuFocusTargets.get(this.menuFocus);
  }

  private setMenuFocus(direction: -1 | 1) {
    const order = this.menuFocusOrder();
    const current = Math.max(0, order.indexOf(this.menuFocus));
    this.menuFocus = order[(current + direction + order.length) % order.length];
    if (this.menuFocus !== 'leader') this.hideLeaderTooltip();
    else this.showLeaderTooltip(this.inspectedLeaderId, 640);
    this.updateMenuFocusRing();
    this.updateMenuTextState();
  }

  private cycleMenuFocus(direction: -1 | 1) {
    if (this.settingsOverlay || this.helpOverlay || this.titleRunLaunchPending) return;
    playUiSound('confirm');
    this.setMenuFocus(direction);
  }

  private cycleMenuLeader(direction: -1 | 1) {
    const ids = this.leaderPanels.map((panel) => panel.id);
    if (ids.length === 0) return;
    const current = Math.max(0, ids.indexOf(this.inspectedLeaderId));
    const next = ids[(current + direction + ids.length) % ids.length];
    this.inspectedLeaderId = next;
    this.selectLeader(next);
    const panel = this.leaderPanels.find((entry) => entry.id === next);
    if (panel) this.showLeaderTooltip(next, panel.rect.x);
  }

  private setMenuRunMode(direction: -1 | 1) {
    const modes: RunMode[] = ['quick', 'full'];
    const current = modes.indexOf(this.selectedRunMode);
    this.selectedRunMode = modes[(current + direction + modes.length) % modes.length];
    this.refreshRunModeSelector();
    this.updateMenuFocusRing();
    this.updateMenuTextState();
  }

  private adjustMenuFocus(direction: -1 | 1) {
    if (this.settingsOverlay || this.helpOverlay || this.titleRunLaunchPending) return;
    playUiSound('confirm');
    if (this.menuFocus === 'leader') {
      this.cycleMenuLeader(direction);
      this.updateMenuFocusRing();
      this.updateMenuTextState();
    } else if (this.menuFocus === 'difficulty') {
      this.stepDifficulty(direction);
      this.updateMenuFocusRing();
      this.updateMenuTextState();
    } else if (this.menuFocus === 'runMode') {
      this.setMenuRunMode(direction);
    } else {
      this.setMenuFocus(direction);
    }
  }

  private activateMenuFocus() {
    if (this.settingsOverlay || this.helpOverlay || this.titleRunLaunchPending) return;
    birdAudio.play('ui.confirm');
    switch (this.menuFocus) {
      case 'configure':
        this.setSetupOpen(!this.setupOpen);
        return;
      case 'leader': {
        const panel = this.leaderPanels.find((entry) => entry.id === this.inspectedLeaderId);
        if (panel) this.showLeaderTooltip(panel.id, panel.rect.x);
        break;
      }
      case 'difficulty':
        this.stepDifficulty(1);
        break;
      case 'runMode':
        this.setMenuRunMode(1);
        return;
      case 'primaryRun':
        this.primaryRunAction?.();
        return;
      case 'secondaryRun':
        this.secondaryRunAction?.();
        return;
      case 'howToPlay':
        this.openHelpOverlay();
        break;
      case 'settings':
        this.openSettingsOverlay();
        break;
      case 'codex':
        this.openCodex(true);
        return;
      case 'profile':
        openProfileScene(this);
        return;
      default:
        this.menuFocusTargets.get(this.menuFocus)?.emit('pointerdown');
        return;
    }
    this.updateMenuFocusRing();
    this.updateMenuTextState();
  }

  private handleMenuBack() {
    if (this.settingsOverlay) {
      playUiSound('close');
      this.closeSettingsOverlay();
    } else if (this.helpOverlay) {
      playUiSound('close');
      const onBack = this.helpOverlay.getData('onBack') as (() => void) | undefined;
      if (onBack) onBack();
      else this.closeHelpOverlay();
    } else if (this.setupOpen) {
      playUiSound('close');
      this.setSetupOpen(false);
    }
  }

  private installMenuFocusInput() {
    const onTab = (event: KeyboardEvent) => {
      if (this.settingsOverlay || this.helpOverlay || this.titleRunLaunchPending) return;
      event.preventDefault();
      event.stopPropagation();
      this.cycleMenuFocus(event.shiftKey ? -1 : 1);
    };
    const onDirectionalKey = (event: KeyboardEvent, direction: -1 | 1) => {
      if (this.settingsOverlay || this.helpOverlay || this.titleRunLaunchPending) return;
      if (controlActionForCode(event.code)) return;
      event.preventDefault();
      event.stopPropagation();
      this.cycleMenuFocus(direction);
    };
    const onUp = (event: KeyboardEvent) => onDirectionalKey(event, -1);
    const onDown = (event: KeyboardEvent) => onDirectionalKey(event, 1);
    const onGamepadDown = (_pad: Phaser.Input.Gamepad.Gamepad, button: Phaser.Input.Gamepad.Button) => {
      if (consumeSaveRecoveryGamepad(button.index)) return;
      if (controlPanelOwnsInput(this)) return;
      if (this.settingsOverlay || this.titleRunLaunchPending) return;
      if (this.helpOverlay) {
        if (button.index === 1) this.handleMenuBack();
        return;
      }
      if (button.index === 12) this.cycleMenuFocus(-1);
      else if (button.index === 13) this.cycleMenuFocus(1);
      else if (button.index === 14) this.adjustMenuFocus(-1);
      else if (button.index === 15) this.adjustMenuFocus(1);
      else if (button.index === 0) this.activateMenuFocus();
      else if (button.index === 1) this.handleMenuBack();
      else if (button.index === 9) {
        playUiSound('confirm');
        this.menuFocus = 'settings';
        this.openSettingsOverlay();
      }
    };
    this.input.keyboard?.on('keydown-TAB', onTab);
    this.input.keyboard?.on('keydown-UP', onUp);
    this.input.keyboard?.on('keydown-DOWN', onDown);
    this.input.gamepad?.on('down', onGamepadDown);
    this.events.once('shutdown', () => {
      this.input.keyboard?.off('keydown-TAB', onTab);
      this.input.keyboard?.off('keydown-UP', onUp);
      this.input.keyboard?.off('keydown-DOWN', onDown);
      this.input.gamepad?.off('down', onGamepadDown);
    });
  }

  private renderMenuFocusHint() {
    this.add.text(GAME_WIDTH / 2, 704,
      `Tab / ↑↓: Focus   ·   ${controlBindingLabel('previous')}/${controlBindingLabel('next')}: Adjust   ·   ${controlBindingLabel('confirm')} / A: Select`, {
        fontFamily: UI_FONT, fontSize: '20px', color: '#bfcbd0',
      }).setResolution(2).setOrigin(0.5).setName('title-input-hint');
  }

  private setSetupOpen(open: boolean) {
    if (this.titleRunLaunchPending || this.settingsOverlay || this.helpOverlay) return;
    this.setupOpen = open;
    this.inspectedLeaderId = this.selectedLeaderId;
    this.hideLeaderTooltip();
    this.menuFocus = open ? 'leader' : 'configure';
    this.refreshTitleLayout();
    this.updateMenuFocusRing();
    this.updateMenuTextState();
    if (open) {
      this.runMenuOptionalAction('renderSetupLeaderPortraits');
      this.showLeaderTooltip(this.selectedLeaderId, 640);
    }
  }

  private refreshTitleLayout() {
    for (const object of this.children.list) if (object.name === 'storage-recovery-notice')
      (object as Phaser.GameObjects.Text).setVisible(!this.setupOpen);
    for (const object of this.setupObjects) {
      (object as Phaser.GameObjects.Rectangle).setVisible(this.setupOpen);
      if (object.input) object.input.enabled = this.setupOpen;
    }
    (this.children.getByName('title-home-scrim') as Phaser.GameObjects.Graphics)?.setVisible(!this.setupOpen);
    const logo = this.children.getByName('title-logo') as Phaser.GameObjects.Container;
    logo?.setPosition(260, this.menuHasSavedRun ? 196 : 224).setVisible(!this.setupOpen);
    (this.children.getByName('title-resume-context') as Phaser.GameObjects.Text)?.setVisible(!this.setupOpen);
    (this.children.getByName('title-input-hint') as Phaser.GameObjects.Text)?.setVisible(this.setupOpen);
    const move = (focus: MenuFocus, x: number, y: number) => {
      const button = this.menuFocusTargets.get(focus);
      if (!button) return;
      button.setPosition(x,y);
      (button.getData('labelObject') as Phaser.GameObjects.Text)?.setPosition(x,y);
    };
    move('primaryRun', this.setupOpen ? 1050 : 260, this.setupOpen ? 642 : this.menuHasSavedRun ? 444 : 426);
    move('secondaryRun', this.setupOpen ? 790 : 260, this.setupOpen ? 642 : 512);
    move('configure', 260, this.setupOpen ? 642 : this.menuHasSavedRun ? 580 : 502);
    const configure = this.menuFocusTargets.get('configure');
    const configureLabel = this.setupOpen ? 'Back to home' : 'Flight setup';
    configure?.setData('fullLabel', configureLabel);
    (configure?.getData('labelObject') as Phaser.GameObjects.Text)?.setText(configureLabel);
    for (const [index, focus] of (['howToPlay','settings','codex','profile'] as MenuFocus[]).entries()) {
      const positions = [[260, this.menuHasSavedRun ? 648 : 574], [1168, 48], [964, 662], [1152, 662]];
      move(focus, positions[index][0], positions[index][1]);
      const button = this.menuFocusTargets.get(focus)!;
      button.setVisible(!this.setupOpen);
      if (button.input) button.input.enabled = !this.setupOpen;
      (button.getData('labelObject') as Phaser.GameObjects.Text).setVisible(!this.setupOpen);
    }
    this.events.emit('title-layout');
  }
  private updateMenuFocusRing() {
    const target = this.menuFocusTarget();
    if (!target?.active) return;
    this.menuFocusRing?.destroy();
    this.menuFocusRing = this.add.rectangle(
      target.x,
      target.y,
      target.displayWidth + 10,
      target.displayHeight + 10,
      0x83aeb6,
      0.04,
    )
      .setStrokeStyle(2, 0x83aeb6, 0.8)
      .setDepth(99)
      .setName('title-menu-focus-ring')
      .setVisible(!this.settingsOverlay && !this.helpOverlay)
      .setData('focus', this.menuFocus)
      .setData('label', this.menuFocusLabel());
  }

  private openCodex(openCollectionAtlas = false, openCardId?: string) {
    this.runMenuOptionalAction('openCodex', openCollectionAtlas, openCardId);
  }

  private updateMenuTextState() {
    this.updateLaunchSummary();
    window.advanceTime = (ms: number) => advanceGameTime(this.game, ms);
    window.render_game_to_text = () => {
      void loadMenuDebugStateModule()
        .then((module) => {
          if (this.scene.isActive()) module.installMenuDebugState(this);
        })
        .catch(() => {});
      return JSON.stringify({ mode: 'menu', scene: 'MenuScene', screenReader: screenReaderState() });
    };
    void menuDebugStateModulePromise?.then((module) => {
      if (this.scene.isActive()) module.installMenuDebugState(this);
    });
  }

  private renderTopUtilityButton(x: number, y: number, label: string, focus: MenuFocus, onClick: () => void) {
    return quietButton(this, { x, y, width: 164, label, name: 'title-utility-hit', kind: 'utility',
      onActivate: () => {
        if (this.settingsOverlay || this.helpOverlay || this.titleRunLaunchPending || this.setupOpen) return;
        this.menuFocus = focus; playUiSound('confirm'); onClick();
      },
    }).setData('label', label);
  }
  private openSettingsOverlay(queueAssets = true) {
    this.runMenuOptionalAction('openSettingsOverlay', queueAssets);
  }

  private openHelpOverlay(queueAssets = true) {
    this.runMenuOptionalAction('openHelpOverlay', queueAssets);
  }

  private closeHelpOverlay() {
    this.helpOverlay?.destroy(true);
    this.helpOverlay = undefined;
    this.updateMenuFocusRing();
    this.updateMenuTextState();
  }

  private closeSettingsOverlay() {
    this.settingsOverlay?.destroy(true);
    this.settingsOverlay = undefined;
    this.updateMenuFocusRing();
    this.updateMenuTextState();
  }

  private stepDifficulty(delta: number) {
    if (this.settingsOverlay || this.helpOverlay || this.titleRunLaunchPending) return;
    this.selectedDifficulty = Math.max(0, Math.min(getMaxUnlockedTier(), this.selectedDifficulty + delta));
    this.updateDifficultyText();
  }

  private updateDifficultyText() {
    this.difficultyLabelText?.setText(this.selectedDifficulty === 0 ? 'Standard' : `Tier ${this.selectedDifficulty}`);
    const locked = this.selectedDifficulty >= getMaxUnlockedTier() && this.selectedDifficulty < MAX_DIFFICULTY;
    this.difficultyDescText?.setText(
      this.selectedDifficulty === 0
        ? `${difficultyAdds(0)}${locked ? '\nWin to unlock the next tier.' : ''}`
        : difficultyStatSummary(this.selectedDifficulty),
    );
    this.updateLaunchSummary();
  }

  private updateLaunchSummary() {
    const label = this.menuHasSavedRun ? 'Start New Run' : 'New flight';
    (this.children.getByName('title-launch-summary') as Phaser.GameObjects.Text)?.setText(
      `${label}: ${getLeader(this.selectedLeaderId).name} · ${difficultyLabel(this.selectedDifficulty)} · ${this.selectedRunMode === 'quick' ? 'Quick / 3 districts' : 'Full / 4 districts'}`,
    );
  }

  private showStorageRecoveryNotice(generation: number) {
    const events = consumeStorageRecoveryEvents();
    if (!events.length && !this.storageRecoveryNotice) return;
    void import('../game/storage-recovery-notice').then((recovery) => {
      if (!this.scene.isActive() || generation !== this.menuGeneration) return;
      if (events.length) this.storageRecoveryNotice = recovery.createStorageRecoveryNotice(events);
      if (this.storageRecoveryNotice) {
        recovery.renderStorageRecoveryNotice(this, this.storageRecoveryNotice, UI_FONT, UI_BOLD);
        this.refreshTitleLayout();
      }
    }).catch(() => {});
  }

  private makeMenuButton(x: number, y: number, width: number, label: string, focus: MenuFocus, onClick: () => void) {
    return quietButton(this, { x, y, width, label, name: 'title-run-action',
      kind: focus === 'primaryRun' ? 'primary' : 'utility',
      onActivate: () => {
        if (this.settingsOverlay || this.helpOverlay || this.titleRunLaunchPending) return;
        this.menuFocus = focus; playUiSound('confirm'); onClick();
      },
    }).setData('focus', focus);
  }
  syncHomeParticles() {
    this.updateMenuTextState();
  }

  private renderRunModeSelector() {
    const y = 490;
    this.add.text(920, 420, 'Flight length', {
      fontFamily: UI_FONT, fontSize: '21px', fontStyle: UI_BOLD, color: '#eee8d8',

    }).setResolution(2).setOrigin(0.5);
    const choices: Array<{ mode: RunMode; x: number; label: string; detail: string }> = [
      { mode: 'quick', x: 818, label: 'Quick', detail: '3 districts\nNo tier unlock' },
      { mode: 'full', x: 1022, label: 'Full', detail: '4 districts\nUnlocks tiers' },
    ];
    choices.forEach((choice) => {
      const selected = choice.mode === this.selectedRunMode;
      const hit = this.add.rectangle(choice.x, y + 10, 192, 104, selected ? 0x193140 : 0x0b1723, 0.95)
        .setStrokeStyle(2, selected ? 0x83aeb6 : 0x83aeb6, selected ? 0.55 : 0)
        .setInteractive({ useHandCursor: true })
        .setName('title-run-mode-option');
      const label = this.add.text(choice.x, y - 14, choice.label, {
        fontFamily: UI_FONT, fontSize: '21px', fontStyle: UI_BOLD, color: '#eee8d8'
      }).setResolution(2).setOrigin(0.5);
      const detail = this.add.text(choice.x, y + 7, choice.detail, {
        fontFamily: UI_FONT,
        fontSize: '20px',
        color: selected ? '#eee8d8' : '#a1b5be',
        align: 'center',
      }).setResolution(2).setOrigin(0.5, 0);
      hit.setData('mode', choice.mode);
      hit.on('pointerdown', () => {
        if (this.settingsOverlay || this.helpOverlay || this.titleRunLaunchPending || !this.setupOpen) return;
        this.menuFocus = 'runMode';
        if (this.selectedRunMode !== choice.mode) {
          playUiSound('confirm');
          this.selectedRunMode = choice.mode;
          this.refreshRunModeSelector();
        }
        this.updateMenuFocusRing();
        this.updateMenuTextState();
      });
      this.runModeFocusTargets.set(choice.mode, hit);
      this.runModeViews.set(choice.mode, { hit, label, detail });
    });
  }

  private refreshRunModeSelector() {
    this.runModeViews.forEach((view, mode) => {
      const selected = mode === this.selectedRunMode;
      view.hit
        .setFillStyle(selected ? 0x193140 : 0x0b1723, 0.95)
        .setStrokeStyle(2, selected ? 0x83aeb6 : 0x83aeb6, selected ? 0.55 : 0);
      view.label.setColor(selected ? '#eee8d8' : '#eee8d8');
      view.detail.setColor(selected ? '#eee8d8' : '#a1b5be');
    });
  }

  private startRunAnimated(confirmAlreadyPlayed = false, x = 780, y = 642, w = 286) {
    this.runTitleLaunch(false, confirmAlreadyPlayed, x, y, w);
  }

  private continueRunAnimated(confirmAlreadyPlayed = false, x = 676, y = 642, w = 252) {
    this.runTitleLaunch(true, confirmAlreadyPlayed, x, y, w);
  }

  private runTitleLaunch(resume: boolean, confirmed: boolean, x: number, y: number, width: number) {
    if (this.titleRunLaunchPending || this.settingsOverlay || this.helpOverlay) return;
    const button = this.menuFocusTargets.get(resume || !this.menuHasSavedRun ? 'primaryRun' : 'secondaryRun');
    if (button) { x = button.x; y = button.y; width = button.width; }
    this.titleRunLaunchPending = true;
    void loadTitleRunLaunchModule()
      .then((module) => module.startRunAnimated(this, resume, confirmed, x, y, width))
      .catch((error) => {
        console.warn(LAZY_LOAD_FAILED, error);
        this.titleRunLaunchPending = false;
        if (resume) this.continueRun();
        else this.startRun();
      });
  }

  continueRun() {
    this.enterRoute(loadActiveRun() ?? createInitialRunState(this.selectedLeaderId, this.selectedDifficulty, this.selectedRunMode, SHARED_ROUTE_SEED));
  }

  private selectLeader(id: string) {
    const target = this.leaderPanels.find((entry) => entry.id === id);
    if (target && !target.unlocked) return; // can't pick a locked Leader
    this.selectedLeaderId = id;
    this.inspectedLeaderId = id;
    this.updateLaunchSummary();
    this.leaderPanels.forEach((entry) => {
      if (!entry.unlocked) return; // locked panels keep their dimmed style
      const selected = entry.id === id;
      entry.rect.setStrokeStyle(0);
      entry.rect.setFillStyle(selected ? 0x193140 : 0x0b1723, selected ? 0.96 : 0.86);
      entry.selectedIcon?.setVisible(selected).setAlpha(selected ? 0.94 : 0);
      entry.cardFrame?.clearTint();
      entry.cardFrame?.setAlpha(selected ? 0.96 : 0.58);
      entry.selectedFlourish?.setVisible(selected).setAlpha(selected ? 0.94 : 0);
    });
    if (this.menuFocus === 'leader') this.updateMenuFocusRing();
  }

  private showLeaderTooltip(id: string, anchorX: number) {
    this.runMenuOptionalAction('showLeaderTooltip', id, anchorX);
  }

  private runMenuOptionalAction(action: keyof MenuOptionalUiModule, ...args: unknown[]) {
    const generation = this.menuGeneration;
    void loadMenuOptionalUiModule()
      .then((module) => {
        if (generation !== this.menuGeneration || !this.scene.isActive() || (action === 'showLeaderTooltip' && !this.setupOpen)) return;
        return (module[action] as (scene: Phaser.Scene, ...values: unknown[]) => void | Promise<void>)(this, ...args);
      })
      .catch(console.warn);
  }

  private hideLeaderTooltip() {
    this.leaderTooltip?.destroy(true);
    this.leaderTooltip = undefined;
    this.updateMenuTextState();
  }

  private startRun() {
    this.enterRoute(createInitialRunState(this.selectedLeaderId, this.selectedDifficulty, this.selectedRunMode, SHARED_ROUTE_SEED));
  }

  private enterRoute(runState: RunState) {
    if (!recoverFinishedRun()) {
      this.titleRunLaunchPending = false;
      showSaveRecovery(() => { if (!recoverFinishedRun()) return false; this.scene.restart(); return true; });
      return;
    }
    birdAudio.play('route');
    this.storageRecoveryNotice = undefined;
    this.scene.start(runState.pendingCombatReward ? 'BattleScene' : 'RouteScene', {
      runState, routeNodeId: runState.pendingCombatReward?.nodeId,
    });
  }

  private createAnimatedTitle() {
    const logo = this.add.container(GAME_WIDTH / 2, 200).setName('title-logo');
    logo.add([
      this.add.image(-10, -51, 'title-bird').setDisplaySize(284, 136),
      this.add.image(6, 38, 'title-squad').setDisplaySize(315, 125),
    ]);
    if (!prefersReducedMotion()) {
      logo.setAlpha(0);
      this.tweens.add({ targets: logo, alpha: 1, duration: 220, ease: 'Sine.easeOut' });
    }
  }

}
