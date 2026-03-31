# STORY-E2: Dark Mode

**Status:** Draft
**Priority:** Low
**Estimate:** 2 days

## User Story
As a staff member using the dashboard in low-light conditions
I want a dark mode option that persists between sessions
So that I can reduce eye strain during evening shifts without losing my preference on refresh

## Acceptance Criteria
- [ ] A moon/sun icon toggle button appears in the dashboard header
- [ ] Clicking the toggle switches between light and dark mode
- [ ] The preference is saved to `localStorage` under key `uklc-theme` with values `"light"` or `"dark"`
- [ ] On first load, the theme defaults to the user's system preference (`prefers-color-scheme: dark`)
- [ ] If a `uklc-theme` value exists in localStorage, it overrides the system preference
- [ ] Dark mode applies a CSS class `dark` to the root `<div>` in `app/page.js`
- [ ] CSS variables for all brand colours are defined in a `<style>` tag in `app/page.js`: light defaults and `.dark` overrides
- [ ] Dark palette: bg `#0f1923`, white `#1a2535`, navy `#0a1220`, border `#2a3a4a`, text `#e2e8f0`, textMuted `#94a3b8`
- [ ] The header remains visually navy/dark in both modes (it uses `B.navy` which is already dark)
- [ ] Vitest test: the `getInitialTheme` and `persistTheme` pure functions correctly read/write the localStorage key and respect system preference

## Tasks
- [ ] Task 1: Write pure functions `getInitialTheme()` and `persistTheme(theme)` — place them in a new file `lib/theme.js` — export for testing
- [ ] Task 2: Add `<style>` tag with CSS variable definitions to `app/page.js` — define `:root` light defaults and `.dark` overrides for all `B.*` tokens that are used as inline styles
- [ ] Task 3: Add `darkMode` state to `app/page.js` with `useState` — initialise using `getInitialTheme()` in a `useEffect` (cannot call `localStorage` during SSR)
- [ ] Task 4: Apply `className={darkMode ? "dark" : ""}` to the root `<div>` in `app/page.js` (line 361)
- [ ] Task 5: Add moon/sun toggle button to the header in `app/page.js` — use a simple SVG moon icon (dark mode off) and sun icon (dark mode on); clicking calls `persistTheme` and toggles `darkMode` state
- [ ] Task 6: Update all inline styles in `app/page.js` and all tab components to use CSS variables (`var(--color-bg)` etc.) instead of `B.*` direct values — OR use a hybrid approach: redefine `B` as a proxy to CSS variables (see Dev Notes)
- [ ] Task 7: Write Vitest tests in `tests/theme.test.js` for `getInitialTheme` and `persistTheme`

## Dev Notes

### File Paths
- Create: `lib/theme.js`
- Modify: `app/page.js`
- Create: `tests/theme.test.js`

### Technical Requirements

#### CSS Variable Strategy (Hybrid Approach — Recommended)
Rather than updating every `B.*` reference across all components (which would touch ~15 files), define CSS variables that shadow `B.*` values. All components continue to use `B.*` but those values are changed to reference CSS variables via a CSS-in-JS shim or by redefining `B` constants to use `var()`:

Option A (CSS variables only — no JS change): Define CSS vars in the `<style>` tag. In each component, replace `B.bg` with `"var(--color-bg)"` etc. This requires updating all files.

Option B (recommended — CSS class approach): Keep all inline styles as-is but override them by injecting a `<style>` block that uses CSS attribute selectors on the root div. This will not work for inline styles (inline styles always take priority over class-based CSS).

Option C (recommended): Redefine `B` in `lib/constants.js` to return CSS variable references. All components already import `B` — this single-file change propagates everywhere:
```js
export const B = {
  navy: "var(--color-navy)",
  red: "var(--color-red)",
  white: "var(--color-white)",
  // ... etc
};
```
Then define the actual colour values in CSS variables in `app/page.js`:
```css
:root {
  --color-navy: #1c3048;
  --color-red: #ec273b;
  --color-white: #ffffff;
  --color-bg: #f4f7fa;
  --color-border: #dce4ec;
  --color-text: #1c3048;
  --color-text-muted: #5c7084;
  /* ... all B.* tokens */
}
.dark {
  --color-navy: #0a1220;
  --color-white: #1a2535;
  --color-bg: #0f1923;
  --color-border: #2a3a4a;
  --color-text: #e2e8f0;
  --color-text-muted: #94a3b8;
  /* red stays the same in dark mode */
}
```

IMPORTANT: Option C changes `B.*` from string colour values to CSS variable references. This means `B.navy + "30"` (alpha suffix pattern used for semi-transparent colours) will break. Before modifying `B`, audit all usages of string concatenation on `B.*` values and replace with explicit `rgba()` calls or additional CSS variables.

#### `B.*` Concatenation Audit
Search for `B\.\w+ \+` pattern in all component files to find places like `B.navy + "30"`. Replace each with an explicit RGBA value or add a new CSS variable (e.g., `--color-navy-alpha: rgba(28,48,72,0.18)`).

#### `getInitialTheme` and `persistTheme`
```js
// lib/theme.js
export function getInitialTheme() {
  if (typeof window === "undefined") return "light"; // SSR guard
  const stored = localStorage.getItem("uklc-theme");
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function persistTheme(theme) {
  if (typeof window === "undefined") return;
  localStorage.setItem("uklc-theme", theme);
}
```

#### initialise in useEffect (SSR safety)
```js
const [darkMode, setDarkMode] = useState(false);
useEffect(() => {
  setDarkMode(getInitialTheme() === "dark");
}, []);
const toggleDark = () => {
  const next = !darkMode;
  setDarkMode(next);
  persistTheme(next ? "dark" : "light");
};
```

#### Moon/Sun Icon
Inline SVG is preferred (no new icon component needed):
- Moon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`
- Sun: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`

Button style: place in the header bar next to the logout button; use `cursor: "pointer"`, `background: "none"`, `border: "none"`, `color: B.white`, `padding: "6px"`, `borderRadius: 6`

### Test File Approach
`tests/theme.test.js` — mock `localStorage` and `window.matchMedia` using Vitest's `vi.stubGlobal`:
```js
import { describe, it, expect, beforeEach, vi } from "vitest";
import { getInitialTheme, persistTheme } from "@/lib/theme";
```

## Testing Requirements
- Vitest tests in `tests/theme.test.js`:
  - `getInitialTheme()` with `localStorage` containing `"dark"` → returns `"dark"`
  - `getInitialTheme()` with `localStorage` containing `"light"` → returns `"light"`
  - `getInitialTheme()` with no localStorage value and `matchMedia` returning dark → returns `"dark"`
  - `getInitialTheme()` with no localStorage value and `matchMedia` returning light → returns `"light"`
  - `persistTheme("dark")` → `localStorage.getItem("uklc-theme")` returns `"dark"`
- Manual verification:
  - Toggle dark mode → page switches to dark palette
  - Refresh page → dark mode persists
  - Clear localStorage → system preference is used
  - Verify at 375px width → toggle button is reachable and tappable
