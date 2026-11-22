import './update-recovery';

interface PlatformGateGame {
  loop: {
    running: boolean;
    sleep: () => void;
    wake: (seamless?: boolean) => void;
  };
  scale: { refresh: () => void };
  scene: {
    getScenes: (activeOnly?: boolean) => Array<{ scene: { key: string } }>;
  };
}

const query = matchMedia('(max-width: 999px), (max-height: 559px), (orientation: portrait) and (max-width: 1100px)');
const portraitQuery = matchMedia('(orientation: portrait)');
const gate = document.querySelector<HTMLElement>('#portrait-gate');
const gameContainer = document.querySelector<HTMLElement>('#game-container');
let pausedByGate = false;
let wasBlocked = false;

function activeGame() {
  return (window as Window & { __birdSquadGame?: PlatformGateGame }).__birdSquadGame;
}

/** Portrait asks for a rotation; a landscape screen below 1000x560 (a phone
 *  held sideways) is told plainly that it is too small: the 1280x720 layout
 *  would shrink 58 px touch targets below 44 CSS px and body text below 9 px. */
const GATE_COPY = {
  rotate: {
    title: 'Rotate to Landscape',
    copy: 'Turn your device sideways to play. Bird Squad runs on desktop and on tablets held in landscape.',
  },
  small: {
    title: 'Landscape screen too small',
    copy: 'Bird Squad needs a window of at least 1000 × 560 so cards stay readable and every button is large enough to touch. Use a tablet, a desktop, or a larger window.',
  },
} as const;

function syncGateCopy() {
  if (!gate) return;
  const reason = portraitQuery.matches ? 'rotate' : 'small';
  if (gate.dataset.reason === reason) return;
  gate.dataset.reason = reason;
  const title = gate.querySelector('.portrait-gate-title');
  const copy = gate.querySelector('#portrait-gate-copy');
  if (title) title.textContent = GATE_COPY[reason].title;
  if (copy) copy.textContent = GATE_COPY[reason].copy;
}

function syncPlatformGate() {
  const blocked = query.matches;
  if (blocked) syncGateCopy();
  gate?.setAttribute('aria-hidden', String(!blocked));
  if (gameContainer) gameContainer.inert = blocked;
  if (blocked && !wasBlocked) gate?.focus({ preventScroll: true });
  wasBlocked = blocked;

  const game = activeGame();
  if (!game) return false;
  if (blocked && !pausedByGate) {
    const ready = game.scene.getScenes(true).some((scene) => scene.scene.key !== 'BootScene');
    if (ready && game.loop.running) {
      game.loop.sleep();
      pausedByGate = true;
    }
  } else if (!blocked && pausedByGate) {
    game.loop.wake(true);
    game.scale.refresh();
    pausedByGate = false;
  }
  return !blocked || pausedByGate;
}

query.addEventListener('change', syncPlatformGate);
portraitQuery.addEventListener('change', syncPlatformGate);
addEventListener('pageshow', syncPlatformGate);
syncPlatformGate();
const readinessPoll = window.setInterval(() => {
  if (syncPlatformGate()) window.clearInterval(readinessPoll);
}, 100);
