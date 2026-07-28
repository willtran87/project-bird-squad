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
      return `Flight Lab for ${text(flightLab.deckName)}. ${flightLab.legalForStandardFlight === true ? 'Standard ready.' : 'Review needed.'} ${number(flightLab.savedCopies) ?? 0} saved copies, ${number(flightLab.playableCards) ?? 0} playable cards, average cost ${number(flightLab.averageCost) ?? 0}. Cost curve: ${curve || 'empty'}. Roles: ${roles || 'none'}. Families: ${families || 'none'}. Resource hooks: ${hooks || 'none'}. Sample hand ${number(sample?.number) ?? 1}: ${sampleCards || 'no cards'}. ${number(sample?.playableCount) ?? 0} playable now and ${number(sample?.pressureCount) ?? 0} pressure cards. Across ${number(consistency?.sampleCount) ?? 0} deterministic hands, ${number(consistency?.averagePlayable) ?? 0} average playable, ${number(consistency?.atLeastTwoPlayablePercent) ?? 0} percent open with two playable, and ${number(consistency?.pressurePercent) ?? 0} percent include pressure.${issues ? ` ${issues}` : ''} Practice uses the real protected combat opening draw, never changes the folio, never affects power, and spends no Scrap. Use Previous and Next, Space, or controller A to deal; Back or controller B closes the Lab.`;
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
    const folioSummary = ` Flight Folios ${number(folios?.count) ?? 0} active of ${number(folios?.capacity) ?? 6}, and ${number(folios?.archivedCount) ?? 0} archived of ${number(folios?.archiveCapacity) ?? 24}. Viewing ${archiveView ? 'Archive' : 'Active'}.${selectedFolio ? ` Selected ${text(selectedFolio.name)}, ${text(selectedFolio.leader)}, ${number(selectedFolio.cardCount) ?? 0} cards, revision ${number(selectedFolio.revision) ?? 1}${selectedFolio.favorite === true ? ', favorite' : ''}${selectedFolio.archived === true ? ', archived' : ''}.` : archiveView ? ' The Archive is empty.' : ' Save a deck from Route Deck Review or import a flight code.'} Archived Folios preserve their identity and never affect gameplay power. BSF version ${number(shareCode?.version) ?? 1} codes use a checksum and exclude account data, custom names, and flight seeds.${folios?.viewActive === true ? ` Use Previous and Next to select, C or controller X to favorite, R or controller Y to rename, A or controller Start to ${archiveView ? 'restore' : 'archive'}, V or controller Select to switch libraries, D or controller left trigger to fork without changing the original, E or controller right trigger to copy a share code, I or controller left stick to import, and L or controller right stick to open the Flight Lab.` : ''}`;
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
      ? ` Collection path: ${number(collectionGoal.owned) ?? 0} of ${number(collectionGoal.total) ?? 0} cards.${nextGoal ? ` Next optional goal, ${text(nextGoal.name)}, ${number(nextGoal.current) ?? 0} of ${number(nextGoal.target) ?? 0}.` : ' All collection badges earned.'} Use G, controller R3, or the route collection strip to open the Atlas and return here without changing the flight.`
      : '';
    return `Route, ${mapName}. Selected ${nodeLabel}${risk ? `, ${risk} risk` : ''}.${resources}${collectionSummary} Press Confirm to inspect or commit.`;
  }

  if (scene === 'BattleScene') {
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
    const latestLog = Array.isArray(payload.log) ? text(payload.log.at(-1)) : '';
    const enemyMove = text(payload.combatEnemyTurnMove);
    const inputFocus = isRecord(payload.combatInputFocus) ? payload.combatInputFocus : undefined;
    if (enemyMove) {
      return `Enemy turn, ${enemyMove}.${latestLog ? ` ${latestLog}` : ''} Cohesion ${hp} of ${maxHp}.`;
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
      return `Reward choice.${focused}${collectionNote}${choices.length ? ` Options: ${choices.join(', ')}.` : ''} Use Previous and Next to choose, then Confirm. Use Skip Reward for Scrap when available.`;
    }
    if (selectedCard) {
      const name = text(selectedCard.name) || 'card';
      const cost = number(selectedCard.cost) ?? 0;
      const rules = text(selectedCard.activeText);
      const target = selectedEnemy ? ` Target ${text(selectedEnemy.name)}.` : '';
      return `Turn ${turn}. Selected ${name}, cost ${cost}.${target}${rules ? ` ${rules}` : ''} Wingbeats ${energy}. Cohesion ${hp} of ${maxHp}.`;
    }
    const firstCombatGuidance = isRecord(payload.firstCombatGuidance) ? payload.firstCombatGuidance : undefined;
    const guideCardName = text(firstCombatGuidance?.cardName);
    if (firstCombatGuidance?.active === true && guideCardName) {
      const guideCost = number(firstCombatGuidance?.cost) ?? 0;
      const guideTarget = text(firstCombatGuidance?.target);
      return `First flight guide. Start with ${guideCardName}, cost ${guideCost} Wingbeat${guideCost === 1 ? '' : 's'}${guideTarget ? `, targeting ${guideTarget}` : ''}. Cards build Flow. Full Flow becomes Surge.`;
    }
    return `Combat, turn ${turn}. Wingbeats ${energy}. Cohesion ${hp} of ${maxHp}. ${hand.length} cards in hand, ${enemies.filter((enemy) => (number(enemy.hp) ?? 0) > 0).length} enemies.${cleared > 0 ? ` ${cleared} card${cleared === 1 ? '' : 's'} cleared for this combat.` : ''}${latestLog ? ` ${latestLog}` : ''}`;
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
    const personalTags = isRecord(payload.personalCardTags) ? payload.personalCardTags : undefined;
    const hunt = isRecord(payload.collectionHunt) ? payload.collectionHunt : undefined;
    const showcase = isRecord(payload.cardShowcase) ? payload.cardShowcase : undefined;
    const ownership = isRecord(payload.cardOwnership) ? payload.cardOwnership : undefined;
    const newCards = isRecord(payload.newlyAcquiredCards) ? payload.newlyAcquiredCards : undefined;
    const collectionLens = isRecord(payload.cardCollectionLens) ? payload.cardCollectionLens : undefined;
    const cardSearch = isRecord(payload.cardSearch) ? payload.cardSearch : undefined;
    const cardSort = isRecord(payload.cardSort) ? payload.cardSort : undefined;
    const collectionAtlas = isRecord(payload.collectionAtlas) ? payload.collectionAtlas : undefined;
    const atlasOverall = isRecord(collectionAtlas?.overall) ? collectionAtlas.overall : undefined;
    const atlasSelected = isRecord(collectionAtlas?.selectedFamily) ? collectionAtlas.selectedFamily : undefined;
    const atlasNextMilestone = isRecord(collectionAtlas?.nextMilestone) ? collectionAtlas.nextMilestone : undefined;
    const detailOwnership = isRecord(ownership?.detail) ? ownership.detail : undefined;
    const collectedCount = number(ownership?.collectedCount) ?? 0;
    const discoveredCount = number(payload.cardsDiscovered) ?? 0;
    const detailFavorite = favorites?.detailFavorite === true;
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
    const sortLabel = spaced(text(cardSort?.label)) || 'binder';
    const newCardCount = number(newCards?.count) ?? 0;
    const detailNew = newCards?.detailNew === true;
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
    const cardSearchState = section === 'cards' && !detail
      ? cardSearch?.editing === true
        ? ` Find cards field active.${searchQuery ? ` Current query ${searchQuery}.` : ''} Type to filter, Enter to apply, or Escape to cancel.`
        : searchQuery
          ? ` Find cards query ${searchQuery}, ${searchMatches} match${searchMatches === 1 ? '' : 'es'} in ${searchScope}; ${searchVisible} visible after the collection lens.${cardSearch?.empty === true ? ' No cards match this search.' : ''} Use slash or controller RB to edit or clear it.`
          : ' Use slash or controller RB to find cards by name, rules, keyword, character, set, type, cost, rarity, ownership, personal tag, or showcase status.'
      : '';
    const cardSortState = section === 'cards' && !detail
      ? ` Sorted by ${sortLabel}. Use R or controller RT to change sorting.`
      : '';
    const collectionAtlasState = section === 'cards' && !detail
      ? collectionAtlas?.open === true
        ? ` Collection Atlas open. ${atlasCollected} of ${atlasTotal} cards permanently collected. Collector milestones ${number(collectionAtlas?.completedMilestones) ?? 0} of ${records(collectionAtlas?.milestones).length} earned.${atlasNextMilestone ? ` Next, ${text(atlasNextMilestone.name)}, ${number(atlasNextMilestone.current) ?? 0} of ${number(atlasNextMilestone.target) ?? 0}.` : ''} Focused ${spaced(text(atlasSelected?.name)) || 'set'}, ${number(atlasSelected?.owned) ?? 0} of ${number(atlasSelected?.total) ?? 0} collected and ${number(atlasSelected?.discovered) ?? 0} encountered. Milestone badges never affect power. Use Up and Down to browse sets, Confirm to open one, or G, controller R3, or Back to close.`
        : ` Collection Atlas has permanent set, rarity, acquisition-path, and collector-milestone progress for ${atlasCollected} of ${atlasTotal} cards. Use G or controller R3 to open it.`
      : '';
    return `Codex, ${section}.${focusLabel ? ` ${focusLabel}.` : ''}${itemPosition}${detail ? ' Detail open.' : ''}${favoriteState}${favoriteViewState}${personalTagState}${showcaseState}${huntState}${huntViewState}${ownershipState}${newCardState}${cardSearchState}${cardSortState}${collectionLensState}${collectionAtlasState} ${detail ? 'Use Up and Down to scroll, then Confirm or Back to close.' : collectionAtlas?.open === true ? 'Choose a set or close the Collection Atlas.' : 'Use Tab to change focus, Previous and Next to navigate, and Confirm to select.'}`;
  }
  return scene ? `${spaced(scene)}.` : '';
}
