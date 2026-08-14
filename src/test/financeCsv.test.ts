import { describe, it, expect } from "vitest";
import {
  buildFinanceCsv,
  financeCsvDataUrl,
  financeCsvFilename,
  type FinanceCsvRecord,
} from "@/lib/financeCsv";

describe("financeCsv export", () => {
  const sampleTransactions: FinanceCsvRecord[] = [
    {
      id: "tx-1",
      date: "2026-08-01",
      type: "income",
      category: "Sponsorship",
      description: "Appalachian Energy Grant",
      amount: 2500,
      seasonId: 2026,
    },
    {
      id: "tx-2",
      date: "2026-08-05",
      type: "expense",
      category: "Hardware",
      description: "rev robotics control hub",
      amount: 320.5,
      seasonId: 2026,
    },
    {
      id: "tx-3",
      date: "2026-08-10",
      type: "expense",
      category: "Tools",
      description: "=SUM(A1:A10)",
      amount: 45,
      seasonId: null,
    },
  ];

  it("formats CSV rows with headers and proper signed numbers", () => {
    const csv = buildFinanceCsv(sampleTransactions);
    const lines = csv.split("\r\n");

    expect(lines[0]).toBe('"Date","Type","Category","Description","Amount ($)","Season"');
    expect(lines[1]).toBe('"2026-08-01","Income","Sponsorship","Appalachian Energy Grant","2500.00","2026"');
    expect(lines[2]).toBe('"2026-08-05","Expense","Hardware","rev robotics control hub","-320.50","2026"');
  });

  it("guards against formula injection attacks", () => {
    const csv = buildFinanceCsv(sampleTransactions);
    const lines = csv.split("\r\n");
    // '=SUM(A1:A10) is prefixed with single quote
    expect(lines[3]).toBe('"2026-08-10","Expense","Tools","\'=SUM(A1:A10)","-45.00","General"');
  });

  it("generates a valid data URL with UTF-8 BOM", () => {
    const dataUrl = financeCsvDataUrl(sampleTransactions);
    expect(dataUrl.startsWith("data:text/csv;charset=utf-8,%EF%BB%BF")).toBe(true);
    expect(dataUrl).toContain(encodeURIComponent("Appalachian Energy Grant"));
  });

  it("produces appropriate filenames for season and overall ledger", () => {
    expect(financeCsvFilename(2026)).toBe("ares-23247-finance-season-2026.csv");
    expect(financeCsvFilename(null)).toBe("ares-23247-finance-ledger.csv");
    expect(financeCsvFilename(undefined)).toBe("ares-23247-finance-ledger.csv");
  });
});
