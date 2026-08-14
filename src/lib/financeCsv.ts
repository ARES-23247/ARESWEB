export interface FinanceCsvRecord {
  id: string;
  amount: number;
  type: "income" | "expense";
  category: string;
  date: string;
  description?: string;
  seasonId?: number | null;
}

const CSV_HEADERS = [
  "Date",
  "Type",
  "Category",
  "Description",
  "Amount ($)",
  "Season",
] as const;

function isPureNumber(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  return Number.isFinite(Number(trimmed));
}

function csvCell(value: string | number | null | undefined): string {
  if (typeof value === "number") {
    return `"${Number.isFinite(value) ? value : ""}"`;
  }
  const raw = value == null ? "" : String(value).replace(/\r\n?/g, "\n");
  const protectedValue =
    !isPureNumber(raw) && /^[\t ]*[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${protectedValue.replace(/"/g, '""')}"`;
}

export function buildFinanceCsv(transactions: readonly FinanceCsvRecord[]): string {
  const rows = transactions.map((tx) => {
    const formattedAmount = (tx.type === "income" ? 1 : -1) * Number(tx.amount || 0);
    const seasonLabel = tx.seasonId ? String(tx.seasonId) : "General";
    return [
      tx.date,
      tx.type === "income" ? "Income" : "Expense",
      tx.category,
      tx.description || "",
      formattedAmount.toFixed(2),
      seasonLabel,
    ];
  });

  return [CSV_HEADERS, ...rows]
    .map((row) => row.map((value) => csvCell(value)).join(","))
    .join("\r\n");
}

export function financeCsvDataUrl(transactions: readonly FinanceCsvRecord[]): string {
  return `data:text/csv;charset=utf-8,%EF%BB%BF${encodeURIComponent(buildFinanceCsv(transactions))}`;
}

export function financeCsvFilename(seasonId?: number | null): string {
  if (seasonId) return `ares-23247-finance-season-${seasonId}.csv`;
  return "ares-23247-finance-ledger.csv";
}
