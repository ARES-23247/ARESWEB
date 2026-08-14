# Public Team Roster Follow-up Review

- Date: August 14, 2026
- Original baseline: `8ae3afb7a99415d5fee9aebde08829b860de03b3`
- Follow-up scope: public roster DTO, consent copy, role badges, and focused tests
- Production mutation: none during review

## Corrected findings

### RST-01 — Fun facts were made public without matching consent disclosure

- **Severity**: high
- **Confidence**: high
- **Evidence**: The public `about-roster` DTO began returning `funFact`, while the profile privacy control described only biography, nickname, and subteams as public. The field may belong to a student profile and was not required for the public roster.
- **Impact**: A profile detail could be disclosed without clear, field-specific notice to the member.
- **Remediation**: Removed `funFact` from the public DTO and About page. The field remains available to its owner in the private profile. Student DTOs are additionally limited to approved nickname, avatar, and the non-identifying student role label; the client enforces the same boundary against stale responses. Updated the privacy control to state the student/adult distinction and that fun facts remain private.
- **Acceptance test**: Backend and frontend roster tests supply a fun fact and verify that it is absent from the public response and rendered page.

### RST-02 — Role badges improve roster clarity without expanding identity data

- **Severity**: informational
- **Confidence**: high
- **Evidence**: Member type was already part of the approved public DTO and used for filtering.
- **Remediation**: Retained the role badge because it presents an existing public field and does not expand the DTO.

## Verification evidence

Only commands actually run during the follow-up should be recorded in the delivery summary.
