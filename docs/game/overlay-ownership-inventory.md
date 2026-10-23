# Overlay ownership acceptance inventory

This inventory closes item 25 only after its listed lifecycle checks pass.
It does not replace compact text/art criteria or the full release regression.
All scene fixtures use production renderers; direct fixture setup is not claimed
as a complete player journey. Keyboard, pointer/touch and virtual-controller
events exercise the live input handlers after setup.

| Family and nesting | Return/context contract | Lifecycle coverage |
| --- | --- | --- |
| Title guide → lesson list; lesson launch | Back returns to Practice lessons; repeated opening does not add listeners; launching preserves an existing flight | practice-lessons, shared-overlay-ownership, overlay-download-recovery |
| Route/Battle Pause → Settings → run-exit confirmation | Settings returns to its exact Pause action; confirmation starts on Keep Playing; close consumes its press and preserves play | shared-overlay-ownership, shared-save-controls, wheel-input-ownership |
| Pending panel → native download recovery | Close remains available without the downloaded module; recovery returns to its opener; confirmed reload only; closed/shutdown owner cannot attach late content | overlay-download-recovery, deck-browser-polish, event-outcome-lifecycle |
| Native save/download recovery over editors | Keep Playing returns to exact textbox and draft; failure never commits or loses draft; cleanup removes deferred focus and native inputs | folio-editor-recovery, collection-control-focus, flight-log-ownership |
| Collection Tools → Saved Views → removal confirmation | Exact tool action/shelf selection restored; safe cancel; armed removal and retry are distinct; background wheel isolated | collection-control-focus, codex-collection-dialogs |
| Collection Atlas | Close remains reachable across redraws and restores its opener without changing shelf/search/filter/scroll | folio-atlas-focus, codex-collection-dialogs |
| Collection dossier → journal editor; live search | Exact dossier action and selected shelf entry restored; drafts survive recovery; held Back closes one layer | collection-control-focus; smoke inspection-context journey |
| Folio Organizer / Identity / templates / native editors | Exact opener action retained after child close; reversible edits preserve original identity; no implicit mutation on navigation | folio-editor-recovery, folio-atlas-focus |
| Flight Lab → Signals / Tuning / Revisions / Field Record → notes | Exact Lab tool restored, sample/selection preserved, failed notes remain editable; held Back retires only the top owner | folio-atlas-focus, folio-editor-recovery |
| Flight Log → recorded-flight review | Exact Review opener; bounded loading/retry; close/reopen/navigation/shutdown retire older requests; Copy owns its visible review | flight-log-ownership, clipboard-ownership |
| Save Data → native file picker → Restore confirmation | Untimed picker, bounded read, explicit safe Cancel; canceled/rejected/late reads cannot restore; exact opener restored | shared-save-controls, flight-log-ownership |
| Route Flock / boss preparation / map inspection | Read-only; unchanged route selection and pending decision; Back/touch/controller exit; pause owns nested input; late downloads do not reopen | flock-stats-reading, boss-prep-reading, map-inspection |
| Route deck → card/comparison reader → Save Folio | Selected card, sort/filter/query and scroll retained; paused/stale controls cannot save; timeout/retry/cancel/restart do not double-save | deck-browser-polish, shared-overlay-ownership, wheel-input-ownership |
| Market shelves → item/card reader → Preen/Release picker → rules | Shelf/offer/armed selection preserved; inspection never spends; Back cancels one stage; explicit second commitment required | market-navigation-polish, market-card-reader-polish, picker-confirmation-polish; smoke picker inspection |
| Route event choice/outcome → full consequence/item reader | Exact offered choice and armed state retained; no background claim, double commit or late reopen; checkpoint recovery | event-outcome-lifecycle, route-decision-polish, outcome-reader-polish |
| Route/Battle Supplies and Waymarks → item reader | Inventory selection, pinned comparison and armed use retained; pause/background wheel cannot mutate; read-only paging separate from Use | packed-supplies-polish, owned-waymark-reader, wheel-input-ownership |
| Battle Flock / piles → card detail / history | Selected hand card, target, pile, row and scroll retained; no background play/Roost; Back closes only the top reader | flock-stats-reading, pile-polish, combat-history-polish, overlay-retirement |
| Battle discard / return choice; rewards → inspection | Required choice remains pending; held/repeated input cannot commit underneath inspection; pointer/keyboard/controller parity | smoke discard/return/reward inspection and deliberate-commit journeys |
| Run outcome → flight details | Exact Flight Details opener restored; held Back or numeric shortcut cannot return to menu/replay underneath; pending Copy guarded and canceled with retired owner | overlay-retirement, clipboard-ownership; smoke outcome focus/details |

## Ownership rules

- Scene-local owners release listeners/timers on surface destruction or shutdown.
  A completed download may populate a cache, but may render only into an
  explicitly open current owner. Native-file reads and clipboard writes cannot
  be physically aborted; their retired results must be ignored.
- Modal action owners consume a physical keyboard event once; Back and Confirm
  autorepeat cannot act on a newly exposed parent. Controller modal release
  latches prevent a held button leaking into route polling.
- A panel scrim intercepts pointer/touch input. Wheel, shortcuts and controller
  dispatch also honor ownership; a visual scrim alone is not sufficient.
- Geometry checks retain the same viewport boundaries and 44px supported target
  floor. Complete typography/content stress remains items 11–15.

Item 25 qualification is complete. Exact candidate reports, input repairs,
recovery-owner sequencing and intermediate failure reconciliation are recorded
in `remaining-24-closure.md`. Compact typography and final full regression remain
separate acceptance items.
