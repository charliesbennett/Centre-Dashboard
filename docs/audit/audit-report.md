# UKLC Centre Dashboard — Audit Report
**Date:** 2026-03-30
**Scope:** All 10 dashboard tabs + shared UI components + constants
**Status:** Awaiting Charlie's approval — mark each issue A (approve fix) or S (skip)

---

## How to use this report

Each issue has an **ID** (e.g. `PC-1`). To approve a fix, add ✅ next to the ID. To skip, add ❌. STORY-B2 will implement everything marked ✅.

---

## STUDENTS TAB
No issues found.

---

## ROTA TAB
No issues found.

---

## PROGRAMMES TAB
No issues found.

---

## CATERING TAB
No issues found.

---

## TRANSFERS TAB

| ID | Issue | Category | Severity | Fix |
|----|-------|----------|----------|-----|
| TR-1 | Status badges use hardcoded hex colours (#dbeafe, #0369a1, #f0fdf4, #16a34a, #fef2f2, #dc2626) instead of brand constants | UI | Medium | Add extended colours to B object and replace hardcoded values |
| TR-2 | Table header background uses hardcoded light greens/reds instead of consistent brand tints | UI | Low | Use brand tint constants |

---

## TEAM TAB

| ID | Issue | Category | Severity | Fix |
|----|-------|----------|----------|-----|
| TM-1 | Email and phone links use hardcoded #0369a1 instead of a brand colour | UI | Low | Add B.link colour constant and apply |
| TM-2 | Role badge uses hardcoded #dbeafe / #1e40af backgrounds | UI | Low | Use brand palette |
| TM-3 | One StatCard accent uses hardcoded #0369a1 | UI | Low | Replace with brand constant |

---

## EXCURSIONS TAB

| ID | Issue | Category | Severity | Fix |
|----|-------|----------|----------|-----|
| EX-1 | Hardcoded hex colours throughout (orange, cyan, purple, red, green tints) — ~15 distinct values | UI | Medium | Consolidate into named constants in B or a local EXCURSION_COLORS map |
| EX-2 | Several action buttons use custom inline styles instead of btnPrimary / btnNavy | UI | Low | Replace with shared button styles from ui.js |

---

## ROOMING TAB

| ID | Issue | Category | Severity | Fix |
|----|-------|----------|----------|-----|
| RM-1 | File is 1,483 lines — well over the 500-line guideline, making it hard to maintain | Code quality | High | Split into RoomingOverviewView, RoomingHousesView, RoomingAssignView sub-components |
| RM-2 | Inline CSS string for bed styling (`.bed.away` class) embedded in JS | UI | Low | Move to a proper style block or replace with inline conditional styles |

---

## PETTY CASH TAB

| ID | Issue | Category | Severity | Fix |
|----|-------|----------|----------|-----|
| PC-1 | Two-column grid (`1fr 1fr`) breaks at 375px — income and expenses columns collide | UX | **High** | Switch to single column below 640px |
| PC-2 | Income and expense lists have no TableWrap — plain flex rows with no column headers | UI | Medium | Wrap in TableWrap with Date / Description / Amount headers |
| PC-3 | Action buttons use custom inline styles instead of btnPrimary / btnNavy | UI | Low | Replace with shared button styles |
| PC-4 | When there are no transactions the list is blank — no empty state message | UX | Low | Add "No income recorded yet" / "No expenses recorded yet" placeholder |

---

## CONTACTS TAB

| ID | Issue | Category | Severity | Fix |
|----|-------|----------|----------|-----|
| CT-1 | Contact card grid (`minmax(280px, 1fr)`) overflows on 375px — card is wider than the screen | UX | **High** | Reduce to minmax(240px, 1fr) or add a max-width + scroll |
| CT-2 | Delete button has no accessible label — screen readers see only an icon with no description | Accessibility | Medium | Add `title="Delete contact"` and `aria-label` to the button |
| CT-3 | Email and phone links use hardcoded #0369a1 | UI | Low | Add B.link constant and apply |
| CT-4 | Delete button has no visible focus ring when navigated by keyboard | Accessibility | Low | Add `:focus-visible` outline |

---

## SHARED — lib/constants.js

| ID | Issue | Category | Severity | Fix |
|----|-------|----------|----------|-----|
| CN-1 | B colour object is missing extended palette used across multiple tabs: link blue (#0369a1), success green (#16a34a), warning orange (#d97706), danger red (#dc2626), purple (#7c3aed) | Code quality | Medium | Add these to B so all tabs can reference them consistently |

---

## Summary

| Category | High | Medium | Low | Total |
|----------|------|--------|-----|-------|
| UI | 0 | 3 | 8 | 11 |
| UX | 2 | 1 | 1 | 4 |
| Accessibility | 0 | 1 | 1 | 2 |
| Code quality | 1 | 1 | 0 | 2 |
| **Total** | **3** | **6** | **10** | **19** |

**Bugs found: 0** — no data loss or incorrect behaviour detected.

---

## Recommended priority for STORY-B2

**Fix first (High severity):**
- PC-1: Petty Cash mobile layout
- CT-1: Contacts card mobile overflow
- RM-1: Split RoomingTab into sub-components

**Fix second (Medium severity):**
- CN-1: Extend B colour constants
- TR-1 / EX-1: Replace hardcoded colours with brand constants once CN-1 is done
- PC-2: Add TableWrap to Petty Cash lists
- CT-2: Accessible delete button label

**Fix if time allows (Low severity):**
- All remaining low items
