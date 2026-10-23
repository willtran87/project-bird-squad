# Locked Major Arcana frames

The 22 approved original Major cards have individual illustrated frames and
raster title lettering. These files preserve those approved pixels exactly;
they are not newly generated borders or newly typeset titles. The rectangular
illustration opening is recorded per card in `manifest.json`. Approved frame,
numeral and title pixels remain outside that opening and are immutable.

For later illustration work, generate only center artwork, place it behind the
locked frame, and keep the full canonical canvas. Do not regenerate the title,
numeral or frame. Changes outside the opening require a deliberate new approved
frame revision. This contract preserves the existing Major visual designs.

`tools/validate-card-export-integrity.py` checks frame SHA-256, selected-master
pixels outside the opening, exact separate-layer recomposition, all ten Snag
compositions from borderless sources and their font/template, and all 220
selected portrait/thumbnail exports. Minor and Aviary frames retain their
existing stricter shared-template validators.
