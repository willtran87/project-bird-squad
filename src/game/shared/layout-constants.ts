export const GAME_WIDTH = 1280;

export const GAME_HEIGHT = 720;

export const HUD_MENU_PANEL = {
  w: 1060,
  h: 570,
  cx: GAME_WIDTH / 2,
  cy: GAME_HEIGHT / 2,
  headerIconX: 392,
  headerIconY: 58,
  closeX: 76,
  closeY: 56
};

const DECK_DETAIL_LAYOUT = {
  panelCx: 826,
  panelCy: 379,
};

export const MENU_BORDER_WIDTH = 1.5;

const MENU_BORDER_COLOR = 0x7ab8d6;

export const HAND_Y = 580;

export const CARD_W = 180;

export const CARD_H = 270;
 // true 2:3 aspect; room for a 16 CSS-pixel compact reading floor
export const ROUTE_NODE_RADIUS = 50;

export const ROUTE_BOSS_NODE_RADIUS = 66;

export const ROUTE_NODE_ICON_SIZE = 84;

export const ROUTE_BOSS_NODE_ICON_SIZE = 120;

export const ROUTE_NODE_FOCUS_PAD = 10;

export const ROUTE_NODE_LAYOUT_PAD = 4;

export const ROUTE_CONFIRM_ICON_SIZE = 36;

export const ROUTE_CONFIRM_HIT_SIZE = 82;

export const ROUTE_CONFIRM_LABEL_OFFSET_X = -86;

export const ROUTE_CONFIRM_LABEL_WIDTH = 128;

export const ROUTE_COMMIT_STREAK_TEXTURE = 'route-commit-streak';

export const ROUTE_COMMIT_STREAK_DELAY_MS = 180;

export const TITLE_RUN_LAUNCH_FLOURISH_TEXTURE = 'title-run-launch-flourish';

// Anchor points for combat FX (floating numbers / bursts), matching the
// enemy body (battle foreground renderer) and flock panel positions.
export const ENEMY_FX_X = 920;

export const ENEMY_FX_Y = 250;

export const FLOCK_FX_X = 230;

export const FLOCK_FX_Y = 332;

export const FLOCK_ART_X = 230;

export const FLOCK_ART_Y = 340;

export const PLAYER_ATTACK_RESOLVE_DELAY_MS = 200;

export const PLAYER_CARD_RESOLVE_DELAY_MS = 140;

export const PLAYER_CARD_FEEDBACK_SETTLE_MS = 60;

export const PLAYER_TURN_HANDOFF_DELAY_MS = 180;

export const ENEMY_TURN_PREAMBLE_MS = 180;

export const ENEMY_ATTACK_WINDUP_MS = 2600;

export const ENEMY_ATTACK_RECOVER_MS = 1450;

export const COMBAT_REDUCED_MOTION_TIMING_SCALE = 0.75;

export const COMBAT_REDUCED_MOTION_MIN_DELAY_MS = 40;

export const COMBAT_STANDARD_REPEAT_TIMING_SCALE = 0.24;

export const COMBAT_SNAPPY_TIMING_SCALE = 0.72;

export const COMBAT_SNAPPY_MIN_DELAY_MS = 40;

// HP-bar geometry, shared by the foreground renderer / top status bar and the
// drain animation (fadeRect in damageEnemy / damageFlock / healFlock) so they line up.
export const ENEMY_HP_BAR = { x: 920, y: 318, w: 210, h: 12 };

export const FLOCK_HP_BAR = { x: 159, y: 44, w: 190, h: 24 };

export const FLOW_HUD_X_OFFSET = 192;

export const FLOW_HUD_Y_OFFSET = 36;

export const FLOW_HUD_WIDTH = 380;

export const FLOW_HUD_HEIGHT = 28;

export const FLOW_HUD_PIP_OFFSET = -56;

export const FLOW_HUD_PIP_GAP = 15;
