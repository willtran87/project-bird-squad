let held = false;
export function recoveryOwnsInput() {
  if (typeof document === 'undefined') return false;
  if (held && !Array.from(navigator.getGamepads?.() ?? []).some(p => p?.buttons.some(b => b.pressed))) held = false;
  return held || Boolean(document.getElementById('update-recovery'));
}
export function holdRecoveryInput() {
  if (held) return;
  held = true;
  const release = () => {
    recoveryOwnsInput();
    if (held) requestAnimationFrame(release);
  };
  requestAnimationFrame(release);
}
