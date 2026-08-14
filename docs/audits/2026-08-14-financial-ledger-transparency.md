# Financial Ledger Transparency & CSV Export Audit

- Date: August 14, 2026
- Audited baseline: `5f5ddb2dceeaa44a695382ca2247bc48428aee4e` (`origin/master`)
- Branch: `codex/continuous-audit-cycle-3`
- Scope: Public financial ledger route, DTO boundary, deleted/void transaction filtering, CSV export generation, formula injection protection, and transparency UX
- Production mutation: none

---

## Confirmed Findings and Remediation

### FLT-01 — Public Finance Route Did Not Filter Soft-Deleted or Void Transactions

- **Severity**: medium
- **Confidence**: high
- **Evidence**: `functions/src/routes/finance.ts` queried `finance_transactions` ordered by date without checking `isDeleted === 1` or `status === "void"`.
- **Impact**: Inadvertently created, canceled, or archived transactions would continue to be returned to the public API and included in community financial ledger calculations.
- **Remediation**: Added server-side filtering on `snapshot.docs` to reject any document where `isDeleted === 1` or `status === "void"`, maintaining a strictly verified DTO boundary.
- **Acceptance test**: `functions/src/routes/__tests__/finance.test.ts` exercises mock documents with `isDeleted: 1` and `status: "void"` and confirms they are completely excluded from the JSON response.
- **Status**: fixed.

### FLT-02 — Missing 1-Click CSV Export for Donors, Sponsors, and Grant Reviews

- **Severity**: low
- **Confidence**: high
- **Evidence**: The public financial ledger offered filtering and cursor pagination, but lacked a structured CSV export capability for sponsors and grant applications.
- **Impact**: Donors, sponsors, and grant auditors had to manually transcribe ledger rows.
- **Remediation**: Created `src/lib/financeCsv.ts` supporting standard RFC-4180 CSV formatting, formula injection protection (protecting against unquoted formulas while permitting negative numbers), and UTF-8 BOM encoding for Microsoft Excel. Added a prominent `Export CSV` action button to `src/app/finance/page.tsx`.
- **Acceptance test**: `src/test/financeCsv.test.ts` (4 tests) and `src/test/ShellUtilityPages.test.tsx` validate CSV formatting, formula escaping, data URLs, and download behavior.
- **Status**: fixed.

---

## Verification Evidence

- `pnpm vitest run src/test/ShellUtilityPages.test.tsx src/test/financeCsv.test.ts`: 9/9 tests passed.
- `pnpm --filter functions test src/routes/__tests__/finance.test.ts`: 1/1 test passed.
- Scoped ESLint & TypeScript: 0 warnings, 0 errors.
