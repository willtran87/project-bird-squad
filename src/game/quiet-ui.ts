import Phaser from 'phaser';
import { DECISION_UI, MIN_SUPPORTED_TOUCH_TARGET, UI_FONT, UI_TYPE, UI_SPACE, UI_CONTROL } from './theme';
import { fitTextExcerpt } from './text-excerpt';

/** Shared restrained controls: decoration never changes the input bounds. */
export function quietButton(scene: Phaser.Scene, options: {
  x: number; y: number; width: number; label: string; name: string;
  onActivate: () => void; kind?: 'primary' | 'secondary' | 'utility' | 'destructive';
  enabled?: boolean; selected?: boolean; focused?: boolean;
}) {
  const { x, y, label, name, onActivate } = options;
  const width = Math.max(options.width, MIN_SUPPORTED_TOUCH_TARGET);
  const enabled = options.enabled !== false;
  const primary = options.kind === 'primary';
  const destructive = options.kind === 'destructive';
  const hit = scene.add.rectangle(x, y, width, MIN_SUPPORTED_TOUCH_TARGET, UI_CONTROL.surface, 1)
    .setName(name).setData('enabled', enabled).setData('selected', Boolean(options.selected))
    .setData('focused', Boolean(options.focused)).setData('fullLabel', label)
    .setData('controlKind', options.kind ?? 'secondary').setData('hovered', false);
  hit.setData('status', 'idle');
  const text = scene.add.text(x, y, label, { fontFamily: UI_FONT, fontSize: `${UI_TYPE.primary}px`, resolution: UI_TYPE.resolution,
    color: UI_CONTROL.text,
    fontStyle: primary || options.selected ? 'bold' : 'normal', align: 'center',
    wordWrap: { width: width - UI_SPACE.controlInset * 2, useAdvancedWrap: true }, maxLines: 2,
  }).setOrigin(0.5).setName(`${name}-label`);
  fitTextExcerpt(text, label, 2);
  hit.setData('labelObject', text);
  const paint = () => {
    const available = hit.getData('enabled') !== false;
    const status = hit.getData('status');
    const focused = Boolean(hit.getData('focused'));
    const selected = Boolean(hit.getData('selected'));
    const hovered = available && status !== 'loading' && Boolean(hit.getData('hovered'));
    const quiet = options.kind === 'utility' && status === 'idle' && available && !selected && !focused && !hovered;
    hit.setFillStyle(!available ? UI_CONTROL.disabled
      : status === 'error' ? UI_CONTROL.danger
      : primary ? (hovered ? UI_CONTROL.primaryHover : UI_CONTROL.primary)
      : destructive ? (hovered ? UI_CONTROL.dangerHover : UI_CONTROL.danger)
      : selected || status === 'loading' ? UI_CONTROL.selected : hovered ? UI_CONTROL.hover : UI_CONTROL.surface,
    quiet ? 0.01 : 1);
    hit.setStrokeStyle(focused ? UI_CONTROL.focusWidth : hovered ? UI_CONTROL.hoverWidth : UI_CONTROL.borderWidth,
      (focused || hovered) && primary && available && status !== 'error' ? UI_CONTROL.surface : focused || hovered ? UI_CONTROL.focus
      : status === 'error' ? UI_CONTROL.dangerBorder : status === 'armed' ? UI_CONTROL.primary
      : destructive && available ? UI_CONTROL.dangerBorder : UI_CONTROL.border,
      quiet ? 0 : 1);
    const color = !available ? UI_CONTROL.disabledText : status === 'error' ? UI_CONTROL.dangerText : primary ? UI_CONTROL.onPrimary
      : destructive ? UI_CONTROL.dangerText : UI_CONTROL.text;
    if (text.style.color !== color) text.setColor(color);
    const weight = primary || selected ? 'bold' : 'normal';
    if (text.style.fontStyle !== weight) {
      // Preserve labels changed by live input hints or setup mode switches.
      const source = text.getData('truncated') ? text.getData('fullText') : text.text;
      text.setFontStyle(weight);
      fitTextExcerpt(text, source, 2);
    }
  };
  hit.on('changedata', (_object: unknown, key: string) => {
    if (key === 'enabled' || key === 'status') {
      if (hit.getData('enabled') !== false && hit.getData('status') !== 'loading') hit.setInteractive({ useHandCursor: true });
      else { hit.disableInteractive(); hit.setData('hovered', false); }
    }
    if (key === 'status' || key === 'statusLabel') {
      const status = hit.getData('status');
      const prefix = status === 'loading' ? 'Opening… ' : status === 'error' ? 'Error: ' : status === 'armed' ? 'Confirm: ' : '';
      fitTextExcerpt(text, status === 'idle' ? hit.getData('fullLabel') : hit.getData('statusLabel') || `${prefix}${hit.getData('fullLabel')}`, 2);
    }
    if (['enabled', 'focused', 'selected', 'hovered', 'status', 'statusLabel'].includes(key)) paint();
  });
  hit.on('pointerover', () => hit.setData('hovered', true))
    .on('pointerout', () => hit.setData('hovered', false))
    .on('pointerdown', () => {
      let parent = hit.parentContainer;
      while (parent) {
        if (!parent.active || !parent.visible) return;
        parent = parent.parentContainer;
      }
      if (hit.active && hit.visible && hit.input?.enabled && hit.getData('enabled') !== false) onActivate();
    });
  if (enabled) hit.setInteractive({ useHandCursor: true });
  paint();
  return hit;
}

export function quietText(scene: Phaser.Scene, x: number, y: number, value: string,
  width: number, size: number = UI_TYPE.primary, color: string = DECISION_UI.text) {
  return scene.add.text(x, y, value, { fontFamily: UI_FONT, fontSize: `${Math.max(UI_TYPE.primary, size)}px`,
    resolution: UI_TYPE.resolution, color, wordWrap: { width, useAdvancedWrap: true }, lineSpacing: 3 });
}
