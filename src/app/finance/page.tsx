"use client";

import { logger } from "@/utils/logger";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeftRight,
  Award,
  ChevronDown,
  Download,
  FileSpreadsheet,
  Globe,
  RefreshCw,
  Search,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import SEO from "@/components/SEO";
import SeasonPicker from "@/components/SeasonPicker";
import { financeCsvDataUrl, financeCsvFilename } from "@/lib/financeCsv";

interface Transaction {
  id: string;
  amount: number;
  type: "income" | "expense";
  category: string;
  date: string;
  description?: string;
  seasonId?: number | null;
}

interface FinanceError {
  diagnostic: string;
  status?: number;
}

type LoadMode = "initial" | "refresh" | "more";

const PAGE_SIZE = 50;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseTransaction(value: unknown): Transaction | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== "string" || typeof value.category !== "string" || typeof value.date !== "string") return null;
  if (value.type !== "income" && value.type !== "expense") return null;
  const amount = Number(value.amount);
  if (!Number.isFinite(amount)) return null;

  return {
    id: value.id,
    amount,
    type: value.type,
    category: value.category,
    date: value.date,
    description: typeof value.description === "string" ? value.description : "",
    seasonId: typeof value.seasonId === "number" ? value.seasonId : null,
  };
}

function guidanceForStatus(status?: number) {
  if (status === 401) return "Your session may have ended. Sign in again, then retry.";
  if (status === 403) return "Your account cannot view this data. Ask a team lead to check your access.";
  return "Check your connection, then try again.";
}

export default function FinanceLedgerPage() {
  const [selectedSeason, setSelectedSeason] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTypeFilter, setActiveTypeFilter] = useState<"all" | "income" | "expense">("all");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<FinanceError | null>(null);

  const loadTransactions = useCallback(async (cursor: string | null, mode: LoadMode) => {
    if (mode === "initial") setIsLoading(true);
    if (mode === "refresh") setIsRefreshing(true);
    if (mode === "more") setIsLoadingMore(true);

    try {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
      if (cursor) params.set("cursor", cursor);
      const response = await fetch(`/api/finance?${params.toString()}`);
      if (!response.ok) {
        throw Object.assign(new Error(`HTTP ${response.status}: ${response.statusText}`), {
          status: response.status,
        });
      }

      const data: unknown = await response.json();
      if (!isRecord(data) || !Array.isArray(data.transactions)) {
        throw Object.assign(new Error("HTTP 502: Invalid finance response"), { status: 502 });
      }
      const parsedTransactions = data.transactions.map(parseTransaction);
      if (parsedTransactions.some((transaction) => transaction === null)) {
        throw Object.assign(new Error("HTTP 502: Invalid finance transaction"), { status: 502 });
      }
      const verifiedTransactions = parsedTransactions.filter((transaction): transaction is Transaction => transaction !== null);
      const responseHasMore = data.hasMore === true;
      const responseCursor = typeof data.nextCursor === "string" ? data.nextCursor : null;
      if (responseHasMore && !responseCursor) {
        throw Object.assign(new Error("HTTP 502: Missing finance page cursor"), { status: 502 });
      }

      setTransactions((current) => {
        if (mode !== "more") return verifiedTransactions;
        const byId = new Map(current.map((transaction) => [transaction.id, transaction]));
        for (const transaction of verifiedTransactions) byId.set(transaction.id, transaction);
        return Array.from(byId.values());
      });
      setHasMore(responseHasMore);
      setNextCursor(responseCursor);
      setLoadError(null);
    } catch (error) {
      logger.error("Error fetching public finance transactions:", error);
      const status = typeof error === "object" && error !== null && "status" in error
        ? Number(error.status)
        : undefined;
      setLoadError({
        diagnostic: error instanceof Error ? error.message : "Unknown finance data error",
        status: Number.isFinite(status) ? status : undefined,
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
      setIsLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    void loadTransactions(null, "initial");
  }, [loadTransactions]);

  const summary = useMemo(() => {
    let income = 0;
    let expenses = 0;
    for (const transaction of transactions) {
      if (selectedSeason && transaction.seasonId !== selectedSeason) continue;
      if (transaction.type === "income") income += Number(transaction.amount);
      else expenses += Number(transaction.amount);
    }
    return { income, expenses, balance: income - expenses };
  }, [transactions, selectedSeason]);

  const filteredTransactions = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();
    return transactions.filter((transaction) => {
      const matchesSeason = !selectedSeason || transaction.seasonId === selectedSeason;
      const matchesSearch = transaction.category.toLowerCase().includes(normalizedSearch)
        || (transaction.description || "").toLowerCase().includes(normalizedSearch);
      const matchesType = activeTypeFilter === "all" || transaction.type === activeTypeFilter;
      return matchesSeason && matchesSearch && matchesType;
    });
  }, [transactions, selectedSeason, searchQuery, activeTypeFilter]);

  const sortedCategories = useMemo(() => {
    const categoryTotals: Record<string, number> = {};
    for (const transaction of filteredTransactions) {
      if (transaction.type === "expense") {
        categoryTotals[transaction.category] = (categoryTotals[transaction.category] || 0) + Number(transaction.amount);
      }
    }
    return Object.entries(categoryTotals)
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [filteredTransactions]);

  const loadedExpenseTotal = useMemo(
    () => sortedCategories.reduce((total, category) => total + category.amount, 0),
    [sortedCategories],
  );

  const resultsMessage = filteredTransactions.length === transactions.length
    ? `Showing ${transactions.length} loaded record${transactions.length === 1 ? "" : "s"}.`
    : `Showing ${filteredTransactions.length} matching record${filteredTransactions.length === 1 ? "" : "s"} from ${transactions.length} loaded.`;

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-obsidian py-24 text-marble">
      <SEO
        title="Financial Transparency Ledger"
        description="Public financial accountability board and ledger for ARES 23247 FIRST® Tech Challenge robotics team."
      />
      <div className="pointer-events-none absolute right-0 top-0 h-[50vw] w-[50vw] -translate-y-1/2 translate-x-1/4 rounded-full bg-ares-red/10 blur-[150px]" aria-hidden="true" />
      <div className="pointer-events-none absolute bottom-0 left-0 h-[40vw] w-[40vw] -translate-x-1/4 translate-y-1/2 rounded-full bg-ares-gold/5 blur-[150px]" aria-hidden="true" />

      <div className="relative z-10 mx-auto max-w-6xl px-6">
        <motion.header initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-12">
          <div className="mb-4 inline-flex items-center gap-2 border border-ares-bronze/40 bg-ares-red px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white">
            <Globe aria-hidden="true" size={10} /> Team Accountability
          </div>
          <h1 className="text-4xl font-black uppercase tracking-tighter text-white md:text-5xl">Financial Ledger</h1>
          <p className="mt-2 max-w-2xl text-sm text-marble/80">
            ARES 23247 supports the values of <i>FIRST</i>®. This public ledger shows published income and costs.
          </p>
        </motion.header>

        <div className="mb-8 flex flex-col items-start justify-between gap-4 border border-white/10 bg-white/5 p-4 sm:flex-row sm:items-end">
          <div className="w-full sm:max-w-sm">
            <div className="mb-2 flex items-center gap-2">
              <FileSpreadsheet aria-hidden="true" className="text-ares-gold" size={20} />
              <span className="text-xs font-black uppercase tracking-widest text-marble/80">Budget season</span>
            </div>
            <SeasonPicker
              label="Budget season filter"
              value={selectedSeason || ""}
              onChange={(value) => setSelectedSeason(value ? Number.parseInt(value, 10) : null)}
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {transactions.length > 0 && (
              <a
                href={financeCsvDataUrl(filteredTransactions)}
                download={financeCsvFilename(selectedSeason)}
                className="inline-flex min-h-11 items-center gap-2 border border-white/20 bg-white/5 px-4 py-2 text-xs font-black uppercase tracking-widest text-white transition-colors hover:border-ares-gold hover:bg-ares-gold/10 hover:text-ares-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
                aria-label="Download financial ledger records as CSV"
              >
                <Download aria-hidden="true" size={15} />
                Export CSV
              </a>
            )}
            <button
              type="button"
              onClick={() => void loadTransactions(null, "refresh")}
              disabled={isRefreshing}
              className="inline-flex min-h-11 items-center gap-2 border border-ares-gold/50 bg-ares-gold/10 px-4 py-2 text-xs font-black uppercase tracking-widest text-ares-gold transition-colors hover:bg-ares-gold hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan disabled:cursor-wait disabled:opacity-60"
            >
              <RefreshCw aria-hidden="true" size={15} className={isRefreshing ? "animate-spin" : ""} />
              {isRefreshing ? "Refreshing" : "Refresh ledger"}
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center gap-4 py-32" role="status">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-ares-red border-t-transparent" aria-hidden="true" />
            <p className="text-xs font-black uppercase tracking-widest text-marble/70">Loading ledger records...</p>
          </div>
        ) : transactions.length === 0 && loadError ? (
          <div className="border border-ares-red bg-ares-red/10 p-6" role="alert">
            <h2 className="font-black uppercase text-white">Financial data unavailable</h2>
            <p className="mt-2 text-sm text-marble/85">No totals are shown because the ledger did not load.</p>
            <p className="mt-2 text-sm text-marble/85">{guidanceForStatus(loadError.status)}</p>
            <p className="mt-3 font-mono text-xs text-marble/80">{loadError.diagnostic}</p>
            <button
              type="button"
              onClick={() => void loadTransactions(null, "initial")}
              className="mt-5 bg-ares-red px-4 py-2 text-xs font-black uppercase tracking-widest text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
            >
              Retry
            </button>
          </div>
        ) : (
          <>
            {loadError && (
              <div className="mb-6 border border-ares-red bg-ares-red/10 p-5" role="alert">
                <h2 className="font-black text-white">The ledger could not refresh</h2>
                <p className="mt-1 text-sm text-marble/85">The last loaded records remain below. {guidanceForStatus(loadError.status)}</p>
                <p className="mt-2 font-mono text-xs text-marble/80">{loadError.diagnostic}</p>
              </div>
            )}

            <p className="mb-4 text-xs text-marble/70" role="note">
              Summary cards use loaded records only{hasMore ? "; more records are available" : ""}.
            </p>
            <div className="mb-12 grid grid-cols-1 gap-6 md:grid-cols-3">
              {[
                { label: "Loaded income", value: summary.income, icon: TrendingUp, tone: "income" },
                { label: "Loaded expenses", value: summary.expenses, icon: TrendingDown, tone: "expense" },
                { label: "Loaded balance", value: summary.balance, icon: Wallet, tone: "balance" },
              ].map((card, index) => (
                <motion.div
                  key={card.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="hero-card relative overflow-hidden border border-white/10 bg-white/[0.03] p-6 transition-colors hover:border-ares-bronze/50"
                >
                  <div className={`mb-6 flex h-10 w-10 items-center justify-center ${card.tone === "expense" ? "bg-ares-red text-white" : card.tone === "income" ? "bg-ares-cyan/15 text-ares-cyan" : "bg-ares-gold/15 text-ares-gold"}`}>
                    <card.icon aria-hidden="true" size={20} />
                  </div>
                  <p className="mb-1 text-xs font-bold uppercase tracking-widest text-marble/70">{card.label}</p>
                  <p className="text-3xl font-black text-white">${card.value.toLocaleString()}</p>
                </motion.div>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
              <section aria-labelledby="expense-allocation-title" className="h-fit border border-white/10 bg-white/[0.03] p-6 lg:col-span-1">
                <div className="mb-6 flex items-center gap-2">
                  <Award aria-hidden="true" className="rounded bg-ares-red p-0.5 text-white" size={20} />
                  <h2 id="expense-allocation-title" className="text-lg font-black uppercase tracking-tighter text-white">Expense Allocation</h2>
                </div>
                {sortedCategories.length === 0 ? (
                  <p className="border border-dashed border-white/10 py-12 text-center text-xs font-bold uppercase tracking-widest text-marble/70">No expense data found</p>
                ) : (
                  <div className="space-y-5">
                    {sortedCategories.map(({ category, amount }) => {
                      const percentage = loadedExpenseTotal > 0 ? Math.round((amount / loadedExpenseTotal) * 100) : 0;
                      return (
                        <div key={category}>
                          <div className="mb-2 flex justify-between gap-3 text-xs font-bold uppercase tracking-widest text-marble/80">
                            <span>{category}</span>
                            <span className="text-white">${amount.toLocaleString()} ({percentage}%)</span>
                          </div>
                          <div className="h-2 w-full overflow-hidden border border-white/10 bg-white/5" role="img" aria-label={`${category}: ${percentage}% of loaded expenses`}>
                            <motion.div initial={{ width: 0 }} animate={{ width: `${percentage}%` }} className="h-full bg-ares-gold" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              <section aria-labelledby="transactions-title" className="space-y-6 lg:col-span-2">
                <h2 id="transactions-title" className="sr-only">Published transactions</h2>
                <div className="flex flex-col items-stretch justify-between gap-4 border border-white/10 bg-white/[0.02] p-4 sm:flex-row sm:items-end">
                  <div className="w-full sm:w-72">
                    <label htmlFor="finance-search" className="mb-2 block text-xs font-bold text-marble/80">Search transactions</label>
                    <div className="relative">
                      <Search aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-marble/60" size={16} />
                      <input
                        id="finance-search"
                        type="search"
                        placeholder="Category or description"
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        className="w-full border border-white/15 bg-white/5 py-2 pl-10 pr-4 text-xs font-bold text-white placeholder:text-marble/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
                      />
                    </div>
                  </div>

                  <fieldset>
                    <legend className="mb-2 text-xs font-bold text-marble/80">Transaction type</legend>
                    <div className="flex border border-white/10 bg-black/40 p-1">
                      {(["all", "income", "expense"] as const).map((filter) => (
                        <button
                          key={filter}
                          type="button"
                          aria-pressed={activeTypeFilter === filter}
                          onClick={() => setActiveTypeFilter(filter)}
                          className={`px-3 py-2 text-[10px] font-black uppercase tracking-widest transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan ${activeTypeFilter === filter ? "bg-ares-red text-white" : "text-marble/75 hover:text-white"}`}
                        >
                          {filter}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                </div>

                <p className="text-xs text-marble/75" role="status" aria-live="polite">
                  {resultsMessage} {hasMore && "More records are available."}
                </p>

                <div className="overflow-x-auto border border-white/10 bg-white/[0.02]">
                  <table className="w-full min-w-[500px] border-collapse text-left">
                    <caption className="sr-only">Published ARES financial transactions</caption>
                    <thead>
                      <tr className="border-b border-white/10 bg-white/5">
                        <th scope="col" className="p-4 text-[10px] font-black uppercase tracking-widest text-marble/70">Date</th>
                        <th scope="col" className="p-4 text-[10px] font-black uppercase tracking-widest text-marble/70">Category</th>
                        <th scope="col" className="p-4 text-[10px] font-black uppercase tracking-widest text-marble/70">Description</th>
                        <th scope="col" className="p-4 text-right text-[10px] font-black uppercase tracking-widest text-marble/70">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      <AnimatePresence>
                        {filteredTransactions.map((transaction) => (
                          <motion.tr key={transaction.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="transition-colors hover:bg-white/[0.03]">
                            <td className="whitespace-nowrap p-4 font-mono text-xs text-marble/75">{transaction.date || "Date not listed"}</td>
                            <td className="p-4"><span className="border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-marble">{transaction.category}</span></td>
                            <td className="max-w-[240px] truncate p-4 text-xs text-white" title={transaction.description || ""}>{transaction.description || "—"}</td>
                            <td className="whitespace-nowrap p-4 text-right text-xs font-black">
                              <span className="sr-only">{transaction.type === "income" ? "Income" : "Expense"}: </span>
                              <span className={transaction.type === "income" ? "text-ares-cyan" : "rounded bg-ares-red px-2 py-1 text-white"}>
                                {transaction.type === "income" ? "+" : "−"}${Number(transaction.amount).toLocaleString()}
                              </span>
                            </td>
                          </motion.tr>
                        ))}
                      </AnimatePresence>
                      {filteredTransactions.length === 0 && (
                        <tr><td colSpan={4} className="p-12 text-center text-xs font-bold uppercase tracking-widest text-marble/70"><ArrowLeftRight aria-hidden="true" className="mx-auto mb-3 text-ares-gold opacity-70" size={32} />No matching ledger transactions</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {hasMore && nextCursor && (
                  <div className="text-center">
                    <button
                      type="button"
                      onClick={() => void loadTransactions(nextCursor, "more")}
                      disabled={isLoadingMore}
                      className="inline-flex min-h-11 items-center gap-2 border border-ares-cyan/50 bg-ares-cyan/10 px-5 py-2 text-xs font-black uppercase tracking-widest text-ares-cyan transition-colors hover:bg-ares-cyan hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan disabled:cursor-wait disabled:opacity-60"
                    >
                      <ChevronDown aria-hidden="true" size={16} /> {isLoadingMore ? "Loading records" : "Load more records"}
                    </button>
                  </div>
                )}
              </section>
            </div>
          </>
        )}

        <footer className="mt-32 border-t border-white/10 pt-8 text-center">
          <p className="text-[10px] font-mono uppercase tracking-widest text-marble/60">ARES 23247 <i>FIRST</i>® Tech Challenge Portal — Morgantown, WV</p>
        </footer>
      </div>
    </div>
  );
}
