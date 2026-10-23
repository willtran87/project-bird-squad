# Shared UI contract

The dark bird-city/tarot theme is unchanged. Shared controls use quiet geometry
so the illustrations, decisions and resource feedback remain the focal points.

## Single source of truth

`src/game/ui-tokens.ts` owns the semantic fonts, palettes, typography, spacing,
corner/border weights and contrast thresholds. It is independent of Phaser.
Budgeted FX/encounter renderers receive fonts through their presentation options
instead of absorbing the full palette into core or lazy chunks.
`theme.ts` re-exports these tokens for existing callers and retains the panel
drawing helper. `text-styles.ts` consumes the same defaults; it must not introduce
a second, smaller legacy type scale. Authored card suit and combat-role colors
remain intentional variants, not alternative general-purpose control themes.

- Arial is the UI family; Georgia with a serif fallback is the display family.
- Primary controls use 21 game pixels; secondary copy uses 19. At the supported
  1000×560 FIT boundary these remain above 16 and 14 CSS pixels respectively.
- Controls reserve at least 58×58 game pixels, exceeding 44×44 CSS pixels at
  that boundary. Neighboring controls retain at least 8 game pixels of separation.
- Standard panel corners use a 10-pixel radius and 2-pixel border. Quiet controls
  deliberately use square vector edges, never stretched illustration frames.
- Text pairs must meet 4.5:1 contrast; focus indicators must meet 3:1 against
  their control surface. Do not apply opacity to an entire disabled control.

These are shared defaults, not a claim that every bespoke screen has completed
its compact-layout migration. The acceptance plan tracks those screens separately.

## Controls and state

`quietButton` is the implementation behind `decisionButton`, the field/close
helpers, system-overlay menu buttons and practice lesson buttons. Preserve its
`labelObject`, `fullLabel`, `controlKind`, `enabled`, `selected`, `hovered` and
`focused` data when adding adapters.

| Role/state | Presentation and behavior |
| --- | --- |
| Primary | Warm gold, dark text; the principal forward/safe action |
| Secondary/navigation | Dark opaque surface, light text |
| Destructive | Muted red surface with explicit destructive wording |
| Utility | Quiet on an opaque panel; never directly over illustration content |
| Hover | Two-pixel outline; does not clear keyboard/controller focus |
| Focus | Three-pixel outline, retained through pointer entry/exit |
| Selected | Persistent fill/weight, independent of hover |
| Disabled | Opaque low-emphasis surface and readable text; no activation |
| Armed | Explicit confirmation wording and a warm outline; never implied by hover |
| Loading | Explicit progress wording, stable bounds, no repeat activation |
| Error | Recovery wording and a warm error outline; owning flow explains recovery |

Changing `enabled` updates input registration immediately. Pointer, keyboard and
controller activation must honor disabled, inactive and hidden controls, including
hidden parent containers. Pointer
activation additionally checks Phaser's input-enabled flag. A live caption change
(for example a loading label or remapped-input hint) must survive repainting.
Decorative state changes never move the hit region or shrink the label.

`status` accepts `idle`, `armed`, `loading` or `error`; set `statusLabel` before
changing status to supply the flow's exact wording. Returning to idle restores
`fullLabel`. Loading disables interaction without erasing the persistent focus.
The label stays within its two-line allocation. Practice lesson downloads use
these states; a delayed completion cannot reopen a guide the player closed.
These states retain the owning flow's semantics, not a generic retry promise.
Their exhaustive adoption remains acceptance item 23.

### Bounded asynchronous actions

Clipboard actions in Folios, recorded flights and outcomes start synchronously
from user activation, then expose a disabled Copying caption. A wall-clock
eight-second deadline produces an actionable Retry state. Each attempt owns its
completion, timer and shutdown listener; retiring it releases those references.
Late promises cannot change a replacement screen or overwrite a newer retry.
Clipboard APIs themselves cannot be aborted; this contract retires UI ownership,
not an already-submitted operating-system clipboard write.

Route Folio saving similarly invalidates a stalled module request before exposing
Retry. Late module availability can warm the cache but cannot create a Folio
without a current save request. Close, restart and shutdown cancel its timer.
Backup selection has no deadline while the native chooser is open. Once a local
File.text read starts, its eight-second deadline restores the picker and explains
failure without mislabeling a read error as invalid JSON. No failure restores data.

Utility controls become opaque when armed/loading/failed; error controls use the
readable muted-red palette, with contrasting focus. Primary hover and focus use a
dark outline against gold. State changes preserve geometry and live captions.

## Overlay ownership

The guide uses one action-focus owner, disposed when its root is destroyed.
Reopening must register exactly one set of navigation handlers. Focused disabled
actions remain readable and announce unavailability but cannot activate.

Pause and abandon-confirmation lists acquire exclusive scene input ownership.
Bound actions, raw combat navigation and route controller polling respect it.
Keyboard events are consumed across a close transition. A controller release
latch survives destruction of the closing panel and retires after release or
scene shutdown; holding A/Start must never also select a route node or card.
Settings retains its separate, higher-priority input owner. Returning to pause
restores Settings focus, including deferred route redraws. Resume/Back clears
that restoration state, so a fresh pause defaults to Resume.

Pause supports Tab/Shift+Tab, directional keys, remapped Previous/Next,
Confirm/Back, controller D-pad/A/B/Start, and existing Settings/Mute/Fullscreen
shortcuts. Abandon confirmations default to Keep Playing; the current remapped
Back binding and B are shown in the hint. Destructive actions remain visibly
separated from safe actions. Save restoration likewise marks Confirm Restore
as destructive and Cancel as the safe primary action.

Global close/focus restoration, background-input isolation and every bespoke
overlay still require the item-25 matrix; a shared helper is not sufficient
evidence to close that whole item.

### Loading and recovery

`pendingOverlay` is boot-resident: Close, keyboard/controller ownership and the
recovery exit cannot depend on the module being downloaded. It is shared by
system panels and title Collection entry. Its wall-clock timeout is independent
of paused scene timers. Eight seconds enables explicit recovery, not an automatic
reload; success replaces only its still-active owner. Close/shutdown retires its
timer and handlers, and late completion cannot navigate or recreate the panel.

Native download recovery is a modal dialog. Keep playing is initially focused;
opening reload confirmation focuses Cancel reload. A reload requires a separate
explicit choice and warns about the last saved checkpoint. Keyboard, pointer,
touch and controller input cannot fall through; held controller input is released
independently of combat polling. Canvas hover focus resumes only after fresh
pointer movement. Dismissal restores the prior connected DOM focus target.

Guide and lesson lists own their input exclusively. Guide toggles preserve the
exact action index; returning from lessons focuses Practice lessons. The quiet
guide does not download unused decorative icons or redraw when they arrive.
Settings ignores decorative refreshes during module loading/error and rejects
refresh callbacks belonging to a replaced owner. Lesson failure/timeout appears
as readable inline copy with Recovery options; it never reloads directly.

## Regression coverage

### Collection continuation

Collection toolbar adapters use the shared quiet-control palette, hover/focus
states and fixed hit bounds, while preserving their two-line labels. Saved Views
has distinct Save, Apply, Remove and Close actions reachable with Tab/Shift+Tab
or controller left/right; up/down still selects saved rows. Removal requires a
separate confirmation, starts at Cancel, and never deletes or replaces data after
a failed write. Back cancels an armed removal before closing the parent panel.

Card dossiers use stable action names for focus across rerenders. Tab or left/right
reaches collection actions and the private journal; up/down scrolls the text.
Journal focus is brought into the reading viewport, restored after save/cancel,
and retained through a nested native download-recovery dialog. Returning from the
dossier still restores the shelf's exact entry and browse context. Native search
cancel restores its pre-edit scroll and selection; recovery does not blur-commit
the draft. IME confirmation cannot submit search, and bound remapped actions take
precedence over Collection shortcuts.

These are Collection-specific implementations of items 22/23/25, not proof that
every Folio, atlas or other scene overlay has passed the complete ownership matrix.

### Atlas and Folio continuation

Atlas adds a separate Close action reached by Tab/Shift+Tab or controller left/right;
up/down retains family browsing. Confirm executes the focused action. Closing
preserves the Collection shelf and returns to the Atlas opener.

Flight Lab and its Signals, Field Record, Revision Trail and Tuning Bench readers
use stable action identifiers. Tab changes focus, not content; Confirm activates.
Controller left/right follows that order. Disabled actions retain their label and
focus but cannot execute. Category IDs disambiguate the Signals tab controls.
Nested readers return to their visible Tools opener without resetting sample or
hand page; late artwork redraws do not move focus. Bound actions take precedence
over shortcuts, and repeated Confirm/Back cannot affect a newly exposed layer.

Folio notes preserve their draft on failed writes, provide an announced retry
message, and survive native download recovery without blur-committing. Save or
cancel restores Edit Notes. IME and repeated Enter cannot submit. Controller Back
closes just the editor until released and pressed again.

October 20 continuation: Organizer folders/tags, Identity cover/sleeves and
starter rows have stable, distinct action IDs. Tab moves focus without applying;
Confirm activates the focused choice or footer action. Controller left/right
follows the same sequence. Browsing shortcuts synchronize focus to the browsed
choice. Only the active reader paints action focus; parent openers survive
redraws. The non-modal Folio shelf allows Tab to leave for Flock navigation.

All four native Folio editors use `folio-editor.ts`. Only Enter commits (Shift+
Enter adds a notes line); blur never saves. Failed persistence or invalid import
retains the field and exposes an associated alert. Recovery dialogs suspend
editor focus ownership. Cancel and scene shutdown remove listeners, timers and
errors without committing; successful persistence closes exactly once.

### Flight Log and Save Data continuation — October 20 (October 21 UTC)

Flight Log rows, Back, Newer, Older and Review participate in the same stable
action-focus mechanism. Tab/Shift+Tab and controller left/right focus actions
without changing the selected flight. Previous/Next and controller up/down
browse flights; paging preserves the row position where possible. Disabled
paging remains discoverable and cannot activate. Closing Recorded Flight restores
the exact row or Review opener and page; held controller Back closes one layer.

Review has a fixed-bounds loading state with duplicate activation suppressed.
Rejected/reconstruction-failed requests expose Retry; eight seconds of wall-clock
delay exposes timeout recovery. Each attempt has its own identity, timer and
shutdown listener. Selection changes, close, timeout and shutdown retire that
identity. A late result cannot replace a newer choice or reopen a closed reader.
Retry is explicit; no automatic reload or data mutation is introduced.

Save Data owns its hidden file input through an abortable lifecycle. File-picker
focus return cannot cancel a File.text read already in progress. Native cancel,
overlay close and scene shutdown remove the input, focus timer and listeners.
Only the still-current open overlay can accept a parsed result. Pending reads
show a stable disabled Restore action and cannot open duplicate pickers.

| Transition | Current local evidence | Scope still unqualified |
| --- | --- | --- |
| Log → Recorded Flight → Log | Exact row/action/page, held Back, touch and disabled focus | Full release input matrix |
| Review loading → failure/timeout/retry | Rejection, timeout, same-record reopen, navigation and shutdown | Real hosting/network failure belongs to download-recovery tests |
| Save picker → reading/cancel/close | Slow actual File.text, focus return, duplicate Confirm, native cancel and stale completion | All save confirmation/ratings action-focus paths |
| Atlas/Folio/native editors | Prior focused suites rerun on this candidate | Every other bespoke game overlay |

`tests/flight-log-ownership.spec.ts` injects review faults at the existing loader
dependency boundary in a test-only served module. This is deliberate: the dossier
is also a static Profile rendering dependency, so blocking its network response
would test Profile entry failure instead. Happy-path review and all save-picker
tests run the unmodified production modules. No runtime test hook is shipped.

- `tests/folio-atlas-focus.spec.ts`: Atlas action focus, all four Lab child
  return paths, redraws, disabled activation, distinct Signals focus, nested
  native recovery, storage failure/retry, IME, remapped and held input.

- `tests/ui-token-contract.spec.ts`: text/focus contrast, compact defaults,
  legacy style alignment, one font-family source, no raster-frame reintroduction.
- `tests/shared-control-contract.spec.ts`: 2560×1600, 1440×900 and 1000×560
  geometry, focus/hover/disabled transitions, live captions, actual touch
  confirmation cancellation, keyboard/controller disabled guards and reopening.
- `tests/shared-overlay-ownership.spec.ts`: route/combat pause, Settings return
  focus, background pointer/shortcut isolation, held controller presses, remapped
  keys, scene shutdown/reopening, state geometry, hidden ancestors and delayed
  lesson cancellation at the same three viewports.
- `tests/overlay-download-recovery.spec.ts`: real delayed/503 module requests,
  paused-combat timeout, safe native recovery and confirmed reload, exact focus,
  repeated/remapped controls, compact touch exit, cancelled Collection navigation,
  scene restart and late-completion isolation.
- `tests/collection-control-focus.spec.ts`: Saved Views action navigation, safe
  removal and failed-write retry, compact touch, journal/recovery nesting, exact
  opener and shelf restoration, canceled search and shortcut/remapping isolation.
- Existing title/setup, Settings, deck reader, reward ceremony and A-grade UI
  tests protect the adapters' consumers. Preserve their state and fault-injection
  assertions; do not replace them with screenshots alone.

This contract is local implementation evidence, not a full release qualification,
human playtest result or guarantee of device performance.
