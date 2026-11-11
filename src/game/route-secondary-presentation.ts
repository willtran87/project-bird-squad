import { setTextureFilter } from './texture-filter';
// Optional market and card-picker presentation, loaded only when opened.
import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, MARKET_KIT_ASSETS, MENU_BORDER_WIDTH, MIN_SUPPORTED_TOUCH_TARGET, TOKEN_DISPLAY_FONT, UI_BOLD, UI_CYAN, UI_FIELD, UI_FONT, UI_GOLD, addSupplyArtImage, addUiIconImage, addWaymarkArtImage, alphaRouteMarkLibrary, alphaSupplyLibrary, buttonIconForLabel, cardStatEntries, clamp, cloneCard, compactCardArtKey, controlBindingLabel, currentMap, displayName, fitTextExcerpt, flockStatLabel, playUiSound, prefersReducedMotion, quietButton, renderFieldPanel, renderSnagCardBorder, suitAccentColor, supplyCompactArtAssets, uiIconAssets, waymarkCompactArtAssets, waymarkGlyph } from '../main';
import type { UiIconId, Card, MarketCardListing, MarketWaymarkListing, MarketUtilityListing } from '../main';

export function renderCardPickerScrollButton(this: any, x: number, y: number, direction: 'up' | 'down', enabled: boolean, onClick: () => void): any {
    return quietButton(this, { x, y, width: 72, label: direction === 'up' ? 'Up' : 'Down', enabled,
      name: `card-picker-scroll-${direction}-hit`, onActivate: () => { playUiSound('confirm'); onClick(); } });
  }

export function renderCardPickerPageIndicatorFrame(this: any, x: number, y: number): any {
    this.add.rectangle(x, y, 88, 34, 0x050b12, 0.96)
      .setStrokeStyle(1, UI_FIELD.cyan, 0.5)
      .setName('card-picker-page-indicator-frame');
  }

export function renderCardPickerOverlay(this: any, ): any {
    const mode = this.cardPickerMode;
    if (!mode) return;
    const isMarketPicker = this.cardPickerContext === 'market';
    const isDistrictPreen = this.cardPickerContext === 'districtPreen';
    const eligible: Array<{ index: number; card: Card; name: string; cost: number; upgraded: boolean }> = this.pickerEligibleCards(mode);
    const node = currentMap().nodes.find((candidate) => candidate.id === (isMarketPicker ? this.marketNodeId : this.nodeChoiceNodeId));
    const accent = mode === 'preen' ? UI_FIELD.cyan : UI_FIELD.danger;
    const columns = 5;
    const visibleCount = 10;
    const rowGap = 192;
    const remainingPicks = Math.max(1, this.cardPickerRemainingPicks || 1);
    const maxScroll = this.cardPickerMaxScroll(eligible.length);
    this.cardPickerScroll = clamp(this.cardPickerScroll, 0, maxScroll);
    const firstVisible = this.cardPickerScroll * columns;
    const visible = eligible.slice(firstVisible, firstVisible + visibleCount);
    this.queueCardPickerArtLoad(visible);
    if (isMarketPicker) {
      this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x020409, 0.94)
        .setInteractive({ useHandCursor: false });
    } else {
      this.renderRouteEventBackdrop(node, 0.82);
    }
    const frame = renderFieldPanel(this, () => {}, GAME_WIDTH / 2, GAME_HEIGHT / 2 + 8, 1040, 558, {
      accent,
      fill: mode === 'preen' ? 0x071824 : 0x1b1114
    });
    // Leave the shared eight-pixel gap below the 19px input hint.
    this.add.text(frame.left + 28, frame.top + 13, mode === 'preen'
        ? remainingPicks > 1 ? `Preen ${remainingPicks} Cards${isDistrictPreen ? ' · Free' : ''}` : isDistrictPreen ? 'Choose a Free Preen' : 'Preen a Card'
        : remainingPicks > 1 ? `Remove ${remainingPicks} Cards` : 'Remove a Card', {
      fontFamily: UI_FONT, fontSize: '28px', fontStyle: UI_BOLD, color: UI_GOLD, resolution: 2,
    }).setName('card-picker-title');
    this.add.text(frame.left + 28, frame.top + 50, mode === 'preen'
        ? isMarketPicker
          ? 'Select a card, then confirm again to improve it and pay Scrap.'
          : isDistrictPreen
            ? 'Choose exactly which card improves before this district. Skipping changes nothing.'
            : 'Select a card, then confirm again to improve it.'
        : isMarketPicker ? 'Select a card, then confirm again to remove it and pay Scrap.' : 'Select a card, then confirm again to remove it.', {
      fontFamily: UI_FONT, fontSize: '18px', color: '#c7d4df', resolution: 2,
      wordWrap: { width: frame.w - 56 },
    }).setName('card-picker-subtitle');
    this.add.text(frame.left + 28, frame.top + 86, '', {
      fontFamily: UI_FONT,
      fontSize: '19px',
      fontStyle: UI_BOLD,
      color: '#bfe8f4',
    }).setResolution(2).setOrigin(0, 0.5).setName('card-picker-input-hint');
    let armedConfirmation: { name: string; cost: number; delta: string } | undefined;
    visible.forEach((entry, i) => {
      const cardW = 66;
      const cardH = Math.round(cardW * 1.5);
      const x = frame.left + 108 + (i % columns) * 177;
      const y = frame.top + 178 + Math.floor(i / columns) * rowGap;
      const affordable = !isMarketPicker || this.runState.scrap >= entry.cost;
      const armed = this.cardPickerArmedIndex === entry.index;
      this.add.rectangle(x, y + 19, 162, 184, 0x030b13, 0.94)
        .setStrokeStyle(1, armed ? UI_FIELD.gold : 0x344654, armed ? 1 : 0.65)
        .setName('card-picker-choice-plate');
      const key = compactCardArtKey(entry.card);
      if (key && this.textures.exists(key)) {
        this.add.image(x, y, key)
          .setDisplaySize(cardW, cardH)
          .setAlpha(affordable ? 1 : 0.48);
      } else if (!renderSnagCardBorder(this, undefined, entry.card, x, y, cardW, cardH, affordable ? 1 : 0.48)) {
        this.add.rectangle(x, y, cardW, cardH, affordable ? 0x101b2a : 0x0a0e15, affordable ? 0.96 : 0.78)
          .setStrokeStyle(1.5, affordable ? accent : 0x3f4c58, affordable ? 0.74 : 0.48);
      } else {
        this.add.rectangle(x, y, cardW, cardH, 0x05101a, 0.12);
      }
      if (isMarketPicker) {
        this.add.text(x, y - 64, `${entry.cost} Scrap`, {
          fontFamily: UI_FONT,
          fontSize: '21px',
          fontStyle: UI_BOLD,
          color: affordable ? (entry.cost === 0 ? '#8df4ff' : '#ffe1a3') : '#91a6b8',
          resolution: 2,
        }).setOrigin(0.5).setName('card-picker-price');
      }
      const name = `${entry.name}${entry.upgraded ? '+' : ''}`;
      const nameLabel = this.add.text(x, y + 54, name, {
        fontFamily: UI_FONT,
        fontSize: '21px',
        fontStyle: UI_BOLD,
        color: affordable ? '#ffe1a3' : '#91a6b8',
        align: 'center',
        wordWrap: { width: 146, useAdvancedWrap: true }, resolution: 2,
      }).setOrigin(0.5, 0).setName('card-picker-card-name');
      fitTextExcerpt(nameLabel, name, 2);
      const decisionDelta = this.routeRewardInteractionModule()?.cardPickerDecisionDelta(
        this.runState.deck.length,
        mode,
        entry.card,
        cardStatEntries,
        flockStatLabel,
      ) ?? (mode === 'release'
        ? `DECK ${this.runState.deck.length} > ${Math.max(0, this.runState.deck.length - 1)}`
        : 'ABILITY\n> IMPROVED');
      if (armed) armedConfirmation = { name: `${entry.name}${entry.upgraded ? '+' : ''}`, cost: entry.cost, delta: decisionDelta };
      const button = this.add.rectangle(x, y + 19, 162, 184, 0x000000, 0.01)
        .setInteractive({ useHandCursor: affordable })
        .setName('card-picker-card-hit').setData('decisionDelta', decisionDelta);
      if (affordable) button.on('pointerdown', () => this.requestCardPick(entry.index));
      this.cardHoverDetailModule?.renderCardPickerInput(
        this, button, entry, x, y, cardW, cardH, accent, firstVisible + i,
      );
    });
    if (armedConfirmation) {
      this.cardHoverDetailModule?.renderCardPickerConfirmationRail(this, frame, {
        mode,
        ...armedConfirmation,
        isMarketPicker,
      });
    }
    if (eligible.length > visibleCount) {
      const scrollX = frame.right - 44;
      this.renderCardPickerScrollButton(scrollX, frame.top + 184, 'up', this.cardPickerScroll > 0, () => this.scrollCardPicker(-1));
      this.renderCardPickerScrollButton(scrollX, frame.top + 184 + rowGap, 'down', this.cardPickerScroll < maxScroll, () => this.scrollCardPicker(1));
      const indicatorY = frame.top + 232 + rowGap;
      this.renderCardPickerPageIndicatorFrame(scrollX, indicatorY);
      this.add.text(scrollX, indicatorY, `${firstVisible + 1}-${firstVisible + visible.length} OF ${eligible.length}`, {
        fontFamily: UI_FONT,
        fontSize: '13px',
        fontStyle: UI_BOLD,
        color: '#c5e8f5',
        align: 'center',
        fixedWidth: 82,
        stroke: '#05080e',
        strokeThickness: 2
      }).setOrigin(0.5);
    }
    const back = quietButton(this, { x: 228, y: 610, width: 176,
      label: isMarketPicker ? 'Back to Market' : isDistrictPreen ? (remainingPicks > 1 ? 'Skip Remaining' : 'Skip Preen') : 'Cancel',
      name: 'route-event-cancel-hit', onActivate: () => isMarketPicker ? this.cancelMarketCardPicker() : this.cancelRouteCardPicker() });
    back.getData('labelObject').setName('card-picker-back-label');
    this.renderRouteCardArtRetry(1060, 118);
    this.cardHoverDetailModule?.renderCardPickerInspection(
      this, GAME_WIDTH, GAME_HEIGHT, controlBindingLabel('back'),
    );
  }

export function renderMarketOverlay(this: any, ): any {
    this.queueMarketShelfArtLoad();
    const node = currentMap().nodes.find((candidate) => candidate.id === this.marketNodeId);
    this.renderRouteEventBackdrop(node, 0.52);
    const frame = {
      left: 62,
      right: GAME_WIDTH - 62,
      top: 102,
      bottom: GAME_HEIGHT - 32,
      cx: GAME_WIDTH / 2,
      w: GAME_WIDTH - 124
    };

    this.renderMarketSceneBackdrop(frame);
    this.renderMarketVendor(frame);
    this.renderMarketVendorTitle(frame);
    if (!this.cardPickerMode) this.renderRouteCardArtRetry(this.marketCategory === 'catalog' ? 986 : 626, 122);
    if (this.marketCategory !== 'catalog') {
      const servicesFocused = this.marketCategory === 'services';
      this.add.rectangle(
        servicesFocused ? 830 : 820,
        432,
        servicesFocused ? 600 : 770,
        servicesFocused ? 400 : 470,
        0x020409,
        servicesFocused ? 0.58 : 0.34,
      )
        .setStrokeStyle(1, 0x49606d, servicesFocused ? 0.26 : 0.14)
        .setName('market-merchandise-scrim')
        .setData('category', this.marketCategory);
    }

    this.renderMarketCategoryTabs(frame);
    if (this.marketCategory === 'catalog') {
      const cardShelfY = frame.top + 252;
      const goodsRowY = frame.top + 492;
      this.renderMarketSectionHeader(frame.left + 576, frame.top + 80, 680, 'Crew Cards', 'Permanent deck options', UI_FIELD.gold);
      this.renderMarketSectionHeader(frame.left + 458, goodsRowY - 84, 330, 'Waymarks', 'Run modifiers', UI_FIELD.violet);
      this.renderMarketSectionHeader(frame.right - 124, frame.top + 80, 240, 'Services', 'Deck tuning', UI_FIELD.cyan);
      this.renderMarketSectionHeader(frame.left + 810, goodsRowY - 84, 300, 'Supplies', 'One-use tools', UI_FIELD.green);
      this.renderMarketCardOffers(frame.left + 576, cardShelfY);
      this.renderMarketWaymarkOffers(frame.left + 458, goodsRowY);
      this.renderMarketUtilityOffers(frame.left + 810, frame.top + 292, goodsRowY);
    } else if (this.marketCategory === 'cards') {
      this.renderMarketSectionHeader(852, frame.top + 132, 640, 'Crew Cards', 'Permanent deck options', UI_FIELD.gold);
      this.renderMarketCardOffers(640, frame.top + 356);
    } else if (this.marketCategory === 'waymarks') {
      this.renderMarketSectionHeader(820, frame.top + 132, 540, 'Waymarks', 'Run modifiers', UI_FIELD.violet);
      this.renderMarketWaymarkOffers(760, frame.top + 354);
    } else if (this.marketCategory === 'supplies') {
      this.renderMarketSectionHeader(820, frame.top + 132, 540, 'Supplies', 'One-use tools', UI_FIELD.green);
      this.renderMarketUtilityOffers(760, frame.top + 250, frame.top + 354, 'supplies');
    } else {
      this.renderMarketSectionHeader(820, frame.top + 132, 540, 'Services', 'Deck tuning and route preparation', UI_FIELD.cyan);
      this.renderMarketUtilityOffers(480, frame.top + 254, undefined, 'services');
    }

    if (!this.cardPickerMode) {
      this.cardHoverDetailModule?.bindMarketInputs(this);
      if (this.cardHoverDetailRequest?.marketCardId) this.renderHoverCardDetailRequest();
      this.cardHoverDetailModule?.renderMarketInputHelp(this, 716, frame.bottom - 8);
    }
  }

export function renderMarketSectionHeader(this: any, x: number, y: number, w: number, title: string, subtitle: string, accent: number): any {
    this.cardHoverDetailModule?.renderMarketSectionHeader(
      this,
      x,
      y,
      w,
      title,
      subtitle,
      accent,
      uiIconAssets['market-section-header-frame'].key
    );
  }

export function renderMarketVendorTitle(this: any, frame: { cx: number; top: number }): any {
    const x = this.marketCategory === 'catalog' ? frame.cx : 858;
    const y = frame.top + 38;
    const w = 408;
    const h = 48;
    const key = uiIconAssets['market-vendor-title-plaque'].key;
    const hasPlaque = this.marketCategory === 'catalog' && this.textures.exists(key);
    if (hasPlaque) {
      setTextureFilter(this.textures.get(key), Phaser.Textures.FilterMode.LINEAR);
      this.add.image(x, y - 2, key)
        .setDisplaySize(500, 104)
        .setAlpha(0.92)
        .setName('market-vendor-title-plaque');
      this.add.rectangle(x, y + 1, w - 48, h - 14, 0x020409, 0.14);
    } else {
      this.add.rectangle(x, y, 642, 64, 0x0b151f, 1).setName('market-vendor-title-surface');
    }
    this.add.text(x, y - 16, 'Veyra Tallybright', {
      fontFamily: UI_FONT,
      fontSize: '24px',
      fontStyle: UI_BOLD,
      color: UI_GOLD,
      stroke: '#020409',
      strokeThickness: 0,
      align: 'center'
    }).setOrigin(0.5, 0);
    this.add.text(x, y + 14, 'Canal curator', {
      fontFamily: UI_FONT,
      fontSize: '18px',
      fontStyle: UI_BOLD,
      color: UI_CYAN,
      align: 'center'
    }).setOrigin(0.5, 0);
  }

export function renderMarketSceneBackdrop(this: any, frame: { left: number; right: number; top: number; bottom: number; cx: number; w: number }): any {
    const backgroundKey = MARKET_KIT_ASSETS.background.key;
    const signKey = MARKET_KIT_ASSETS.sign.key;
    const counterKey = MARKET_KIT_ASSETS.counter.key;
    const hasBackground = this.textures.exists(backgroundKey);

    // Market owns this decision surface, including while its art is loading.
    // Never let map instructions or future route paths bleed through the shop.
    this.add.rectangle(640, 400, 1280, 640, 0x0b151f, 1).setName('market-opaque-backdrop');

    if (hasBackground) {
      this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, backgroundKey)
        .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
        .setAlpha(1);
      this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x020409,
        this.marketCategory === 'catalog' ? 0.34 : 0.54).setName('market-background-scrim');
    } else {
      this.add.rectangle(frame.cx, frame.top + 360, frame.w - 86, 460, 0x080604, 0.28)
        .setStrokeStyle(1, UI_FIELD.gold, 0.14);
      for (let i = 0; i < 17; i += 1) {
        const lx = frame.left + 118 + i * 52;
        this.add.line(lx - 24, frame.top + 210, 0, 0, 48, i % 2 === 0 ? 8 : -3, UI_FIELD.gold, 0.34);
        this.add.circle(lx, frame.top + 213 + (i % 2) * 7, 4, i % 3 === 0 ? 0x8df4ff : 0xf0c36f, 0.86);
      }
    }

    if (this.marketCategory === 'catalog' && this.textures.exists(signKey)) {
      this.add.image(frame.cx, frame.top + 160, signKey)
        .setDisplaySize(486, 274)
        .setAlpha(1);
    } else if (this.marketCategory === 'catalog') {
      this.add.rectangle(frame.cx, frame.top + 168, 456, 58, 0x241708, 0.86)
        .setStrokeStyle(1, UI_FIELD.gold, 0.52);
    }

    if (this.textures.exists(counterKey)) {
      this.add.image(frame.cx + 44, frame.bottom + 8, counterKey)
        .setOrigin(0.5, 1)
        .setDisplaySize(982, 524)
        .setAlpha(this.marketCategory === 'catalog' ? 0.34 : 0.12);
    } else {
      this.add.rectangle(frame.cx + 26, frame.bottom - 108, frame.w - 164, 128, 0x130c06, 0.96)
        .setStrokeStyle(2, 0x7b4f18, 0.88);
      this.add.rectangle(frame.cx + 26, frame.bottom - 166, frame.w - 138, 18, 0x321f0d, 0.98)
        .setStrokeStyle(1, UI_FIELD.gold, 0.48);
    }

  }

export function renderMarketVendor(this: any, frame: { left: number; top: number; bottom: number }): any {
    const catalog = this.marketCategory === 'catalog';
    const x = catalog ? frame.left + 90 : 492;
    const y = catalog ? frame.bottom : 164;
    const shopkeeperKey = MARKET_KIT_ASSETS.shopkeeper.key;
    if (this.textures.exists(shopkeeperKey)) {
      const texture = this.textures.get(shopkeeperKey);
      // Authored head-and-shoulders region of the 768x960 resident export.
      // A texture frame preserves proportions and actual bounds (unlike scaling
      // the full-body sprite down until the face is only a handful of pixels).
      if (!texture.has('portrait')) texture.add('portrait', 0, 350, 40, 410, 400);
      if (catalog) this.add.ellipse(x + 8, y - 19, 254, 42, 0x020409, 0.5);
      const vendor = this.add.image(x, y, shopkeeperKey, catalog ? undefined : 'portrait')
        .setOrigin(0.5, 1)
        .setAlpha(1)
        .setDepth(20);
      vendor.setName('market-vendor-shopkeeper');
      this.fitImageInside(vendor, catalog ? 300 : 82, catalog ? 460 : 80);
      if (catalog && !prefersReducedMotion()) this.animateMarketVendorIdle(vendor);
      return;
    }

    // The named vendor header and usable market remain while artwork is pending;
    // never substitute an unrelated geometric character during load/failure.
  }

export function renderMarketCategoryTabs(this: any, frame: { top: number }): any {
    this.cardHoverDetailModule?.renderMarketCategoryTabs(
      this,
      frame.top,
      MIN_SUPPORTED_TOUCH_TARGET,
      [UI_FIELD.gold, UI_FIELD.violet, UI_FIELD.green, UI_FIELD.cyan]
    );
  }

export function renderMarketCardOffers(this: any, x: number, y: number): any {
    if (this.marketCardShelf.length === 0) {
      this.add.rectangle(x, y - 6, 420, 78, 0x020409, 0.42)
        .setStrokeStyle(1, 0x6f6044, 0.34);
      this.add.text(x, y - 24, 'Every available crew card is already in the flock.', {
        fontFamily: UI_FONT,
        fontSize: '15px',
        color: '#d7c5a6',
        align: 'center',
        wordWrap: { width: 360 },
        maxLines: 2
      }).setOrigin(0.5, 0);
      return;
    }
    this.marketCardShelf.forEach((listing: MarketCardListing, i: number) => {
      const card = cloneCard(listing.id);
      const focusedShelf = this.marketCategory === 'cards';
      const artW = focusedShelf ? 148 : 176;
      const artH = Math.round(artW * 1.5);
      const cardW = artW + 8;
      const cardH = artH + 8;
      const cardX = focusedShelf ? 606 + i * 168 : x - 290 + i * 175;
      const cardY = focusedShelf ? 410 : y - 4 + (i % 2 === 0 ? -8 : 8);
      const enabled = !listing.sold && this.runState.scrap >= listing.price;
      const accent = card.type === 'major' ? 0xd8a840 : card.type === 'molt' ? 0xc56cff : suitAccentColor(card);
      if (focusedShelf) this.add.rectangle(cardX, 461, 156, 338, 0x080f18, 0.98)
        .setStrokeStyle(1, accent, 0.4).setName('market-card-offer-frame');
      this.add.rectangle(cardX + 5, cardY + 8, cardW - 18, cardH - 18, 0x020409, 0.5);
      const key = compactCardArtKey(card);
      if (key && this.textures.exists(key)) {
        this.add.image(cardX, cardY, key)
          .setDisplaySize(artW, artH)
          .setAlpha(1);
      } else if (!renderSnagCardBorder(this, undefined, card, cardX, cardY, artW, artH, 1)) {
        this.add.rectangle(cardX, cardY, artW, artH, 0x101b2a, 0.98)
          .setStrokeStyle(1, accent, 0.6).setName('market-card-art-placeholder').setData('cardId', card.id);
      } else {
        this.add.rectangle(cardX, cardY, artW, artH, 0x05101a, 0.12);
      }
      if (focusedShelf) {
        const title = this.add.text(cardX - 68, 534, displayName(card), {
          fontFamily: UI_FONT, fontSize: '21px', resolution: 2, color: '#e6eef6',
          wordWrap: { width: 136, useAdvancedWrap: true }, lineSpacing: 2,
        }).setName('market-card-offer-title').setData('fullTitle', displayName(card));
        const lines = title.getWrappedText();
        let excerpt = lines.slice(0, 3).join('\n');
        title.setText(excerpt + (lines.length > 3 ? '…' : ''));
        while (title.height > 64 && excerpt.length) { excerpt = excerpt.slice(0, -1).trimEnd(); title.setText(`${excerpt}…`); }
        this.add.text(cardX, 614, listing.sold ? 'Sold' : `${listing.price} Scrap`, {
          fontFamily: UI_FONT, fontSize: '21px', resolution: 2,
          color: listing.sold ? '#abc4d4' : enabled ? UI_CYAN : '#ffc7a4',
        }).setOrigin(0.5).setName('market-card-price');
      } else this.renderMarketPriceTag(cardX, cardY + artH / 2 + 2, listing.price, enabled, accent, 'BUY');
      if (listing.sold) this.renderMarketSoldSlat(cardX, cardY, cardW, cardH);
      if (!listing.sold) {
        const hit = this.add.rectangle(cardX, focusedShelf ? 461 : cardY + 8, focusedShelf ? 156 : cardW + 12, focusedShelf ? 338 : cardH + 34, 0x000000, 0.01)
          .setInteractive({ useHandCursor: enabled })
          .setData('marketFocusId', `card:${i}`).setData('marketAvailable', enabled)
          .setData('label', displayName(card));
        hit.on('pointerover', () => this.showHoverCardDetail(
          card,
          'Market offer',
          listing.price,
          cardX,
          cardY,
          this.marketCardDecisionPreview(listing)
        ));
        // Keep rules reachable when the pointer moves from the offer to its pager.
      }
    });
  }

export function renderMarketWaymarkOffers(this: any, x: number, rowY: number): any {
    if (this.marketWaymarkShelf.length === 0) {
      this.add.rectangle(x, rowY + 22, 300, 72, 0x020409, 0.34)
        .setStrokeStyle(1, 0x6f6044, 0.28);
      this.add.text(x, rowY - 4, 'No unclaimed pins remain in this market.', {
        fontFamily: UI_FONT,
        fontSize: '13px',
        color: '#d7c5a6',
        align: 'center',
        wordWrap: { width: 260 },
        maxLines: 2
      }).setOrigin(0.5, 0);
      return;
    }
    this.marketWaymarkShelf.forEach((listing: MarketWaymarkListing, i: number) => {
      const mark = alphaRouteMarkLibrary.get(listing.id);
      if (!mark) return;
      const itemX = x - 134 + i * 134;
      const enabled = !listing.sold && this.runState.scrap >= listing.price;
      const key = waymarkCompactArtAssets[mark.id]?.key;
      if (this.marketCategory === 'waymarks' && this.cardHoverDetailModule) {
        this.cardHoverDetailModule.renderMarketMerchandise(this, {
          index: i, title: mark.name, price: listing.price, enabled, sold: listing.sold,
          accent: UI_FIELD.gold, artKey: key, kind: 'waymark', focusId: `waymark:${i}`,
          onInspect: () => this.showMarketWaymarkDetail(mark, listing.price, itemX, rowY),
        });
        return;
      }
      this.renderMarketObjectBackplate(itemX, rowY - 16, 112, 94, enabled ? UI_FIELD.gold : 0x3f4c58);
      const badge = addUiIconImage(this, 'market-waymark-badge', itemX, rowY - 16, 44);
      if (badge) {
        badge.setAlpha(enabled ? 0.98 : 0.46);
      } else if (key && this.textures.exists(key)) addWaymarkArtImage(this, itemX, rowY - 16, key).setDisplaySize(96, 96).setAlpha(1);
      else {
        this.add.text(itemX, rowY - 29, waymarkGlyph(mark), {
          fontFamily: TOKEN_DISPLAY_FONT,
          fontSize: '27px',
          fontStyle: UI_BOLD,
          color: '#fff1c7',
          stroke: '#020409',
          strokeThickness: 2
        }).setOrigin(0.5, 0);
      }
      this.renderMarketItemLabelBox(itemX, rowY + 68, 128, 48, 'WAYMARKER', mark.name, listing.price, enabled, UI_FIELD.gold);
      if (listing.sold) this.renderMarketSoldSlat(itemX, rowY + 24, 128, 126);
      if (!listing.sold) {
        const hit = this.add.rectangle(itemX, rowY + 24, 136, 160, 0x000000, 0.01)
          .setInteractive({ useHandCursor: enabled })
          .setData('marketFocusId', `waymark:${i}`).setData('marketAvailable', enabled)
          .setData('label', mark.name);
        hit.on('pointerover', () => this.showMarketWaymarkDetail(mark, listing.price, itemX, rowY));
      }
    });
  }

export function renderMarketUtilityOffers(this: any, x: number, y: number, goodsRowY?: number, view: 'all' | 'supplies' | 'services' = 'all'): any {
    if (view === 'services' && this.cardHoverDetailModule) {
      this.cardHoverDetailModule.renderMarketServices(this);
      return;
    }
    if (this.marketUtilityShelf.length === 0) {
      this.add.rectangle(x, y + 70, 220, 96, 0x020409, 0.34)
        .setStrokeStyle(1, 0x59606a, 0.24);
      this.add.text(x, y + 42, 'The benches are quiet. Your pouch may be full, or every card is settled.', {
        fontFamily: UI_FONT,
        fontSize: '13px',
        color: '#d7c5a6',
        align: 'center',
        wordWrap: { width: 190 },
        maxLines: 3
      }).setOrigin(0.5, 0);
      return;
    }
    let serviceIndex = 0;
    let supplyIndex = 0;
    const serviceBaseY = y - 44;
    this.marketUtilityShelf.forEach((listing: MarketUtilityListing, i: number) => {
      if (view === 'supplies' && listing.id !== 'supply') return;
      if (view === 'services' && listing.id === 'supply') return;
      const enabled = !listing.sold && this.marketUtilityEnabled(listing);
      const accent = listing.id === 'release' ? UI_FIELD.danger : listing.id === 'supply' ? UI_FIELD.green : UI_FIELD.cyan;
      const supply = listing.supplyId ? alphaSupplyLibrary.get(listing.supplyId) : undefined;
      const supplyKey = supply ? supplyCompactArtAssets[supply.id]?.key : undefined;
      if (listing.id !== 'supply') {
        const serviceY = serviceBaseY + serviceIndex * 58;
        const serviceX = x + 300;
        serviceIndex += 1;
        const serviceWidth = view === 'services' ? 340 : 144;
        this.renderMarketServiceButton(
          serviceX,
          serviceY,
          serviceWidth,
          48,
          this.marketUtilityServiceIcon(listing),
          listing.price,
          enabled,
          accent,
          this.marketUtilityLabel(listing)
        );
        if (listing.sold) this.renderMarketSoldSlat(serviceX, serviceY, serviceWidth + 2, 48);
        if (!listing.sold) {
          const hit = this.add.rectangle(serviceX, serviceY, serviceWidth + 10, MIN_SUPPORTED_TOUCH_TARGET, 0x000000, 0.01)
            .setInteractive({ useHandCursor: enabled })
            .setName('market-service-hit')
            .setData('marketFocusId', `utility:${i}`).setData('marketAvailable', enabled)
            .setData('label', this.marketUtilityLabel(listing));
          hit.on('pointerover', () => this.showMarketUtilityDetail(listing, serviceX, serviceY));
        }
        return;
      }

      const rowY = goodsRowY ?? y + 276;
      const supplyX = x - 72 + supplyIndex * 134;
      if (view === 'supplies' && this.cardHoverDetailModule) {
        this.cardHoverDetailModule.renderMarketMerchandise(this, {
          index: supplyIndex++, title: supply?.name ?? this.marketUtilityLabel(listing), price: listing.price,
          enabled, sold: listing.sold, accent, artKey: supplyKey, kind: 'supply', focusId: `utility:${i}`,
          onInspect: () => this.showMarketUtilityDetail(listing, supplyX, rowY),
        });
        return;
      }
      supplyIndex += 1;
      this.renderMarketObjectBackplate(supplyX, rowY - 16, 112, 94, enabled ? accent : 0x3f4c58);
      if (listing.supplyId) {
        const icon = addUiIconImage(this, 'market-supply-crate', supplyX, rowY - 16, 40);
        if (icon) {
          icon.setAlpha(enabled ? 0.98 : 0.46);
        } else if (supplyKey && this.textures.exists(supplyKey)) {
          addSupplyArtImage(this, supplyX, rowY - 16, supplyKey)
            .setDisplaySize(96, 96)
            .setAlpha(enabled ? 1 : 0.5);
        } else {
          this.add.text(supplyX, rowY - 26, 'S', {
            fontFamily: UI_FONT,
            fontSize: '17px',
            fontStyle: UI_BOLD,
            color: listing.sold ? '#596a78' : '#8df4ff',
            stroke: '#020409',
            strokeThickness: 2
          }).setOrigin(0.5, 0);
        }
      } else {
        const artAsset = this.marketUtilityProxyArtAsset(listing);
        if (artAsset && this.textures.exists(artAsset.key)) {
          this.add.image(supplyX, rowY - 16, artAsset.key)
            .setDisplaySize(96, 96)
            .setAlpha(1);
        } else if (listing.id === 'supply') {
          this.add.text(supplyX, rowY - 26, 'S', {
            fontFamily: UI_FONT,
            fontSize: '17px',
            fontStyle: UI_BOLD,
            color: listing.sold ? '#596a78' : '#8df4ff',
            stroke: '#020409',
            strokeThickness: 2
          }).setOrigin(0.5, 0);
        }
      }
      this.renderMarketItemLabelBox(
        supplyX,
        rowY + 68,
        128,
        48,
        'SUPPLY',
        this.marketUtilityLabel(listing),
        listing.price,
        enabled,
        accent
      );
      if (listing.sold) this.renderMarketSoldSlat(supplyX, rowY + 24, 128, 126);
      if (!listing.sold) {
        const hit = this.add.rectangle(supplyX, rowY + 24, 136, 160, 0x000000, 0.01)
          .setInteractive({ useHandCursor: enabled })
          .setData('marketFocusId', `utility:${i}`).setData('marketAvailable', enabled)
          .setData('label', this.marketUtilityLabel(listing));
        hit.on('pointerover', () => this.showMarketUtilityDetail(listing, supplyX, rowY));
      }
    });
    if (view === 'supplies') return;
    const refreshCost = this.marketRefreshCost();
    const refreshEnabled = this.runState.scrap >= refreshCost;
    const refreshX = x + 300;
    const refreshY = serviceBaseY + serviceIndex * 58;
    this.renderMarketServiceButton(
      refreshX,
      refreshY,
      view === 'services' ? 340 : 144,
      48,
      'market-refresh-service',
      refreshCost,
      refreshEnabled,
      UI_FIELD.cyan,
      'Refresh stock'
    );
    {
      const hit = this.add.rectangle(refreshX, refreshY, view === 'services' ? 350 : 154, MIN_SUPPORTED_TOUCH_TARGET, 0x000000, 0.01)
        .setInteractive({ useHandCursor: refreshEnabled })
        .setName('market-refresh-hit')
        .setData('marketFocusId', 'refresh')
        .setData('marketAvailable', refreshEnabled)
        .setData('label', 'Refresh stock');
      hit.on('pointerover', () => this.showMarketRefreshDetail(refreshCost, refreshX, refreshY));
    }
  }

export function renderMarketObjectBackplate(this: any, x: number, y: number, w: number, h: number, accent: number): any {
    this.add.rectangle(x, y, w, h, 0x07101a, 0.96)
      .setStrokeStyle(1, accent, 0.5).setName('market-object-backplate-frame');
  }

export function renderMarketOfferTray(this: any, x: number, y: number, w: number, h: number, enabled: boolean, alpha = 0.42): any {
    this.add.rectangle(x, y, w + 12, h + 8, 0x07101a, alpha)
      .setStrokeStyle(1, enabled ? UI_FIELD.brass : 0x49606d, 0.4).setName('market-offer-tray');
  }

export function renderMarketPriceChipFrame(this: any, x: number, y: number, w: number, h: number, enabled: boolean, alpha = 0.62): any {
    return this.add.rectangle(x, y, w, h, 0x07101a, alpha)
      .setStrokeStyle(1, enabled ? UI_FIELD.brass : 0x49606d, 0.4).setName('market-price-chip-frame');
  }

export function renderMarketItemLabelBox(this: any, x: number, y: number, w: number, h: number, kicker: string, title: string, price: number, enabled: boolean, accent: number): any {
    this.cardHoverDetailModule?.renderMarketCatalogLabel(this, x, y, w, h, kicker, title, price, enabled, accent);
  }

export function renderMarketItemLabelFrame(this: any, x: number, y: number, w: number, h: number, enabled: boolean): any {
    const key = uiIconAssets['market-item-label-frame'].key;
    if (!this.textures.exists(key)) return undefined;
    setTextureFilter(this.textures.get(key), Phaser.Textures.FilterMode.LINEAR);
    const frame = this.add.image(x, y, key)
      .setDisplaySize(w + 26, h + 14)
      .setAlpha(enabled ? 0.9 : 0.4)
      .setName('market-item-label-frame');
    if (!enabled) frame.setTint(0x798a9a);
    return frame;
  }

export function renderMarketServiceButton(this: any, x: number, y: number, w: number, h: number, iconId: UiIconId, price: number, enabled: boolean, accent: number, label?: string): any {
    const fill = enabled ? 0x0d1420 : 0x0a0e15;
    const stroke = enabled ? accent : 0x3f4c58;
    const serviceFrame = this.renderMarketServiceButtonFrame(x, y, w, h, enabled);
    this.renderMarketOfferTray(x, y, w, h, enabled, serviceFrame ? 0.18 : 0.44);
    this.add.rectangle(x, y, w, h, fill, enabled ? 0.96 : 0.82)
      .setAlpha(serviceFrame ? enabled ? 0.18 : 0.24 : enabled ? 0.96 : 0.82)
      .setStrokeStyle(MENU_BORDER_WIDTH, stroke, serviceFrame ? 0.18 : enabled ? 0.9 : 0.54);
    const iconSize = iconId.startsWith('market-') && iconId.endsWith('-service') ? 34 : 25;
    addUiIconImage(this, iconId, x - w / 2 + 28, y, iconSize)
      ?.setAlpha(enabled ? 0.94 : 0.42);
    if (label && w >= 220) {
      this.add.text(x - w / 2 + 54, y, label, {
        fontFamily: UI_FONT,
        fontSize: '12px',
        fontStyle: UI_BOLD,
        color: enabled ? '#dffbff' : '#748494',
        fixedWidth: w - 156,
        maxLines: 1
      }).setOrigin(0, 0.5).setName('market-service-label');
    }
    const costFrame = this.renderMarketPriceChipFrame(x + w / 2 - 44, y, 96, 36, enabled, serviceFrame ? 0.3 : 0.54);
    costFrame?.setData('role', 'service-cost');
    this.add.text(x + w / 2 - 9, y - 9, `${price}`, {
      fontFamily: UI_FONT,
      fontSize: '14px',
      fontStyle: UI_BOLD,
      color: enabled ? '#f0c36f' : '#91a6b8',
      align: 'right'
    }).setOrigin(1, 0).setName('market-service-cost-value');
    addUiIconImage(this, 'scrap-gear', x + w / 2 - 76, y, 20)
      ?.setAlpha(enabled ? 0.94 : 0.46)
      .setName('market-service-cost-icon');
  }

export function renderMarketServiceButtonFrame(this: any, x: number, y: number, w: number, h: number, enabled: boolean): any {
    return this.add.rectangle(x, y, w, h, 0x0d1420, 0.98)
      .setStrokeStyle(1, enabled ? UI_FIELD.cyan : 0x49606d, 0.5).setName('market-service-button-frame');
  }

export function renderMarketPriceTag(this: any, x: number, y: number, price: number, enabled: boolean, accent: number, verb: string): any {
    const fill = enabled ? 0x0d1420 : 0x0a0e15;
    const tagW = 122;
    const tagFrame = this.renderMarketCardPriceTagFrame(x, y, tagW, 26, enabled);
    this.add.rectangle(x + 3, y + 4, tagW, 26, 0x020409, tagFrame ? 0.28 : 0.78);
    this.renderMarketOfferTray(x, y, tagW, 26, enabled, tagFrame ? 0.12 : 0.34);
    this.add.rectangle(x, y, tagW, 26, fill, enabled ? 0.94 : 0.86)
      .setAlpha(tagFrame ? enabled ? 0.18 : 0.26 : enabled ? 0.94 : 0.86)
      .setStrokeStyle(MENU_BORDER_WIDTH, enabled ? accent : 0x3f4c58, tagFrame ? 0.14 : enabled ? 0.86 : 0.52);
    this.renderMarketPriceChipFrame(x, y, tagW + 22, 42, enabled, tagFrame ? 0.28 : 0.68);
    addUiIconImage(this, 'scrap-gear', x - 47, y, 23)
      ?.setAlpha(enabled ? 0.94 : 0.5);
    this.add.text(x - 19, y - 10, `${price}`, {
      fontFamily: UI_FONT,
      fontSize: '13px',
      fontStyle: UI_BOLD,
      color: enabled ? '#f0c36f' : '#91a6b8'
    });
    const verbIcon = buttonIconForLabel(verb);
    const icon = verbIcon ? addUiIconImage(this, verbIcon, x + 24, y, 20) : undefined;
    if (icon) icon.setAlpha(enabled ? 0.92 : 0.42);
  }

export function renderMarketCardPriceTagFrame(this: any, x: number, y: number, w: number, h: number, enabled: boolean): any {
    return this.add.rectangle(x, y, w, h, 0x0d1420, 0.98)
      .setStrokeStyle(1, enabled ? UI_FIELD.brass : 0x49606d, 0.5).setName('market-card-price-tag-frame');
  }

export function renderMarketEnamelButton(this: any, x: number, y: number, w: number, h: number, label: string, enabled: boolean, onClick: () => void, accent = UI_FIELD.gold, fontSize = '14px', detail?: string): any {
    this.add.rectangle(x + 4, y + 5, w, h, 0x020409, 0.82);
    const frameKey = uiIconAssets['market-enamel-command-frame'].key;
    const hasFrame = this.textures.exists(frameKey);
    const panel = this.add.rectangle(
      x,
      y,
      w,
      h,
      enabled ? 0x0d1420 : 0x0a0e15,
      hasFrame ? 0.01 : enabled ? 0.92 : 0.82
    );
    if (!hasFrame) {
      panel.setStrokeStyle(MENU_BORDER_WIDTH, enabled ? accent : 0x3f4c58, enabled ? 0.95 : 0.58);
    }
    let frame: Phaser.GameObjects.Image | undefined;
    if (hasFrame) {
      setTextureFilter(this.textures.get(frameKey), Phaser.Textures.FilterMode.LINEAR);
      frame = this.add.image(x, y, frameKey)
        .setDisplaySize(w + 24, h + 18)
        .setAlpha(enabled ? 0.88 : 0.38)
        .setName('market-enamel-command-frame');
      if (!enabled) frame!.setTint(0x8192a2);
    }
    const labelY = detail ? y - 3 : y - 8;
    const iconId = label === 'Close' ? 'close-medallion' : buttonIconForLabel(label);
    const contentX = iconId ? x + (label === 'Close' ? 28 : Math.min(28, w * 0.18)) : x;
    const text = this.add.text(contentX, labelY, label, {
      fontFamily: UI_FONT,
      fontSize,
      fontStyle: UI_BOLD,
      color: enabled ? '#ffe1a3' : '#596a78',
      stroke: '#111111',
      strokeThickness: 2
    }).setResolution(2).setOrigin(0.5, 0);
    const detailText = detail
      ? this.add.text(contentX, y - 17, detail, {
        fontFamily: UI_FONT,
        fontSize: '11px',
        fontStyle: UI_BOLD,
        color: enabled ? '#8df4ff' : '#596a78',
        stroke: '#05070c',
        strokeThickness: 2
    }).setResolution(2).setOrigin(0.5, 0)
      : undefined;
    const icon = iconId ? addUiIconImage(this, iconId, x - w / 2 + (label === 'Close' ? 14 : 24), y, Math.min(26, h - 6)) : undefined;
    if (icon) icon.setAlpha(enabled ? 0.92 : 0.42);
    if (enabled) {
      const hit = this.add.rectangle(
        x,
        y,
        Math.max(w, MIN_SUPPORTED_TOUCH_TARGET),
        Math.max(h, MIN_SUPPORTED_TOUCH_TARGET),
        0x020409,
        0.001,
      ).setInteractive({ useHandCursor: true })
        .setName('market-enamel-button-hit')
        .setData('label', label);
      hit.on('pointerover', () => {
        panel.setFillStyle(0x1b2535, hasFrame ? 0.08 : 0.96);
        frame?.setDisplaySize(w + 28, h + 20).setAlpha(0.98);
        text.setColor('#ffffff');
        detailText?.setColor('#ffffff');
      });
      hit.on('pointerout', () => {
        panel.setFillStyle(0x0d1420, hasFrame ? 0.01 : 0.92);
        frame?.setDisplaySize(w + 24, h + 18).setAlpha(0.88);
        text.setColor('#ffe1a3');
        detailText?.setColor('#8df4ff');
      });
      hit.on('pointerdown', () => {
        playUiSound('confirm');
        onClick();
      });
      return hit;
    }
    return panel;
  }

export function renderMarketSoldSlat(this: any, x: number, y: number, w: number, _h: number): any {
    const slatKey = uiIconAssets['market-sold-slat-frame'].key;
    const slatWidth = Math.max(150, w + 38);
    const slatHeight = slatWidth * 192 / 640;
    if (this.textures.exists(slatKey)) {
      setTextureFilter(this.textures.get(slatKey), Phaser.Textures.FilterMode.LINEAR);
      this.add.image(x, y, slatKey)
        .setDisplaySize(slatWidth, slatHeight)
        .setAngle(-16)
        .setAlpha(0.94)
        .setName('market-sold-slat-frame');
    } else {
      this.add.rectangle(x, y, w + 18, 10, 0x020409, 0.82).setAngle(-18);
    }
    this.add.text(x, y, 'SOLD', {
      fontFamily: UI_FONT,
      fontSize: w >= 180 ? '21px' : '18px',
      fontStyle: UI_BOLD,
      color: '#f4dcc0',
      stroke: '#020409',
      strokeThickness: 5
    }).setOrigin(0.5).setAngle(-16).setResolution(2).setName('market-sold-label');
  }

export function renderMarketPurchaseFeedback(this: any, x: number, y: number, accent = UI_FIELD.gold): any {
    this.renderAll();
    this.marketPurchaseFlourishReplay = { x, y, accent, expiresAt: this.time.now + 1800 };
    this.marketPurchaseFlourish(x, y, accent, true);
    this.updateTextState();
  }

