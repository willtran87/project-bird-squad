# Audio events

Every sound in Bird Squad is synthesised with WebAudio at play time from
oscillators and filtered noise. There are no recorded assets. The bird calls
are stylised chirp, trill and caw shapes, not recordings of birds.

**Nobody has listened to these sounds yet.** They were built and checked by
structure only: which nodes each cue creates, how long they run, how loud their
envelopes peak, and that real Chromium accepts every node and ramp. Whether a
cue reads as paper, metal, rain or a heron needs a person with headphones. See
[What still needs ears](#what-still-needs-ears).

## Triggering a sound

```ts
import { birdAudio } from '../game/shared/bird-audio-director';

birdAudio.play('card.play', { suit: 'basins', molt: false });
birdAudio.play('hit.impact', { damage: 12, maxHp: enemy.maxHp, lethal: enemy.hp <= 0 });
birdAudio.play('overlay.set', { id: 'deck-browser', open: true });
```

`play` is typed: the event name picks the shape of the detail object
(`BirdAudioEventMap` in `src/game/audio-events.ts`). The older cue names
(`birdAudio.play('draw', 0.8)`) still work and now route to the same voices.

Every event honours mute and the Effects, Voices, Music and Ambience volume
settings, and passes through the cue budget, which drops repeats and bursts
instead of queuing them.

## Events

| Event | Detail | What it does |
| --- | --- | --- |
| `ui.click` | `{ intensity? }` | Soft click for any shared button |
| `ui.confirm` | `{ intensity? }` | Click plus a rising two-note answer, for a committed choice |
| `ui.cancel` | `{ intensity? }` | Falling two-note step back |
| `card.draw` | `{ count? }` | Paper sliding off the deck |
| `card.play` | `{ suit?, molt?, intensity? }` | Paper slap, the suit's material, the suit's bird call. Pitch climbs with each consecutive play |
| `card.discard` | `{ count? }` | Paper dropped on a pile |
| `material.tap` | `{ material, intensity? }` | `paper`, `metal` (Scrap), `wood` (Nest cards, route nodes) or `water` (Basin) |
| `voice.suit` | `{ suit, intensity? }` | The suit's short bird call on its own |
| `voice.leader` | `{ leader, intensity? }` | A Flock Leader's signature call (`fledgling`, `spark_caller`, `talon`, `tidewarden`, `roostkeeper`, plus the rival `jackdaw`) |
| `hit.impact` | `{ damage, maxHp, lethal?, coverBroke?, target? }` | Impact scaled by `damage / maxHp`, from a light tick to a heavy thud. `lethal` adds a falling tail; `coverBroke` adds the Cover break |
| `cover.absorb` | `{ amount? }` | Cover takes the hit: padded and dull |
| `cover.break` | `{ amount? }` | Cover gives way: a crack and falling shards |
| `count.tick` | `{ step, of? }` | One tick of a counting number; pitch rises an octave across `of` ticks |
| `stinger.play` | `{ id }` | `victory`, `defeat`, `reward`, `molt` or `bossPhase` |
| `turn.start` | `{}` | Silent. Restarts the card pitch ladder |
| `battle.enter` | `{ tier, district? }` | Sets the music tier (`street`, `elite`, `boss`) and district. A boss also plays the entrance |
| `district.enter` | `{ district }` | Silent. Crossfades the ambience bed to district 0–3 |
| `flock.formation` | `{ state }` | Silent. `surging` adds music stems, `scattered` thins them out |
| `overlay.set` | `{ id, open }` | Silent. The bed sits at 35% while any overlay id is open |

The five silent events only change state, so they are safe to send while muted
and as often as you like.

## What follows the fight

**Pitch ladder.** Consecutive `card.play` events step up a major pentatonic
scale (0, 2, 4, 7, 9, 12 semitones) and hold at one octave. The ladder restarts
on `turn.start`, on the legacy `turn` and `playerTurnRally` cues, on
`battle.enter`, and after 12 seconds without a play.

**Impact scale.** `impactScale(damage, maxHp)` names a tier from the share of
max HP: tick under 6%, light under 18%, solid under 38%, heavy above. Loudness,
body pitch and length move continuously inside those tiers. A finishing blow is
never quieter than solid.

**Music layers.** `selectMusicLayers` chooses stems at each four-step phrase.
A street fight plays pulse, harmony and bass. Surge adds shimmer, lead and hat,
and opens the filter. Scatter drops everything but a darker, quieter pulse.
Elites add the hat and an off-beat drive; bosses add a sub on top.

**Ducking.** The music steps back, on its own gain stage, under a heavy hit
(to 50%), a finishing blow (32%), a stinger (40%) and a boss entrance (25%),
then returns within about two seconds.

**Ambience.** One bed per district: rain on rooftops (0, and the title
screen), canal water (1), radio static and wind in wires (2), high wind (3).
Beds crossfade over 1.8 seconds on a district change. The level follows the
Ambience setting, drops in fights and drops again under overlays.

## Hooks in scene files

Each is one added line at an existing event site.

`src/scenes/battle-scene.ts`

- `create()`, after `setMood`: `birdAudio.play('battle.enter', { tier, district })`
- `setBattlePaused()`: `birdAudio.play('overlay.set', { id: 'pause', open: paused })`
- `updateFormationFx()`: `birdAudio.play('flock.formation', { state: now })`
- `damageEnemy()`, before the `attack` cue: `birdAudio.play('hit.impact', { damage, maxHp: enemy.maxHp, lethal, coverBroke })`
- `damageFlock()`, before the `attack` cue: `birdAudio.play('hit.impact', { damage, maxHp: this.flock.maxHp, target: 'flock', coverBroke })`

`src/scenes/route-scene.ts`

- `create()`, after `setMood`: `birdAudio.play('district.enter', { district: activeMapIndex })`
- `setRoutePaused()`: `birdAudio.play('overlay.set', { id: 'pause', open: paused })`

When `hit.impact` and the legacy `attack` or `heavyAttack` cue arrive in the
same tick, the scaled impact plays and the fixed cue is dropped.

Nothing else is hooked from scenes. Molt and boss-phase stingers fire when
`setFlightState` moves to `molt` or `boss-phase`. Legacy cues were re-voiced in
place: `confirm` is the soft click, `close` is cancel, `draw`, `discard` and
`shuffle` are paper, `routeChoice` is wood, `marketPurchase` is metal,
`coverBlock` and `block` absorb, `coverBreak` breaks, `reward`,
`victoryFanfare` and `defeat` are stingers, and the `flock*` cues are the
leader signatures.

## Not hooked yet

- `ui.confirm` has no call site. All 146 `playUiSound('confirm')` calls, which
  cover menu navigation as well as real confirmations, now play the soft
  click. A committing button should call `birdAudio.play('ui.confirm')`.
- `count.tick` has no call site because no number counts up on screen yet.
- `material.tap` with `metal` is only reached through `marketPurchase`. Scrap
  gains elsewhere do not call it.
- `overlay.set` is sent for the pause overlay only. Settings, the deck browser,
  the Codex and other canvas overlays should send their own id. Open
  `<dialog>` elements are not detected.
- `turn.start` is not sent; the ladder relies on the legacy turn cues.

## Where the code lives

| File | Role | Chunk |
| --- | --- | --- |
| `src/game/shared/bird-audio-director.ts` | `birdAudio`: settings, mute, lazy loading, routing | boot |
| `src/game/audio-events.ts` | Event types and every pure rule | `audio-events` |
| `src/game/audio-voices.ts` | Materials, bird calls, impacts, stingers | `audio-voices` |
| `src/game/audio-cue-budget.ts` | Burst and repeat limits | `audio-voices` |
| `src/game/audio-sfx.ts` | Legacy cue names | `audio-sfx` |
| `src/game/adaptive-music.ts` | Sequencer, stems, duck stage | `adaptive-music` |
| `src/game/audio-ambience.ts` | District beds and mood drones | `audio-ambience` |

All five chunks load on the first interaction, never at boot.
`window.__birdSquadAudio()` reports `events`, `ambienceBed` and
`music.layers`, `music.tier`, `music.formation` and `music.ducks` for tests.

## Tests

- `src/game/audio-events.test.ts`: pitch ladder, impact scaling, layer
  selection, ducking, bed selection, call shapes, cue budget.
- `src/game/audio-synthesis.test.ts`: node counts, durations and envelope
  peaks against a fake AudioContext.
- `tests/audio-events.spec.ts`: the hooks, lazy chunks and state in real
  Chromium.
- `tests/audio-cue-budget.spec.ts` and the smoke tests "synthesized cues stay
  lazy" and "card plays route distinct suit voices" are unchanged.

## What still needs ears

Everything. In rough order of risk:

1. **Ambience beds.** Four continuous textures built from filtered noise and
   slow oscillators. Levels, and whether static reads as radio and not hiss,
   are guesses.
2. **Bird calls.** Four suit calls on every card play and six leader
   signatures. They may be too frequent, too shrill at the top of the pitch
   ladder, or not birdlike.
3. **Materials.** Paper, metal, wood and water, and whether the soft click is
   soft enough for constant menu navigation.
4. **Music stems and ducking.** The hat, drive and sub layers, the Scatter
   filter, and whether duck depths feel like emphasis or like dropouts.
5. **Impacts and Cover.** The tick-to-thud range and the absorb and break pair.
6. **Stingers.** Victory, defeat, reward, Molt, boss phase and boss entrance.
   The reward stinger plays on several existing `reward` cue sites and may
   repeat too often.
