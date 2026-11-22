/**
 * Narrative threads: content only. Short beats that give one flight a through
 * line. `arrivals[leader][district]` is read on entering a district;
 * `closings[leader][result]` is read once the flight ends, with `{district}`
 * replaced by the name of the last district reached.
 *
 * Voice: a grounded, modern city of bird crews. Birds do the acting, in the
 * present tense, with real rooftop and street materials. No magic, no fate,
 * no prophecy. Keep every line under about 110 characters so it fits one or
 * two lines on the arrival card.
 */

export interface LeaderThreads {
  /** One list per district, in flight order: Rooftop Blocks, Canal Markets, Signal Spires, High Roost. */
  arrivals: readonly [readonly string[], readonly string[], readonly string[], readonly string[]];
  closings: { win: readonly string[]; loss: readonly string[] };
}

export const narrativeThreads: Record<string, LeaderThreads> = {
  fledgling: {
    arrivals: [
      [
        'The sparrows count heads on the water tank. Everyone gets a job before the first vent.',
        'Laundry lines, loose gravel, one good awning. The crew splits the roof into pieces it can hold.',
        'Nobody here has flown this block twice. They pick a lookout and go anyway.',
        'A pigeon crew watches from the next roof and does not help. The sparrows take notes on them too.',
      ],
      [
        'Wet tile and loud stalls. The crew stays low and lets the market noise cover its wings.',
        'The youngest bird spots the dry crossing first. The others follow without arguing.',
        'Canal air smells like fried dough and diesel. The flock eats quickly and moves on.',
        'Every awning down here belongs to somebody. The sparrows ask once, then borrow.',
      ],
      [
        'The antennas hum underfoot. The crew learns which cables are safe by watching who else lands.',
        'It is colder up here. They fly closer together and stop pretending that was the plan.',
        'A relay light blinks out of order. Three sparrows call it at the same moment.',
        'Half the flock has never been this high. The other half keeps that to itself.',
      ],
      [
        'The last roof is all wind and bare steel. The crew that left the Blocks would not know this one.',
        'They stop on the ledge to check feathers and straps. Nobody has to be told anymore.',
        'From here the whole city fits under one wing. The sparrows look for a long second, then get to work.',
        'Every bird knows its job now. The Fledgling Flock crosses the gap in one line.',
      ],
    ],
    closings: {
      win: [
        'A mixed crew brought the call home over {district}. They did it loudly and all together.',
        'The sparrows land on the summit rail in the order they learned to fly in. Nobody is missing.',
        'Other crews will say it was luck. The Fledgling Flock knows which bird did which job.',
      ],
      loss: [
        'The crew scatters over {district} and regroups two roofs back. Everyone has a note for next time.',
        'It came apart at {district}. The sparrows count heads, share what they saw, and plan the next crossing.',
        'Not this flight. They learned where {district} bites, and they will bring that back with them.',
      ],
    },
  },
  spark_caller: {
    arrivals: [
      [
        'The roller lands on the tallest dish so everyone can see the colors. Then the crew moves on the count.',
        'Wires sing in the morning wind. The Spark-Caller taps out a tempo and the flock picks it up.',
        'Bright feathers on gray tar. Every rival on the Blocks is already looking the wrong way.',
        'First call goes out before the gravel settles. The roof is still deciding what happened.',
      ],
      [
        'Market bells set a slow beat. The Spark-Caller doubles it and the crew threads the stalls.',
        'Reflections off the canal make two flocks out of one. The roller uses both.',
        'A barge horn covers the signal. The crew is across the water before it stops.',
        'Too many eyes at the crossings. Good. The Spark-Caller wants them watching.',
      ],
      [
        'These are the old message runs. The roller knows which relay boxes still carry a clean call.',
        'Cable hum rises a half step. The Spark-Caller hears the lockdown coming and flies ahead of it.',
        'Every antenna up here repeats what it is given. The crew gives it something fast.',
        'A warning light warms on the far mast. The flock is already airborne when it turns red.',
      ],
      [
        'Thin air, short calls. The Spark-Caller cuts the signal to two notes and the crew still answers.',
        'The High Roost keeps its own time. The roller sets a quicker one and holds it.',
        'One beat early has carried them this far. The crew leans into the wind and takes it again.',
        'Nothing left above them to relay to. The last call goes straight down to the city.',
      ],
    ],
    closings: {
      win: [
        'The call reaches every roof below {district} before the echo comes back. The Spark-Caller is still moving.',
        'One beat ahead from the first vent to the summit rail. The city heard all of it.',
        'The relay lights come on in sequence, district by district. The crew flies home under them.',
      ],
      loss: [
        'The tempo broke at {district}. The Spark-Caller counts the crew in again from the nearest wire.',
        'A beat late over {district}, and that was enough. The roller will not be late there twice.',
        'The signal dropped at {district}. The crew carries what got through and resets the count.',
      ],
    },
  },
  talon: {
    arrivals: [
      [
        'The shrike walks the fence line first. Three bent wires, one loose vent cover, one way out.',
        'The Talon marks the weak corner of the roof with a feather. The crew sees it and nods.',
        'No speech. The shrike points at the nearest threat and the flock closes the distance.',
        'Everything on this roof can be read from the parapet. The Talon reads it once.',
      ],
      [
        'Crowded stalls, narrow lanes. The Talon picks the one crossing where numbers do not matter.',
        'The shrike notes which vendors look up and which look away. The crew flies past the second kind.',
        'Slick tile punishes a wasted motion. The Talon does not plan any.',
        'A rival lookout sits on the lamp post. The crew passes on its blind side.',
      ],
      [
        'The Spires are all edges, which suits the shrike. The crew spreads along the sharpest one.',
        'A warning strung on wire at the first mast. The Talon reads it, leaves it up, and adds another.',
        'Cables cut the sky into lanes. The shrike assigns one to each bird and keeps the middle.',
        'Whoever holds these towers left a gap in the watch. The Talon was counting on it.',
      ],
      [
        'One roof left. The Talon checks every bird for damage before checking the enemy.',
        'The wind is doing half the work up here. The shrike plans around the other half.',
        'Short fight or no fight. The crew has heard it at every district and still listens.',
        'The Talon lands where the summit can see them. This warning is meant to be read.',
      ],
    ],
    closings: {
      win: [
        'It ended quickly over {district}, the way the Talon wanted. More birds are standing because of it.',
        'The shrike takes the old warnings down from the wire. This route does not need them now.',
        'Every district and no wasted strikes. The Talon lets the crew rest before saying so.',
      ],
      loss: [
        'The fight ran long at {district}. The Talon marks the spot on the wire and pulls the crew out.',
        'The shrike saw the opening at {district} and it closed first. That will be remembered exactly.',
        'Too wide a fight over {district}. The Talon will narrow it next time.',
      ],
    },
  },
  tidewarden: {
    arrivals: [
      [
        'The heron stands on the tank lid until the crew stops fidgeting. Then they cross.',
        'Dry roofs make birds careless. The Tidewarden walks the gutter line and counts the exits.',
        'A slow start. By the second vent, nobody in the flock is breathing hard.',
        'The Tidewarden checks which rain barrels are full. The crew will want them on the way back.',
      ],
      [
        'Home water. The heron knows which railings hold weight and which only look like it.',
        'The canal is running high today. The Tidewarden moves the tired birds to the inside of the line.',
        'Stallkeepers leave a basin out by the third bridge. The crew drinks, then keeps its promise to hurry.',
        'The heron reads the waterline on the pilings. There is time, but not much of it.',
      ],
      [
        'No water up here, only wire. The Tidewarden sets a slower pace and the crew does not argue.',
        'Wind pulls at long wings between the masts. The heron takes the outside lane and shields the rest.',
        'The Tidewarden counts the flock at every tower. Same number each time. Good.',
        'Rain is coming in from the harbor. The heron has already picked which mast to wait it out behind.',
      ],
      [
        'The crew arrives tired and whole. The Tidewarden planned on both.',
        'Thin air makes small injuries loud. The heron has every bird rest for one full minute.',
        'Nothing has been left behind on the way up. The Tidewarden looks once more to be sure.',
        'The last crossing is long and open. The heron goes first so the others can see it done.',
      ],
    ],
    closings: {
      win: [
        'Every bird that left the Blocks lands at {district}. The Tidewarden counts them twice anyway.',
        'They outlasted all of it. The heron folds its wings and watches the water lights come on below.',
        'A patient flight, start to summit. The crew is tired, dry, and all accounted for.',
      ],
      loss: [
        'The Tidewarden calls it at {district} and gets the hurt birds under cover first.',
        'Too much weather over {district}. The heron pulls the crew back to a safe edge and waits.',
        'They gave ground at {district}, but nobody was left on it. The Tidewarden will take that trade.',
      ],
    },
  },
  roostkeeper: {
    arrivals: [
      [
        'The weaver tests a loose cable, a tarp, and a milk crate. Two of the three will do.',
        'Before the crew moves, the Roostkeeper ties off a fallback under the stairwell hood.',
        'Somebody built a good windbreak on this roof and left. The weaver fixes one knot and uses it.',
        'The Roostkeeper notes where tired birds would land. Those spots get cover first.',
      ],
      [
        'Scaffold and awning cloth everywhere. The weaver has not been this pleased all week.',
        'The Roostkeeper trades a length of good twine for a dry shelf above the fish stall.',
        'Market repair crews leave offcuts by the bridge. The flock carries what it can use.',
        'Every crossing gets a perch on both banks. The weaver will not move the crew until they do.',
      ],
      [
        'Bare steel and nowhere soft to land. The Roostkeeper starts with the cable ties.',
        'The weaver strings a line between two dishes. By noon it is a place to stand.',
        'Wind tears at the first shelter. The crew adds a scrap each, and the second one holds.',
        'Old nests on the lower masts show who was here before. The Roostkeeper reads them like a ledger.',
      ],
      [
        'The summit has never held a nest. The Roostkeeper unpacks everything the crew carried up.',
        'Each bird brought one scrap from each district. The weaver knows where every piece goes.',
        'Nothing up here was made for them. The crew starts making it.',
        'The Roostkeeper ties the first knot on the highest rail and tells the flock to hold.',
      ],
    ],
    closings: {
      win: [
        'There is a roost at {district} now. The weaver built it with scraps from every roof on the way.',
        'The warden broke itself on shelter that kept changing. The Roostkeeper is already repairing it.',
        'A whole route of knots, tarps, and borrowed crates. The crew sleeps under all of it tonight.',
      ],
      loss: [
        'The shelter gave way at {district}. The Roostkeeper gathers what is left and knows what to tie tighter.',
        'Not enough cover over {district}. The weaver walks the crew back along the fallbacks it built.',
        'The nest at {district} did not hold. Every perch behind it did, and the flock is using them.',
      ],
    },
  },
};
