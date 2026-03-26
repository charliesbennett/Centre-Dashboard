# UKLC Centre Dashboard v2 — Architecture Document
**Version:** 1.0
**Date:** 24 March 2026
**Author:** Winston (Architect) — Agile Studio
**Status:** Draft — pending approval

---

## 1. Overview

This document describes the existing architecture of the UKLC Centre Dashboard and the structural decisions for the three v2 workstreams. It is the authoritative reference for all build agents.

**Do not invent architecture not described here.** If something is not in this document, ask before building.

---

## 2. Existing System Architecture

### 2.1 Stack (fixed — do not change)

| Layer | Technology | Notes |
|-------|-----------|-------|
| Frontend | Next.js 14 (App Router) | JavaScript, not TypeScript |
| Styling | Tailwind CSS + custom inline styles | Brand colours in `lib/constants.js` `B` object |
| Component library | Custom components in `components/ui.js` | TableWrap, StatCard, Fld, IconBtn, etc. |
| Database | Supabase (PostgreSQL) | Anon key + RLS `using(true)` pattern |
| Auth | Custom SHA-256 (`lib/useAuth.js`) | Session in `localStorage` as `uklc_user` |
| Data layer | Supabase JS client (`lib/supabaseClient.js`) | No ORM — direct table queries |
| State management | `lib/useSupabase.js` custom hook | Loads all centre data on centre selection |
| Deployment | Vercel | Next.js API routes run as serverless functions |
| AI solver | FastAPI on Railway (`uklc-rota-solver`) | Claude API, `/generate` + `/validate` endpoints |

### 2.2 File structure

```
app/
  page.js                  — main app shell, tab routing, centre selection
  layout.js                — root layout
  api/
    generate-rota/route.js — existing AI rota API route (server-side)
  room-form/[token]/page.js — public room assignment form

components/
  LoginPage.js
  ui.js                    — shared UI components
  tabs/
    StudentsTab.js
    RotaTab.js
    ProgrammesTab.js
    CateringTab.js
    TransfersTab.js
    TeamTab.js
    ExcursionsTab.js
    RoomingTab.js
    PettyCashTab.js
    ContactsTab.js
    HomeTab.js
    UsersTab.js
    AiRotaTab.js            — AI rota generator UI

lib/
  constants.js             — TABS, B (brand), uid(), date utils, ROLES, MEALS, etc.
  useSupabase.js           — data hook (loads all centre state)
  useAuth.js               — SHA-256 login, localStorage session
  supabaseClient.js        — Supabase client instance
  rotaRules.js             — session limits, NO_COUNT, role rules
  rotaIntel.md             — constraint doc fed to rota solver prompt
```

### 2.3 Auth pattern

Auth is **client-side only**. On login, SHA-256 password hash is checked against `app_users` table. The user object `{ id, email, name, role, centreId }` is stored in `localStorage` as `uklc_user`. There is no server-side session token or cookie.

**Implication for API routes:** Next.js API routes cannot verify the user from a session cookie. The security model relies on: (a) the Supabase anon key having RLS `using(true)` — acceptable for an internal tool, (b) server-side secrets (Anthropic API key, solver API key) being the gate against unauthenticated external callers.

**For `/api/chat`:** The route must require a `centreId` in the request body. It validates the centreId exists in the `centres` table before loading data. This prevents blank/malformed requests but does not constitute server-side user auth. The floating chat button is only rendered when `isAuthenticated` is true (client-side check).

### 2.4 Supabase schema (relevant tables)

| Table | Purpose |
|-------|---------|
| `centres` | All 17 centres + metadata |
| `groups` | Student groups per centre (arr/dep dates, student counts, lesson slot) |
| `students` | Individual student records linked to groups |
| `staff` | Staff records per centre (role, name, availability) |
| `rota_cells` | Rota grid: `{ centre_id, staff_id, date, slot, value }` |
| `programme_cells` | Programme grid: `{ centre_id, group_id, date, slot, value }` |
| `excursions` | Excursion records: `{ centre_id, date, destination, coaches, notes }` |
| `transfers` | Transfer records per centre |
| `rooming_houses` | House records per centre |
| `rooming_rooms` | Room records per house |
| `rooming_assignments` | Student-to-room assignments |
| `programme_settings` | JSON blobs: rooming_overrides, prog_start, prog_end |
| `app_users` | Auth table: email, password_hash, role, centre_id |

### 2.5 Data flow

```
Browser
  └── app/page.js
        ├── useAuth.js          (login, user state)
        ├── useSupabase.js      (loads all centre data on selection)
        │     └── supabaseClient.js  →  Supabase
        └── renderTab()         (routes to each Tab component)
              └── [Tab].js      (reads/writes via callbacks from page.js)
```

All writes flow through save callbacks defined in `page.js` and passed down as props. Grids use debounced diff-based upserts. Row data uses immediate upserts.

---

## 3. Workstream A — AI Rota Fix Architecture

### 3.1 Current flow (broken)

```
AiRotaTab → POST /api/generate-rota → solver /generate → writes to rota_cells → returns result
```

The problem: the solver writes to `rota_cells` during Generate. Review is reviewing live data.

### 3.2 Fixed flow

```
Generate:
  AiRotaTab → POST /api/generate-rota { programme_id, dry_run: true }
    → Railway /generate?dry_run=true
    → Claude generates rota JSON
    → enforce_hard_limits() runs
    → returns rota JSON to dashboard (NO DB write)
    → AiRotaTab stores draft rota in React state

Review:
  AiRotaTab renders draft rota from state (not from DB)
  User inspects, adjusts if needed

Publish:
  AiRotaTab → POST /api/generate-rota { programme_id, dry_run: false, rota: <draft> }
    → Railway /generate?dry_run=false (or a /publish endpoint)
    → Writes rota JSON to rota_cells
    → Sets programme status to 'active'
    → Returns confirmation
```

### 3.3 Changes required

**Dashboard (`app/api/generate-rota/route.js`):**
- Pass `dry_run` flag through to Railway solver
- Handle two response types: draft (JSON, no DB write) and confirmed (DB write complete)

**Railway solver (`solver.py`, `main.py`):**
- Add `dry_run: bool = False` parameter to `/generate` endpoint
- If `dry_run=True`: return rota JSON, skip all `rota_cells` inserts
- If `dry_run=False`: write to `rota_cells` as currently

**`AiRotaTab.js`:**
- Remove Shifts step entirely — stepper: Programme → Generate → Review (3 steps)
- Store draft rota in component state after Generate
- Render Review from state (not from DB)
- Publish button sends dry_run=false with stored draft
- Fix Publish button disabled condition: check `draftRota` in state, not `assignments`
- Update constraint checklist: remove HC-007/HC-008, reflect actual Claude constraints

### 3.4 No schema changes required for Workstream A

---

## 4. Workstream B — Audit Architecture

No new files. No schema changes. Audit produces a report; approved fixes are applied in-place.

**Audit Report location:** `docs/audit/audit-report.md`

Build agent reads each tab file, identifies issues, documents them. Charlie approves. Build agent applies only approved fixes.

---

## 5. Workstream C — AI Chatbox Architecture

### 5.1 New files

```
app/
  api/
    chat/
      route.js             — new API route (server-side, holds ANTHROPIC_API_KEY)

components/
  ChatButton.js            — floating button + panel (client component)

lib/
  buildChatContext.js      — transforms centre data into structured text summary
```

### 5.2 Component: ChatButton

A client component rendered in `app/page.js` at the root level (outside tab rendering), so it appears on all tabs.

```
<ChatButton
  centreId={selectedCentre}
  centreName={centreName}
  centreData={allCentreData}   // passed from useSupabase state
/>
```

**UI:**
- Floating button: bottom-right, fixed position, `z-index: 50`
- Navy background (`B.navy`), white chat icon
- On click: opens a slide-in panel (right side, ~400px wide on desktop, full-width on mobile)
- Panel has: close button, message history, text input, send button
- Does not obscure tab content when closed

**State:**
- `isOpen: boolean`
- `messages: [{ role, content }]`
- `context: string | null` — built once on panel open, cached until close
- `loading: boolean`

**Context loading sequence:**
1. User clicks chat button → panel opens
2. If `context` is null: call `buildChatContext(centreData)` → produces structured text summary
3. Store result in `context` state
4. Show "Ready" indicator when context is loaded
5. User submits question → POST `/api/chat` with `{ centreId, context, messages }`
6. Response appended to `messages`
7. On panel close: `context` reset to null (next open refreshes data)

### 5.3 Function: buildChatContext

Located at `lib/buildChatContext.js`. Pure function — no Supabase calls. Takes the data already loaded by `useSupabase` and returns a structured plain-text string.

**Output format (plain text, not JSON):**

```
CENTRE: [name]
CURRENT DATE: [today]
PROGRAMME: [start] to [end]

GROUPS ([n] total):
- [Group name]: [n] students, arr [date], dep [date], lesson slot [AM/PM]
...

STUDENTS ([n] total):
- [Name] (Group: [X], Room: [Y or 'unassigned'], Arr: [date], Dep: [date])
...

STAFF ([n] total):
- [Name] (Role: [X])
...

ROTA (current week):
[date] [dayname]:
  AM: [Staff: value, Staff: value, ...]
  PM: [Staff: value, ...]
  Eve: [Staff: value, ...]
...

PROGRAMME GRID (current week):
[date] [dayname]:
  AM: [Group: value, ...]
  PM: [Group: value, ...]
...

EXCURSIONS:
- [date]: [destination], coaches: [n]
...

ROOMING:
House [name]:
  Room [id]: [Student name, Student name, ...]
...

CATERING:
[date]: Breakfast [n], Lunch [n], Dinner [n]
...

TRANSFERS:
- [date] [type]: [Group name], [n] students
...
```

**Why structured text, not raw JSON:** Reduces token usage by ~60%. Claude reads narrative text more reliably than deeply nested JSON for Q&A tasks. The structure is predictable enough for accurate answers.

**Rota scope:** Include full programme range (not just current week) to answer questions like "what is the rota for next Friday?" The rota can be large — include all dates but use compact per-line format.

### 5.4 API route: /api/chat

Located at `app/api/chat/route.js`. Server-side only.

```javascript
// POST /api/chat
// Body: { centreId: string, context: string, messages: [{ role, content }] }
// Returns: { reply: string }

import Anthropic from "@anthropic-ai/sdk";

export async function POST(req) {
  const { centreId, context, messages } = await req.json();

  // Validate centreId exists (lightweight auth gate)
  if (!centreId) return Response.json({ error: "centreId required" }, { status: 400 });

  const client = new Anthropic(); // uses ANTHROPIC_API_KEY from env

  const systemPrompt = `You are a helpful assistant for UKLC centre managers.
You have access to the current data for this centre.
Answer questions accurately based only on the data provided.
If information is not in the data, say "I can't find that in the current data."
Never guess or make up student names, room numbers, or dates.
Be concise. Use plain English.

CENTRE DATA:
${context}`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: systemPrompt,
    messages: messages,
  });

  return Response.json({ reply: response.content[0].text });
}
```

**Error handling:**
- Missing centreId → 400
- Anthropic API error → 500 with plain message (not raw error)
- Response timeout: Vercel serverless function max duration set to 30s (sufficient for 1024 token responses)

### 5.5 Environment variables

| Variable | Location | Purpose |
|----------|----------|---------|
| `ANTHROPIC_API_KEY` | Vercel (server-side only) | Claude API calls from `/api/chat` |
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel (existing) | Supabase connection |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Vercel (existing) | Supabase connection |
| `NEXT_PUBLIC_SOLVER_URL` | Vercel (existing) | Railway solver URL |
| `NEXT_PUBLIC_SOLVER_API_KEY` | Vercel (existing) | Railway solver auth |

`ANTHROPIC_API_KEY` must NOT have the `NEXT_PUBLIC_` prefix — this keeps it server-side only.

### 5.6 Data flow diagram

```
User types question
  └── ChatButton.js (client)
        ├── buildChatContext(centreData) [on panel open, once]
        └── POST /api/chat { centreId, context, messages }
              └── app/api/chat/route.js (server)
                    ├── validates centreId
                    └── Anthropic SDK → claude-sonnet-4-6
                          └── returns reply → ChatButton displays it
```

---

## 6. Testing

**Framework:** Vitest (existing project standard)

**What must be tested:**
- `buildChatContext.js` — unit tests for all data transformations (students with/without rooms, empty states, date formatting)
- `rotaRules.js` session counting — existing tests must continue to pass
- AI Rota dry_run flag — test that draft state is populated and DB is not written during Generate

**What is not tested by Vitest:**
- Claude API responses (non-deterministic — test with real queries manually)
- Supabase interactions (integration — test manually against staging)

---

## 7. Key Constraints for Build Agents

1. **Do not use TypeScript.** The codebase is JavaScript. Do not add `.ts` or `.tsx` files.
2. **Do not introduce new UI libraries.** Use existing `components/ui.js` components and Tailwind.
3. **Do not change the auth system.** Custom SHA-256 stays as-is.
4. **Do not use raw SQL.** All DB access via Supabase JS client.
5. **`ANTHROPIC_API_KEY` is server-side only.** Never reference it with `NEXT_PUBLIC_` prefix. Never use it in client components.
6. **Chat is read-only.** The `/api/chat` route must never write to Supabase.
7. **Keep files under 500 lines.** If a file approaches this, split logically.
8. **Brand colours come from `B` in `lib/constants.js`.** No hardcoded hex values in components.
