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

// Portrait phones and tablets rotate; a landscape window below 560x320 is too
// small even for the compact lens. Keep in step with style.css.
const query = matchMedia('(orientation: portrait) and (max-width: 1100px), (max-width: 559px), (max-height: 319px)');
const portraitQuery = matchMedia('(orientation: portrait)');
// Phone landscape (below 1000x560) plays through the compact lens, a lazy chunk
// that magnifies the 1280x720 layout and adds side rails. Larger windows never
// load it and keep the unchanged layout.
const compactQuery = matchMedia('(max-width: 999px), (max-height: 559px)');
const gate = document.querySelector<HTMLElement>('#portrait-gate');
const gameContainer = document.querySelector<HTMLElement>('#game-container');
let pausedByGate = false;
let wasBlocked = false;
let lens: Promise<typeof import('./game/compact-lens')> | undefined;

function activeGame() {
  return (window as Window & { __birdSquadGame?: PlatformGateGame }).__birdSquadGame;
}

/** Portrait asks for a rotation; a landscape window below 560x320 is told
 *  plainly that it is too small. Phone landscape plays (compact lens). */
const GATE_COPY = {
  rotate: {
    title: 'Rotate to Landscape',
    copy: 'Turn your device sideways to play. Bird Squad runs on desktop, tablets and phones held in landscape.',
  },
  small: {
    title: 'Landscape screen too small',
    copy: 'Bird Squad needs a window of at least 560 × 320 so cards stay readable and every button is large enough to touch. Use a larger window or screen.',
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

function syncCompact(game: PlatformGateGame | undefined, blocked: boolean) {
  const compact = !blocked && compactQuery.matches;
  if (compact) document.documentElement.dataset.layout = 'compact';
  else delete document.documentElement.dataset.layout;
  if (!game || (!compact && !lens)) return;
  lens ??= import('./game/compact-lens');
  lens.then(m => m.syncCompactLens(game as unknown as Parameters<typeof m.syncCompactLens>[0], compact), () => undefined);
}

function syncPlatformGate() {
  const blocked = query.matches;
  if (blocked) syncGateCopy();
  gate?.setAttribute('aria-hidden', String(!blocked));
  if (gameContainer) gameContainer.inert = blocked;
  if (blocked && !wasBlocked) gate?.focus({ preventScroll: true });
  wasBlocked = blocked;

  const game = activeGame();
  syncCompact(game, blocked);
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
compactQuery.addEventListener('change', syncPlatformGate);
addEventListener('pageshow', syncPlatformGate);
syncPlatformGate();
const readinessPoll = window.setInterval(() => {
  if (syncPlatformGate()) window.clearInterval(readinessPoll);
}, 100);
