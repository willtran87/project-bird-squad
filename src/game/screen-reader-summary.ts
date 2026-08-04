function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function number(value: unknown) {
  return Number.isFinite(value) ? Number(value) : undefined;
}

function records(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function spaced(value: string) {
  return value.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').trim();
}

export function screenReaderSummary(payload: unknown): string {
  if (!isRecord(payload)) return '';
  const mode = text(payload.mode);
  const scene = text(payload.scene);
  const settingsOpen = payload.settingsOpen === true || payload.settingsOverlayOpen === true;
  const settingsFocus = isRecord(payload.settingsFocus) ? payload.settingsFocus : undefined;
  if (settingsOpen && settingsFocus) {
    const label = text(settingsFocus.label) || 'setting';
    return `Settings. ${label}. Use Up and Down to move, Left and Right to adjust.`;
  }

  if (scene === 'MenuScene' || mode === 'menu') {
    if (payload.helpOpen === true) return 'How to Play is open. Press Back to close.';
    const focus = isRecord(payload.titleFocus) ? payload.titleFocus : undefined;
    const collectionGoal = isRecord(payload.collectionGoal) ? payload.collectionGoal : undefined;
    const nextGoal = isRecord(collectionGoal?.next) ? collectionGoal.next : undefined;
    const label = text(focus?.label) || 'Choose a setup, then start a run';
    const collectionSummary = collectionGoal
      ? ` Collection path: ${number(collectionGoal.owned) ?? 0} of ${number(collectionGoal.total) ?? 0} cards, ${number(collectionGoal.completed) ?? 0} of ${number(collectionGoal.milestoneTotal) ?? 0} badges.${nextGoal ? ` Next optional goal, ${text(nextGoal.name)}, ${number(nextGoal.current) ?? 0} of ${number(nextGoal.target) ?? 0}.` : ' All collection badges earned.'} No deadline and no gameplay power.`
      : '';
    return `Bird Squad menu. ${label}.${collectionSummary} Press Confirm to select.`;
  }

  if (scene === 'ProfileScene' || mode === 'profile') {
    const history = isRecord(payload.flightHistory) ? payload.flightHistory : undefined;
    const review = isRecord(history?.review) ? history.review : undefined;
    if (review) {
      const details = isRecord(review.details) ? review.details : undefined;
      const deck = Array.isArray(details?.deck) ? details.deck.map(text).filter(Boolean) : [];
      const path = Array.isArray(details?.path) ? details.path.map(text).filter(Boolean) : [];
      const focusedAction = spaced(text(review.focusedAction)) || 'copy';
      return `Recorded flight ${text(review.seed)}. ${deck.length} cards in the final deck. ${path.length} route stops. Focused action ${focusedAction}. Use Previous and Next to choose Copy Flight Link or Close Review, Confirm to select, and Back to return to the Flight Log.`;
    }
    if (history?.open === true) {
      const selected = isRecord(history.selected) ? history.selected : undefined;
      const selectedIndex = number(history.selectedIndex) ?? 0;
      const count = number(history.count) ?? 0;
      const page = number(history.page) ?? 0;
      const pageCount = number(history.pageCount) ?? 0;
      const result = spaced(text(selected?.result)) || 'flight';
      const seed = text(selected?.seed);
      const leader = text(selected?.leader);
      return `Flight Log. ${count} recorded flight${count === 1 ? '' : 's'}. Page ${page} of ${pageCount}. Selected ${selectedIndex + 1} of ${count}, ${result}${seed ? `, flight ${seed}` : ''}${leader ? `, ${leader}` : ''}. Use Previous and Next to choose a flight, Page Up and Page Down or controller shoulders to change pages, Confirm for the complete review, and Back to return.`;
    }
    const focus = isRecord(payload.focus) ? payload.focus : undefined;
    const collectionMilestones = isRecord(payload.collectionMilestones) ? payload.collectionMilestones : undefined;
    const showcase = isRecord(payload.cardShowcase) ? payload.cardShowcase : undefined;
    const folios = isRecord(payload.savedFlightFolios) ? payload.savedFlightFolios : undefined;
    const template = isRecord(folios?.template) ? folios.template : undefined;
    if (template?.open === true) {
      const options = records(template.items);
      const selectedIndex = number(template.selectedIndex) ?? 0;
      const selected = options[selectedIndex];
      const missingNames = Array.isArray(selected?.missingNames)
        ? selected.missingNames.map(text).filter(Boolean)
        : [];
      const requirement = selected?.available === true
        ? 'Ready to build.'
        : `${text(selected?.reason) || 'Template unavailable'}.${missingNames.length > 0 ? ` Missing cards: ${missingNames.join(', ')}.` : ''}`;
      return `Build a Starter Folio. Selected ${selectedIndex + 1} of ${options.length}, ${text(selected?.leader)}, ${text(selected?.bird)}, ${text(selected?.suit)}. ${number(selected?.ownedCount) ?? 0} of ${number(selected?.cardCount) ?? 0} starter cards permanently owned. ${requirement} Building creates a new revision 1 Full Flight Folio with Base cards. It never grants cards, changes collection history, replaces another Folio, or starts a flight. Use Previous and Next, D-pad, controller shoulders, or pointer to choose; Confirm, controller A, or pointer to build; and Back, controller B, or pointer to cancel.`;
    }
    const identity = isRecord(folios?.identity) ? folios.identity : undefined;
    if (identity?.open === true) {
      if (identity.descriptionEditing === true) {
        return `Editing the private Folio description for ${text(identity.deckName)}. Type one line up to ${number(identity.descriptionLimit) ?? 120} characters, press Enter to save, or Escape to cancel. The description is included in backups, excluded from BSF share codes, and never affects play.`;
      }
      const cover = isRecord(identity.coverCard) ? identity.coverCard : undefined;
      const selectedSleeve = isRecord(identity.selectedSleeve) ? identity.selectedSleeve : undefined;
      const activeSection = text(identity.section) === 'sleeve' ? 'card-back sleeves' : 'cover cards';
      const selected = selectedSleeve
        ? `${text(selectedSleeve.label)}: ${text(selectedSleeve.description)}`
        : `${text(cover?.name)}${cover?.selected === true ? ', currently set' : ''}`;
      return `Folio Identity for ${text(identity.deckName)}. Current cover card ${text(cover?.name)}. Current card-back sleeve ${text(identity.sleeveLabel)}. Private description: ${text(identity.description) || 'none yet'}. Active section ${activeSection}. Selected ${selected}. Cover, sleeve, and description are cosmetic collection metadata, included in save backups, excluded from BSF share codes, and never affect power. Use Tab or controller shoulders to switch sections; Previous, Next, Up, Down, or controller D-pad to choose; Confirm or controller A to apply; E or controller X to edit the description; and Back or controller B to return to the Folio Organizer.`;
    }
    const organizer = isRecord(folios?.organizer) ? folios.organizer : undefined;
    if (organizer?.open === true) {
      if (folios?.renaming === true) {
        return `Renaming ${text(organizer.deckName)} from the Folio Organizer. Type a name up to 32 characters, press Enter to save, or Escape to cancel. The organizer remains open and the name stays private.`;
      }
      const labels = Array.isArray(organizer.tagLabels)
        ? organizer.tagLabels.map(text).filter(Boolean)
        : [];
      const selected = isRecord(organizer.selectedFolder)
        ? organizer.selectedFolder
        : isRecord(organizer.selectedTag)
          ? organizer.selectedTag
          : undefined;
      const section = text(organizer.section) === 'tags' ? 'strategy labels' : 'collection folders';
      const limitMessage = text(organizer.status) === 'tagLimit'
        ? ' The three-label limit is reached; remove one before adding another.'
        : '';
      return `Folio Organizer for ${text(organizer.deckName)}. Current folder ${text(organizer.folderLabel)}. Strategy labels: ${labels.join(', ') || 'none'}. ${labels.length} of ${number(organizer.tagLimit) ?? 3} labels used. Active section ${section}. Selected ${text(selected?.label)}: ${text(selected?.description)}.${limitMessage} Organization is private, included in save backups, excluded from BSF share codes, and never affects power. Use Tab or controller shoulders to switch sections; Previous, Next, Up, Down, or controller D-pad to choose; Confirm or controller A to apply; P or controller X for Folio Identity; R or controller Y to rename; and Back or controller B to return.`;
    }
    const collectionSignals = isRecord(folios?.collectionSignals) ? folios.collectionSignals : undefined;
    if (collectionSignals?.open === true) {
      const unused = records(collectionSignals.unused)
        .map((card) => text(card.name))
        .filter(Boolean)
        .join(', ');
      const frequent = records(collectionSignals.frequentlyFiled)
        .map((card) => `${text(card.name)}, ${number(card.folioCount) ?? 0} Folios`)
        .join('; ');
      const recent = records(collectionSignals.recentlyAcquired)
        .map((card) => `${text(card.name)}${number(card.folioCount) === 0 ? ', unused' : ''}`)
        .join('; ');
      const pairs = records(collectionSignals.commonlyPaired).map((pair) => {
        const first = isRecord(pair.first) ? pair.first : undefined;
        const second = isRecord(pair.second) ? pair.second : undefined;
        return `${text(first?.name)} with ${text(second?.name)}, ${number(pair.folioCount) ?? 0} Folios`;
      }).join('; ');
      return `Collection Signals for ${text(collectionSignals.deckName)}. ${number(collectionSignals.ownedCount) ?? 0} permanently owned cards across ${number(collectionSignals.activeFolioCount) ?? 0} active and ${number(collectionSignals.archivedFolioCount) ?? 0} archived Folios. ${number(collectionSignals.unusedCount) ?? 0} owned cards are unused.${unused ? ` Unused shown: ${unused}.` : ''}${frequent ? ` Many Folios: ${frequent}.` : ''}${recent ? ` New arrivals: ${recent}.` : ''}${pairs ? ` Common pairs touching this Folio: ${pairs}.` : ''} Usage counts distinct saved Folios including Archive, duplicate copies count once per Folio, recent means first acquired, and a pair means two owned cards share a Folio. These are descriptive signals, not recommendations; they never edit the Folio or affect power. Use G, Back, controller B or right stick, or pointer to return to Flight Lab.`;
    }
    const fieldRecord = isRecord(folios?.fieldRecord) ? folios.fieldRecord : undefined;
    if (fieldRecord?.open === true) {
      if (fieldRecord.notesEditing === true) {
        return `Editing private matchup notes for ${text(fieldRecord.deckName)}, revision ${number(fieldRecord.revision) ?? 1}. The limit is 240 characters. Press Enter to save, Shift plus Enter for a new line, or Escape to cancel. Notes remain local, are included in save backups, never enter BSF share codes, and never affect play.`;
      }
      const recent = records(fieldRecord.recent).map((flight) => (
        `${text(flight.result)}, flight ${text(flight.seed)}, ${text(flight.difficulty)}, ${number(flight.turns) ?? 0} turns, ${number(flight.currentCohesion) ?? 0} of ${number(flight.maxCohesion) ?? 0} Cohesion`
      )).join('; ');
      const notes = spaced(text(fieldRecord.notes));
      const flights = number(fieldRecord.flights) ?? 0;
      return `Folio Field Record for ${text(fieldRecord.deckName)}, revision ${number(fieldRecord.revision) ?? 1}${fieldRecord.archived === true ? ', archived' : ''}. ${flights} exact-match flight${flights === 1 ? '' : 's'}, ${number(fieldRecord.wins) ?? 0} wins, ${number(fieldRecord.losses) ?? 0} losses, ${flights > 0 ? `${number(fieldRecord.winRate) ?? 0} percent win rate, average ${number(fieldRecord.averageTurns) ?? 0} turns` : 'no win rate yet'}${fieldRecord.fastestWinTurns == null ? '' : `, fastest win ${number(fieldRecord.fastestWinTurns) ?? 0} turns`}. Matching requires the same leader, mode, card order, and Base or Preened states.${recent ? ` Recent results: ${recent}.` : ' Complete a flight with this exact Folio to start its record.'} Private matchup notes: ${notes || 'none yet'}. Notes stay local, are included in backups, never enter BSF share codes, and never affect power. Use Confirm, E, controller A, or pointer to edit notes, and Back or controller B to return to Flight Lab.`;
    }
    const revisionTrail = isRecord(folios?.revisionTrail) ? folios.revisionTrail : undefined;
    if (revisionTrail?.open === true) {
      const source = isRecord(revisionTrail.source) ? revisionTrail.source : undefined;
      const target = isRecord(revisionTrail.selectedTarget) ? revisionTrail.selectedTarget : undefined;
      const comparison = isRecord(revisionTrail.comparison) ? revisionTrail.comparison : undefined;
      const changes = records(comparison?.cardChanges).map((change) => {
        const current = isRecord(change.current) ? change.current : undefined;
        const next = isRecord(change.target) ? change.target : undefined;
        const currentLabel = current
          ? `${text(current.name)}${current.upgraded === true ? ', Preened' : ', Base'}`
          : 'empty slot';
        const targetLabel = next
          ? `${text(next.name)}${next.upgraded === true ? ', Preened' : ', Base'}`
          : 'empty slot';
        return `card ${number(change.position) ?? 0}, ${currentLabel} to ${targetLabel}`;
      }).join('; ');
      const metadata = [
        comparison?.leaderChanged === true ? `leader changes to ${text(target?.leader)}` : '',
        comparison?.runModeChanged === true ? `mode changes to ${text(target?.runMode)}` : '',
      ].filter(Boolean).join(', ');
      if (!target) {
        return `Revision Trail for ${text(source?.name)}, revision ${number(source?.revision) ?? 1}. This is the first preserved revision in its lineage, so there is nothing earlier to compare or restore. The Folio remains unchanged. Use Back or controller B to return to Flight Lab.`;
      }
      return `Revision Trail for ${text(source?.name)}, current revision ${number(source?.revision) ?? 1}. Selected ${target.id === source?.parentId ? 'direct parent, ' : ''}${text(target.name)}, revision ${number(target.revision) ?? 1}${target.archived === true ? ', archived' : ''}. ${comparison?.exactMatch === true ? `The playable decks match exactly, with ${number(comparison.unchangedCards) ?? 0} unchanged cards.` : `${records(comparison?.cardChanges).length} card changes${metadata ? `, ${metadata}` : ''}: ${changes || 'no positional card changes'}.`} Restoring copies the selected revision's exact card order and Base or Preened states into a new active revision; source and target remain preserved. ${revisionTrail.canRestore === true ? 'Restore is available.' : number(revisionTrail.activeCount) === number(revisionTrail.capacity) ? 'Restore is unavailable because active Folios are full; archive one first.' : 'Restore is unnecessary because the playable decks match.'} Use Previous and Next, Up and Down, pointer, or controller shoulders to choose a revision, Confirm or controller A to restore, and Back or controller B to return to Flight Lab.`;
    }
    const workshop = isRecord(folios?.workshop) ? folios.workshop : undefined;
    if (workshop?.open === true) {
      const source = isRecord(workshop.sourceCard) ? workshop.sourceCard : undefined;
      const selected = isRecord(workshop.selectedSuggestion) ? workshop.selectedSuggestion : undefined;
      const suggestions = records(workshop.suggestions);
      const reasons = Array.isArray(selected?.reasons) ? selected.reasons.map(text).filter(Boolean).join(', ') : '';
      return `Tuning Bench for ${text(workshop.deckName)}. Replacing card ${number(workshop.sourceCardNumber) ?? 1} of ${number(workshop.sourceCardCount) ?? 0}, ${text(source?.name)}${source?.upgraded === true ? ', Preened' : ', Base'}${source?.available === false ? ', definition unavailable' : ''}. ${suggestions.length} permanently owned role-similar replacements.${selected ? ` Selected ${text(selected.name)}, ${number(selected.cost) ?? 0} Wingbeats, ${text(selected.family)}, ${text(selected.role)}.${reasons ? ` Reasons: ${reasons}.` : ''}` : ' No valid owned replacement is available.'} Saving creates a new revision with one Base replacement and preserves the source Folio unchanged. ${workshop.canSave === true ? 'A tuned revision can be saved.' : `A tuned revision cannot be saved${number(workshop.activeCount) === number(workshop.capacity) ? ' because active Folios are full; archive one first' : ''}.`} Use Previous and Next or controller shoulders to choose the source card, Up and Down or controller D-pad to choose a replacement, Confirm or controller A to save, and Back or controller B to return to Flight Lab.`;
    }
    const flightLab = isRecord(folios?.flightLab) ? folios.flightLab : undefined;
    if (flightLab?.open === true) {
      const curve = records(flightLab.costCurve)
        .map((entry) => `${text(entry.label)} Wingbeats, ${number(entry.count) ?? 0}`)
        .join('; ');
      const roles = records(flightLab.roles)
        .map((entry) => `${text(entry.label)} ${number(entry.count) ?? 0}`)
        .join(', ');
      const families = records(flightLab.families)
        .map((entry) => `${text(entry.label)} ${number(entry.count) ?? 0}`)
        .join(', ');
      const hooks = records(flightLab.resourceHooks)
        .map((entry) => `${text(entry.label)} ${number(entry.count) ?? 0}`)
        .join(', ');
      const consistency = isRecord(flightLab.consistency) ? flightLab.consistency : undefined;
      const sample = isRecord(flightLab.sample) ? flightLab.sample : undefined;
      const sampleCards = records(sample?.cards)
        .map((card) => `${text(card.name)}, ${number(card.cost) ?? 0} Wingbeats${card.upgraded === true ? ', Preened' : ''}`)
        .join('; ');
      const issues = Array.isArray(flightLab.issues)
        ? flightLab.issues.map(text).filter(Boolean).join(' ')
        : '';
      const launch = isRecord(flightLab.launch) ? flightLab.launch : undefined;
      const launchText = launch?.available === true
        ? 'This exact owned Folio can launch a fresh Tier 0 route without changing the saved revision.'
        : `Folio launch is unavailable: ${text(launch?.detail) || 'review the saved deck first'}`;
      return `Flight Lab for ${text(flightLab.deckName)}. ${flightLab.legalForStandardFlight === true ? 'Standard ready.' : 'Review needed.'} ${number(flightLab.savedCopies) ?? 0} saved copies, ${number(flightLab.playableCards) ?? 0} playable cards, average cost ${number(flightLab.averageCost) ?? 0}. Cost curve: ${curve || 'empty'}. Roles: ${roles || 'none'}. Families: ${families || 'none'}. Resource hooks: ${hooks || 'none'}. Sample hand ${number(sample?.number) ?? 1}: ${sampleCards || 'no cards'}. ${number(sample?.playableCount) ?? 0} playable now and ${number(sample?.pressureCount) ?? 0} pressure cards. Across ${number(consistency?.sampleCount) ?? 0} deterministic hands, ${number(consistency?.averagePlayable) ?? 0} average playable, ${number(consistency?.atLeastTwoPlayablePercent) ?? 0} percent open with two playable, and ${number(consistency?.pressurePercent) ?? 0} percent include pressure.${issues ? ` ${issues}` : ''} ${launchText} Shared codes never grant ownership, archived Folios must be restored, locked leaders stay locked, and an active flight is never overwritten. Practice uses the real protected combat opening draw, never changes the folio, never affects power, and spends no Scrap. Use S, controller Start, or pointer to launch when available; G or controller right stick for Collection Signals, N or controller left stick for the Field Record, R or controller Y for the Revision Trail, T or controller X for the Tuning Bench, Previous and Next, Space, or controller A to deal, and Back or controller B to close the Lab.`;
    }
    const nextMilestone = isRecord(collectionMilestones?.next) ? collectionMilestones.next : undefined;
    const current = spaced(text(focus?.current)) || 'Flock Record';
    const milestoneSummary = collectionMilestones
      ? ` Collector milestones ${number(collectionMilestones.completed) ?? 0} of ${number(collectionMilestones.total) ?? 0} earned.${nextMilestone ? ` Next, ${text(nextMilestone.name)}, ${number(nextMilestone.current) ?? 0} of ${number(nextMilestone.target) ?? 0}.` : ''} Collector badges never affect power.`
      : '';
    const showcaseItems = records(showcase?.items);
    const showcaseSummary = ` Showcase ${number(showcase?.count) ?? 0} of ${number(showcase?.capacity) ?? 3}.${showcaseItems.length > 0 ? ` Presented cards: ${showcaseItems.map((item) => text(item.name)).filter(Boolean).join(', ')}.` : ' No cards presented; add discovered cards from their Codex dossiers.'} Showcase choices never affect power.`;
    const folioItems = records(folios?.items);
    const selectedFolioId = text(folios?.selected);
    const selectedFolio = folioItems.find((item) => text(item.id) === selectedFolioId);
    const shareCode = isRecord(folios?.shareCode) ? folios.shareCode : undefined;
    const archiveView = text(folios?.view) === 'archive';
    const selectedTags = Array.isArray(selectedFolio?.tags)
      ? selectedFolio.tags.map((tag) => isRecord(tag) ? text(tag.label) : '').filter(Boolean)
      : [];
    const folioStatus = text(folios?.status) === 'templateCreated'
      ? ' A starter Folio was built; ownership and collection history were unchanged.'
      : '';
    const folioSummary = ` Flight Folios ${number(folios?.count) ?? 0} active of ${number(folios?.capacity) ?? 6}, and ${number(folios?.archivedCount) ?? 0} archived of ${number(folios?.archiveCapacity) ?? 24}. Viewing ${archiveView ? 'Archive' : 'Active'}.${selectedFolio ? ` Selected ${text(selectedFolio.name)}, ${text(selectedFolio.leader)}, ${number(selectedFolio.cardCount) ?? 0} cards, revision ${number(selectedFolio.revision) ?? 1}${selectedFolio.favorite === true ? ', favorite' : ''}${selectedFolio.archived === true ? ', archived' : ''}, folder ${text(selectedFolio.folderLabel)}${selectedTags.length > 0 ? `, labels ${selectedTags.join(', ')}` : ''}, cover ${text(selectedFolio.coverCardName)}, card back ${text(selectedFolio.sleeveLabel)}${text(selectedFolio.description) ? `, description ${text(selectedFolio.description)}` : ''}.` : archiveView ? ' The Archive is empty.' : ' Build from an owned leader starter, save a deck from Route Deck Review, or import a flight code.'}${folioStatus} Archived Folios preserve their identity and never affect gameplay power. BSF version ${number(shareCode?.version) ?? 1} codes use a checksum and exclude account data, custom names, flight seeds, private notes, folders, labels, descriptions, cover choices, and sleeves.${folios?.viewActive === true ? ` Use K, controller right shoulder, or pointer to build from an owned starter; Previous and Next to select; O or controller A to organize; C or controller X to favorite; R or controller Y to rename; A or controller Start to ${archiveView ? 'restore' : 'archive'}; V or controller Select to switch libraries; D or controller left trigger to fork without changing the original; E or controller right trigger to copy a share code; I or controller left stick to import; and L or controller right stick to open the Flight Lab.` : ''}`;
    return `Flock Record. ${current}.${milestoneSummary}${showcaseSummary}${folioSummary} Press Confirm to select, or Back to return.`;
  }

  if (scene === 'RouteScene' || mode === 'routeSelection') {
    const waymarkReview = isRecord(payload.waymarkReview) ? payload.waymarkReview : undefined;
    if (payload.waymarkDrawerOpen === true && waymarkReview?.open === true) {
      const selected = isRecord(waymarkReview.selected) ? waymarkReview.selected : undefined;
      const pinned = isRecord(waymarkReview.pinned) ? waymarkReview.pinned : undefined;
      const effects = records(selected?.effects)
        .map((effect) => `${number(effect.order) ?? 0}. ${text(effect.text)}`)
        .filter((effect) => !effect.endsWith('. '));
      const pinnedEffects = records(pinned?.effects)
        .map((effect) => `${number(effect.order) ?? 0}. ${text(effect.text)}`)
        .filter((effect) => !effect.endsWith('. '));
      const selectedIndex = number(waymarkReview.selectedIndex) ?? 0;
      const count = number(waymarkReview.count) ?? 0;
      const selectedName = text(selected?.name) || 'no Waymark';
      const selectedSummary = selected
        ? ` Selected ${selectedIndex + 1} of ${count}, ${selectedName}, ${text(selected.family)}, ${text(selected.rarity)}. Trigger: ${text(selected.trigger)}. Effect order: ${effects.join(' ')}`
        : ` ${count} Waymarks carried.`;
      const comparison = waymarkReview.comparing === true && pinned
        ? ` Comparing pinned ${text(pinned.name)}. Its trigger is ${text(pinned.trigger)}. Its effect order is ${pinnedEffects.join(' ')}`
        : pinned
          ? ` ${text(pinned.name)} is pinned. Choose another Waymark to compare.`
          : '';
      return `Found Waymarks.${selectedSummary}${comparison} Use Arrow keys, Tab, or pointer to choose, C or controller X to pin, and Back to close.`;
    }
    const deckReview = isRecord(payload.deckReview) ? payload.deckReview : undefined;
    if (payload.deckOverlayOpen === true && deckReview?.open === true) {
      const cards = records(deckReview.cards);
      const selectedId = text(deckReview.selectedCardId);
      const selected = cards.find((card) => text(card.id) === selectedId) ?? cards[0];
      const total = number(deckReview.total) ?? cards.length;
      const visible = number(deckReview.visible) ?? cards.length;
      const filter = spaced(text(deckReview.filterLabel)) || 'all';
      const sort = spaced(text(deckReview.sortLabel)) || 'run';
      const query = text(deckReview.query);
      const selectedName = text(selected?.name) || 'no matching card';
      const selectedCost = number(selected?.cost);
      const comparison = isRecord(deckReview.comparison) ? deckReview.comparison : undefined;
      const savedFlights = isRecord(deckReview.savedFlights) ? deckReview.savedFlights : undefined;
      const pinned = isRecord(comparison?.pinned) ? comparison.pinned : undefined;
      const compared = isRecord(comparison?.selected) ? comparison.selected : undefined;
      const comparisonSummary = comparison?.active === true && comparison?.mode === 'preen' && pinned && compared
        ? ` Preen preview for ${text(pinned.name)}. Base: ${spaced(text(pinned.role))}, ${spaced(text(pinned.target))}. Preened: ${spaced(text(compared.role))}, ${spaced(text(compared.target))}. ${spaced(text(comparison.summary))}.`
        : comparison?.active === true && pinned && compared
          ? ` Comparing pinned ${text(pinned.name)}, ${number(pinned.cost) ?? 0} Wingbeats, ${spaced(text(pinned.role))}, ${spaced(text(pinned.target))}, with selected ${text(compared.name)}, ${number(compared.cost) ?? 0} Wingbeats, ${spaced(text(compared.role))}, ${spaced(text(compared.target))}.`
        : pinned
          ? ` Pinned ${text(pinned.name)}. Choose another card to compare.`
          : '';
      const saveSummary = savedFlights
        ? ` Saved Flight Folios ${number(savedFlights.count) ?? 0} of ${number(savedFlights.capacity) ?? 6}.${savedFlights.status === 'saved' ? ' Current deck saved.' : savedFlights.status === 'full' ? ' Folios are full; no saved deck was replaced.' : savedFlights.status === 'failed' ? ' Save failed; no existing folio changed.' : ''}`
        : '';
      return `Deck review. ${visible} of ${total} cards. Filter ${filter}. Sort ${sort}.${query ? ` Find ${query}.` : ''} Selected ${selectedName}${selectedCost === undefined ? '' : `, ${selectedCost} Wingbeats`}.${comparisonSummary}${saveSummary} Use Up and Down to choose a card, Previous and Next to change filter, Confirm to change sort, C or controller X to pin a comparison; pin the selected card to compare Base and Preened, V or controller Y to save this flight without replacing an existing folio, slash to find, and Back to close.`;
    }
    const cardPicker = isRecord(payload.cardPickerInput) ? payload.cardPickerInput : undefined;
    if (cardPicker) {
      const pickerMode = text(cardPicker.mode) === 'preen' ? 'Preen' : 'Release';
      const index = number(cardPicker.focusIndex) ?? 0;
      const count = number(cardPicker.count) ?? 0;
      const cost = number(cardPicker.cost);
      const costLabel = text(cardPicker.context) === 'market' ? 'Scrap' : 'Wingbeats';
      if (cardPicker.inspectionOpen === true) {
        return `Full card inspection. ${text(cardPicker.cardName) || `${pickerMode} candidate`}${cost === undefined ? '' : `, ${cost} ${costLabel}`}. No card has been changed${costLabel === 'Scrap' ? ' and no Scrap has been spent' : ''}. Use Back, controller B, Confirm, controller A, or tap outside to return to card ${index + 1} of ${count}.`;
      }
      if (cardPicker.armed === true) {
        return `${pickerMode} card picker. ${text(cardPicker.cardName) || 'Card'} is selected, card ${index + 1} of ${count}.${cost === undefined ? '' : ` Cost ${cost} ${costLabel}.`} Confirm, controller A, or activate the same card again to ${pickerMode.toLowerCase()}. Back or controller B clears the selection without changing the deck${costLabel === 'Scrap' ? ' or spending Scrap' : ''}.`;
      }
      return `${pickerMode} card picker. Focused ${text(cardPicker.cardName) || 'card'}${cost === undefined ? '' : `, ${cost} ${costLabel}`}, card ${index + 1} of ${count}.${cardPicker.affordable === false ? ' Not enough Scrap.' : ''} Activate a card once to select it; Previous, Next, or the D-pad also selects. Confirm, controller A, or a second activation commits. Roost or Y inspects without applying. Back or B cancels.`;
    }
    const market = isRecord(payload.market) ? payload.market : undefined;
    if (market) {
      const input = isRecord(market.input) ? market.input : undefined;
      const index = number(input?.index) ?? 0;
      const count = number(input?.count) ?? 0;
      const focus = text(input?.label) || 'no available offer';
      const confirmation = input?.armed === true
        ? ' Purchase confirmation is armed. Confirm, controller A, or activate the same offer again to buy; moving focus or pressing Back cancels.'
        : ' Choose an offer before buying; a first pointer activation only arms the purchase.';
      return `Market, ${spaced(text(market.category))}. ${number(market.scrap) ?? 0} Scrap. Selected ${focus}, offer ${Math.min(index + 1, count)} of ${count}.${confirmation} Use Previous and Next or the D-pad to choose, Confirm or controller A to buy, keys 1 through 4 or controller shoulders to change sections, and Back or controller B to leave. Route commitment is blocked while the Market is open.`;
    }
    const routeReward = isRecord(payload.routeReward) ? payload.routeReward : undefined;
    if (routeReward) {
      const routeInspection = isRecord(routeReward.inspection) ? routeReward.inspection : undefined;
      const routeFocus = isRecord(routeReward.inputFocus) ? routeReward.inputFocus : undefined;
      if (routeInspection?.open === true) {
        return `Full card inspection. ${text(routeInspection.cardName) || 'Reward card'}${number(routeInspection.cost) === undefined ? '' : `, ${number(routeInspection.cost)} Wingbeats`}. No reward has been claimed. Use Back, controller B, or tap outside to return to choice ${number(routeInspection.returnIndex) === undefined ? '' : (number(routeInspection.returnIndex) ?? 0) + 1}.`;
      }
      const cardChoices = Array.isArray(routeReward.cardChoices) ? routeReward.cardChoices.length : 0;
      if (cardChoices > 0) {
        const index = number(routeFocus?.index) ?? 0;
        const confirmation = routeFocus?.armed === true
          ? ` ${text(routeFocus.cardName) || 'Reward card'} is selected. Confirm, controller A, or activate it again to claim; Back or controller B cancels the selection without claiming.`
          : ' A direct activation selects without claiming; activate the same card again to commit. Previous, Next, or the D-pad deliberately selects a card, so Confirm or controller A commits it once.';
        return `Route reward choice. Focused card ${index + 1} of ${cardChoices}.${confirmation} Use Roost or Y to inspect, and Back or B to return without claiming.`;
      }
    }
    const map = isRecord(payload.map) ? payload.map : undefined;
    const run = isRecord(payload.run) ? payload.run : undefined;
    const selectedNodeId = text(payload.selectedNodeId);
    const nodes = records(payload.nodes);
    const selected = nodes.find((node) => text(node.id) === selectedNodeId)
      ?? nodes.find((node) => node.selectable === true);
    const mapName = text(map?.name) || 'current district';
    const nodeLabel = text(selected?.label) || 'available route';
    const risk = text(selected?.risk);
    const hp = number(run?.currentHp);
    const maxHp = number(run?.maxHp);
    const scrap = number(run?.scrap);
    const collectionGoal = isRecord(payload.collectionGoal) ? payload.collectionGoal : undefined;
    const nextGoal = isRecord(collectionGoal?.next) ? collectionGoal.next : undefined;
    const resources = hp === undefined || maxHp === undefined
      ? ''
      : ` Cohesion ${hp} of ${maxHp}.${scrap === undefined ? '' : ` Scrap ${scrap}.`}`;
    const collectionSummary = collectionGoal
      ? ` Collection path: ${number(collectionGoal.owned) ?? 0} of ${number(collectionGoal.total) ?? 0} cards.${nextGoal ? ` Next optional goal, ${text(nextGoal.name)}, ${number(nextGoal.current) ?? 0} of ${number(nextGoal.target) ?? 0}.` : ' All collection badges earned.'}${text(collectionGoal.newCardId) ? ' A newly claimed card is ready for review. Use G, controller R3, or the route collection strip to open its exact dossier and return here without changing the flight or clearing its New marker.' : ' Use G, controller R3, or the route collection strip to open the Atlas and return here without changing the flight.'}`
      : '';
    return `Route, ${mapName}. Selected ${nodeLabel}${risk ? `, ${risk} risk` : ''}.${resources}${collectionSummary} Press Confirm to inspect or commit.`;
  }

  if (scene === 'BattleScene') {
    const rewardInspection = isRecord(payload.rewardInspection) ? payload.rewardInspection : undefined;
    if (rewardInspection?.open === true) {
      const cost = number(rewardInspection.cost);
      const rules = text(rewardInspection.rules);
      return `Full card inspection. ${text(rewardInspection.cardName) || 'Reward card'}${cost === undefined ? '' : `, ${cost} Wingbeats`}.${rules ? ` ${rules}` : ''} No reward has been claimed. Use Back, controller B, Confirm, controller A, or tap outside to return to the same choice.`;
    }
    const inspect = isRecord(payload.cardInspectFocus) ? payload.cardInspectFocus : undefined;
    if (inspect?.active === true) {
      const card = isRecord(payload.inspectedCard) ? payload.inspectedCard : undefined;
      const overlay = spaced(text(inspect.overlay)) || 'card';
      const index = number(inspect.index) ?? 0;
      const count = number(inspect.count) ?? 0;
      const label = text(inspect.label) || text(card?.name) || 'card';
      const zone = text(inspect.zone);
      const cost = number(card?.cost);
      const rules = text(card?.activeText) || text(card?.baseText);
      const bindings = isRecord(inspect.bindings) ? inspect.bindings : undefined;
      const counts = isRecord(inspect.zoneCounts) ? inspect.zoneCounts : undefined;
      const zoneSummary = counts
        ? ` Deck ${number(counts.deck) ?? 0}, Draw ${number(counts.draw) ?? 0}, Discard ${number(counts.discard) ?? 0}, Cleared ${number(counts.cleared) ?? 0}.`
        : '';
      const selection = count > 0
        ? ` Selected ${index + 1} of ${count}, ${label}${zone ? `, ${zone}` : ''}${cost === undefined ? '' : `, ${cost} Wingbeats`}.${rules ? ` ${rules}` : ''}`
        : ' No cards in this zone.';
      return `${overlay === 'deck' ? 'Deck review' : `${overlay} pile`}.${zoneSummary}${selection} Use ${text(bindings?.select) || 'Up and Down'} to choose a card, ${text(bindings?.previousZone) || 'Previous'} and ${text(bindings?.nextZone) || 'Next'} to switch zones, controller shoulders to page, and ${text(bindings?.back) || 'Back'} to close.`;
    }
    const runOutcome = mode === 'defeat' || mode === 'runComplete';
    const flightDetailsState = isRecord(payload.outcomeFlightDetails) ? payload.outcomeFlightDetails : undefined;
    if (runOutcome && flightDetailsState?.open === true) {
      const details = isRecord(flightDetailsState.details) ? flightDetailsState.details : undefined;
      const deck = Array.isArray(details?.deck) ? details.deck.map(text).filter(Boolean) : [];
      const path = Array.isArray(details?.path) ? details.path.map(text).filter(Boolean) : [];
      const waymarks = Array.isArray(details?.waymarks) ? details.waymarks.map(text).filter(Boolean) : [];
      const results = Array.isArray(details?.results) ? details.results.map(text).filter(Boolean) : [];
      return `Flight details. ${results.join('. ')}. Final deck has ${deck.length} cards${deck.length ? `: ${deck.join(', ')}` : ''}. Route path has ${path.length} stops${path.length ? `: ${path.join(', ')}` : ''}. Waymarks ${waymarks.join(', ') || 'none'}. Press Confirm or Back to close.`;
    }
    if (runOutcome) {
      const review = isRecord(payload.defeatReview) ? payload.defeatReview : undefined;
      const focus = isRecord(payload.combatInputFocus) ? payload.combatInputFocus : undefined;
      const fatalMove = text(review?.fatalMove);
      const evidence = text(review?.evidence);
      const tip = text(review?.tip);
      const focused = text(focus?.label) || 'Replay Flight';
      const heading = mode === 'defeat' ? 'Flock scattered.' : 'Run complete.';
      return `${heading}${fatalMove ? ` Last hit ${fatalMove}.` : ''}${evidence ? ` ${evidence}.` : ''}${tip ? ` ${tip}` : ''} Focused ${focused}. Press Confirm to select.`;
    }
    if (payload.paused === true) return 'Battle paused. Use Settings, Resume, or Return to menu.';
    const turn = number(payload.turn) ?? 0;
    const energy = number(payload.energy) ?? 0;
    const flock = isRecord(payload.flock) ? payload.flock : undefined;
    const hp = number(flock?.hp) ?? 0;
    const maxHp = number(flock?.maxHp) ?? 0;
    const cleared = number(payload.clearedPile) ?? 0;
    const hand = records(payload.hand);
    const enemies = records(payload.enemies);
    const selectedCardId = text(payload.selectedCard);
    const selectedCard = hand.find((card) => text(card.instanceId) === selectedCardId);
    const selectedEnemyId = text(payload.selectedEnemy);
    const selectedEnemy = enemies.find((enemy) => text(enemy.id) === selectedEnemyId);
    const phaseTwoBoss = enemies.find((enemy) => number(enemy.phase) === 2 && (number(enemy.hp) ?? 0) > 0);
    const phaseNote = phaseTwoBoss
      ? ` ${text(phaseTwoBoss.name) || 'Boss'} is in Phase II, ${text(phaseTwoBoss.phaseName) || 'final pattern'}; next Tell ${text(phaseTwoBoss.intent) || 'unknown'}.`
      : '';
    const latestLog = Array.isArray(payload.log) ? text(payload.log.at(-1)) : '';
    const enemyMove = text(payload.combatEnemyTurnMove);
    const inputFocus = isRecord(payload.combatInputFocus) ? payload.combatInputFocus : undefined;
    if (enemyMove) {
      return `Enemy turn, ${enemyMove}.${phaseNote}${latestLog ? ` ${latestLog}` : ''} Cohesion ${hp} of ${maxHp}.`;
    }
    if (mode === 'cardReward' || mode === 'upgradeReward' || mode === 'waymarkReward') {
      const source = mode === 'cardReward'
        ? records(payload.rewardChoices)
        : mode === 'upgradeReward'
          ? records(payload.upgradeChoices)
          : records(payload.waymarkChoices);
      const choices = source.map((choice) => text(choice.name)).filter(Boolean);
      const focusedLabel = text(inputFocus?.label);
      const focusedIndex = number(inputFocus?.index);
      const focusedCount = number(inputFocus?.count);
      const focusedChoice = focusedIndex === undefined ? undefined : source[focusedIndex];
      const collection = mode === 'cardReward' && focusedChoice && isRecord(focusedChoice.collection)
        ? focusedChoice.collection
        : undefined;
      const collectionNote = collection
        ? collection.targeted === true
          ? ' Hunt target. Claiming it completes a permanent personal milestone; reward odds were not changed.'
          : collection.firstClaim === true
            ? ' This would be its first permanent collection record; the playable copy is for this flight.'
            : ` Already collected, with ${number(collection.timesClaimed) ?? 0} prior flight claims; this playable copy is for this flight.`
        : '';
      const focused = focusedLabel
        ? ` Focused ${focusedLabel}${focusedIndex !== undefined && focusedCount !== undefined ? `, choice ${focusedIndex + 1} of ${focusedCount}` : ''}.`
        : '';
      const rewardConfirmation = isRecord(payload.rewardChoiceConfirmation)
        ? payload.rewardChoiceConfirmation
        : undefined;
      const claimInstruction = rewardConfirmation?.armed === true
        ? ` ${text(rewardConfirmation.choiceName) || focusedLabel || 'Reward'} is selected. Activate Confirm, controller A, or the choice again to commit; Back or controller B cancels without changing the run.`
        : ' A direct activation selects without claiming; activate the same choice again to commit. Previous or Next deliberately selects a choice, so Confirm or controller A commits it once.';
      const rewardSkip = mode === 'cardReward' && isRecord(payload.rewardSkip)
        ? payload.rewardSkip
        : undefined;
      const skipInstruction = rewardSkip?.available === true
        ? rewardSkip.armed === true
          ? ` Skip confirmation is armed for ${number(rewardSkip.scrap) ?? 0} Scrap. Activate ${text(isRecord(rewardSkip.input) ? rewardSkip.input.keyboard : undefined) || 'Skip Reward'}, controller X, or Skip again to commit; Back or controller B cancels without skipping.`
          : ` Skip is available for ${number(rewardSkip.scrap) ?? 0} Scrap and requires two activations; the first only arms confirmation.`
        : '';
      return `Reward choice.${focused}${collectionNote}${choices.length ? ` Options: ${choices.join(', ')}.` : ''}${claimInstruction} Use Roost or controller Y to inspect without claiming.${skipInstruction}`;
    }
    if (selectedCard) {
      const name = text(selectedCard.name) || 'card';
      const cost = number(selectedCard.cost) ?? 0;
      const rules = text(selectedCard.activeText);
      const activeTarget = text(selectedCard.activeTarget);
      const target = activeTarget === 'enemy' && selectedEnemy ? ` Target ${text(selectedEnemy.name)}.` : '';
      const bindings = isRecord(inputFocus?.bindings) ? inputFocus.bindings : undefined;
      const commit = text(bindings?.confirm) || 'Confirm';
      const targetAction = activeTarget === 'enemy' ? ' Choose the enemy target, or' : '';
      const outcome = isRecord(payload.selectedCardOutcome) ? text(payload.selectedCardOutcome.summary) : '';
      return `Turn ${turn}. Selected ${name}, cost ${cost}.${target}${rules ? ` ${rules}` : ''}${outcome ? ` Preview: ${outcome}.` : ''}${phaseNote} Wingbeats ${energy}. Cohesion ${hp} of ${maxHp}.${targetAction} press ${commit}, controller A, or activate the selected card again to play. Back or controller B cancels without playing.`;
    }
    const firstCombatGuidance = isRecord(payload.firstCombatGuidance) ? payload.firstCombatGuidance : undefined;
    const guideCardName = text(firstCombatGuidance?.cardName);
    if (firstCombatGuidance?.active === true && guideCardName) {
      const guideCost = number(firstCombatGuidance?.cost) ?? 0;
      const guideTarget = text(firstCombatGuidance?.target);
      return `First flight guide. Start with ${guideCardName}, cost ${guideCost} Wingbeat${guideCost === 1 ? '' : 's'}${guideTarget ? `, targeting ${guideTarget}` : ''}. Cards build Flow. Full Flow becomes Surge.`;
    }
    return `Combat, turn ${turn}. Wingbeats ${energy}. Cohesion ${hp} of ${maxHp}. ${hand.length} cards in hand, ${enemies.filter((enemy) => (number(enemy.hp) ?? 0) > 0).length} enemies.${phaseNote}${cleared > 0 ? ` ${cleared} card${cleared === 1 ? '' : 's'} cleared for this combat.` : ''}${latestLog ? ` ${latestLog}` : ''}`;
  }

  if (mode === 'codex') {
    const section = spaced(text(payload.section)) || 'cards';
    const focus = isRecord(payload.codexFocus) ? payload.codexFocus : undefined;
    const focusLabel = text(focus?.label);
    const zone = text(focus?.zone);
    const position = number(focus?.index);
    const count = number(focus?.count);
    const detail = text(payload.detailOpen);
    const favorites = isRecord(payload.cardFavorites) ? payload.cardFavorites : undefined;
    const protection = isRecord(payload.cardProtection) ? payload.cardProtection : undefined;
    const personalTags = isRecord(payload.personalCardTags) ? payload.personalCardTags : undefined;
    const cardJournal = isRecord(payload.cardJournal) ? payload.cardJournal : undefined;
    const savedViews = isRecord(payload.savedCollectionViews) ? payload.savedCollectionViews : undefined;
    const hunt = isRecord(payload.collectionHunt) ? payload.collectionHunt : undefined;
    const showcase = isRecord(payload.cardShowcase) ? payload.cardShowcase : undefined;
    const ownership = isRecord(payload.cardOwnership) ? payload.cardOwnership : undefined;
    const acquisition = isRecord(payload.cardAcquisition) ? payload.cardAcquisition : undefined;
    const folioUsage = isRecord(payload.cardFolioUsage) ? payload.cardFolioUsage : undefined;
    const activeFlightCards = isRecord(payload.activeFlightCards) ? payload.activeFlightCards : undefined;
    const newCards = isRecord(payload.newlyAcquiredCards) ? payload.newlyAcquiredCards : undefined;
    const collectionLens = isRecord(payload.cardCollectionLens) ? payload.cardCollectionLens : undefined;
    const activeFilters = isRecord(payload.activeCardFilters) ? payload.activeCardFilters : undefined;
    const cardSearch = isRecord(payload.cardSearch) ? payload.cardSearch : undefined;
    const cardSort = isRecord(payload.cardSort) ? payload.cardSort : undefined;
    const inspectionReturn = isRecord(payload.inspectionReturn) ? payload.inspectionReturn : undefined;
    const collectionAtlas = isRecord(payload.collectionAtlas) ? payload.collectionAtlas : undefined;
    const atlasOverall = isRecord(collectionAtlas?.overall) ? collectionAtlas.overall : undefined;
    const atlasSelected = isRecord(collectionAtlas?.selectedFamily) ? collectionAtlas.selectedFamily : undefined;
    const atlasSelectedMissing = isRecord(collectionAtlas?.selectedMissing) ? collectionAtlas.selectedMissing : undefined;
    const atlasNextMilestone = isRecord(collectionAtlas?.nextMilestone) ? collectionAtlas.nextMilestone : undefined;
    const detailOwnership = isRecord(ownership?.detail) ? ownership.detail : undefined;
    const detailAcquisition = isRecord(acquisition?.detail) ? acquisition.detail : undefined;
    const detailFolioUsage = isRecord(folioUsage?.detail) ? folioUsage.detail : undefined;
    const detailActiveFlight = isRecord(activeFlightCards?.detail) ? activeFlightCards.detail : undefined;
    const collectedCount = number(ownership?.collectedCount) ?? 0;
    const discoveredCount = number(payload.cardsDiscovered) ?? 0;
    const detailFavorite = favorites?.detailFavorite === true;
    const detailProtected = protection?.detailProtected === true;
    const detailProtectionEligible = protection?.detailEligible === true;
    const protectedCount = number(protection?.count) ?? 0;
    const favoriteView = favorites?.viewActive === true;
    const favoriteViewEmpty = favorites?.viewEmpty === true;
    const favoriteCount = number(favorites?.count) ?? 0;
    const personalTagCount = number(personalTags?.count) ?? 0;
    const visiblePersonalTagCount = Array.isArray(personalTags?.visibleIds)
      ? personalTags.visibleIds.length
      : 0;
    const detailPersonalTag = spaced(text(personalTags?.detailTag));
    const detailPersonalTagLabel = detailPersonalTag
      ? `${detailPersonalTag[0].toUpperCase()}${detailPersonalTag.slice(1)}`
      : '';
    const detailJournalNote = spaced(text(cardJournal?.detailNote)).replace(/\s+/g, ' ').trim();
    const detailJournalSentence = detailJournalNote && /[.!?]$/.test(detailJournalNote)
      ? detailJournalNote
      : `${detailJournalNote}.`;
    const detailTargeted = hunt?.detailTargeted === true;
    const canTarget = hunt?.detailCanTarget === true;
    const huntView = hunt?.viewActive === true;
    const huntViewEmpty = hunt?.viewEmpty === true;
    const huntCount = number(hunt?.count) ?? 0;
    const huntCapacity = number(hunt?.capacity) ?? 3;
    const huntCompleted = number(hunt?.completed) ?? 0;
    const showcaseCount = number(showcase?.count) ?? 0;
    const showcaseCapacity = number(showcase?.capacity) ?? 3;
    const detailShowcased = showcase?.detailShowcased === true;
    const detailCanShowcase = showcase?.detailCanAdd === true;
    const lensLabel = spaced(text(collectionLens?.label)) || 'all';
    const lensVisible = number(collectionLens?.visibleCount) ?? 0;
    const lensBase = number(collectionLens?.baseCount) ?? 0;
    const searchQuery = text(cardSearch?.query);
    const searchScope = spaced(text(cardSearch?.scope)) || 'current set';
    const searchMatches = number(cardSearch?.matchCount) ?? 0;
    const searchVisible = number(cardSearch?.visibleCount) ?? 0;
    const typoMatches = number(cardSearch?.typoMatchCount) ?? 0;
    const sortLabel = spaced(text(cardSort?.label)) || 'binder';
    const newCardCount = number(newCards?.count) ?? 0;
    const detailNew = newCards?.detailNew === true;
    const folioCardCount = number(folioUsage?.cardCount) ?? 0;
    const atlasCollected = number(atlasOverall?.owned) ?? collectedCount;
    const atlasTotal = number(atlasOverall?.total) ?? number(payload.cardsTotal) ?? 0;
    const itemPosition = zone === 'entries' && position !== undefined && count !== undefined
      ? ` Item ${position + 1} of ${count}.`
      : '';
    const favoriteState = detail
      ? ` This card is ${detailFavorite ? 'favorited' : 'not favorited'}. Use C or controller X to ${detailFavorite ? 'remove it from' : 'add it to'} favorites.`
      : '';
    const favoriteViewState = favoriteView
      ? favoriteViewEmpty
        ? ' No favorite cards yet. Open a discovered card and choose Favorite to add it here.'
        : ` Showing ${favoriteCount} favorite card${favoriteCount === 1 ? '' : 's'}.`
      : '';
    const protectionState = section === 'cards'
      ? detail
        ? detailProtectionEligible
          ? detailProtected
            ? ' This owned card is protected. Use T or controller Y to remove protection. Protection is private, included in complete save backups, and has no effect on power or reward odds.'
            : ' This owned card is not protected. Use T or controller Y to protect it against future conversion or destruction tools. Bird Squad currently has no destructive card action; protection is private, backup-safe, and has no effect on play.'
          : ''
        : ` ${protectedCount} owned card${protectedCount === 1 ? '' : 's'} protected.`
      : '';
    const personalTagState = section === 'cards'
      ? detail
        ? detailPersonalTagLabel
          ? ` Personal tag ${detailPersonalTagLabel}. Use V or controller L3 to change it; tags are private and never affect power.`
          : ' No personal tag. Use V or controller L3 to choose Staple, Experiment, or Keepsake.'
        : personalTags?.lensActive === true
          ? visiblePersonalTagCount > 0
            ? ` Showing ${visiblePersonalTagCount} personally tagged card${visiblePersonalTagCount === 1 ? '' : 's'} in this set; ${personalTagCount} tagged across the collection.`
            : ' No personal tags in this set. Open a discovered card and use V or controller L3 to choose one.'
          : ` ${personalTagCount} personally tagged card${personalTagCount === 1 ? '' : 's'}.`
      : '';
    if (cardJournal?.editing === true) {
      return `Editing the private Card Journal for ${text(cardJournal.detailName) || 'this card'}. The limit is ${number(cardJournal.maxLength) ?? 240} characters. Press Enter or controller A to save, Shift plus Enter for a new line, or Escape or controller B to cancel. The note is included in local save backups, excluded from shared deck codes, and never affects play.`;
    }
    if (savedViews?.open === true) {
      const items = records(savedViews.items);
      const selectedIndex = Math.max(0, number(savedViews.selectedIndex) ?? 0);
      const selected = items[selectedIndex];
      const selectedName = text(selected?.name);
      const query = text(selected?.query);
      const criteria = selected
        ? `${text(selected.tabLabel) || 'Cards'}, ${text(selected.lensLabel) || 'All'} lens, ${query ? `search ${query}` : 'no search'}, ${text(selected.sortLabel) || 'Binder'} order`
        : 'No saved view selected';
      const status = text(savedViews.status);
      const statusText = status === 'saved'
        ? ' View saved.'
        : status === 'duplicate'
          ? ' That exact view is already saved.'
          : status === 'full'
            ? ' The four-view shelf is full.'
            : status === 'deleted'
              ? ' View removed without changing collection data.'
              : status === 'failed'
                ? ' The view could not be stored; nothing changed.'
                : '';
      return `Saved Collection Views open. ${items.length} of ${number(savedViews.capacity) ?? 4} saved.${selectedName ? ` Selected ${selectedIndex + 1} of ${items.length}, ${selectedName}: ${criteria}.` : ' No saved views yet; save the current combination.'}${statusText} Use Up and Down to choose, Confirm or controller A to apply, Control plus S or controller X to save the current view, Delete or controller Y to remove the selected view, or B, controller Select, or Back to close. Saved views are private, included in complete save backups, and never affect card power, ownership, or reward odds.`;
    }
    const cardJournalState = section === 'cards' && detail
      ? detailJournalNote
        ? ` Private Card Journal note: ${detailJournalSentence} Use J, controller Start, or the journal panel to edit it. The note is included in local save backups, excluded from shared deck codes, and never affects power.`
        : ' No private Card Journal note yet. Use J, controller Start, or the journal panel to add one; it is included in local save backups, excluded from shared deck codes, and never affects power.'
      : '';
    const huntState = detail
      ? detailOwnership
        ? detailOwnership.targetCompletedAt
          ? ' This card completed a Hunt List milestone.'
          : ''
        : detailTargeted
          ? ' Active Hunt List target. Use T or controller Y to stop tracking it. Reward odds are unchanged.'
          : canTarget
            ? ' Use T or controller Y to track this card on the Hunt List. Reward odds are unchanged.'
            : ` Hunt List full at ${huntCount} of ${huntCapacity}.`
      : '';
    const huntViewState = huntView
      ? huntViewEmpty
        ? ` Hunt List empty. Open a discovered, uncollected card and choose Track. Up to ${huntCapacity} cards can be tracked without changing reward odds.`
        : ` Showing ${huntCount} active Hunt List target${huntCount === 1 ? '' : 's'}; ${huntCompleted} completed.`
      : '';
    const showcaseState = section === 'cards' && detail
      ? detailShowcased
        ? ` Presented in Flock Record. Use G or controller R3 to remove it from the showcase. ${showcaseCount} of ${showcaseCapacity} slots used.`
        : detailCanShowcase
          ? ` Use G or controller R3 to present this card in Flock Record. ${showcaseCount} of ${showcaseCapacity} slots used. Showcase choices never affect power.`
          : ` Flock Record showcase full at ${showcaseCount} of ${showcaseCapacity}. Remove a presented card before adding this one; existing choices are never replaced automatically.`
      : '';
    const ownershipState = section === 'cards'
      ? detail
        ? detailOwnership
          ? ` Collected permanently, with ${number(detailOwnership.timesClaimed) ?? 1} flight claims. Playable copies and upgrades are specific to each flight.`
          : ' Discovered but not yet collected. Claim it during a flight to create its permanent collection record.'
        : ` ${collectedCount} collected and ${discoveredCount} discovered.`
      : '';
    const starterLeaderNames = Array.isArray(detailAcquisition?.starterLeaderNames)
      ? detailAcquisition.starterLeaderNames.map(text).filter(Boolean)
      : [];
    const acquisitionState = section === 'cards' && detail && detailAcquisition
      ? ` Permanently available with no seasonal rotation, expiration, or store gate. Acquisition paths: ${records(detailAcquisition.paths).map((path) => spaced(text(path.label))).filter(Boolean).join(', ') || 'none recorded'}.${starterLeaderNames.length > 0 ? ` Starter options: ${starterLeaderNames.join(', ')}.` : ''}`
      : '';
    const folioUsageState = section === 'cards'
      ? detail
        ? detailFolioUsage
          ? ` Used in ${number(detailFolioUsage.total) ?? 0} saved Flight Folio${number(detailFolioUsage.total) === 1 ? '' : 's'}: ${number(detailFolioUsage.active) ?? 0} active and ${number(detailFolioUsage.archived) ?? 0} archived. This private organization never changes card power or ownership.`
          : ' Not used in a saved Flight Folio.'
        : folioUsage?.lensActive === true
          ? ` Showing ${lensVisible} card${lensVisible === 1 ? '' : 's'} used in saved Flight Folios.`
          : ` ${folioCardCount} discovered card${folioCardCount === 1 ? '' : 's'} used in saved Flight Folios.`
      : '';
    const activeFlightState = section === 'cards' && detail && detailActiveFlight
      ? activeFlightCards?.active === true
        ? detailActiveFlight.inDeck === true
          ? ` In the active flight: one playable ${text(detailActiveFlight.state) === 'preened' ? 'Preened' : 'Base'} copy. This checkpoint copy is run-specific and does not change permanent ownership or saved Folios.${detailActiveFlight.canOpenDeckReview === true ? ' Use D, controller right shoulder, or View in Flight Deck to return to the route with this exact card selected in Deck Review; this does not edit or save the deck.' : ''}`
          : ' Not in the active flight deck; playable quantity there is zero. Permanent ownership and saved Folios are unchanged.'
        : ' No active flight, so there are zero flight-specific playable copies. Permanent ownership and saved Folios remain available independently.'
      : '';
    const newCardState = section === 'cards'
      ? detail
        ? detailNew
          ? ' New to collection. Choose Mark Seen, press N, or use controller LT to acknowledge this marker.'
          : ''
        : newCardCount > 0
          ? ` ${newCardCount} new card marker${newCardCount === 1 ? '' : 's'}. Use N, controller LT, or Clear All to acknowledge them without changing ownership.`
          : ' No new card markers.'
      : '';
    const collectionLensState = section === 'cards' && !detail
      ? ` Collection lens ${lensLabel}, showing ${lensVisible} of ${lensBase} ${cardSearch?.active === true ? 'search matches' : 'cards in this set'}.${collectionLens?.empty === true ? ' No cards match this lens.' : ''} Use L or controller LB to change the lens.`
      : '';
    const activeFilterItems = records(activeFilters?.chips)
      .filter((chip) => chip.clearAll !== true);
    const activeFiltersState = section === 'cards' && !detail && activeFilterItems.length > 0
      ? ` Active filter chips: ${activeFilterItems.map((chip) => `${text(chip.label)}, ${text(chip.value)}`).join('; ')}. Focus a chip and press Confirm, Delete, or controller A to remove it individually, or choose Clear All to reset search and lens together. The current set and sorting stay in place.`
      : '';
    const cardSearchState = section === 'cards' && !detail
      ? cardSearch?.editing === true
        ? ` Find cards field active.${searchQuery ? ` Current query ${searchQuery}.` : ''} Type to filter, Enter to apply, or Escape to cancel.`
        : searchQuery
          ? ` Find cards query ${searchQuery}, ${searchMatches} match${searchMatches === 1 ? '' : 'es'} in ${searchScope}; ${searchVisible} visible after the collection lens.${typoMatches > 0 ? ` Typo-tolerant matching helped with ${typoMatches} result${typoMatches === 1 ? '' : 's'}.` : ''}${cardSearch?.empty === true ? ' No card matches every search term. Check spelling, remove the Search chip, or choose Clear All.' : ''} Use slash or controller RB to edit or clear it.`
          : ' Use slash or controller RB to find cards by name, rules, keyword, character, set, type, cost, rarity, ownership, saved Folio usage, personal tag, private journal, showcase status, or protection status. Search tolerates conservative misspellings while requiring every term to match.'
      : '';
    const cardSortState = section === 'cards' && !detail
      ? ` Sorted by ${sortLabel}. Use R or controller RT to change sorting.`
      : '';
    const inspectionReturnState = detail && inspectionReturn?.captured === true
      ? ` Closing this inspection returns to ${spaced(text(inspectionReturn.set)) || 'the same set'}, ${spaced(text(inspectionReturn.lens)) || 'the same lens'} lens${text(inspectionReturn.query) ? `, search ${text(inspectionReturn.query)}` : ''}, ${spaced(text(inspectionReturn.sort)) || 'the same'} order, selected card, and prior scroll position.`
      : '';
    const savedViewsState = section === 'cards' && !detail
      ? ` ${number(savedViews?.count) ?? 0} of ${number(savedViews?.capacity) ?? 4} reusable collection views saved. Use B or controller Select to manage combinations of set, lens, search, and sorting. Saved views are private, included in complete save backups, and never affect power.`
      : '';
    const collectionAtlasState = section === 'cards' && !detail
      ? collectionAtlas?.open === true
        ? ` Collection Atlas open. ${atlasCollected} of ${atlasTotal} cards permanently collected. Collector milestones ${number(collectionAtlas?.completedMilestones) ?? 0} of ${records(collectionAtlas?.milestones).length} earned.${atlasNextMilestone ? ` Next, ${text(atlasNextMilestone.name)}, ${number(atlasNextMilestone.current) ?? 0} of ${number(atlasNextMilestone.target) ?? 0}.` : ''} Focused ${spaced(text(atlasSelected?.name)) || 'set'}, ${number(atlasSelected?.owned) ?? 0} of ${number(atlasSelected?.total) ?? 0} collected and ${number(atlasSelected?.discovered) ?? 0} encountered.${atlasSelectedMissing ? ` ${number(atlasSelectedMissing.count) ?? 0} missing; available through ${records(atlasSelectedMissing.paths).map((path) => `${spaced(text(path.name))} for ${number(path.count) ?? 0}`).join(', ') || 'no remaining paths'}. All cards are permanent with no rotation, season, or store gate; undiscovered identities remain concealed.` : ''} Milestone badges never affect power. Use Up and Down to browse sets, Confirm to open one, or G, controller R3, or Back to close.`
        : ` Collection Atlas has permanent set, rarity, acquisition-path, and collector-milestone progress for ${atlasCollected} of ${atlasTotal} cards. Use G or controller R3 to open it.`
      : '';
    return `Codex, ${section}.${focusLabel ? ` ${focusLabel}.` : ''}${itemPosition}${detail ? ' Detail open.' : ''}${favoriteState}${favoriteViewState}${protectionState}${personalTagState}${cardJournalState}${showcaseState}${huntState}${huntViewState}${ownershipState}${acquisitionState}${activeFlightState}${folioUsageState}${newCardState}${cardSearchState}${cardSortState}${collectionLensState}${activeFiltersState}${savedViewsState}${collectionAtlasState}${inspectionReturnState} ${detail ? 'Use Up and Down to scroll, then Confirm or Back to close.' : collectionAtlas?.open === true ? 'Choose a set or close the Collection Atlas.' : 'Use Tab to change focus, Previous and Next to navigate, and Confirm to select.'}`;
  }
  return scene ? `${spaced(scene)}.` : '';
}
