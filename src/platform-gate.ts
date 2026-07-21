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
const gate = document.querySelector<HTMLElement>('#portrait-gate');
const gameContainer = document.querySelector<HTMLElement>('#game-container');
let pausedByGate = false;
let wasBlocked = false;

function activeGame() {
  return (window as Window & { __birdSquadGame?: PlatformGateGame }).__birdSquadGame;
}

function syncPlatformGate() {
  const blocked = query.matches;
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
addEventListener('pageshow', syncPlatformGate);
syncPlatformGate();
const readinessPoll = window.setInterval(() => {
  if (syncPlatformGate()) window.clearInterval(readinessPoll);
}, 100);
