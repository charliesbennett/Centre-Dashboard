# UKLC Centre Dashboard v2 — Product Requirements Document
**Version:** 1.0
**Date:** 24 March 2026
**Author:** John (Product Manager) — Agile Studio
**Status:** Draft — pending approval

---

## 1. Purpose

This PRD defines the scope, requirements, and acceptance standards for the second major development phase of the UKLC Centre Dashboard. It covers three workstreams to be delivered before June 2026:

- **Workstream A** — AI Rota: fix and stabilise the existing Claude-powered rota generator
- **Workstream B** — Dashboard audit: discover and fix bugs, UX rough edges, and UI inconsistencies across all 10 tabs
- **Workstream C** — AI Chatbox: a new floating natural-language assistant for querying live centre data

Build order is fixed: A → B → C.

---

## 2. Background

The UKLC Centre Dashboard is a browser-based operational tool used at up to 17 summer residential language centres across the UK. It is the primary system for centre managers during the summer season (June–August).

**Stack:** Next.js 14 · Supabase (PostgreSQL) · Vercel · custom SHA-256 auth
**Tabs (10):** students, rota, programmes, catering, transfers, team, excursions, rooming, pettycash, contacts

An AI rota generator (v2) was recently added: a FastAPI microservice on Railway that calls the Claude API to generate staff rotas from programme data. It is functionally complete but has known defects.

---

## 3. Users

| Role | Description | Primary concern |
|------|-------------|-----------------|
| Centre Manager (CM) | Day-to-day operational lead | Accuracy, speed, no surprises |
| Centre Director (CD) | Senior onsite authority | Compliance, overview |
| English Activity Manager (EAM) | Programme and activities | Rota, excursions, programme grid |
| Senior Welfare Coordinator (SWC) | Student welfare | Rooming, transfers, student records |
| Head Office | Remote oversight | Data integrity, reporting |
| Summer staff | Read-only, own rota | Clarity of their own schedule |

---

## 4. Workstream A — AI Rota: Fix & Stabilise

### 4.1 Goal
The AI rota generator must be operationally reliable before the summer season. Managers must be able to generate, review, and publish a rota with confidence in its accuracy.

### 4.2 High-Priority Defects (must fix)

**A1 — Remove redundant Shifts step**
The stepper currently shows: Programme → Shifts → Generate → Review.
The Shifts step is a leftover from v1 (OR-Tools). The v2 solver reads `programme_cells` directly and does not use shifts.
Stepper must become: **Programme → Generate → Review** (3 steps).
All shift template UI must be removed from `AiRotaTab.js`.

**A2 — Fix Generate/Publish flow**
Currently, clicking Generate writes the rota to `rota_cells` immediately (live data). The Review step is therefore reviewing already-published data, which is misleading.
Required behaviour:
- Generate → calls solver with `dry_run=true` → returns a draft rota in memory/state only, nothing written to DB
- Review → user inspects the draft
- Publish → calls solver (or a write endpoint) to commit the rota to `rota_cells` → sets programme status to `active`

**A3 — Verify session cap enforcement**
`enforce_hard_limits()` in `solver.py` was fixed (removed duplicate import causing silent crash) but has not been verified with a clean generate.
Required: run a full generate on at least one real centre and confirm all staff session counts are at or below their role limits (TAL ≤22, FTT ≤22, 5FTT ≤20, LAL/SAI/EAL etc. ≤24).

**A4 — Fix Publish button hard-flag check**
The Publish button's disabled condition references `assignments` (v1 field, no longer populated). It must reference `rota_cells` (v2 output).

### 4.3 Medium-Priority (fix before June)

**A5 — Full QA with real centre**
QMU was used as test data. Run a full generate + review + publish cycle on at least one centre with a complete programme grid: multiple arrival groups, excursion days, testing days, Ministay variant.

**A6 — Update constraint checklist UI**
The checklist shown during Generate still references HC-007 and HC-008 (overnight constraints, removed). Update to reflect what Claude actually enforces.

**A7 — Ministay centre verification**
Ministay centres use `turn_length_days = 7`. Verify the solver handles 7-day programmes correctly (1 day off, session counts pro-rated).

### 4.4 Out of scope (Workstream A)
- Archive flow (post-season)
- Student age backfill
- Wycombe Abbey
- Repurposing or deleting the unused `shifts`/`assignments` DB tables

---

## 5. Workstream B — Dashboard Audit

### 5.1 Goal
Identify and fix unknown bugs, UX rough edges, and UI inconsistencies across all 10 tabs. The result must be a dashboard that feels intentional and consistent — not assembled tab by tab.

### 5.2 Process (two-phase)

**Phase 1 — Discovery**
Conduct a systematic audit of all 10 tabs. Produce an **Audit Report** listing every issue found, categorised as:
- **Bug** — incorrect behaviour, data error, broken interaction
- **UX** — confusing flow, missing feedback, unclear labelling, poor empty state
- **UI** — visual inconsistency, spacing, colour misuse, typography

Each issue: tab, description, severity (high/medium/low), recommended fix.

**Phase 2 — Fix (approved issues only)**
Charlie reviews the Audit Report and approves issues for fixing. Only approved issues are fixed. No opportunistic refactoring.

### 5.3 Audit scope per tab

| Tab | Key audit focus |
|-----|-----------------|
| Students | Group assignment, arrival/departure dates, age data display |
| Rota | Session count display, cell editing, sticky header/column behaviour |
| Programmes | Turn creation, date handling, status labels |
| Catering | Number accuracy, meal type display, date range |
| Transfers | Arrival/departure logic, group matching |
| Team | Staff role display, availability editing |
| Excursions | Date/destination grid, coach assignment |
| Rooming | Overview vs Houses view, bed assignment UX, occupancy display |
| Pettycash | Entry recording, totals |
| Contacts | Display and edit flow |

### 5.4 UI standards to enforce across all tabs
- Brand colours: navy `#1c3048`, red `#ec273b` — no ad-hoc colours
- All interactive elements keyboard-navigable
- Consistent use of shared components: `TableWrap`, `StatCard`, `Fld`, `IconBtn`
- Sticky first column on wide tables (consistent implementation)
- Navy totals rows where applicable (consistent background/text)
- No layout breakage at 375px viewport width

### 5.5 Out of scope (Workstream B)
- Feature additions (those go in Workstream C or future sprints)
- Redesigning tab architecture or navigation
- Performance optimisation (unless a bug is causing visible slowness)

---

## 6. Workstream C — AI Chatbox

### 6.1 Goal
A floating natural-language assistant that allows managers to query live centre data in plain English. It surfaces answers instantly, reduces the need to navigate between tabs, and flags data gaps or inconsistencies when asked.

### 6.2 User experience

**Entry point:** A floating button, bottom-right corner, visible on all 10 tabs. Chat icon. Does not obscure tab content.

**Interaction:** User clicks button → chat panel opens (overlay or side drawer). User types a question. Response appears within the panel. User can ask follow-up questions. Close button returns to the tab.

**Example queries the chatbox must handle:**
1. *"Find any students without a room"* → lists student names with no room assignment
2. *"Find the student in room 14B"* → names the student(s) assigned to that room
3. *"Check the catering numbers are accurate"* → compares catering entries against student headcount and flags discrepancies
4. *"What is the excursion on Saturday?"* → returns destination and coach details for the relevant date
5. *"Which staff are on Day Off this week?"* → returns staff names and dates from the rota

### 6.3 Technical design

**Architecture:** Next.js API route at `/api/chat`. The Anthropic API key is stored as a Vercel server-side environment variable (`ANTHROPIC_API_KEY`). The browser calls `/api/chat` — the key is never exposed to the client.

**Context strategy:** When the user opens the chat panel, the client loads the full dataset for the currently selected centre (all 10 tab datasets from Supabase) once and caches it for the lifetime of that panel session. Each message sends the cached context to `/api/chat` alongside the user's question. Claude returns a plain-language answer. Context is refreshed if the user closes and reopens the panel.

**Model:** claude-sonnet-4-6 (latest available at build time — use the most capable Sonnet).

**Data access:** Read-only. The chatbox never modifies Supabase data.

**Auth:** The `/api/chat` route must verify the user is authenticated (same session check as other protected routes) before loading any Supabase data.

**Scope of knowledge:** The chatbox answers questions about the currently selected centre only. It does not answer questions about other centres.

### 6.4 Behaviour requirements

| Scenario | Required behaviour |
|----------|--------------------|
| Question answered from data | Returns a clear, plain-English answer |
| Data not found | Returns "I couldn't find [X] for this centre" — no hallucination |
| Data gap detected (e.g. student with no room) | Lists the specific missing items clearly |
| Ambiguous question | Asks a clarifying question before answering |
| Question outside data scope | "I can only answer questions about [centre name]'s data" |
| No centre selected | "Please select a centre first" |

### 6.5 Out of scope (Workstream C)
- Write operations (booking rooms, editing rotas, etc.)
- Multi-centre queries
- Export of chat history
- Voice input

---

## 7. Non-functional Requirements

| Requirement | Standard |
|-------------|----------|
| Auth | All routes and API endpoints require valid session |
| Data sensitivity | No student or staff data returned to unauthenticated requests |
| Mobile | All UI functional at 375px width |
| Accessibility | WCAG 2.1 AA minimum |
| Performance | Chatbox response within 10 seconds on typical query |
| API key security | `ANTHROPIC_API_KEY` server-side only, never in client bundle |

---

## 8. Prioritised Feature List

| ID | Feature | Workstream | Priority |
|----|---------|------------|----------|
| F-A1 | Remove Shifts step from AI Rota stepper | A | Must |
| F-A2 | Fix Generate (dry run) / Publish (write) flow | A | Must |
| F-A3 | Verify session cap enforcement end-to-end | A | Must |
| F-A4 | Fix Publish button hard-flag check | A | Must |
| F-A5 | Full QA with real centre programme grid | A | Should |
| F-A6 | Update constraint checklist UI | A | Should |
| F-A7 | Ministay centre verification | A | Should |
| F-B1 | Audit Report — all 10 tabs | B | Must |
| F-B2 | Fix approved bugs from audit | B | Must |
| F-B3 | Fix approved UX issues from audit | B | Should |
| F-B4 | Fix approved UI issues from audit | B | Should |
| F-C1 | Floating chat button (all tabs) | C | Must |
| F-C2 | Chat panel UI | C | Must |
| F-C3 | /api/chat route with auth + context loading | C | Must |
| F-C4 | Claude integration — answer generation | C | Must |
| F-C5 | Graceful fallback for unknown/out-of-scope queries | C | Must |

---

## 9. Definition of Done

A workstream is done when:
1. All Must features for that workstream pass their acceptance criteria
2. `npm test` passes with no failures
3. No console errors on `npm run dev`
4. All UI verified at 375px width
5. No regressions in other tabs introduced by changes

---

## 10. Deadline

All three workstreams operational and tested: **before June 2026.**
