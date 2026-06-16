export interface LeaderLore {
  id: string;
  epithet: string;
  codexSummary: string;
  backstory: string;
  narrativeBeats: string[];
  playstyleRead: string;
  flockRole: string;
  quote: string;
  unlockFlavor: string;
}

export const leaderLore: Record<string, LeaderLore> = {
  fledgling: {
    id: 'fledgling',
    epithet: 'Small Wings, Wide Sky',
    codexSummary: 'A mixed rooftop crew learning how to turn uneven instincts into one shared rhythm.',
    backstory: 'The Fledgling Flock is not one hero but the first mixed crew to survive the rooftop circuit together. House sparrows know how to live under signs, above awnings, and beside louder birds who underestimate them. Their leader learned by failing in public, then turning each mistake into a job for another bird. Plumes set tempo, Quills mark danger, Basins keep the wounded moving, and Nests make cover from whatever the roof gives back.',
    narrativeBeats: [
      'A bad first crossing scatters the flock across vents, wires, and rain barrels.',
      'The survivors stop imitating specialist crews and start assigning every bird a useful job.',
      'Their first clean victory is messy, loud, and enough to prove a mixed flock can hold a roof.',
    ],
    playstyleRead: 'Balanced starter deck with all four suits represented. Strongest when it pivots instead of forcing one plan.',
    flockRole: 'The baseline flock: flexible, forgiving, and built to teach the city one rooftop at a time.',
    quote: 'Nobody starts with a formation. We find it while the wind is moving.',
    unlockFlavor: 'Available from the first run.',
  },
  spark_caller: {
    id: 'spark_caller',
    epithet: 'Tempo on the Wire',
    codexSummary: 'A bright signal-runner who turns motion, timing, and nerve into sudden advantage.',
    backstory: 'Before the fights reached the high roofs, the Spark-Caller ran messages through antenna forests and service ladders, where a delayed call could strand a crew in open sky. The lilac-breasted roller learned to read the city by tiny changes: a relay light warming, a cable humming underfoot, the hush before a rival flock breaks cover. Their colors make them easy to spot, so they became faster, sharper, and brave enough to make being seen part of the tactic.',
    narrativeBeats: [
      'A relay job goes wrong when a signal tower locks down mid-flight.',
      'The Spark-Caller learns to use attention as bait, dragging enemies out of position.',
      'Their flock wins by moving one beat before the roof realizes the fight has started.',
    ],
    playstyleRead: 'Plumes tempo leader. Builds Resonance quickly, reaches Surge earlier, and rewards clean sequencing.',
    flockRole: 'The opener: calls the first lane, sets the pace, and punishes hesitation.',
    quote: 'If they can see me, they are already late.',
    unlockFlavor: 'Available from the first run.',
  },
  talon: {
    id: 'talon',
    epithet: 'Warnings on the Wire',
    codexSummary: 'A ruthless Quills tactician who turns pressure into precision without wasting a motion.',
    backstory: 'The Talon grew up where rooftop fences snag shed feathers and sharp wire keeps every lesson visible. Loggerhead shrikes are remembered for their caches, but this leader remembers the reason for them: preparation makes mercy possible. They mark danger before others notice it, pin weak points before a fight can widen, and demand that every strike have a purpose. The Talon is feared because they finish fights quickly; they are followed because quick endings leave more birds standing.',
    narrativeBeats: [
      'A trapped fledgling survives because the Talon notices one bent wire before the rest of the flock does.',
      'Their first command is challenged by birds who mistake restraint for softness.',
      'A rooftop ambush becomes a lesson in ending danger before panic spreads.',
    ],
    playstyleRead: 'Quills pressure leader. Opens with Flow, exploits Winded enemies, and wants decisive early turns.',
    flockRole: 'The point bird: identifies the threat, narrows the fight, and cuts off the worst outcome.',
    quote: 'Sharp is not cruel. Sharp is clear.',
    unlockFlavor: 'Unlocks after your first win.',
  },
  tidewarden: {
    id: 'tidewarden',
    epithet: 'Patience at the Waterline',
    codexSummary: 'A canal-side guardian who knows survival is a tempo of its own.',
    backstory: 'The Tidewarden kept watch where gutters empty into canal markets and every storm changes the map. Great blue herons are patient hunters, but this one became patient for another reason: panicked birds waste strength, and wasted strength gets carried away. They learned to read slick tile, bent railings, water levels, and the faces of tired flockmates. Their command is quiet until it matters. When the fight gets ugly, the Tidewarden is already counting who needs shelter, who can still fly, and where the next safe edge will be.',
    narrativeBeats: [
      'A flood night forces the Tidewarden to move a wounded crew across market roofs one bird at a time.',
      'They earn trust by refusing to trade a weak flockmate for a faster route.',
      'Their flock wins a long fight because every small recovery was planned before it was needed.',
    ],
    playstyleRead: 'Basins attrition leader. Converts wasted healing into Cover and turns endurance into board control.',
    flockRole: 'The anchor: slows panic, protects the damaged, and lets the flock outlast bad weather.',
    quote: 'Hold still long enough to know what the water is doing.',
    unlockFlavor: 'Unlocks after winning with two different Leaders.',
  },
  roostkeeper: {
    id: 'roostkeeper',
    epithet: 'Hands That Make Shelter',
    codexSummary: 'A builder-leader who turns scrap, patience, and community into a roof that fights back.',
    backstory: 'The Roostkeeper learned the city from scaffold knots, loose cable, weathered cloth, and the way tired birds gather where someone has made a place for them. Baya weavers build by repetition, but this leader builds by listening. Every perch says who was afraid to land there. Every patch of cover says who might need to flee through it later. Rivals call them defensive until they try to break a nest built by birds who know exactly why it matters.',
    narrativeBeats: [
      'A temporary roost survives a windstorm because every bird added one useful scrap.',
      'The Roostkeeper turns a market repair job into a network of hidden fallbacks.',
      'Their flock wins by letting an enemy exhaust itself against shelter that keeps adapting.',
    ],
    playstyleRead: 'Nests defense leader. Stacks Cover, rewards full blocks, and turns preparation into Flow.',
    flockRole: 'The builder: makes positions worth holding and teaches the flock how to recover ground.',
    quote: 'A roof is not safe because it is high. It is safe because we made it ours.',
    unlockFlavor: 'Unlocks after a Tier 1+ win or three total wins.',
  },
};

export function getLeaderLore(id: string | undefined): LeaderLore | undefined {
  return id ? leaderLore[id] : undefined;
}
