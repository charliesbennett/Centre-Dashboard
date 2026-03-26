# Sprint 1 — AI Rota Fix & Stabilise

**Sprint goal:** The AI rota generator is reliable, honest about what's live vs draft, and ready for use on real centres.

**Stories:**
1. STORY-A1 — Fix AiRotaTab UI (stepper, publish button, constraint checklist)
2. STORY-A2 — Fix Generate/Publish flow (dry run architecture) — *depends on A1*
3. STORY-A3 — Full QA verification with real centres — *depends on A1, A2*

**Build sequence:** A1 → A2 → A3

**Definition of Done:**
- All acceptance criteria pass on a single clean run
- `npm test` passes
- No console errors on `npm run dev`
- Published rota from AI Rota tab appears correctly in Rota tab
- Session counts verified within limits on at least one real centre
