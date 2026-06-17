# AAA Field-Kit UI Direction

Status: first implementation pass complete; route-map chrome has been revisited
after the other UI surfaces established the shared language.

## Intent

Bird Squad UI should feel like a rooftop field kit: crew dossiers, field
binders, chalk price tags, worn metal rails, tape-like dividers, and stamped
action controls. Cyan is reserved for live interaction and active bonuses; warm
brass/gold carries focus, prices, and route/action authority.

## Rules

- Reduce full filled boxes. Prefer subtle rails, thin dividers, corner brackets,
  and selected-state highlights.
- Use strong filled buttons only for primary actions; close/back controls should
  read as light text controls.
- Make menus distinct by material: Flock is a crew dossier, Deck is a field
  binder, Market is a warm rooftop stall, Combat is a compact tactical rail.
- Keep stats readable, but avoid spreadsheet-like row fills except for active
  emphasis.
- Add tactile feedback through shared hover/press states and quiet UI sounds.
- Keep route-map node/data layout stable unless the map itself is the target;
  polish map chrome through shared field-kit panels, rails, and inspector frames.

## First Pass

- Add shared field-kit panel, close-control, action-button, and lighter stat-row
  helpers in `src/main.ts`.
- Apply them to Flock, Deck, Market, combat HUD, and combat inspect overlays.
- Preserve route-map node/data work while applying field-kit chrome to the map
  frame, status rail, legend, top controls, and inspector.
