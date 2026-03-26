# STORY-C1: AI Chatbox — Backend (Context Builder + API Route)

**Epic:** Workstream C — AI Chatbox
**Status:** Ready
**Sprint:** 3
**Dependencies:** STORY-B2 (Workstream B complete — chatbox built on polished foundation)

---

## User Story

As a centre manager, I want the dashboard to be able to answer my questions about the current centre's data, so I don't have to navigate between tabs to find information.

---

## Background

This story builds the backend of the AI chatbox: the `buildChatContext` function that transforms centre data into a structured text summary, and the `/api/chat` Next.js API route that calls Claude with that context. No UI is built in this story — only the data layer and API. This allows the backend to be tested independently before the UI is wired in STORY-C2.

---

## Acceptance Criteria

**AC1 — buildChatContext produces a non-empty summary**
Given a centre's data loaded from useSupabase (groups, students, staff, rotaGrid, progGrid, excursions, transfers, roomingHouses, roomingRooms, roomingAssignments, settings),
When `buildChatContext(centreData, centreName)` is called,
Then it returns a non-empty string containing sections for: Centre, Groups, Students, Staff, Rota, Programme Grid, Excursions, Rooming, and Transfers.

**AC2 — Students with no room are identifiable from context**
Given a centre where some students have no room assignment,
When `buildChatContext` is called,
Then the Students section lists each student with their room assignment or "unassigned" if none exists.

**AC3 — /api/chat returns an answer**
Given a valid POST to `/api/chat` with `{ centreId, context, messages: [{ role: "user", content: "What is the excursion on Saturday?" }] }`,
When the route processes the request,
Then it returns `{ reply: "<plain English answer>" }` with HTTP 200.

**AC4 — /api/chat returns 400 when centreId is missing**
Given a POST to `/api/chat` with no `centreId`,
When the route processes the request,
Then it returns HTTP 400 with `{ error: "centreId required" }`.

**AC5 — Claude does not hallucinate absent data**
Given a query asking for a student that does not exist in the context,
When `/api/chat` processes the request,
Then the reply contains "I can't find" or "not in the data" — not an invented name or room.

**AC6 — Context is a structured summary, not raw JSON**
Given `buildChatContext` is called with a full centre dataset,
When I read the returned string,
Then it is formatted as readable plain text with labelled sections (e.g. "STUDENTS (24 total):") — not a JSON blob.

**AC7 — ANTHROPIC_API_KEY is not exposed to the client**
Given the `/api/chat` route is deployed,
When I inspect the browser network requests and the client-side JS bundle,
Then `ANTHROPIC_API_KEY` does not appear anywhere in client-accessible code or responses.

---

## Technical Notes

**New files:**
- `lib/buildChatContext.js` — pure function, no Supabase calls, takes centreData object
- `app/api/chat/route.js` — POST handler, server-side only

**`buildChatContext` output format** (per architecture doc section 5.3):
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

ROTA:
[date] [dayname]:
  AM: [Staff: value, ...]
  PM: [Staff: value, ...]
  Eve: [Staff: value, ...]
...

PROGRAMME GRID:
[date] [dayname]:
  AM: [Group: value, ...]
  PM: [Group: value, ...]
...

EXCURSIONS:
- [date]: [destination], coaches: [n]
...

ROOMING:
House [name]:
  Room [id]: [Student name, ...]
  Room [id]: unoccupied
...

TRANSFERS:
- [date] [type]: [Group name], [n] students
...
```

**`/api/chat` system prompt:**
```
You are a helpful assistant for UKLC centre managers.
Answer questions accurately based only on the data provided below.
If information is not in the data, say "I can't find that in the current data."
Never guess or make up student names, room numbers, or dates.
Be concise. Use plain English.

CENTRE DATA:
[context]
```

**Model:** `claude-sonnet-4-6`
**Max tokens:** 1024
**Vercel function max duration:** 30s (add `export const maxDuration = 30` to route)

---

## Tests

- Vitest: `buildChatContext` with full mock centre data — returns string containing all section headers
- Vitest: `buildChatContext` with student having roomingAssignment — student line shows room label
- Vitest: `buildChatContext` with student having no roomingAssignment — student line shows "unassigned"
- Vitest: `buildChatContext` with empty groups array — returns "GROUPS (0 total):" without crashing
- Vitest: `buildChatContext` with empty staff array — returns "STAFF (0 total):" without crashing
- Vitest: `buildChatContext` with null/undefined data fields — handles gracefully, no crash
