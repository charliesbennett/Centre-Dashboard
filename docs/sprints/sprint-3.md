# Sprint 3 — AI Chatbox

**Sprint goal:** A floating chat assistant is available on all tabs, answers questions accurately about the current centre's data, and looks distinctly UKLC.

**Stories:**
1. STORY-C1 — Backend: buildChatContext + /api/chat route — *depends on Sprint 2 complete*
2. STORY-C2 — Frontend: ChatButton component, wired into app/page.js — *depends on C1*

**Build sequence:** C1 → C2

**Definition of Done:**
- Floating button visible on all tabs when a centre is selected
- Context loads on panel open (once, cached for session)
- All 5 example query types return accurate answers
- No student names, room numbers, or dates are hallucinated
- ANTHROPIC_API_KEY not present in client bundle
- Panel accessible by keyboard, closes on Escape
- Panel full-width at 375px
- `npm test` passes
