# UKLC Centre Dashboard v2 — Front-end Specification
**Version:** 2.0
**Date:** 24 March 2026
**Author:** Sally (UX Expert) — Agile Studio
**Status:** Draft — pending approval

---

## 1. Brand Foundation

The Centre Dashboard is an **internal staff tool**. Per UKLC brand guidelines, internal tools should:
- Use **Navy as the dominant background colour**
- Use **Red and White** as primary UI accents
- Use **Neon Yellow** for CTA highlights and accents on navy surfaces
- Use **Pink and Grey/Blue** for secondary cards and panels
- Include **geometric decorative elements** (play arrows, diagonal lines, dots) as section separators and texture
- Never use off-brand colours (greens, purples, oranges, blues outside the brand palette)

This spec governs every screen. Build agents must not deviate from it.

---

## 2. Colour System

### 2.1 Brand Palette

All colours come from the `B` object in `lib/constants.js`. Never use hardcoded hex values in components.

| Token | Hex | Brand Name | Primary Usage |
|-------|-----|-----------|---------------|
| `B.navy` | `#1C3048` | Navy Blue | Headers, nav, table headers, dominant surfaces, buttons |
| `B.red` | `#EC273B` | Red | Primary CTA buttons, alerts, accents, active states |
| `B.yellow` | `#F0F279` | Neon Yellow | CTA accents on navy, highlight tags, active indicators |
| `B.white` | `#FFFFFF` | White | Card backgrounds, text on dark, button labels |
| `B.pink` | `#FAD7D8` | Pink | Soft card backgrounds, notification panels, secondary UI |
| `B.ice` | `#E6EEF3` | Grey/Blue | Secondary panel backgrounds, hover states, assistant bubbles |

### 2.2 Functional Colour Mapping

All UI chrome uses brand palette only. Green, red, and amber are permitted for **semantic data states** with clear meaning — arrival days, departure days, errors, warnings. They must not be used decoratively.

| Token | Hex | Purpose |
|-------|-----|---------|
| `B.bg` | `#f4f7fa` | Page background (near-white with cool tint) |
| `B.card` | `#ffffff` | Card/panel backgrounds |
| `B.border` | `#dce4ec` | Standard borders |
| `B.borderLight` | `#e8eef4` | Table row dividers |
| `B.text` | `#1c3048` | Body text (navy) |
| `B.textMuted` | `#5c7084` | Labels, secondary text |
| `B.textLight` | `#8a9bb0` | Placeholder, disabled |
| `B.success` | `#16a34a` | Semantic green — arrival days, positive confirmations |
| `B.successBg` | `#dcfce7` | Green tint background — arrival indicators |
| `B.warning` | `#d97706` | Amber — warning messages, data alerts |
| `B.warningBg` | `#fef3c7` | Amber tint — warning banners |
| `B.danger` | `#dc2626` | Semantic red — departure days, cell errors, validation failures |
| `B.dangerBg` | `#fee2e2` | Red tint — error states |

> **Rule:** Green = arrival/positive. Red = departure/error. Amber = warning. These signal meaning to the user — apply them only where that meaning is present. All decorative and structural UI elements use brand palette only.

> **Audit note:** `SESSION_TYPES` and `MEAL_COLORS` in `lib/constants.js` use off-brand purples, blues, and browns with no semantic meaning. These must be replaced during Workstream B. See section 7.

### 2.3 Approved Colour Combinations

| Background | Text / Foreground | Accent / CTA |
|------------|-------------------|--------------|
| Navy `#1C3048` | White `#FFFFFF` | Yellow `#F0F279` or Red `#EC273B` |
| Red `#EC273B` | White `#FFFFFF` | Navy `#1C3048` |
| Yellow `#F0F279` | Navy `#1C3048` | Red `#EC273B` |
| Pink `#FAD7D8` | Navy `#1C3048` | Red `#EC273B` |
| Grey/Blue `#E6EEF3` | Navy `#1C3048` | Red `#EC273B` |
| White `#FFFFFF` | Navy `#1C3048` | Red `#EC273B` |

---

## 3. Typography

### 3.1 Typefaces

| Face | Variable | Usage |
|------|----------|-------|
| Raleway Bold/ExtraBold | `'Raleway', sans-serif` | All headings, tab labels, button text, stat card labels, stepper labels |
| Open Sans Regular/SemiBold | `'Open Sans', sans-serif` | Body text, table cells, inputs, descriptions, chat messages |

Both fonts are imported via Google Fonts in `app/layout.js`. Build agents must not substitute other fonts.

### 3.2 Type Scale

| Use | Size | Weight | Font | Colour |
|-----|------|--------|------|--------|
| Page/tab heading | 18px | 800 | Raleway | `B.navy` |
| Section heading | 15px | 700 | Raleway | `B.navy` |
| Table header | 10px | 700 | Raleway | `B.white` (on navy) |
| Field label | 9px | 800 | Raleway | `B.textMuted`, uppercase, letterSpacing 0.8 |
| Body text | 13px | 400 | Open Sans | `B.text` |
| Table cell | 12px | 400 | Open Sans | `B.text` |
| Small/muted | 11px | 400 | Open Sans | `B.textMuted` |
| Badge | 9px | 700 | Raleway | varies by badge colour |

---

## 4. Geometric Brand Motifs

UKLC's visual language uses specific geometric patterns. These must appear in the dashboard to distinguish it from a generic tool. Use them as accents — not decorations for their own sake.

### 4.1 Where to use them

| Motif | Usage in dashboard |
|-------|-------------------|
| **Diagonal lines** | Already present on table headers (`thStyle` — diagonal texture overlay). Keep. Also use on chat panel header and AI Rota header. |
| **Play arrows (▶ rows)** | Use as section dividers between major content areas, as decorative borders on stat card rows, or as a loading indicator pattern. |
| **Dots grid** | Use as background texture on navy surfaces (chat panel header, tab nav header). CSS: `radial-gradient` dot pattern in rgba(255,255,255,0.07). |
| **Yellow diagonal stripe** | A thin yellow diagonal accent line on cards or panel headers gives brand energy. Use sparingly — one per screen maximum. |

### 4.2 CSS implementations

**Diagonal texture (existing — on table headers):**
```css
background-image: repeating-linear-gradient(
  135deg,
  rgba(255,255,255,0.04) 0px,
  rgba(255,255,255,0.04) 1px,
  transparent 1px,
  transparent 10px
);
```

**Dots grid (new — for navy surfaces):**
```css
background-image: radial-gradient(circle, rgba(255,255,255,0.08) 1px, transparent 1px);
background-size: 16px 16px;
```

**Play arrow divider (new — between sections):**
```jsx
// Small row of rightward-pointing triangles in brand colour
// Use as a <div> between stat cards and table content
<div style={{
  display: "flex", gap: 4, padding: "6px 0",
  color: B.red, fontSize: 8, letterSpacing: 2
}}>
  {"▶".repeat(12)}
</div>
```

**Yellow accent stripe (new — on card left border, sparingly):**
```css
border-left: 3px solid #F0F279; /* B.yellow — on navy background cards only */
```

---

## 5. Shared Components (`components/ui.js`)

Build agents must use these components. Do not recreate inline.

### `<Fld label>` — Field label wrapper
Uppercase 9px Raleway label above any input.

### `<StatCard label value accent?>` — Metric card
White card, navy left border accent (pass `accent={B.red}` or `accent={B.yellow}` for variety).
The `label` is uppercase Raleway 9px; `value` is Raleway 800 22px navy.

### `<StatusBadge status map>` — Coloured pill badge
Brand-compliant colour map only. Use these standard maps:

```javascript
// Programme status
const PROG_STATUS_MAP = {
  active:   { color: B.white,  bg: B.navy },
  draft:    { color: B.navy,   bg: B.ice  },
  complete: { color: B.white,  bg: B.red  },
};

// General positive/warning/error
const GENERAL_STATUS_MAP = {
  ok:      { color: B.navy,  bg: B.ice  },
  warning: { color: B.red,   bg: B.pink },
  error:   { color: B.white, bg: B.red  },
};
```

### `<IconBtn>` — Icon-only ghost button
Use `danger` prop to colour red. All icon buttons must have a `title` for accessibility.

### `<TableWrap>` — Table scroll container
Wrap every `<table>`. Provides white card, rounded corners, horizontal scroll.

### Style objects (import from `components/ui.js`):

| Export | Description |
|--------|-------------|
| `inputStyle` | Standard text input — white, border, Open Sans 12px |
| `thStyle` | Table header — navy bg, white Raleway, diagonal texture |
| `tdStyle` | Table data cell — Open Sans 12px, light bottom border |
| `btnPrimary` | Red action button — primary CTA |
| `btnNavy` | Navy action button — secondary CTA |

**New button variant to add to `ui.js` (Workstream C):**
```javascript
export const btnYellow = {
  ...btnPrimary,
  background: B.yellow,
  color: B.navy,
  boxShadow: "0 2px 8px rgba(240,242,121,0.35)",
};
```
Use `btnYellow` for highlighted/featured actions on navy backgrounds (e.g. suggestion chips, active step in stepper).

### Icon components
All icons use `<Ic d="..." />` base (16×16 SVG, stroke). Available in `components/ui.js`.

**New icon to add for Workstream C:**
```javascript
export function IcChat() {
  return <Ic d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" s={22} />;
}
```

---

## 6. Layout Patterns

### 6.1 Standard tab structure
```jsx
<div style={{ padding: "20px 24px" }}>
  {/* Header row */}
  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
    <h2 style={{ fontSize: 18, fontWeight: 800, color: B.navy, fontFamily: "'Raleway', sans-serif" }}>
      Tab Title
    </h2>
    <div style={{ display: "flex", gap: 8 }}>
      {/* action buttons */}
    </div>
  </div>

  {/* Stat cards row */}
  <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
    <StatCard label="..." value={...} accent={B.red} />
    <StatCard label="..." value={...} accent={B.navy} />
  </div>

  {/* Optional play-arrow section divider */}
  <div style={{ display: "flex", gap: 3, padding: "4px 0 12px", color: B.red, fontSize: 8, letterSpacing: 2, opacity: 0.5 }}>
    {"▶".repeat(16)}
  </div>

  {/* Main content */}
  <TableWrap>...</TableWrap>
</div>
```

### 6.2 Wide tables — sticky first column
```javascript
// th (header):
{ ...thStyle, position: "sticky", left: 0, zIndex: 2 }

// td (data):
{ ...tdStyle, position: "sticky", left: 0, zIndex: 1, background: B.white }
```

### 6.3 Totals rows
```javascript
{ background: B.navy, color: B.white, fontWeight: 700, fontFamily: "'Raleway', sans-serif" }
```

### 6.4 Empty states
Every table and list must have a meaningful empty state — not a blank space.

```jsx
<tr>
  <td colSpan={99} style={{ padding: "40px 20px", textAlign: "center" }}>
    <div style={{ color: B.textMuted, fontFamily: "'Open Sans', sans-serif", fontSize: 13 }}>
      No [items] yet. [Brief action hint if applicable.]
    </div>
  </td>
</tr>
```

### 6.5 Loading states
Every async operation must show a loading indicator.

```jsx
// Inline spinner pattern (reuse across tabs)
<div style={{ display: "flex", alignItems: "center", gap: 8, color: B.textMuted, fontSize: 12, fontFamily: "'Open Sans', sans-serif" }}>
  <div style={{
    width: 16, height: 16, border: `2px solid ${B.border}`,
    borderTop: `2px solid ${B.navy}`, borderRadius: "50%",
    animation: "spin 0.7s linear infinite"
  }} />
  Loading...
</div>
```

Add to global CSS: `@keyframes spin { to { transform: rotate(360deg); } }`

### 6.6 Navy card / panel variant
For prominent panels (AI Rota, chat header, featured sections):
```javascript
{
  background: B.navy,
  borderRadius: 12,
  padding: "20px 24px",
  color: B.white,
  backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)",
  backgroundSize: "16px 16px",
}
```
This combines the dots-grid motif with the navy background for a distinctly UKLC feel.

---

## 7. Off-Brand Colour Audit (Workstream B)

The following constants in `lib/constants.js` use non-brand colours and must be replaced:

### `SESSION_TYPES` — current (off-brand)
```javascript
// ❌ Uses blues, purples, teals, pinks not in brand palette
Lessons: "#3b82f6", Activities: "#8b5cf6", ...
```

### `SESSION_TYPES` — replacement (brand-compliant)
```javascript
export const SESSION_TYPES = {
  Lessons:      B.navy,
  Activities:   B.red,
  "English+":   "#2a4a6b",   // navy tint
  Excursion:    B.red,
  "Half Exc":   "#c41f31",   // red shade
  "Eve Ents":   B.navy,
  Airport:      B.textMuted,
  Floating:     B.ice,
  "Lesson Prep":B.navy,
  Reports:      B.textMuted,
  Induction:    "#2a4a6b",
  Setup:        B.ice,
};
```

### `MEAL_COLORS` — current (off-brand)
```javascript
// ❌ Uses browns, greens, blues not in brand palette
Breakfast: "#b45309", Lunch: "#15803d", Dinner: "#1e40af", ...
```

### `MEAL_COLORS` — replacement (brand-compliant)
```javascript
export const MEAL_COLORS = {
  Breakfast:      B.navy,
  "Packed Bkfst": "#2a4a6b",   // navy tint
  Lunch:          B.red,
  "Packed Lunch": "#c41f31",   // red shade
  Dinner:         B.textMuted,
  "Packed Dinner":"#3d5166",   // navy mid
};
```

> Note: These replacements maintain visual distinction between meal/session types while staying within the brand palette. Exact shades can be adjusted by Charlie during review — the constraint is no non-brand colours.

---

## 8. New Component: ChatButton

**File:** `components/ChatButton.js`

### 8.1 Floating button

```
Position: fixed, bottom: 24px, right: 24px
z-index: 50
Size: 52×52px circle
Background: B.navy (with dots-grid texture overlay)
Border: none
Box shadow: 0 4px 20px rgba(28,48,72,0.35)
Icon: IcChat (white, 22px)
Hover: background B.red, transition 150ms ease
Focus: outline 2px solid B.yellow, offset 2px
aria-label: "Open UKLC Assistant"
aria-expanded: {isOpen}
```

On mobile (≤480px): `bottom: 16px, right: 16px`.

### 8.2 Chat panel

Slides in from the right. Page content remains visible on desktop.

```
Position: fixed, top: 0, right: 0, bottom: 0
Width: 400px (>480px), 100vw (≤480px)
Background: B.card (#ffffff)
Border-left: 1px solid B.border
Box shadow: -6px 0 32px rgba(28,48,72,0.15)
z-index: 49
Transition: transform 200ms ease (slide in/out)
role: "dialog"
aria-label: "UKLC Assistant"
```

**Panel structure:**
```
┌──────────────────────────────────┐
│  NAVY HEADER (dots texture)      │
│  ✦ Ask UKLC Assistant       [✕]  │
│  [centre name — muted]           │
│  [Yellow accent stripe bottom]   │
├──────────────────────────────────┤
│  MESSAGE AREA (scroll)           │
│                                  │
│  [Empty state / suggestions]     │
│      or                          │
│  [Message bubbles]               │
│                                  │
├──────────────────────────────────┤
│  INPUT ROW (border-top)          │
│  [input ──────────] [Send]       │
└──────────────────────────────────┘
```

### 8.3 Panel header

```javascript
{
  background: B.navy,
  padding: "16px 20px",
  backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)",
  backgroundSize: "16px 16px",
  borderBottom: `3px solid ${B.yellow}`,  // yellow accent stripe
}
```

Content:
- Left: `IcSparkles` (white, 16px) + **"Ask UKLC Assistant"** (Raleway 700, 13px, white)
- Below title: centre name (Open Sans, 11px, `rgba(255,255,255,0.55)`)
- Right: `IconBtn` with `IcX` (white, close panel), `aria-label="Close assistant"`

### 8.4 Message bubbles

**User messages (right):**
```javascript
{
  background: B.navy,
  color: B.white,
  borderRadius: "16px 16px 4px 16px",
  padding: "10px 14px",
  maxWidth: "80%",
  marginLeft: "auto",
  fontFamily: "'Open Sans', sans-serif",
  fontSize: 13,
}
```

**Assistant messages (left):**
```javascript
{
  background: B.ice,           // Grey/Blue — brand accent
  color: B.text,
  borderRadius: "16px 16px 16px 4px",
  padding: "10px 14px",
  maxWidth: "85%",
  fontFamily: "'Open Sans', sans-serif",
  fontSize: 13,
  borderLeft: `3px solid ${B.red}`,   // red left accent for brand identity
}
```

**Loading indicator (assistant thinking):**
Same bubble as assistant. Content: animated dots (`···`), opacity 0.6 pulse.

### 8.5 Input area

```javascript
// Container
{ borderTop: `1px solid ${B.border}`, padding: "12px 16px", display: "flex", gap: 8 }

// Input
{ ...inputStyle, flex: 1, fontSize: 13 }
// placeholder: "Ask about students, rota, rooms..."
// onKeyDown: Enter submits, Shift+Enter = newline

// Send button
{ ...btnNavy, padding: "8px 14px" }
// Disabled when input empty or loading
```

### 8.6 Empty / initial state

Shown when panel opens and no messages exist yet:

```
Centred vertically in message area:

  IcSparkles (B.navy, 36px)
  "Ask me anything about [centre name]"  — Raleway 14px, B.navy, centred

  [Suggestion chips — 3 pills]
```

**Suggestion chip style:**
```javascript
{
  display: "inline-flex", alignItems: "center", gap: 4,
  padding: "7px 14px",
  background: B.white,
  color: B.navy,
  borderRadius: 20,
  fontSize: 11,
  fontFamily: "'Raleway', sans-serif",
  fontWeight: 700,
  cursor: "pointer",
  border: `1px solid ${B.border}`,
  boxShadow: "0 1px 4px rgba(28,48,72,0.08)",
}
```

Suggestions (default):
1. "Find students without a room"
2. "What's on the excursion this week?"
3. "Check catering numbers"

Clicking a chip populates the input and submits automatically.

### 8.7 Error state

```javascript
// Assistant bubble with error style:
{
  background: B.pink,
  color: B.red,
  borderLeft: `3px solid ${B.red}`,
  // ... rest of assistant bubble style
}
// Content: "Something went wrong. Please try again."
```

### 8.8 Context loading state

Shown briefly after panel opens while `buildChatContext` runs:

```
Centred:
  [Spinner — navy]
  "Loading centre data..."  — Open Sans 12px, B.textMuted
```

### 8.9 Accessibility

| Element | Requirement |
|---------|-------------|
| Floating button | `aria-label="Open UKLC Assistant"`, `aria-expanded={isOpen}` |
| Panel | `role="dialog"`, `aria-label="UKLC Assistant"`, focus trapped |
| Close button | `aria-label="Close assistant"` |
| Send button | `aria-label="Send message"` |
| Input | `aria-label="Message"` |
| Escape key | Closes panel |
| Tab key | Cycles through: input → send → close |

---

## 9. AI Rota Stepper Specification

**File:** `components/tabs/AiRotaTab.js`

### 9.1 Stepper layout

3 steps: **Programme → Generate → Review**

```
[1 Programme] ——— [2 Generate] ——— [3 Review]
```

Step indicator style:
```javascript
// Active step
{
  background: B.navy,
  color: B.yellow,         // yellow number on navy for brand identity
  borderRadius: "50%",
  width: 28, height: 28,
  fontFamily: "'Raleway', sans-serif",
  fontWeight: 800, fontSize: 13,
}

// Completed step
{
  background: B.red,
  color: B.white,
  // show IcCheck instead of number
}

// Inactive step
{
  background: B.ice,
  color: B.textMuted,
}

// Connector line
// completed segment: B.red
// incomplete segment: B.border
```

### 9.2 AI Rota section header

The AiRotaTab header bar (above the stepper) should use the navy card with dots-grid pattern:
```javascript
{
  background: B.navy,
  borderRadius: 12,
  padding: "20px 24px",
  marginBottom: 20,
  backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)",
  backgroundSize: "16px 16px",
  borderBottom: `3px solid ${B.yellow}`,
}
```

Title: "AI Rota Generator" — Raleway 800, 18px, white
Subtitle: "Powered by Claude AI" — Open Sans, 11px, rgba(255,255,255,0.55)

### 9.3 Generate step

- Programme summary card (white, navy border-left)
- Updated constraint checklist (remove HC-007/HC-008; use navy + red checkmarks/crosses)
- **"Generate Rota"** button: `btnPrimary` (red)
- During generation: spinner + "Claude is generating your rota..." (Open Sans, `B.textMuted`)
- On success: auto-advance to Review

### 9.4 Review step

- **"Draft Rota — not yet published"** badge: `{ background: B.yellow, color: B.navy }` — prominent, Raleway 700
- Staff × date grid: same visual style as RotaTab (thStyle/tdStyle)
- **"Publish Rota"** button: `btnPrimary` (red) — enabled only when draft exists in state
- **"Start Over"** button: `btnNavy` — clears draft, returns to Programme step
- After publish: success panel (navy card with dots-grid, white text, yellow accent)

---

## 10. Audit Standards (Workstream B)

Before any tab is marked fixed, verify all of the following:

| # | Check | Standard |
|---|-------|----------|
| 1 | Brand colours only | No hex values outside B object; no greens, purples, off-brand blues/oranges |
| 2 | Navy + Red present | At least one must appear on every screen |
| 3 | Yellow used on navy surfaces | CTA buttons, active states, and accents on navy backgrounds use `B.yellow` |
| 4 | Pink/ice used correctly | Secondary cards and soft states only |
| 5 | Buttons | `btnPrimary` (red) for primary, `btnNavy` for secondary — no custom button styles |
| 6 | Table headers | `thStyle` from `components/ui.js` |
| 7 | Table cells | `tdStyle` from `components/ui.js` |
| 8 | Inputs | `inputStyle` from `components/ui.js` |
| 9 | Field labels | `<Fld>` component |
| 10 | Table containers | `<TableWrap>` |
| 11 | Sticky first column | Consistent on all wide tables |
| 12 | Totals rows | Navy background, white text, Raleway |
| 13 | Empty states | Meaningful message, not a blank space |
| 14 | Loading states | Spinner shown for all async operations |
| 15 | Geometric motifs | At least one motif per major section (diagonal texture on headers, play arrows or dots on panels) |
| 16 | Mobile 375px | No overflow, no broken layouts |
| 17 | Keyboard nav | All interactive elements reachable via Tab; visible focus ring |
| 18 | SESSION_TYPES colours | Replaced with brand-compliant palette (see section 7) |
| 19 | MEAL_COLORS | Replaced with brand-compliant palette (see section 7) |

---

## 11. Responsive Breakpoints

| Breakpoint | Width | Behaviour |
|------------|-------|-----------|
| Mobile | ≤375px | All content usable; tables scroll; chat panel full-width; stat cards wrap |
| Narrow | ≤480px | Chat panel full-width |
| Standard | >480px | Chat panel 400px fixed width |

The dashboard is primarily used on laptops. Mobile is a floor, not a target. No layout should break at 375px — but fine-tuned mobile optimisation is out of scope for v2.
