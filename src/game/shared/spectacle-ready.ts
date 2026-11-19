// Resolves once the optional spectacle layer has installed (or failed to).
// main.ts kicks off the lazy import right after the game is created; BootScene
// waits on it alongside the UI fonts before starting the menu.
let spectacleReady: Promise<unknown> = Promise.resolve();

export function setSpectacleReady(value: Promise<unknown>) {
  spectacleReady = value;
}

export function getSpectacleReady(): Promise<unknown> {
  return spectacleReady;
}
