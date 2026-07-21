import type Phaser from 'phaser';
import type { StorageRecoveryEvent, StorageRecoveryOutcome } from './safe-storage';

export interface StorageRecoveryNotice {
  outcome: StorageRecoveryOutcome;
  scopes: string[];
  text: string;
}

export function createStorageRecoveryNotice(events: StorageRecoveryEvent[]): StorageRecoveryNotice {
  const scopeFor = (key: string) => key === 'birdsquad.account'
    ? 'Flock Record'
    : key === 'birdsquad.run.active'
      ? 'flight checkpoint'
      : key === 'birdsquad.firstFlightGuide'
        ? 'First Flight guide'
        : key === 'birdsquad.runs'
          ? 'flight history'
          : 'save data';
  const scopes = [...new Set(events.map((event) => scopeFor(event.key)))];
  const reset = events.some((event) => event.outcome === 'reset');
  const joined = scopes.length > 2
    ? `${scopes.length} save areas`
    : scopes.length === 1
      ? scopes[0]
      : `${scopes[0]} and ${scopes[1]}`;
  return reset
    ? { outcome: 'reset', scopes, text: `SAVE CHECK  Damaged ${joined} isolated; safe defaults are active.` }
    : { outcome: 'recovered', scopes, text: `RECOVERED  Last safe ${joined} restored.` };
}

export function renderStorageRecoveryNotice(
  scene: Phaser.Scene,
  notice: StorageRecoveryNotice,
  fontFamily: string,
  fontStyle: Phaser.Types.GameObjects.Text.TextStyle['fontStyle'],
): void {
  const recovered = notice.outcome === 'recovered';
  const accent = recovered ? 0x8fd6a0 : 0xf0c36f;
  scene.add.rectangle(780, 697, 620, 28, 0x05070c, 0.84)
    .setStrokeStyle(1, accent, 0.74)
    .setName('storage-recovery-notice');
  scene.add.rectangle(484, 697, 4, 18, accent, 0.92)
    .setName('storage-recovery-notice');
  scene.add.text(792, 697, notice.text, {
    fontFamily,
    fontSize: '13px',
    fontStyle,
    color: recovered ? '#bce9c5' : '#ffe1a3',
    stroke: '#05070c',
    strokeThickness: 2,
    align: 'center',
    wordWrap: { width: 584 },
  }).setResolution(2).setOrigin(0.5).setName('storage-recovery-notice');
}
