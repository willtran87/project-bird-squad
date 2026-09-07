// Waivers affect gate requirements, never the evidence count or its provenance.
export function freshPlayerGate(policy, releaseVersion, strictHuman = false) {
  const waiver = policy?.freshPlayerGate;
  const valid = policy?.schemaVersion === 1
    && policy.releaseVersion === releaseVersion
    && ['required', 'waived'].includes(waiver?.status);
  if (!valid) return { waived: false, error: 'Release policy is missing, invalid, or belongs to another release version.' };
  if (waiver.status === 'required') return { waived: false };
  if (waiver.approvedBy !== 'project-owner'
    || !/^\d{4}-\d{2}-\d{2}$/.test(waiver.approvedOn ?? '')
    || typeof waiver.source !== 'string' || !waiver.source.trim()
    || typeof waiver.reason !== 'string' || !waiver.reason.trim()) {
    return { waived: false, error: 'Fresh-player waiver requires owner, date, source, and residual-risk explanation.' };
  }
  return {
    waived: !strictHuman,
    notice: strictHuman
      ? 'Strict human-evidence mode: the recorded waiver is not applied.'
      : `Fresh-player gate WAIVED for ${releaseVersion} by ${waiver.approvedBy} on ${waiver.approvedOn}. ${waiver.reason} Source: ${waiver.source}. Not passing human evidence. Physical-device and assistive-technology requirements remain unchanged.`,
  };
}
