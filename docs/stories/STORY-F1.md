# STORY-F1: Eve Slot & Programme Grid Colour Fix

**Status:** Draft
**Priority:** High
**Estimate:** 0.5 days

## User Story
As a centre manager reviewing the rota
I want custom evening activity names to display in purple rather than orange
So that the visual coding correctly communicates that an Eve slot entry is an evening entertainment, not an excursion

## Acceptance Criteria
- [ ] In `RotaTab.js`, the `cellColor` function accepts a second `slot` parameter
- [ ] When `slot === "Eve"` and the value does not match any known `SESSION_TYPES` key (and does not match any of the existing keyword checks), the function returns `SESSION_TYPES["Eve Ents"]` (purple `#7c3aed`) instead of the current orange fallthrough
- [ ] When `slot !== "Eve"` (e.g., "AM" or "PM") and the value is unrecognised, the function continues to return `SESSION_TYPES["Excursion"]` (orange `#ea580c`) as before
- [ ] All call sites of `cellColor(v)` in `RotaTab.js` are updated to pass the slot: `cellColor(v, slot)` — slot is "AM", "PM", or "Eve"
- [ ] Named session types (e.g., "Day Off", "Lessons", "Excursion") return the same colour regardless of which slot they appear in
- [ ] In `ProgrammesTab.js`, the equivalent cell colour function is found and updated: unknown values in the programme grid fall through to `ACTIVITY_TYPES["Multi-Act"]` (purple `#8b5cf6`) instead of any hardcoded fallback colour
- [ ] Vitest: `cellColor("Beach Party", "Eve")` returns `#7c3aed`
- [ ] Vitest: `cellColor("Beach Party", "AM")` returns `SESSION_TYPES["Excursion"]` (`#ea580c`)
- [ ] Vitest: `cellColor("Day Off", "Eve")` returns `#f59e0b` (unchanged Day Off colour)
- [ ] Vitest: `cellColor("Excursion", "Eve")` returns `SESSION_TYPES["Excursion"]` (a named type always wins)

## Tasks
- [ ] Task 1: In `RotaTab.js` at line 577, update `cellColor(v)` to `cellColor(v, slot = "AM")` — change the final fallthrough (currently line 591 `return SESSION_TYPES["Excursion"]`) to `return slot === "Eve" ? SESSION_TYPES["Eve Ents"] : SESSION_TYPES["Excursion"]`
- [ ] Task 2: Find all call sites of `cellColor(v)` in `RotaTab.js` — search for `cellColor(` in the file — update each to pass the slot variable in scope at that call site; the slot is available as `"AM"`, `"PM"`, or `"Eve"` from the SLOTS array (`const SLOTS = ["AM", "PM", "Eve"]` at line 8) or from the iteration variable
- [ ] Task 3: In `ProgrammesTab.js`, search for the cell colour function (search for `cellColor` or `cellBg` or the hex colour `#ea580c` or a colour mapping function) — find the fallthrough line and change it to return `ACTIVITY_TYPES["Multi-Act"]` (already available from the import at line 3)
- [ ] Task 4: Export `cellColor` from `RotaTab.js` for test isolation (add `export` keyword — or replicate inline in the test file per existing test conventions)
- [ ] Task 5: Write Vitest tests in `tests/RotaTab.test.js`

## Dev Notes

### File Paths
- Modify: `components/tabs/RotaTab.js` (lines 577–592 + all `cellColor` call sites)
- Modify: `components/tabs/ProgrammesTab.js` (cell colour fallthrough)
- Create: `tests/RotaTab.test.js`

### Technical Requirements

#### RotaTab.js cellColor — Current Code (lines 577–592)
```js
const cellColor = (v) => {
  if (!v) return null;
  if (v === "Day Off") return "#f59e0b";
  if (SESSION_TYPES[v]) return SESSION_TYPES[v];
  const vl = v.toLowerCase();
  if (vl.includes("lesson") || ...) return SESSION_TYPES["Lessons"];
  if (vl.includes("evening activity") || vl.includes("eve ent") || vl.includes("disco") || ...) return SESSION_TYPES["Eve Ents"];
  if (vl.includes("excursion")) return SESSION_TYPES["Excursion"];
  if (vl.includes("act") || vl.includes("multi")) return SESSION_TYPES["Activities"];
  if (vl.includes("half exc")) return SESSION_TYPES["Half Exc"];
  if (vl === "office") return "#94a3b8";
  if (vl === "pickup" || vl === "welcome" || vl === "setup" || vl === "departure duty") return SESSION_TYPES["Setup"];
  if (vl === "football") return "#16a34a";
  if (vl === "drama" || vl === "dance") return "#9333ea";
  return SESSION_TYPES["Excursion"];  // <-- THIS LINE: change to slot-aware fallthrough
};
```

#### Updated Function
```js
const cellColor = (v, slot = "AM") => {
  if (!v) return null;
  if (v === "Day Off") return "#f59e0b";
  if (SESSION_TYPES[v]) return SESSION_TYPES[v];
  const vl = v.toLowerCase();
  if (vl.includes("lesson") || vl.includes("english test") || vl.includes("testing") || vl.includes("int english") || vl.includes("int eng")) return SESSION_TYPES["Lessons"];
  if (vl.includes("evening activity") || vl.includes("eve ent") || vl.includes("disco") || vl.includes("bbq") || vl.includes("quiz") || vl.includes("karaoke") || vl.includes("film") || vl.includes("talent") || vl.includes("scav")) return SESSION_TYPES["Eve Ents"];
  if (vl.includes("excursion")) return SESSION_TYPES["Excursion"];
  if (vl.includes("act") || vl.includes("multi")) return SESSION_TYPES["Activities"];
  if (vl.includes("half exc")) return SESSION_TYPES["Half Exc"];
  if (vl === "office") return "#94a3b8";
  if (vl === "pickup" || vl === "welcome" || vl === "setup" || vl === "departure duty") return SESSION_TYPES["Setup"];
  if (vl === "football") return "#16a34a";
  if (vl === "drama" || vl === "dance") return "#9333ea";
  return slot === "Eve" ? SESSION_TYPES["Eve Ents"] : SESSION_TYPES["Excursion"];
};
```

#### Finding cellColor Call Sites in RotaTab.js
Search for `cellColor(` in `RotaTab.js`. Each call site will be rendering a cell background. The slot at each call site comes from the rendering loop — identify whether the cell is in an AM, PM, or Eve column and pass the string literal or the loop variable accordingly.

#### ProgrammesTab.js Colour Function
Search `ProgrammesTab.js` for any function that maps a cell value to a colour. It may be named `cellBg`, `cellColor`, or `getColor`, or it may be inline. Look for hex colour literals like `"#ea580c"` or `"#8b5cf6"` or references to `ACTIVITY_TYPES`. Find the final fallthrough line and change it to:
```js
return ACTIVITY_TYPES["Multi-Act"] || "#8b5cf6";
```
`ACTIVITY_TYPES` is already imported in `ProgrammesTab.js` at line 3 as part of the `B, ACTIVITY_TYPES, ...` import.

#### SESSION_TYPES Reference Values
```js
SESSION_TYPES["Eve Ents"] === "#7c3aed"  // purple
SESSION_TYPES["Excursion"] === "#ea580c"  // orange
SESSION_TYPES["Lessons"] === "#3b82f6"   // blue
SESSION_TYPES["Activities"] === "#8b5cf6" // purple
ACTIVITY_TYPES["Multi-Act"] === "#8b5cf6" // purple
```

#### Test File Approach
Follow `tests/AiRotaTab.test.js` pattern — replicate `cellColor` as a standalone function (do not import `RotaTab.js` directly due to `"use client"`) or export it from a separate util file. Copy the exact function body into the test file.

```js
// tests/RotaTab.test.js
import { describe, it, expect } from "vitest";
// Replicate cellColor here (copy exact implementation)
const SESSION_TYPES = { ... }; // copy from constants
const cellColor = (v, slot = "AM") => { ... };
```

## Testing Requirements
- Vitest tests in `tests/RotaTab.test.js`:
  - `cellColor("Beach Party", "Eve")` → `"#7c3aed"`
  - `cellColor("Beach Party", "AM")` → `"#ea580c"`
  - `cellColor("Day Off", "Eve")` → `"#f59e0b"` (named type, unchanged)
  - `cellColor("Excursion", "Eve")` → `"#ea580c"` (SESSION_TYPES match wins before fallthrough)
  - `cellColor("Lessons", "Eve")` → `SESSION_TYPES["Lessons"]` (`"#3b82f6"`)
  - `cellColor("", "Eve")` → `null`
  - `cellColor("disco night", "Eve")` → `SESSION_TYPES["Eve Ents"]` (keyword match, not fallthrough)
  - `cellColor("custom activity", "PM")` → `SESSION_TYPES["Excursion"]` (orange, PM fallthrough unchanged)
