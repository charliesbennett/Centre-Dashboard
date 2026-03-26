# Sprint 2 — Dashboard Audit & Polish

**Sprint goal:** Every tab has been reviewed, known issues are documented, and approved fixes are applied. The dashboard looks and feels like a UKLC product.

**Stories:**
1. STORY-B1 — Dashboard audit (all 10 tabs, produces audit report) — *depends on Sprint 1 complete*
2. STORY-B2 — Apply approved fixes — *depends on B1 and Charlie's approval of issue list*

**Build sequence:** B1 → [Charlie reviews audit report] → B2

**Note:** There is a manual gate between B1 and B2. B2 cannot begin until Charlie has reviewed `docs/audit/audit-report.md` and marked which issues are approved for fixing.

**Definition of Done:**
- Audit report covers all 10 tabs
- All approved issues are fixed and re-verified
- `npm test` passes with no regressions
- All 10 tabs verified at 375px
- SESSION_TYPES and MEAL_COLORS use brand-compliant colours (if approved)
