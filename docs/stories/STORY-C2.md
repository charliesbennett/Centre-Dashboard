# STORY-C2: AI Chatbox — ChatButton UI Component

**Epic:** Workstream C — AI Chatbox
**Status:** Ready
**Sprint:** 3
**Dependencies:** STORY-C1 (API route must exist before UI can be wired to it)

---

## User Story

As a centre manager, I want a floating chat button on every tab that opens a panel where I can ask questions about my centre's data, so I can get answers without navigating between tabs.

---

## Background

This story builds the `ChatButton` component — the floating button and slide-in panel — and wires it into `app/page.js` so it appears on all tabs. The component calls the `/api/chat` route built in STORY-C1, using centre data already loaded by `useSupabase` as context (built once on panel open, cached until close).

All visual details are specified in `docs/ui/frontend-spec.md` sections 8.1–8.9.

---

## Acceptance Criteria

**AC1 — Floating button visible on all tabs**
Given I am logged in and have a centre selected,
When I navigate to any of the 10 tabs,
Then the floating chat button is visible in the bottom-right corner.

**AC2 — Button not visible when no centre selected**
Given I am logged in but have not selected a centre,
When I view the dashboard,
Then the floating chat button is not visible.

**AC3 — Panel opens on button click**
Given the floating button is visible,
When I click it,
Then the chat panel slides in from the right and the button remains visible.

**AC4 — Context loads on panel open**
Given the panel has just opened,
When I see the initial state,
Then a brief loading indicator appears ("Loading centre data...") followed by the empty state with suggestion chips.

**AC5 — Suggestion chips populate input**
Given the panel is open and showing the empty state,
When I click a suggestion chip,
Then the input field is populated with that suggestion's text and the message is submitted automatically.

**AC6 — User message appears in panel**
Given I type a message and press Send (or Enter),
When the message is submitted,
Then my message appears as a navy bubble on the right side of the panel, and a loading indicator appears while waiting for a response.

**AC7 — Assistant response appears in panel**
Given a message has been submitted,
When the response is received from `/api/chat`,
Then the assistant's reply appears as a grey/blue bubble on the left side with a red left border.

**AC8 — Conversation history is maintained**
Given I have had an exchange of 3 or more messages,
When I ask a follow-up question,
Then all previous messages are included in the context sent to `/api/chat` (up to the panel session).

**AC9 — Error state is shown on API failure**
Given the `/api/chat` route returns an error,
When the response is received,
Then a pink/red error bubble appears: "Something went wrong. Please try again."

**AC10 — Panel closes on X button or Escape**
Given the panel is open,
When I click the X button or press Escape,
Then the panel closes, the context is cleared, and the floating button is visible.

**AC11 — Panel is full-width on mobile**
Given I am viewing at 375px viewport width,
When the panel is open,
Then it occupies the full viewport width.

**AC12 — Panel header matches brand spec**
Given the panel is open,
When I view the header,
Then it shows: navy background with dots-grid texture, yellow bottom border, IcSparkles icon, "Ask UKLC Assistant" title in white Raleway, centre name in muted white below.

**AC13 — Keyboard accessible**
Given the panel is open,
When I use Tab to navigate,
Then focus cycles through: input → Send button → close button. Escape closes the panel.

---

## Technical Notes

**New file:** `components/ChatButton.js`

**Wire into `app/page.js`:**
```jsx
// After renderTab(), at bottom of authenticated view:
{selectedCentre && (
  <ChatButton
    centreId={selectedCentre}
    centreName={centreName}
    centreData={{
      groups, students, staff, rotaGrid, progGrid,
      excursions, transfers, settings,
      roomingHouses, roomingRooms, roomingAssignments
    }}
  />
)}
```

**Context caching pattern:**
```javascript
const [context, setContext] = useState(null);
const [isOpen, setIsOpen] = useState(false);

// On open:
const handleOpen = () => {
  setIsOpen(true);
  if (!context) {
    const summary = buildChatContext(centreData, centreName);
    setContext(summary);
  }
};

// On close:
const handleClose = () => {
  setIsOpen(false);
  setContext(null);  // refresh on next open
  setMessages([]);
};
```

**Message submission:**
```javascript
// POST /api/chat with full message history + context
const res = await fetch("/api/chat", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    centreId,
    context,
    messages: [...messages, { role: "user", content: input }]
  })
});
```

**Panel animation:**
```css
/* Slide in from right */
transform: translateX(100%);  /* closed */
transform: translateX(0);     /* open */
transition: transform 200ms ease;
```

All styles per `docs/ui/frontend-spec.md` sections 8.1–8.9. Use `B` object from `lib/constants.js` for all colours.

**Add to `components/ui.js`:**
- `IcChat` icon (spec section 5)
- `btnYellow` style object (spec section 5)

---

## Tests

- Vitest: `ChatButton` renders floating button when `centreId` is provided
- Vitest: `ChatButton` does not render when `centreId` is null/undefined
- Vitest: panel `isOpen` state toggles on button click
- Vitest: `handleClose` resets `context` to null and `messages` to empty array
- Vitest: message submission appends user message to `messages` state
