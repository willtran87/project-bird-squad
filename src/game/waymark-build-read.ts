export interface WaymarkBuildRead {
  notes: string[];
  tags: string[];
}

export function renderWaymarkBuildTags(
  context: { scene: any; target: any; fontFamily: string; boldFontStyle: string; goldColor: string },
  x: number,
  y: number,
  tags: string[],
  accent: number,
  maxWidth: number,
) {
  let cursor = x;
  tags.slice(0, 3).forEach((tag) => {
    const width = Math.max(70, Math.min(132, tag.length * 7 + 24));
    if (cursor + width > x + maxWidth) {
      cursor = x;
      y += 24;
    }
    context.target.add(context.scene.add.rectangle(cursor + width / 2, y, width, 22, 0x1d3047, 0.98)
      .setStrokeStyle(1, accent, 0.95)
      .setName('reward-waymark-build-chip'));
    context.target.add(context.scene.add.text(cursor + width / 2, y, tag, {
      fontFamily: context.fontFamily,
      fontSize: '10px',
      fontStyle: context.boldFontStyle,
      color: context.goldColor,
      align: 'center',
      fixedWidth: width - 8,
      maxLines: 1,
    }).setResolution(2).setOrigin(0.5).setName('reward-waymark-build-observation'));
    cursor += width + 8;
  });
}

export function waymarkBuildRead(
  mark: { trigger: string; familyLabel: string },
  cards: any[],
  supplyCount: number,
  familyCount: number,
): WaymarkBuildRead {
  const notes: string[] = [];
  const tags: string[] = [];
  const add = (note: string, tag: string) => {
    notes.push(note);
    tags.push(tag);
  };
  const suit = /^onSuitPlayed\(([^)]+)\)$/.exec(mark.trigger)?.[1];
  if (suit) {
    const count = cards.filter((card) => card.runtime?.suit === suit).length;
    add(`${count ? '+' : '!'} ${count} ${suit} card${count === 1 ? '' : 's'} ${count === 1 ? 'triggers' : 'trigger'} it`, `${count ? '+' : '!'} ${count} ${suit}`);
  } else if (mark.trigger === 'onSupplyUsed') {
    add(`${supplyCount ? '+' : '!'} ${supplyCount} packed Suppl${supplyCount === 1 ? 'y' : 'ies'} ${supplyCount === 1 ? 'triggers' : 'trigger'} it`, `${supplyCount ? '+' : '!'} ${supplyCount} SUPPLY`);
  } else if (mark.trigger === 'onEnterMolt') {
    const count = cards.filter((card) => card.type === 'molt' || card.moltText).length;
    add(`${count ? '+' : '!'} ${count} Molt card${count === 1 ? '' : 's'} ${count === 1 ? 'triggers' : 'trigger'} it`, `${count ? '+' : '!'} ${count} MOLT`);
  } else if (mark.trigger === 'onEnemyCoverBroken') {
    const count = cards.filter((card) => /removeCover|damagePierce/.test(`${card.text} ${card.upgradedText}`)).length;
    add(`${count ? '+' : '!'} ${count} anti-Cover card${count === 1 ? '' : 's'} ${count === 1 ? 'enables' : 'enable'} it`, `${count ? '+' : '!'} ${count} ANTI-COVER`);
  } else if (mark.trigger === 'onResonanceSpent') {
    const count = cards.filter((card) => /spendResonance/.test(`${card.text} ${card.upgradedText}`)).length;
    add(`${count ? '+' : '!'} ${count} Resonance spender${count === 1 ? '' : 's'} ${count === 1 ? 'enables' : 'enable'} it`, `${count ? '+' : '!'} ${count} SPENDERS`);
  } else if (mark.trigger === 'onHealFlock' || mark.trigger === 'basinHeal') {
    const count = cards.filter((card) => /\bheal\(|overhealCover/.test(`${card.text} ${card.upgradedText}`)).length;
    add(`${count ? '+' : '!'} ${count} recovery card${count === 1 ? '' : 's'} ${count === 1 ? 'triggers' : 'trigger'} it`, `${count ? '+' : '!'} ${count} RECOVERY`);
  } else {
    const trigger = mark.trigger
      .replace(/\([^)]*\)/g, '')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .toLowerCase();
    const known: Record<string, [string, string]> = {
      afterMarketPurchase: ['Rewards later Market purchases', '+ MARKET BUY'],
      afterStreetEncounter: ['Rewards later Street victories', '+ STREET WIN'],
      cacheChoice: ['Rewards later Cache choices', '+ CACHE'],
      combatStart: ['Reliable every-combat opening', '+ COMBAT START'],
      firstOpenSkyIncrease: ['Answers the first Open Sky rise', '+ OPEN SKY'],
      mapStart: ['Prepares the next district', '+ NEXT DISTRICT'],
      onLowCardTurn: ['Rewards restrained card turns', '+ LOW-CARD TURN'],
      onRoostWithCardsInHand: ['Rewards cards banked at Roost', '+ BANKED CARDS'],
      onRoostWithWingbeat: ['Rewards Wingbeats banked at Roost', '+ BANKED ENERGY'],
      onTurnEndNoHpLoss: ['Rewards fully guarded Beats', '+ CLEAN BEAT'],
      onTurnEndNoOverextension: ['Rewards restrained card turns', '+ RESTRAINT'],
      signalResolved: ['Rewards later Signal choices', '+ SIGNAL'],
    };
    const read = known[mark.trigger];
    add(`+ ${read?.[0] ?? `Reliable ${trigger} trigger`}`, read?.[1] ?? `+ ${trigger.toUpperCase()}`);
  }
  add(`+ ${familyCount ? `Joins ${familyCount}` : 'Starts a'} ${mark.familyLabel} lane`, familyCount ? `+ ${familyCount} ${mark.familyLabel}` : `+ NEW ${mark.familyLabel}`);
  return { notes: notes.slice(0, 2), tags: tags.slice(0, 2) };
}
