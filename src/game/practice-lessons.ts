import { UI_FONT as TOKEN_FONT, UI_DISPLAY_FONT as TOKEN_DISPLAY_FONT } from './ui-tokens';
import Phaser from 'phaser';
import { createInitialRunState } from '../main';
import { bindActionFocus } from './action-focus';
import { beginPracticeSession, endPracticeSession } from './practice-session';
import { skipFirstFlightGuide } from './first-flight-guide';
import { announceScreenReader } from './screen-reader-accessibility';
import { controlBindingLabel } from './input-bindings';
import { openHelpOverlay } from './menu-optional-ui';
import { DECISION_UI } from './theme';
import { quietButton } from './quiet-ui';

const KEY = 'GuidedPracticeScene';
const STATE = 'birdsquad.practiceLesson';
const lessons = [
  { id: 'cover', title: 'Protect the flock', description: 'Read an intent, build Cover, then Roost through the attack.',
    cards: ['pentacles_04', 'swords_ace', 'cups_fledgling', 'wands_ace'],
    steps: ['Play Locked Nest. Cover absorbs the damage shown by the enemy intent.',
      'Roost. Cover absorbs damage first; any remaining damage reaches Cohesion.'],
    conclusion: 'Cover absorbs hits before Cohesion. Check the incoming-damage preview before you Roost.' },
  { id: 'flow', title: 'Find your Flow', description: 'Combine suits to reach Surge using the Fledgling’s signature.',
    cards: ['pentacles_fledgling', 'wands_ace', 'swords_ace', 'cups_fledgling', 'major_00'],
    steps: ['Play Nest Fledgling, Plume Flash, and Quill Point to reach Surge.'],
    conclusion: 'Attacks build Flow. This Leader also gains Flow from each suit’s first play each combat. Cover helps you hold it through incoming hits.' },
  { id: 'molt', title: 'Turn through Molt', description: 'Change your cards, use an alternate effect, and see the cost of Roosting.',
    cards: ['aviary_25', 'pentacles_04', 'wands_ace', 'cups_fledgling'],
    steps: ['Play Hot Feathers to change your cards and reduce their costs.',
      'Play Plume Flash: in Molt it grants Cover instead of attacking.',
      'Roost to see Molt end and Open Sky expose the flock.'],
    conclusion: 'Molt changes every card’s ability and reduces non-Molt costs by 1. Roost ends Molt and leaves the flock Open Sky for the enemy turn.' },
] as const;
type Lesson = typeof lessons[number];

function button(scene: Phaser.Scene, root: Phaser.GameObjects.Container, x: number, y: number, width: number, label: string, run: () => void) {
  const hit = quietButton(scene, { x, y, width, label, name: 'practice-lesson-action', onActivate: run });
  hit.setData('label', label);
  root.add([hit, hit.getData('labelObject')]);
  return { hit, label, run };
}

export function openPracticeLessons(menu: any) {
  menu.closeHelpOverlay();
  const root = menu.add.container(0, 0).setDepth(80);
  menu.helpOverlay = root;
  menu.menuFocusRing?.setVisible(false);
  root.setData('topic', 'Practice lessons. Choose Cover, Flow, or Molt. Nothing is saved.');
  const back = () => { menu.closeHelpOverlay(); openHelpOverlay(menu); };
  root.setData('onBack', back);
  root.add(menu.add.rectangle(640, 360, 1280, 720, DECISION_UI.surface, 1).setInteractive());
  root.add(menu.add.text(180, 100, 'Learn by playing', {
    fontFamily: TOKEN_DISPLAY_FONT, fontSize: '38px', color: DECISION_UI.text,
  }).setResolution(2));
  root.add(menu.add.text(180, 159, 'Short, replayable lessons. Your active flight and collection stay safe.', {
    fontFamily: TOKEN_FONT, fontSize: '20px', color: DECISION_UI.secondary,
  }).setResolution(2).setName('how-to-play-readable'));
  let launching = false;
  const actions = lessons.map((lesson, index) => {
    const y = 270 + index * 116;
    const action = button(menu, root, 340, y, 320, lesson.title, () => {
      if (launching) return;
      launching = true;
      const cards = lesson.cards.map(id => ({ id, upgraded: false }));
      if (!beginPracticeSession(cards)) { launching = false; return; }
      try {
        skipFirstFlightGuide();
        const runState = createInitialRunState('fledgling', 0, 'quick', `lesson-${lesson.id}`, cards);
        if (!menu.game.scene.getScene(KEY)) menu.game.scene.add(KEY, GuidedPracticeScene, false);
        menu.scene.start('BattleScene', { runState, routeNodeId: 'm1_entry' });
        menu.scene.launch(KEY, { id: lesson.id });
      } catch (error) {
        endPracticeSession(); launching = false;
        announceScreenReader('The lesson could not open. Please try again.');
        console.warn('Practice lesson could not open', error);
      }
    });
    root.add(menu.add.text(548, y, lesson.description, {
      fontFamily: TOKEN_FONT, fontSize: '22px', color: DECISION_UI.secondary,
      wordWrap: { width: 540 }, lineSpacing: 4,
    }).setResolution(2).setOrigin(0, 0.5).setName('how-to-play-readable'));
    return action;
  });
  actions.push(button(menu, root, 640, 635, 240, 'Back to guide', back));
  bindActionFocus(menu, root, actions, back, { exclusive: true });
  menu.updateMenuTextState();
}

class GuidedPracticeScene extends Phaser.Scene {
  private lesson!: Lesson;
  private battle: any;
  private prompt!: Phaser.GameObjects.Container;
  private copy!: Phaser.GameObjects.Text;
  private lastStep = -1;
  private moltPlays = -1;
  private moltTurn = -1;
  private usedAlternate = false;
  private protectedTurn = -1;
  private blockedBefore = 0;
  private finished = false;

  constructor() { super(KEY); }

  create(data: { id: string }) {
    this.lesson = lessons.find(lesson => lesson.id === data.id)!;
    this.battle = this.scene.get('BattleScene');
    this.lastStep = -1; this.moltPlays = -1; this.moltTurn = -1;
    this.protectedTurn = -1; this.usedAlternate = false; this.finished = false;
    this.prompt = this.add.container(0, 0);
    this.prompt.add(this.add.rectangle(400, 150, 600, 82, DECISION_UI.surface, 0.97).setName('practice-lesson-panel'));
    this.copy = this.add.text(400, 150, '', {
      fontFamily: TOKEN_FONT, fontSize: '20px', color: DECISION_UI.text,
      wordWrap: { width: 560 }, align: 'center', lineSpacing: 3,
    }).setResolution(2).setOrigin(0.5).setName('practice-lesson-instruction');
    this.prompt.add(this.copy);
    const exit = () => this.scene.stop();
    this.battle.events.once('shutdown', exit);
    this.events.once('shutdown', () => {
      this.battle.events.off('shutdown', exit);
      this.registry.remove(STATE);
    });
    this.scene.bringToTop();
  }

  update() {
    const b = this.battle;
    if (this.finished || !b?.root?.active || !b?.fxLayer?.active) return;
    this.prompt.setVisible(!b.pauseOverlayOpen && !b.settingsOverlayOpen && !b.combatCardDetail?.active
      && !b.inspectOverlay && !b.supplyDrawerOpen && !b.waymarkDrawerOpen);
    if (b.pauseOverlayOpen || b.settingsOverlayOpen || b.combatAnimationPending || b.combatIntroActive) return;
    let step = 0, complete = false;
    if (this.lesson.id === 'cover') {
      if (this.protectedTurn < 0 && b.flock.block > 0 && b.statCardsPlayed > 0) {
        this.protectedTurn = b.turn; this.blockedBefore = b.statBlocked;
      }
      step = this.protectedTurn >= 0 ? 1 : 0;
      complete = this.protectedTurn >= 0 && b.turn > this.protectedTurn && b.statBlocked > this.blockedBefore;
    } else if (this.lesson.id === 'flow') {
      complete = b.statSurgesTriggered > 0;
    } else {
      if (this.moltPlays < 0 && b.flock.molt) { this.moltPlays = b.statCardsPlayed; this.moltTurn = b.turn; }
      if (b.flock.molt && this.moltPlays >= 0 && b.statCardsPlayed > this.moltPlays) this.usedAlternate = true;
      step = this.usedAlternate ? 2 : this.moltPlays >= 0 ? 1 : 0;
      complete = this.usedAlternate && b.turn > this.moltTurn && !b.flock.molt;
    }
    if (complete || b.mode !== 'battle') { this.finish(complete); return; }
    if (step !== this.lastStep) {
      this.lastStep = step;
      const instruction = this.lesson.steps[step];
      this.copy.setText(instruction);
      this.registry.set(STATE, { id: this.lesson.id, title: this.lesson.title, step: step + 1, instruction, complete: false });
      announceScreenReader(`${this.lesson.title}. ${instruction} Pause opens the exit to Main Menu.`);
    }
  }

  private finish(complete: boolean) {
    this.finished = true;
    this.prompt.destroy(true);
    this.battle.scene.pause();
    const root = this.add.container(0, 0);
    root.add(this.add.rectangle(640, 360, 1280, 720, 0x050d15, 0.93).setInteractive());
    root.add(this.add.text(640, 245, complete ? 'Lesson complete' : 'Give it another try', {
      fontFamily: TOKEN_DISPLAY_FONT, fontSize: '36px', color: DECISION_UI.text,
    }).setResolution(2).setOrigin(0.5));
    const instruction = complete ? this.lesson.conclusion
      : 'Follow the lesson prompts to try this mechanic. You can replay any lesson from How to Play.';
    root.add(this.add.text(640, 340, instruction, {
      fontFamily: TOKEN_FONT, fontSize: '24px', color: DECISION_UI.secondary,
      wordWrap: { width: 740 }, align: 'center', lineSpacing: 8,
    }).setResolution(2).setOrigin(0.5));
    const back = () => this.battle.scene.start('MenuScene', { reopenHelp: true });
    const action = button(this, root, 640, 478, 300, 'Back to How to Play', back);
    bindActionFocus(this, root, [action], back);
    root.add(this.add.text(640, 550, `${controlBindingLabel('confirm')} / A: Continue  ·  Nothing saved`, {
      fontFamily: TOKEN_FONT, fontSize: '18px', color: DECISION_UI.secondary,
    }).setOrigin(0.5).setResolution(2));
    this.registry.set(STATE, { id: this.lesson.id, title: this.lesson.title, instruction, complete, finished: true });
    announceScreenReader(`${complete ? 'Lesson complete.' : 'Give it another try.'} ${instruction} Confirm returns to How to Play.`);
  }
}
