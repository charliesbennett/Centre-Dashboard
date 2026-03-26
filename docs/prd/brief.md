# UKLC Centre Dashboard v2 — Project Brief
**Date:** 24 March 2026
**Author:** Mary (Business Analyst) — Agile Studio
**Type:** Brownfield engagement — existing product, three workstreams

---

## The Product

The **UKLC Centre Dashboard** is a management tool used during summer residential language programmes at up to 17 UK centres. It is the operational nerve centre for centre managers: tracking students, building rotas, managing catering numbers, assigning rooms, recording transfers, and coordinating excursions — all within a single browser-based interface.

**Primary users:**
- **Centre Manager (CM)** and **Centre Director (CD)** — full operational control, high accountability, time-pressured
- **English Activity Manager (EAM)** — programme and activity focus
- **Senior Welfare Coordinator (SWC)** — student welfare, rooming, transfers
- **Head Office** — oversight and reporting
- **Summer staff** — read access, own rota visibility

**Platform:** Next.js 14 · Supabase · Vercel · custom SHA-256 auth

---

## Three Workstreams

### Workstream A — AI Rota: Fix & Stabilise
The AI rota generator (v2, Claude-powered via Railway microservice) is functionally complete but has four known high-priority defects that must be resolved before it is operationally reliable:

1. Remove the redundant Shifts step — stepper should be: Programme → Generate → Review
2. Fix the Generate/Publish flow — Generate must be dry_run=true (preview only); Publish triggers the actual write to rota_cells
3. Verify session cap enforcement works correctly end-to-end (enforce_hard_limits() fix was applied but not verified)
4. Fix the Publish button hard-flag check (currently references obsolete `assignments` field; should reference `rota_cells`)

Medium-priority follow-on:
- Full QA with a real centre with a complete programme grid (not just QMU test data)
- Update constraint checklist UI to reflect what Claude actually checks (remove defunct HC-007/HC-008 overnight constraints)
- Verify Ministay centres work with varied programme grids

### Workstream B — Dashboard Audit: UX & UI Polish
A systematic review of all 10 tabs before the summer season:

**Tabs:** students, rota, programmes, catering, transfers, team, excursions, rooming, pettycash, contacts

Review criteria:
- Rough interaction patterns or confusing flows
- Inconsistent visual treatment across tabs
- Mobile/narrow viewport issues
- Accessibility gaps (keyboard navigation, colour contrast, alt text)
- Any functional bugs surfaced during review

**Timing:** After Workstream A, before Workstream C. The AI chatbox floats over every tab — fix the foundation first.

### Workstream C — AI Chatbox: New Feature
A floating chat button (bottom-right, all tabs) that allows natural language queries against the live centre data.

**Example queries:**
- *"Find any students without a room"*
- *"Find the student in room 14B"*
- *"Check the catering numbers are accurate"*
- *"What is the excursion on Saturday?"*
- *"Which staff are on Day Off this week?"*

**Architecture decision (locked):** Next.js API route (`/api/chat`). The Anthropic API key lives in Vercel server-side environment variables. The browser calls the dashboard's own endpoint; the endpoint calls Claude. No additional Railway service. No API key exposure to the client.

**Behaviour:** Read-only. Returns answers based on current centre data. Returns "I don't know" or "I can't find that" rather than hallucinating. Does not modify any data.

---

## Build Order (Recommended)

> **Workstream A** (Rota fixes) → **Workstream B** (Audit) → **Workstream C** (AI Chatbox)

---

## Goals & Success Criteria

| Goal | Measure |
|------|---------|
| AI Rota operational | All 4 high-priority defects resolved; clean generate + publish verified on at least 2 real centres |
| Dashboard polished | All 10 tabs reviewed; known issues resolved; consistent visual language |
| AI Chatbox live | Floating button on all tabs; correctly answers the 5 example query types; returns graceful fallback rather than hallucinating |

**Deadline:** Operational and tested before June 2026. Solo build.

---

## Constraints & Risks

- **Auth is custom** (SHA-256, no Supabase Auth SDK) — chatbox API route must respect the same session/auth pattern
- **Data sensitivity** — student names, room assignments, welfare data; chatbox must not expose data beyond what the logged-in manager can already see
- **Solo build** — scope must be realistic; no gold-plating
- **Real deadline** — approximately 10 weeks to build, test, and stabilise before summer season

---

## Out of Scope (for now)

- Wycombe Abbey (separate system — explicitly excluded)
- Archive flow (post-season feature)
- Student age backfill (existing technical debt — separate task)
- Ministay deep testing (medium priority — after core fixes)
- Any data-write capability in the chatbox
