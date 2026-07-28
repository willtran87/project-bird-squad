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
    const label = text(focus?.label) || 'Choose a setup, then start a run';
    return `Bird Squad menu. ${label}. Press Confirm to select.`;
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
    const current = spaced(text(focus?.current)) || 'Flock Record';
    return `Flock Record. ${current}. Press Confirm to select, or Back to return.`;
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
      const pinned = isRecord(comparison?.pinned) ? comparison.pinned : undefined;
      const compared = isRecord(comparison?.selected) ? comparison.selected : undefined;
      const comparisonSummary = comparison?.active === true && comparison?.mode === 'preen' && pinned && compared
        ? ` Preen preview for ${text(pinned.name)}. Base: ${spaced(text(pinned.role))}, ${spaced(text(pinned.target))}. Preened: ${spaced(text(compared.role))}, ${spaced(text(compared.target))}. ${spaced(text(comparison.summary))}.`
        : comparison?.active === true && pinned && compared
          ? ` Comparing pinned ${text(pinned.name)}, ${number(pinned.cost) ?? 0} Wingbeats, ${spaced(text(pinned.role))}, ${spaced(text(pinned.target))}, with selected ${text(compared.name)}, ${number(compared.cost) ?? 0} Wingbeats, ${spaced(text(compared.role))}, ${spaced(text(compared.target))}.`
        : pinned
          ? ` Pinned ${text(pinned.name)}. Choose another card to compare.`
          : '';
      return `Deck review. ${visible} of ${total} cards. Filter ${filter}. Sort ${sort}.${query ? ` Find ${query}.` : ''} Selected ${selectedName}${selectedCost === undefined ? '' : `, ${selectedCost} Wingbeats`}.${comparisonSummary} Use Up and Down to choose a card, Previous and Next to change filter, Confirm to change sort, C or controller X to pin a comparison; pin the selected card to compare Base and Preened, slash to find, and Back to close.`;
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
    const resources = hp === undefined || maxHp === undefined
      ? ''
      : ` Cohesion ${hp} of ${maxHp}.${scrap === undefined ? '' : ` Scrap ${scrap}.`}`;
    return `Route, ${mapName}. Selected ${nodeLabel}${risk ? `, ${risk} risk` : ''}.${resources} Press Confirm to inspect or commit.`;
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
    const hunt = isRecord(payload.collectionHunt) ? payload.collectionHunt : undefined;
    const ownership = isRecord(payload.cardOwnership) ? payload.cardOwnership : undefined;
    const collectionLens = isRecord(payload.cardCollectionLens) ? payload.cardCollectionLens : undefined;
    const cardSearch = isRecord(payload.cardSearch) ? payload.cardSearch : undefined;
    const cardSort = isRecord(payload.cardSort) ? payload.cardSort : undefined;
    const detailOwnership = isRecord(ownership?.detail) ? ownership.detail : undefined;
    const collectedCount = number(ownership?.collectedCount) ?? 0;
    const discoveredCount = number(payload.cardsDiscovered) ?? 0;
    const detailFavorite = favorites?.detailFavorite === true;
    const favoriteView = favorites?.viewActive === true;
    const favoriteViewEmpty = favorites?.viewEmpty === true;
    const favoriteCount = number(favorites?.count) ?? 0;
    const detailTargeted = hunt?.detailTargeted === true;
    const canTarget = hunt?.detailCanTarget === true;
    const huntView = hunt?.viewActive === true;
    const huntViewEmpty = hunt?.viewEmpty === true;
    const huntCount = number(hunt?.count) ?? 0;
    const huntCapacity = number(hunt?.capacity) ?? 3;
    const huntCompleted = number(hunt?.completed) ?? 0;
    const lensLabel = spaced(text(collectionLens?.label)) || 'all';
    const lensVisible = number(collectionLens?.visibleCount) ?? 0;
    const lensBase = number(collectionLens?.baseCount) ?? 0;
    const searchQuery = text(cardSearch?.query);
    const searchScope = spaced(text(cardSearch?.scope)) || 'current set';
    const searchMatches = number(cardSearch?.matchCount) ?? 0;
    const searchVisible = number(cardSearch?.visibleCount) ?? 0;
    const sortLabel = spaced(text(cardSort?.label)) || 'binder';
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
    const ownershipState = section === 'cards'
      ? detail
        ? detailOwnership
          ? ` Collected permanently, with ${number(detailOwnership.timesClaimed) ?? 1} flight claims. Playable copies and upgrades are specific to each flight.`
          : ' Discovered but not yet collected. Claim it during a flight to create its permanent collection record.'
        : ` ${collectedCount} collected and ${discoveredCount} discovered.`
      : '';
    const collectionLensState = section === 'cards' && !detail
      ? ` Collection lens ${lensLabel}, showing ${lensVisible} of ${lensBase} ${cardSearch?.active === true ? 'search matches' : 'cards in this set'}.${collectionLens?.empty === true ? ' No cards match this lens.' : ''} Use L or controller LB to change the lens.`
      : '';
    const cardSearchState = section === 'cards' && !detail
      ? cardSearch?.editing === true
        ? ` Find cards field active.${searchQuery ? ` Current query ${searchQuery}.` : ''} Type to filter, Enter to apply, or Escape to cancel.`
        : searchQuery
          ? ` Find cards query ${searchQuery}, ${searchMatches} match${searchMatches === 1 ? '' : 'es'} in ${searchScope}; ${searchVisible} visible after the collection lens.${cardSearch?.empty === true ? ' No cards match this search.' : ''} Use slash or controller RB to edit or clear it.`
          : ' Use slash or controller RB to find cards by name, rules, keyword, character, set, type, cost, rarity, or ownership.'
      : '';
    const cardSortState = section === 'cards' && !detail
      ? ` Sorted by ${sortLabel}. Use R or controller RT to change sorting.`
      : '';
    return `Codex, ${section}.${focusLabel ? ` ${focusLabel}.` : ''}${itemPosition}${detail ? ' Detail open.' : ''}${favoriteState}${favoriteViewState}${huntState}${huntViewState}${ownershipState}${cardSearchState}${cardSortState}${collectionLensState} ${detail ? 'Use Up and Down to scroll, then Confirm or Back to close.' : 'Use Tab to change focus, Previous and Next to navigate, and Confirm to select.'}`;
  }
  return scene ? `${spaced(scene)}.` : '';
}
