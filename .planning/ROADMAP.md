# Roadmap: v3.2 Operations & UX Refinement

**2 phases** | **3 requirements mapped** | All covered ✓

| # | Phase | Goal | Requirements | Success Criteria |
|---|-------|------|--------------|------------------|
| 01 | Calendar Subscriptions | Native iCal/WebCal subscription links for Apple/Google Calendar. | CAL-01 | 2 |
| 02 | Finance Manager Fixes | Fix budget deletion and Kanban idempotency bugs. | FIN-01, FIN-02 | 2 |

### Phase Details

**Phase 01: Calendar Subscriptions**
Goal: Native iCal/WebCal subscription links for Apple/Google Calendar.
Requirements: CAL-01
Success criteria:
1. Users can click a button to subscribe to the calendar in their native client (Apple/Google/Outlook).
2. The iCal feed provides a valid `.ics` format stream of all live events.

**Phase 02: Finance Manager Fixes**
Goal: Fix budget deletion and Kanban idempotency bugs, maximizing API test coverage.
Requirements: FIN-01, FIN-02, TST-01
Success criteria:
1. Users can delete budget items and the UI reflects the removed amount.
2. Dropping a sponsorship into "Completed" multiple times only adds the budget amount once.
3. Finance API test coverage is maintained at 100% line coverage.
