/** Reviewed contacts in normalized source coordinates (not transparent bounds).
 * Tails, wing tips and carried tools must not become the floor anchor.
 * All other cutouts use their measured alpha floor. Keep these independent of
 * screen scale so the same art remains grounded in every encounter layout.
 */
// Named tuple: horizontal contact, vertical contact, stance width.
export const COMBAT_ART_CONTACTS: Readonly<Record<string, readonly [x: number, y: number, width: number]>> = {
  roof_rat: [0.60, 416 / 512, 0.44],
  canal_dock_rat: [0.56, 424 / 512, 0.50],
  kite_hawk_courier: [0.40, 0.87, 0.30],
  opossum_decoy: [0.47, 0.82, 0.40],
  rooftop_raccoon: [0.42, 0.86, 0.42],
  crab_dockguard: [0.60, 0.74, 0.60],
  bat_nightcaller: [0.48, 0.75, 0.32],
  moth_lantern_drifter: [0.57, 0.84, 0.35],
  canal_toll_magpie: [0.55, 0.92, 0.42],
  roost_relay_falcon: [0.39, 0.945, 0.44],
  roost_kettle_harrier: [0.39, 0.97, 0.44],
  roost_skyline_baron: [0.38, 0.98, 0.45],
  roost_wind_shrike: [0.39, 0.96, 0.43],
  spire_static_swift: [0.62, 0.90, 0.27],
  spire_signal_kite: [0.59, 0.92, 0.31],
  spire_tollkeeper_kestrel: [0.60, 0.93, 0.35],
  'flock-leader-fledgling': [0.60, 0.884, 0.44],
  'flock-leader-roostkeeper': [0.64, 0.788, 0.34],
  'flock-leader-spark-caller': [0.65, 0.844, 0.34],
  'flock-leader-talon': [0.73, 0.89, 0.29],
  'flock-leader-tidewarden': [0.59, 0.915, 0.29],
};

export function artContact(key: string, artX: number, artY: number, width: number, height: number,
  fallback: { x: number; y: number; width: number }) {
  const contact = COMBAT_ART_CONTACTS[key.replace(/^enemy-/, '')];
  return contact ? {
    x: artX + width * (contact[0] - 0.5),
    y: artY + height * (contact[1] - 0.5),
    width: width * contact[2],
  } : fallback;
}
