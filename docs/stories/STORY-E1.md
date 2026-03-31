# STORY-E1: Mobile Responsiveness on Wide Grids

**Status:** Draft
**Priority:** Medium
**Estimate:** 1 day

## User Story
As a staff member viewing the dashboard on a mobile device
I want the Rota, Programme, and Catering tab grids to scroll smoothly horizontally
So that I can view and interact with the full grid without layout breakage on small screens

## Acceptance Criteria
- [ ] All horizontally-scrolling grid containers in RotaTab, ProgrammesTab, and CateringTab have `-webkit-overflow-scrolling: touch` applied
- [ ] A "scroll" hint label ("← scroll →") is visible below each grid on screens narrower than 600px; it is hidden on wider screens
- [ ] The sticky first column (staff/group name column) remains visible and stuck during horizontal scroll on iOS — no parent `overflow: auto` wrapper breaks `position: sticky`
- [ ] All interactive grid cells have a minimum touch target height of 44px
- [ ] The layout does not break or clip content at 375px viewport width
- [ ] Vitest tests are not applicable to this story (all changes are visual/CSS)

## Tasks
- [ ] Task 1: In `RotaTab.js` — locate the main scrolling container (the outer `div` with `overflow: "hidden"` at line 598 and the inner scrolling div) — add `WebkitOverflowScrolling: "touch"` to the horizontally-scrolling inner container's inline style
- [ ] Task 2: In `RotaTab.js` — add a scroll hint element after the grid container: `<div className="scroll-hint">← scroll →</div>` — add a `<style>` tag in the component JSX (or use the existing global CSS) with `.scroll-hint { display: none; } @media (max-width: 600px) { .scroll-hint { display: block; ... } }`
- [ ] Task 3: Audit `RotaTab.js` for any `overflow: "auto"` or `overflow: "scroll"` on a parent element of the sticky first column — if found, restructure so that `position: sticky; left: 0` works correctly (sticky requires the scrolling ancestor to be the direct overflow parent, not a grandparent)
- [ ] Task 4: In `ProgrammesTab.js` — apply the same three fixes: `WebkitOverflowScrolling: "touch"`, scroll hint, sticky column audit
- [ ] Task 5: In `CateringTab.js` — apply the same three fixes: `WebkitOverflowScrolling: "touch"`, scroll hint, sticky column audit
- [ ] Task 6: Audit all interactive cell heights in all three tabs — ensure cells are at minimum 44px tall; if `CELL_H` constants are below 44, raise them; if individual `td` cells use inline height styles, ensure `minHeight: 44`

## Dev Notes

### File Paths
- Modify: `components/tabs/RotaTab.js`
- Modify: `components/tabs/ProgrammesTab.js`
- Modify: `components/tabs/CateringTab.js`

### Technical Requirements

#### WebkitOverflowScrolling
In React inline styles, the CSS property `-webkit-overflow-scrolling: touch` is written as:
```js
style={{ WebkitOverflowScrolling: "touch", overflowX: "auto" }}
```
Apply this to the div that has `overflow: "auto"` or `overflowX: "auto"` wrapping the wide grid table.

#### Scroll Hint
Inject a `<style>` block once at the top of each component's return:
```jsx
<style>{`
  .grid-scroll-hint {
    display: none;
    text-align: center;
    font-size: 10px;
    color: #8a9bb0;
    padding: 4px 0;
    letter-spacing: 0.5px;
  }
  @media (max-width: 600px) {
    .grid-scroll-hint { display: block; }
  }
`}</style>
```
Then place `<div className="grid-scroll-hint">← scroll →</div>` immediately after the scrolling container.

#### Sticky Column iOS Fix
The most common iOS `position: sticky` issue on tables: the scrolling `overflow` container must be a direct ancestor of the sticky element. In all three tabs, the sticky first column uses `position: "sticky", left: 0, zIndex: 1` on `<th>` or `<td>`. The table must be inside a `<div style={{ overflowX: "auto" }}>`. If there is a wrapper div with both `overflow: "hidden"` AND the inner div with `overflow: "auto"`, the sticky will fail on Safari. Fix: ensure `overflow: "hidden"` is only on the outer container for vertical clipping, and the horizontal scroll container is the immediate wrapper.

In `RotaTab.js`: the outer div at line 598 has `overflow: "hidden"` (vertical clip for vh-based layout). The inner scrolling div should have `overflow: "auto"` only — do not nest another `overflow` wrapper between it and the table.

#### Minimum Touch Target
- `RotaTab.js`: `CELL_H` is defined at line 10 as `const CELL_H = 52` — already 52px, which exceeds 44px. No change needed.
- `ProgrammesTab.js`: check for a `CELL_H` constant or inline height on cells. If cells are below 44px, set to `minHeight: 44`.
- `CateringTab.js`: same audit — find the cell height definition and ensure `minHeight: 44`.

### Pattern to Locate Scrolling Containers
Search for `overflowX.*auto` or `overflow.*auto` in each file to find the scrolling wrapper div.
- `RotaTab.js`: the scrolling wrapper is likely around line 624 (after the controls bar)
- `ProgrammesTab.js`: search for `overflowX` or `overflow: "auto"` in the file
- `CateringTab.js`: same search

### No New Dependencies
No new libraries required. Uses only CSS media queries and inline React style properties.

## Testing Requirements
- No Vitest tests (visual/CSS changes only)
- Manual verification on 375px width (Chrome DevTools mobile emulation, iPhone SE preset):
  - Open Rota tab → grid scrolls horizontally, first column stays stuck, "← scroll →" hint appears below the grid
  - Open Programmes tab → same verification
  - Open Catering tab → same verification
  - Tap on a rota cell → tap registers correctly (no mis-tap on adjacent cell)
  - Verify on actual iOS Safari if available (sticky + overflow interactions differ from Chrome)
