# Requirements: v3.2 Operations & UX Refinement

## Active Requirements

### Calendar (CAL)
- [ ] **CAL-01**: Provide direct subscription buttons/links (iCal/WebCal format) for Apple Calendar, Outlook, and Google Calendar on the events page so users can sync the feed natively.

### Finance (FIN)
- [ ] **FIN-01**: Add the ability to delete a budget item from the Finance Manager interface and ensure the backend API supports it.
- [ ] **FIN-02**: Ensure that dragging a sponsorship lead to the "completed" column on the Kanban board is idempotent. It should only add the sponsorship amount to the budget once, even if the user drags it back and forth or if it's already recorded.

### Testing (TST)
- [ ] **TST-01**: Maximize test coverage for the backend `finance` API routes, ensuring 100% line coverage for the new idempotency and deletion logic.

## Traceability
- **CAL-01** → Phase 01
- **FIN-01** → Phase 02
- **FIN-02** → Phase 02
- **TST-01** → Phase 02
