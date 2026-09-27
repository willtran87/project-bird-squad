// Waivers affect gate requirements, never the evidence count or its provenance.
export function failedManualAudits(audits) {
  return audits.filter(audit => audit?.passed === false).map(audit =>
    `Manual audit reports failure: ${audit.kind ?? 'unknown kind'} / ${audit.environment ?? 'unknown environment'}. An evidence waiver does not resolve a known failure.`);
}

export function freshPlayerGate(policy, releaseVersion, strictHuman = false) {
  return evidenceGate(policy, releaseVersion, 'freshPlayerGate', strictHuman);
}

export function evidenceGate(policy, releaseVersion, key, strict = false) {
  const label = { freshPlayerGate: 'Fresh-player', physicalDeviceGate: 'Physical-device', assistiveTechGate: 'Assistive-technology' }[key];
  if (!label) return { waived: false, error: 'Unknown release evidence gate.' };
  const waiver = policy?.[key];
  // Older policies did not expose manual waivers: keep those gates required.
  if (key !== 'freshPlayerGate' && waiver === undefined
    && policy?.schemaVersion === 1 && policy.releaseVersion === releaseVersion) return { waived: false };
  const valid = policy?.schemaVersion === 1
    && policy.releaseVersion === releaseVersion
    && ['required', 'waived'].includes(waiver?.status);
  if (!valid) return { waived: false, error: 'Release policy is missing, invalid, or belongs to another release version.' };
  if (waiver.status === 'required') return { waived: false };
  if (waiver.approvedBy !== 'project-owner'
    || !/^\d{4}-\d{2}-\d{2}$/.test(waiver.approvedOn ?? '')
    || typeof waiver.source !== 'string' || !waiver.source.trim()
    || typeof waiver.reason !== 'string' || !waiver.reason.trim()) {
    return { waived: false, error: `${label} waiver requires owner, date, source, and residual-risk explanation.` };
  }
  return {
    waived: !strict,
    notice: strict
      ? `Strict evidence mode: the recorded ${label} waiver is not applied.`
      : `${label} gate WAIVED for ${releaseVersion} by ${waiver.approvedBy} on ${waiver.approvedOn}. ${waiver.reason} Source: ${waiver.source}. Not passing human evidence or a verified device/assistive-technology audit.`,
  };
}
