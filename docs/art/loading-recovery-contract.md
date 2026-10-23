# Artwork loading and recovery contract

Artwork is presentation, never a transaction. Loading or recovering it must not
spend resources, play a card, change an armed choice, scroll a list, or resurrect
a closed reader. Fixed portrait bounds exist before an image decodes. An absent
image must not be replaced by an unrelated illustration or a misleading identity.

| Surface | Reserved presentation | Recovery and retained state |
| --- | --- | --- |
| Combat hand | Complete 60×90 card beside name/rules, including failed renderer | Runtime recovery paints the existing art layer. Normal selection retains its registered hit object. Opening Deck retries missing card images without playing a card. |
| Combat reward / Preen | Fixed card slot, explicit unavailable state | Retry / Read requests another bounded attempt; armed reward, focus and deck remain unchanged. Ordinary redraws do not retry. |
| Market | Complete shelf card; separate rules-only dossier | One bounded attempt per missing shelf asset. Retry art, or the displayed Inspect binding/controller action, retries without changing the armed offer or spending Scrap. No unused full portrait download. |
| Preen / Release picker | Complete 66×99 slot with separate name and price | Same bounded attempt/recovery policy as Market. Choice, focus, card geometry and run data are retained. |
| Collection | Fixed tile and intentional undiscovered back | Delayed image updates its tile in place; failure exposes Retry. Hover, registered input target, filter and scroll remain intact. |
| Deck detail / comparison | Persistent portrait rectangle and reading controls | Delayed/failure updates never rebuild the reader. Reopening retries. Closing retires the slot and its observer's visual ownership. |
| Folio tools | Fixed owned-cover slot | Delayed/failed status occupies the same bounds; reopening the tool retries without mutating the saved deck. |
| New-flight setup | Fixed leader portrait region | Late completion is painted only while setup owns it; returning home cannot resurrect the portrait. |

The shared loader deduplicates active transfers. Its 8-second soft readiness
timeout does not cancel the real request: the observer can report a later
successful decode. Transfers retain the existing 15-second transport deadline
and Phaser's two network retries. Scene shutdown retires listeners/observers.
Market/picker failed-request latches prevent a completion → redraw → download
loop; explicit recovery clears failed latches, not pending transfers.

Regression sources: `asset-loading-recovery`, `hand-art-continuity`,
`hand-art-retry`, `hand-renderer-recovery`, `route-card-art-continuity`,
`collection-art-continuity`, `collection-tools-polish`, `deck-art-continuity`,
`folio-tools-polish`, `reward-ceremony-polish`, and `title-setup-polish` specs.
Run reports and the acceptance disposition belong in
`docs/game/remaining-24-closure.md`; this contract alone is not pass evidence.
