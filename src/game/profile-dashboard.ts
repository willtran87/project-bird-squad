import { UI_DISPLAY_FONT as TOKEN_DISPLAY_FONT } from './ui-tokens';
import Phaser from 'phaser';
import { quietButton, quietText } from './quiet-ui';
import { DECISION_UI } from './theme';

type Tab = 'leaders' | 'achievements' | 'contracts' | 'showcase' | 'folios';
export interface ProfileDashboardView {
  tab: Tab; focus: string;
  stats: Array<{ label: string; value: string }>;
  progress: Array<{ label: string; value: number; total: number }>;
  leaders: Array<{ id: string; name: string; unlocked: boolean; status: string; detail: string }>;
  badges: Array<{ id: string; name: string; description: string; earned: boolean }>;
  counts: Record<Tab, number>; page: number; pageCount: number; historyCount: number;
  onTab: (tab: Tab) => void; onPage: (delta: -1 | 1) => void;
  onHistory: () => void; onBack: () => void; onSave: () => void;
}

/** One content view at a time. Small-screen readability is authored, not shrunk. */
export function renderProfileDashboard(scene: Phaser.Scene, view: ProfileDashboardView) {
  scene.add.rectangle(640, 360, 1160, 656, DECISION_UI.surface, 1)
    .setName('profile-dashboard-surface');
  quietText(scene, 92, 58, 'Flock Record', 700, 38, '#eee8d8').setFontFamily(TOKEN_DISPLAY_FONT);
  quietButton(scene, { x: 1100, y: 82, width: 168, label: 'Back to home', name: 'profile-return-hit',
    kind: 'utility', focused: view.focus === 'return', onActivate: view.onBack });
  view.stats.forEach((stat, index) => {
    const x = 94 + index * 219;
    quietText(scene, x, 128, stat.label, 202, 20, DECISION_UI.secondary).setName('profile-stat-label');
    quietText(scene, x, 154, stat.value, 202, 26, '#dfc18b').setName('profile-stat-value');
  });
  scene.add.rectangle(640, 201, 1096, 1, DECISION_UI.border, 0.6);
  quietText(scene, 94, 230, 'Your progress', 300, 24, '#dfc18b');
  view.progress.forEach((progress, index) => {
    const y = 286 + index * 87;
    quietText(scene, 94, y, progress.label, 260, 20, DECISION_UI.secondary);
    quietText(scene, 358, y, `${progress.value}/${progress.total}`, 104, 20)
      .setOrigin(1, 0).setName('profile-progress-value');
    scene.add.rectangle(226, y + 39, 264, 5, 0x29414d);
    const width = 264 * Phaser.Math.Clamp(progress.value / Math.max(1, progress.total), 0, 1);
    if (width > 0) scene.add.rectangle(94 + width / 2, y + 39, width, 5, 0x86b1be);
  });
  quietButton(scene, { x: 226, y: 589, width: 264, label: `Flight Log · ${view.historyCount}`,
    name: 'profile-flight-log-hit', enabled: view.historyCount > 0, focused: view.focus === 'flightLog', onActivate: view.onHistory });
  quietButton(scene, { x: 226, y: 655, width: 264, label: 'Manage save data', kind: 'utility',
    name: 'profile-save-data-hit', focused: view.focus === 'saveData', onActivate: view.onSave });
  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'leaders', label: 'Leaders' }, { id: 'achievements', label: 'Badges' },
    { id: 'contracts', label: 'Contracts' }, { id: 'showcase', label: 'Showcase' }, { id: 'folios', label: 'Folios' },
  ];
  tabs.forEach((tab, index) => {
    const x = 475 + index * 157;
    quietButton(scene, { x, y: 240, width: 149, label: tab.label, name: `profile-${tab.id}-tab-hit`,
      kind: 'utility', selected: view.tab === tab.id, focused: view.focus === tab.id,
      onActivate: () => view.onTab(tab.id) });
  });
  if (view.tab === 'leaders') view.leaders.forEach((leader, index) => {
    const y = 286 + index * 61;
    scene.add.rectangle(790, y + 27, 770, 56, index % 2 ? 0x10212c : 0x132632, 1)
      .setName('profile-leader-row').setData('leaderId', leader.id);
    quietText(scene, 416, y + 2, leader.name, 320, 20).setFontStyle('bold')
      .setName('profile-leader-name').setData('leaderId', leader.id);
    quietText(scene, 416, y + 29, leader.detail, 726, 20, DECISION_UI.secondary)
      .setName('profile-leader-detail').setData('leaderId', leader.id);
    quietText(scene, 1158, y + 3, leader.status, 384, 20, leader.unlocked ? '#adc9d2' : '#dfc18b')
      .setOrigin(1, 0).setName('profile-leader-status').setData('leaderId', leader.id);
  });
  if (view.tab === 'achievements' || view.tab === 'contracts') {
    if (!view.badges.length) quietText(scene, 430, 332,
      'Complete a district contract to place its mark here.', 670, 22, DECISION_UI.secondary);
    view.badges.forEach((badge, index) => {
      const y = 286 + index * 98;
      scene.add.rectangle(790, y + 44, 770, 90, index % 2 ? 0x10212c : 0x132632, 1);
      quietText(scene, 416, y + 2, badge.name, 610, 20).setFontStyle('bold')
        .setName('profile-badge-name').setData('badgeId', badge.id);
      quietText(scene, 1158, y + 3, badge.earned ? 'Earned' : 'To earn', 100, 20, '#adc9d2').setOrigin(1, 0);
      quietText(scene, 416, y + 29, badge.description, 738, 20, DECISION_UI.secondary)
        .setName('profile-badge-description').setData('badgeId', badge.id);
    });
  }
  if (view.pageCount > 1 && view.tab !== 'showcase' && view.tab !== 'leaders') {
    quietButton(scene, { x: 510, y: 625, width: 160, label: 'Previous', name: 'profile-badge-page-previous',
      enabled: view.page > 0, onActivate: () => view.onPage(-1) });
    quietText(scene, 790, 625, `${view.page + 1} / ${view.pageCount}`, 160, 20).setOrigin(0.5).setName('profile-badge-page-label');
    quietButton(scene, { x: 1070, y: 625, width: 160, label: 'Next', name: 'profile-badge-page-next',
      enabled: view.page < view.pageCount - 1, onActivate: () => view.onPage(1) });
  }
}
