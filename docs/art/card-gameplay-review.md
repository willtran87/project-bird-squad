# Complete runtime-card illustration review — closure item 20

Local review, 2026-10-22. All 110 shipped cards were inspected at gallery
164×246, hand 60×90 and compact hand 47×70. Suspect species and clipping were
checked against 512×768 portraits and canonical card data before deciding.
This is an LLM visual assessment, not player research or automated proof of taste.

The art bible and `data/cards/arcana` are the species source of truth. Thirteen
stale runtime species labels differed; those labels were corrected, without
changing effects, IDs or art to match obsolete metadata. The runtime validator
now rejects that divergence. A tiny thumbnail alone was not used to identify
a species: e.g. the three pink birds in Basin Chorus have actual spoon-shaped
bills in the portrait, and their existing illustration is retained.

## Evidence and acceptance

- Initial and final complete review sheets and SHA-256 indices:
  `D:/codex-bird-squad-closure24-20261021/evidence/card-gameplay-review{,-final}`.
- Final composites: `card-repairs-composited.png` and
  `card-framing-repairs.png` in that evidence directory.
- Canonical selected masters remain versioned in the manifest. Eighteen
  approved master selections change; the other 92 remain intact. Four use
  preserved original center art, not new generation.
- Every replacement uses the existing locked raster frame, deterministic title,
  approved font and lossless 512×768 / 184×276 exports. `--fit-opening` is opt-in;
  proportions are uniform and the frame mask is unchanged.
- Generation briefs/repairs are in `closure24-card-repair-prompts.json`.
- Rejected intermediate candidates: Green Jay quill crossed the frame;
  Hamerkop candidate had an extra raised limb; Wilson's candidate had six rods,
  then eleven. Accepted replacements remove that limb and show ten rods.
- Final candidate By96udgS passes all-card cross-surface identity, the 1,320
  card/state/viewport layouts and the 440-case fallback catalog. All 110 reviewed
  thumbnails and manifest match current sources by SHA-256. Item 20 is closed;
  the full release regression remains a separate open gate.

Legend: **retain** means no actionable illustration defect at the reviewed
scales; **repair** means generated replacement; **reframe** means original center
art recomposited. Clothing can occlude plumage and a far wing naturally; that
alone is not an anatomy defect. Gameplay rules remain separately readable in UI.

## Per-card dispositions

| ID | Disposition | Specific visual check |
| --- | --- | --- |
| aviary_22 | reframe | Godwit long bill and both wing tips now clear the frame; original migration scene retained. |
| aviary_23 | retain | Martin flight silhouette and speed direction remain distinct. |
| aviary_24 | reframe | Frigatebird wings and forked tail restored inside frame; red throat remains focal. |
| aviary_25 | retain | Scarlet/olive transitional plumage and beak-led preening tell the molt story; not a parrot bill. |
| aviary_26 | retain | Quelea flock reads as a deliberate same-species signal group. |
| aviary_27 | retain | Frogmouth broad head and resting posture distinguish the card. |
| aviary_28 | retain | Hummingbird hover, dark chin/violet throat and traffic light give clear pause action. |
| aviary_29 | retain | Red shoulder patch and dark blackbird silhouette remain recognizable. |
| aviary_30 | retain | Killdeer distraction posture and ground context remain readable. |
| aviary_31 | retain | Gull pale body and coastal-city scavenging action remain distinct. |
| aviary_32 | reframe | Condor fingered wings no longer clipped; thermal rooftop scene unchanged. |
| aviary_33 | repair | Removed Blue Jay crest/white cheeks; Pinyon Jay now retrieves cache with beak. |
| aviary_34 | retain | Penguin upright but avian body, black/white massing and cold context read clearly. |
| aviary_35 | retain | Catbird grey silhouette and listening posture preserve subtle signal role. |
| aviary_36 | retain | Flicker markings and tapping action remain visible. |
| aviary_37 | retain | Coot pale bill contrasts with dark body and wet setting. |
| aviary_38 | retain | Creeper curved bill and vertical climbing pose distinguish movement. |
| aviary_39 | retain | Reedling grey head, black moustache and yellow bill verified in portrait. |
| aviary_40 | retain | Osprey eye stripe and grasping posture preserve precise aerial role. |
| aviary_41 | retain | Dipper white throat and low water posture remain distinct. |
| aviary_42 | reframe | Canada Goose full wings clear rails; original formation scene retained. |
| aviary_43 | retain | Crow beak-led tool use and dark outline remain legible. |
| cups_02 | retain | Hooded Merganser paired fan crests correct; stale Wood Duck runtime label repaired. |
| cups_03 | retain | Three spoonbills have spatulate bills, three basins and a clear shared splash action. |
| cups_04 | retain | Green Heron pointed bill/compact neck correct; stale coot label repaired. |
| cups_05 | retain | Wood Duck face markings correct; three tipped/two standing vessel story retained. |
| cups_06 | repair | Five-bird crowd replaced by intended two Sanderlings sharing food with six capped cups. |
| cups_07 | retain | Mandarin Duck plumage and reflective choices preserve distinctive color identity. |
| cups_08 | repair | Night-heron replaced by low-flying Black Skimmer with red/black asymmetric bill and eight whole basins. |
| cups_09 | retain | Scarlet Ibis saturated red body separates from full-basin setting. |
| cups_10 | retain | Mallard family shelter scene reads as collective protection. |
| cups_ace | retain | Heron long neck/bill and single vessel remain the clear focal action. |
| cups_elder | retain | Shoebill broad bill and monumental stance distinguish authority. |
| cups_fledgling | retain | Plover small shorebird body and carried vessel remain readable. |
| cups_matron | retain | Pelican pouch/bill and quiet care-station posture remain distinct. |
| cups_outrider | repair | Red-headed duck replaced by white/buff Gannet with black wing tips, whole flight silhouette. |
| major_00 | retain | Sparrow scale, avian anatomy and journey-start silhouette remain clear. |
| major_01 | retain | Magpie black/white massing and beak-led action remain distinct. |
| major_02 | retain | Barn Owl heart-shaped face and still posture maintain focus. |
| major_03 | retain | Swan neck and pale silhouette preserve nurturing identity. |
| major_04 | retain | Golden Eagle heavy raptor silhouette preserves command role. |
| major_05 | retain | Crane long-legged silhouette remains separate from smaller birds. |
| major_06 | retain | Lovebird paired social composition and warm faces remain readable. |
| major_07 | retain | Peregrine compact flight profile carries forward movement. |
| major_08 | retain | Secretarybird long legs and crest retain distinctive strength identity. |
| major_09 | retain | Snowy Owl pale rounded mass separates from dark surroundings. |
| major_10 | retain | Kingfisher crest/long bill preserve the turning-point focal subject. |
| major_11 | retain | Stilt fine legs and black/white contrast remain distinct. |
| major_12 | retain | Nuthatch inverted posture remains intentional and anatomically avian. |
| major_13 | retain | Vulture bald head and broad silhouette read as transition, without gore. |
| major_14 | retain | Flamingo curved bill/long neck distinguish it from the spoonbill group. |
| major_15 | retain | Raven dark form retains sufficient edge separation and focus. |
| major_16 | retain | Woodpecker red head and forceful posture remain recognizable. |
| major_17 | retain | Fairywren blue focal color and small body read clearly. |
| major_18 | retain | Nightjar large eye/low posture fit nocturnal scene without losing the subject. |
| major_19 | retain | Goldfinch yellow/black contrast provides strong light identity. |
| major_20 | retain | Junglefowl crest and call posture maintain a distinct awakening cue. |
| major_21 | retain | Arctic Tern slim wings and pale body preserve completion/movement identity. |
| pentacles_02 | repair | Full Starling wings and two cable-hung tags restored; bike-shop balance story preserved. |
| pentacles_03 | repair | Weaver-like birds replaced by three hammer-headed Hamerkops; three plans, no extra limbs. |
| pentacles_04 | retain | Pigeon grounded guard stance and four resource tags remain clear. |
| pentacles_05 | retain | Mourning Dove pair and cold/warm shelter contrast retained; stale swallow label repaired. |
| pentacles_06 | retain | Myna yellow eye patch and sharing scene correct; stale woodpecker label repaired. |
| pentacles_07 | retain | Nutcracker grey body and black/white wing panels distinguish patient cache watch. |
| pentacles_08 | repair | Yellow weaver replaced by olive/white/rufous Tailorbird, seven finished plus one working tag. |
| pentacles_09 | repair | Blue Satin Bowerbird replaced by gold/black Regent; nine tags remain clear on 3×3 rack. |
| pentacles_10 | retain | Baya Weaver gathering and shared scaffold resources preserve communal role. |
| pentacles_ace | retain | Satin Bowerbird blue-black plumage and single resource focal point retained. |
| pentacles_elder | repair | Yellow weaver replaced by broad mottled Malleefowl; grey head and builder stance readable. |
| pentacles_fledgling | retain | Hoopoe fan crest and apprenticeship scene correct; stale tit label repaired. |
| pentacles_matron | retain | Golden Bowerbird and sorted parts-library scene retain curatorial identity. |
| pentacles_outrider | repair | Grey pigeon replaced by chestnut/black Oropendola, yellow tail and intact courier wings. |
| bad_directions | retain | Misleading route object reads as disruption; bird portrait is not required for this object card. |
| barricade_scrap | retain | Jagged scrap silhouette clearly communicates obstruction. |
| bent_feather | retain | Bent feather is distinct from intact court props and readable at hand size. |
| glass_gap | retain | Broken gap/glass composition gives a clear hazard focal point. |
| jammed_strap | retain | Tangled strap mechanism communicates an impediment without character anatomy. |
| loose_shingle | retain | Dislodged roof object has a distinct angular silhouette. |
| smeared_map | retain | Damaged map surface remains recognizable without depending on tiny lettering. |
| static_burst | retain | Static interruption motif remains distinct from ordinary card backgrounds. |
| tangled_line | retain | Tangled cable silhouette communicates blockage at small scale. |
| wet_feathers | retain | Wet feather cluster has an intentional subdued disruption read. |
| swords_02 | retain | Blue Jay crest/wing bars and two crossed signals remain distinct. |
| swords_03 | retain | Mockingbird grey/white wing marks and rain witness pose remain readable. |
| swords_04 | retain | Goshawk barred chest/raptor bill correct; four sheathed objects, stale kingfisher label repaired. |
| swords_05 | retain | Black Drongo dark silhouette and salvage action retained; stale blackbird label repaired. |
| swords_06 | retain | Merlin flight group matches canonical storm crossing; stale heron label repaired. |
| swords_07 | retain | Steller's Jay dark crested head verified; five carried/two left quills, stale waxwing label repaired. |
| swords_08 | retain | Drongo forked tail and enclosure/exit geometry remain legible. |
| swords_09 | retain | Caracara pale neck/face and black cap verified; night-watch focal subject clear. |
| swords_10 | retain | Butcherbird black/white body remains distinct against recovery ledge. |
| swords_ace | retain | Shrike mask and single quill preserve signal-start identity. |
| swords_elder | retain | Cooper's Hawk shape and commander perch remain recognizable. |
| swords_fledgling | repair | Green Jay green wings/yellow tail/blue-black face replace Blue Jay; quill fully inside frame. |
| swords_matron | retain | Kea hooked bill and olive body maintain tactician identity. |
| swords_outrider | retain | Prairie Falcon swept flight and pale face preserve aerial strategy cue. |
| wands_02 | retain | Swallow forked tail and wind-flag lookout remain distinct. |
| wands_03 | retain | Bird-of-Paradise display plumes and mirror scene retain theatrical silhouette. |
| wands_04 | retain | Vermilion Flycatcher red/black group and practical party anchors remain readable. |
| wands_05 | repair | Hummingbirds replaced by five crested, white-cheeked Bulbuls around five chalk marks. |
| wands_06 | retain | Kestrel raised-wing pose and reflected victory rhythm remain clear. |
| wands_07 | retain | Scissor-tail outline gives strong defensive ledge identity. |
| wands_08 | retain | Roller lilac/blue body and roof-gap movement remain recognizable. |
| wands_09 | retain | Rufous Hummingbird warm body and watchful posture remain distinct. |
| wands_10 | repair | Wilson's blue crown/red wings/curled violet tail restored; exactly ten carried rods. |
| wands_ace | retain | Earlier approved Sunbird readability pilot preserved, no regenerated replacement. |
| wands_elder | repair | Aplomado eyebrow, breast band, rust belly and long tail replace generic heavy falcon. |
| wands_fledgling | retain | Bee-eater slender curved bill and colorful poster-runner silhouette remain distinct. |
| wands_matron | retain | Lyrebird long display tail and runway command remain readable. |
| wands_outrider | retain | Swift narrow wings and compact body maintain unmistakable speed. |

## Identification references used for ambiguous repairs

Canonical design was checked against primary field-guide descriptions, not
rewritten to fit whatever the old art depicted:
[Green Jay](https://www.allaboutbirds.org/guide/Green_Jay/id),
[Northern Gannet](https://www.allaboutbirds.org/guide/northern_gannet/id),
[Aplomado Falcon](https://www.allaboutbirds.org/guide/Aplomado_Falcon/id),
[Pinyon Jay](https://www.fws.gov/species/pinyon-jay-gymnorhinus-cyanocephalus),
[Wilson's Bird-of-Paradise](https://academy.allaboutbirds.org/wilsons-bird-of-paradise-a-full-spectrum/),
[Regent Bowerbird](https://absa.asn.au/wp-content/uploads/2015/12/Regent-Bowerbird.pdf),
[Montezuma Oropendola](https://animaldiversity.org/accounts/Psarocolius_montezuma/).
