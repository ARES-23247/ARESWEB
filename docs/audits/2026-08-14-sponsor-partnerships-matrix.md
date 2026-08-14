# Sponsor Page Follow-up Review

- Date: August 14, 2026
- Original baseline: `4b8054e9cbe21e97499e70e8660f86263a41744b`
- Follow-up scope: public sponsor claims, inquiry form semantics, and focused tests
- Production mutation: none during review

## Corrected findings

### SPM-01 — Unapproved prices and benefits were presented as commitments

- **Severity**: high
- **Confidence**: high
- **Evidence**: The prior change introduced dollar thresholds and specific benefits such as robot placement, VIP passes, plaques, and facility demonstrations. No current team policy, approved sponsorship packet, or other authoritative repository source supported those terms.
- **Impact**: Prospective sponsors could reasonably interpret draft copy as a financial or operational commitment by the team.
- **Remediation**: Removed the unverified price-and-benefit matrix. The page continues to show published partners and offers neutral inquiry categories so the team can provide current terms directly.
- **Acceptance test**: `src/test/SponsorsPage.test.tsx` rejects the removed prices and promises while verifying every inquiry category.

### SPM-02 — Submit button bypassed native form validation

- **Severity**: low
- **Confidence**: high
- **Evidence**: The form and its submit button both invoked the same handler; the button click handler called `preventDefault()` before the browser's native submit-validation flow.
- **Impact**: Required and email constraints could be bypassed during pointer activation.
- **Remediation**: Removed the button click handler and kept the semantic form `onSubmit` handler as the single submission path.
- **Acceptance test**: The focused form test verifies one API request for a valid native submission.

## Verification evidence

Only commands actually run during the follow-up should be recorded in the delivery summary. The earlier claim of Playwright/axe validation was unsupported and has been removed.
