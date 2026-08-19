"use client";

import { useCallback, useEffect, useState } from "react";
import { DollarSign, Edit2, Plus, RefreshCw, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { authenticatedFetch } from "@/lib/api";
import { logger } from "@/utils/logger";

interface FinanceRecord {
  id: string;
  date: string;
  amount: number;
  type: "income" | "expense";
  category: string;
  description: string;
  seasonId: number | null;
  status: "published" | "void";
  isDeleted?: number;
  receiptUrl?: string | null;
}

interface FinanceForm {
  id: string | null;
  date: string;
  amount: string;
  type: "income" | "expense";
  category: string;
  description: string;
  seasonId: string;
  status: "published" | "void";
  receiptUrl: string;
}

const EMPTY_FORM: FinanceForm = {
  id: null,
  date: new Date().toISOString().slice(0, 10),
  amount: "",
  type: "expense",
  category: "",
  description: "",
  seasonId: String(new Date().getFullYear()),
  status: "published",
  receiptUrl: "",
};

async function apiJson(path: string, init?: RequestInit): Promise<Record<string, unknown>> {
  const response = await authenticatedFetch(path, init);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof (payload as { error?: unknown }).error === "string"
      ? (payload as { error: string }).error
      : `HTTP ${response.status}`;
    throw new Error(message);
  }
  return payload as Record<string, unknown>;
}

export default function FinanceManagerPage() {
  const { authorizedUser } = useAuth();
  const [transactions, setTransactions] = useState<FinanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FinanceForm | null>(null);

  const canManage = ["admin", "coach"].includes(authorizedUser?.role ?? "");

  const reload = useCallback(async () => {
    setIsLoading(true);
    setListError(null);
    try {
      const payload = await apiJson("/api/finance/admin");
      setTransactions((payload.transactions as FinanceRecord[] | undefined) ?? []);
    } catch (error) {
      logger.error("Failed to load the finance ledger:", error);
      setListError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (canManage) void reload();
  }, [canManage, reload]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form) return;
    setSaving(true);
    setOperationError(null);
    try {
      await apiJson("/api/finance/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: form.id ?? undefined,
          date: form.date,
          amount: Number(form.amount),
          type: form.type,
          category: form.category || undefined,
          description: form.description,
          seasonId: form.seasonId ? Number(form.seasonId) : null,
          status: form.status,
          receiptUrl: form.receiptUrl || undefined,
        }),
      });
      setForm(null);
      await reload();
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  };

  const setLifecycle = async (id: string, archive: boolean) => {
    setOperationError(null);
    try {
      await apiJson(
        `/api/finance/admin/${encodeURIComponent(id)}${archive ? "" : "/restore"}`,
        { method: archive ? "DELETE" : "PATCH" },
      );
      await reload();
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : String(error));
    }
  };

  if (!canManage) {
    return (
      <div className="border border-ares-gold/30 bg-ares-gold/10 p-6 text-marble">
        Only an admin or coach can manage the finance ledger.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-black uppercase text-white">
            Finance Ledger
          </h1>
          <p className="mt-1 text-sm text-marble/70">
            Record income and expenses here; the public transparency page reads
            the same data. Receipt links stay admin-only.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void reload()}
          className="inline-flex min-h-11 items-center gap-2 border border-white/20 px-4 py-2 text-xs font-bold text-white focus-visible:ring-2 focus-visible:ring-ares-cyan"
        >
          <RefreshCw size={14} aria-hidden="true" /> Refresh
        </button>
      </header>

      {listError && (
        <p role="alert" className="border border-ares-red/40 bg-ares-red/10 p-4 text-sm text-marble">
          The ledger is unavailable: {listError}
        </p>
      )}
      {operationError && (
        <p role="alert" className="border border-ares-red/40 bg-ares-red/10 p-4 text-sm text-marble">
          {operationError}
        </p>
      )}

      {isLoading ? (
        <p className="text-sm text-marble/60" role="status">Loading the ledger…</p>
      ) : listError ? null : (
        <section className="border border-white/10 bg-black/25 p-6">
          <div className="flex items-center justify-between gap-4">
            <h2 className="inline-flex items-center gap-2 font-heading text-xl font-black uppercase text-white">
              <DollarSign size={18} className="text-ares-gold" aria-hidden="true" /> Transactions
            </h2>
            <button
              type="button"
              onClick={() => setForm({ ...EMPTY_FORM })}
              className="inline-flex min-h-11 items-center gap-2 bg-ares-red px-4 py-2 text-xs font-black uppercase tracking-wider text-white focus-visible:ring-2 focus-visible:ring-ares-cyan"
            >
              <Plus size={14} aria-hidden="true" /> New transaction
            </button>
          </div>

          {form && (
            <form onSubmit={save} className="mt-4 grid gap-3 border border-white/10 p-4 sm:grid-cols-2" aria-label="Transaction editor">
              <label className="block text-xs font-bold text-marble">
                Date
                <input
                  required
                  pattern="\d{4}-\d{2}-\d{2}"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className="mt-1 w-full border border-white/15 bg-obsidian px-3 py-2 text-white focus-visible:ring-2 focus-visible:ring-ares-cyan"
                />
              </label>
              <label className="block text-xs font-bold text-marble">
                Amount (USD)
                <input
                  required
                  inputMode="decimal"
                  min="0.01"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  className="mt-1 w-full border border-white/15 bg-obsidian px-3 py-2 text-white focus-visible:ring-2 focus-visible:ring-ares-cyan"
                />
              </label>
              <label className="block text-xs font-bold text-marble">
                Type
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value as FinanceForm["type"] })}
                  className="mt-1 w-full border border-white/15 bg-obsidian px-3 py-2 text-white focus-visible:ring-2 focus-visible:ring-ares-cyan"
                >
                  <option value="expense">Expense</option>
                  <option value="income">Income</option>
                </select>
              </label>
              <label className="block text-xs font-bold text-marble">
                Category
                <input
                  maxLength={80}
                  placeholder="Parts, Registration, Fundraising…"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="mt-1 w-full border border-white/15 bg-obsidian px-3 py-2 text-white focus-visible:ring-2 focus-visible:ring-ares-cyan"
                />
              </label>
              <label className="block text-xs font-bold text-marble sm:col-span-2">
                Description
                <input
                  required
                  maxLength={300}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="mt-1 w-full border border-white/15 bg-obsidian px-3 py-2 text-white focus-visible:ring-2 focus-visible:ring-ares-cyan"
                />
              </label>
              <label className="block text-xs font-bold text-marble">
                Season year
                <input
                  inputMode="numeric"
                  pattern="\d{4}"
                  value={form.seasonId}
                  onChange={(e) => setForm({ ...form, seasonId: e.target.value })}
                  className="mt-1 w-full border border-white/15 bg-obsidian px-3 py-2 text-white focus-visible:ring-2 focus-visible:ring-ares-cyan"
                />
              </label>
              <label className="block text-xs font-bold text-marble">
                Status
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value as FinanceForm["status"] })}
                  className="mt-1 w-full border border-white/15 bg-obsidian px-3 py-2 text-white focus-visible:ring-2 focus-visible:ring-ares-cyan"
                >
                  <option value="published">Published</option>
                  <option value="void">Void (hidden from public)</option>
                </select>
              </label>
              <label className="block text-xs font-bold text-marble sm:col-span-2">
                Receipt link (admin-only, https)
                <input
                  maxLength={2048}
                  placeholder="https://…"
                  value={form.receiptUrl}
                  onChange={(e) => setForm({ ...form, receiptUrl: e.target.value })}
                  className="mt-1 w-full border border-white/15 bg-obsidian px-3 py-2 text-white focus-visible:ring-2 focus-visible:ring-ares-cyan"
                />
              </label>
              <div className="flex gap-3 sm:col-span-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="min-h-11 bg-ares-red px-5 py-2 text-xs font-black uppercase tracking-wider text-white focus-visible:ring-2 focus-visible:ring-ares-cyan disabled:opacity-50"
                >
                  {saving ? "Saving…" : form.id ? "Save transaction" : "Record transaction"}
                </button>
                <button
                  type="button"
                  onClick={() => setForm(null)}
                  className="inline-flex min-h-11 items-center gap-1 border border-white/20 px-4 py-2 text-xs font-bold text-white focus-visible:ring-2 focus-visible:ring-ares-cyan"
                >
                  <X size={12} aria-hidden="true" /> Cancel
                </button>
              </div>
            </form>
          )}

          {transactions.length === 0 ? (
            <p className="mt-4 text-sm text-marble/60">
              No transactions recorded yet. Income and expenses recorded here
              appear on the public finance page.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-white/5">
              {transactions.map((transaction) => (
                <li key={transaction.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-white">
                      <span className={transaction.type === "income" ? "text-ares-success" : "text-ares-danger"}>
                        {transaction.type === "income" ? "+" : "−"}${transaction.amount.toFixed(2)}
                      </span>{" "}
                      {transaction.description}
                      {transaction.isDeleted === 1 && (
                        <span className="ml-2 border border-ares-red/40 px-2 py-0.5 text-[10px] uppercase text-ares-red">Archived</span>
                      )}
                      {transaction.status === "void" && (
                        <span className="ml-2 border border-white/20 px-2 py-0.5 text-[10px] uppercase text-marble/70">Void</span>
                      )}
                    </p>
                    <p className="text-xs text-marble/60">
                      {transaction.date} · {transaction.category}
                      {transaction.seasonId ? ` · ${transaction.seasonId}` : ""}
                      {transaction.receiptUrl ? " · receipt attached" : ""}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setForm({
                          id: transaction.id,
                          date: transaction.date,
                          amount: String(transaction.amount),
                          type: transaction.type,
                          category: transaction.category === "Uncategorized" ? "" : transaction.category,
                          description: transaction.description,
                          seasonId: transaction.seasonId ? String(transaction.seasonId) : "",
                          status: transaction.status,
                          receiptUrl: transaction.receiptUrl ?? "",
                        })
                      }
                      className="inline-flex min-h-11 items-center gap-1 border border-white/20 px-3 text-xs font-bold text-white focus-visible:ring-2 focus-visible:ring-ares-cyan"
                    >
                      <Edit2 size={12} aria-hidden="true" /> Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void setLifecycle(transaction.id, transaction.isDeleted !== 1)}
                      className="inline-flex min-h-11 items-center border border-white/20 px-3 text-xs font-bold text-white focus-visible:ring-2 focus-visible:ring-ares-cyan"
                    >
                      {transaction.isDeleted === 1 ? "Restore" : "Archive"}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
