export interface MoltPowerState {
  moltPower: number;
  moltApplied: number;
}

export function spendMoltPower(
  state: MoltPowerState,
  effectValue: number,
  area = false,
  onSpend?: (amount: number) => void
) {
  const available = Number.isFinite(state.moltPower) ? Math.max(0, state.moltPower) : 0;
  if (available <= 0 || !Number.isFinite(effectValue) || effectValue <= 0) return 0;
  const amount = area ? Math.ceil(available / 2) : available;
  state.moltPower = 0;
  state.moltApplied = amount;
  onSpend?.(amount);
  return amount;
}
