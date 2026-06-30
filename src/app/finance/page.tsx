"use client";

import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  Search, 
  ArrowLeftRight, 
  FileSpreadsheet, 
  Award,
  Globe
} from "lucide-react";
import { collection, query, getDocs, orderBy } from "firebase/firestore";

import SEO from "@/components/SEO";
import SeasonPicker from "@/components/SeasonPicker";
import { db } from "@/lib/firebase";

interface Transaction {
  id: string;
  amount: number;
  type: "income" | "expense";
  category: string;
  date: string;
  description?: string;
  receiptUrl?: string;
  seasonId?: number | null;
  loggedBy?: string;
}

export default function FinanceLedgerPage() {
  const [selectedSeason, setSelectedSeason] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTypeFilter, setActiveTypeFilter] = useState<"all" | "income" | "expense">("all");
  
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch all transactions from Firestore
  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        const q = query(
          collection(db, "finance_transactions"),
          orderBy("date", "desc")
        );
        const snap = await getDocs(q);
        const list = snap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data()
        })) as Transaction[];
        
        setTransactions(list);
      } catch (err) {
        console.error("Error fetching transactions:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchTransactions();
  }, []);

  // Calculate finance summary in memory
  const summary = useMemo(() => {
    let totalIncome = 0;
    let totalExpenses = 0;
    for (const t of transactions) {
      if (selectedSeason && t.seasonId !== selectedSeason) continue;
      if (t.type === "income") {
        totalIncome += Number(t.amount);
      } else if (t.type === "expense") {
        totalExpenses += Number(t.amount);
      }
    }
    return {
      totalIncome,
      totalExpenses,
      balance: totalIncome - totalExpenses
    };
  }, [transactions, selectedSeason]);

  // Filters & Calculations
  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      const matchesSeason = !selectedSeason || t.seasonId === selectedSeason;
      
      const matchesSearch = 
        t.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.description || "").toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesType = activeTypeFilter === "all" || t.type === activeTypeFilter;

      return matchesSeason && matchesSearch && matchesType;
    });
  }, [transactions, selectedSeason, searchQuery, activeTypeFilter]);

  // Calculate category aggregates for dynamic CSS progress meters
  const categorySummary = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const t of filteredTransactions) {
      if (t.type === "expense") {
        acc[t.category] = (acc[t.category] || 0) + Number(t.amount);
      }
    }
    return acc;
  }, [filteredTransactions]);

  const totalExpenseFiltered = useMemo(() => {
    return Object.values(categorySummary).reduce((a, b) => a + b, 0);
  }, [categorySummary]);

  const sortedCategories = useMemo(() => {
    return Object.entries(categorySummary)
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [categorySummary]);

  return (
    <div className="min-h-screen bg-obsidian text-marble py-24 relative overflow-hidden w-full">
      <SEO 
        title="Financial Transparency Ledger" 
        description="Public financial accountability board and ledger for ARES 23247 *FIRST*® Tech Challenge robotics team." 
      />

      {/* Decorative Grid and Ambient Lights */}
      <div className="absolute top-0 right-0 w-[50vw] h-[50vw] bg-ares-red/10 blur-[150px] rounded-full pointer-events-none -translate-y-1/2 translate-x-1/4" />
      <div className="absolute bottom-0 left-0 w-[40vw] h-[40vw] bg-ares-gold/5 blur-[150px] rounded-full pointer-events-none translate-y-1/2 -translate-x-1/4" />

      <div className="max-w-6xl mx-auto px-6 relative z-10">
        
        {/* Header Block */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 ares-cut-sm bg-ares-red/10 border border-ares-red/30 text-ares-red text-[10px] font-black uppercase tracking-widest mb-4">
            <Globe size={10} /> Corporate Governance
          </div>
          <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter text-white">
            Financial Ledger
          </h1>
          <p className="text-marble/60 text-sm max-w-2xl mt-2">
            In alignment with the core values of <i>FIRST</i>®, ARES 23247 practices total operational transparency. Below is our public ledger detailing all sponsor income, parts investments, and competition logistics.
          </p>
        </motion.div>

        {/* Season Selector & Controls */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 bg-white/5 border border-white/10 p-4 ares-cut-lg backdrop-blur-md">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="text-ares-gold" size={20} />
            <span className="text-xs font-black uppercase tracking-widest text-marble/80">Active Budget Season</span>
          </div>
          <SeasonPicker 
            value={selectedSeason || ""} 
            onChange={(v) => setSelectedSeason(v ? parseInt(v) : null)} 
          />
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <div className="animate-spin w-10 h-10 border-4 border-ares-red border-t-transparent rounded-full" />
            <p className="text-xs font-black uppercase tracking-widest text-marble/40 animate-pulse">Synchronizing ledger records...</p>
          </div>
        ) : (
          <>
            {/* KPI Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
              {[
                { 
                  label: "Total Seasonal Income", 
                  value: `$${(summary.totalIncome).toLocaleString()}`, 
                  icon: TrendingUp, 
                  color: "text-ares-green", 
                  bg: "bg-ares-green/10" 
                },
                { 
                  label: "Total Seasonal Expenses", 
                  value: `$${(summary.totalExpenses).toLocaleString()}`, 
                  icon: TrendingDown, 
                  color: "text-ares-red", 
                  bg: "bg-ares-red/10" 
                },
                { 
                  label: "Liquid Cash Balance", 
                  value: `$${(summary.balance).toLocaleString()}`, 
                  icon: Wallet, 
                  color: "text-ares-gold", 
                  bg: "bg-ares-gold/10" 
                }
              ].map((card, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="bg-white/[0.02] border border-white/5 ares-cut-lg p-6 backdrop-blur-md relative overflow-hidden group hover:border-ares-bronze/50 transition-colors"
                >
                  <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-20 transition-all duration-300 transform group-hover:scale-110 group-hover:-translate-y-2 group-hover:translate-x-2">
                    <card.icon size={80} />
                  </div>
                  <div className={`w-10 h-10 ares-cut-sm ${card.bg} flex items-center justify-center mb-6`}>
                    <card.icon size={20} className={card.color} />
                  </div>
                  <p className="text-marble/40 text-xs font-bold uppercase tracking-widest mb-1">{card.label}</p>
                  <p className="text-3xl font-black text-white">{card.value}</p>
                </motion.div>
              ))}
            </div>

            {/* Content Split: Category Allocation (Left) & Transaction ledger (Right) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              {/* Category Allocation */}
              <div className="lg:col-span-1 bg-white/[0.02] border border-white/5 ares-cut-lg p-6 backdrop-blur-md h-fit">
                <div className="flex items-center gap-2 mb-6">
                  <Award className="text-ares-red" size={18} />
                  <h2 className="text-lg font-black uppercase tracking-tighter text-white">Expense Allocation</h2>
                </div>

                {sortedCategories.length === 0 ? (
                  <p className="text-xs text-marble/40 font-bold uppercase tracking-widest text-center py-12 border border-dashed border-white/10 ares-cut">
                    No expense data found
                  </p>
                ) : (
                  <div className="space-y-5">
                    {sortedCategories.map(({ category, amount }) => {
                      const percentage = totalExpenseFiltered > 0 
                        ? ((amount / totalExpenseFiltered) * 100).toFixed(0) 
                        : "0";
                      return (
                        <div key={category}>
                          <div className="flex justify-between text-xs font-bold uppercase tracking-widest text-marble/60 mb-2">
                            <span>{category}</span>
                            <span className="text-white">${amount.toLocaleString()} ({percentage}%)</span>
                          </div>
                          <div className="h-2 w-full bg-white/5 ares-cut-sm overflow-hidden border border-white/5">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${percentage}%` }}
                              transition={{ duration: 0.8, ease: "easeOut" }}
                              className="h-full bg-ares-red" 
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Transactions Ledger */}
              <div className="lg:col-span-2 space-y-6">
                
                {/* Search and Filters */}
                <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-white/[0.01] border border-white/5 p-4 ares-cut-lg">
                  
                  {/* Search input */}
                  <div className="relative w-full sm:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-marble/40" size={16} />
                    <input 
                      type="text" 
                      placeholder="Search transactions..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 pl-10 pr-4 py-2 text-xs text-white placeholder-marble/30 font-bold ares-cut-sm focus:border-ares-red focus:outline-none transition-colors"
                    />
                  </div>

                  {/* Filter switches */}
                  <div className="flex bg-black/40 p-1 ares-cut-sm border border-white/5 shrink-0">
                    {(["all", "income", "expense"] as const).map((filter) => (
                      <button
                        key={filter}
                        onClick={() => setActiveTypeFilter(filter)}
                        className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-all ares-cut-sm cursor-pointer ${
                          activeTypeFilter === filter 
                            ? "bg-ares-red text-white" 
                            : "text-marble/40 hover:text-white"
                        }`}
                      >
                        {filter}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Table container */}
                <div className="bg-white/[0.01] border border-white/5 ares-cut-lg overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[500px]">
                    <thead>
                      <tr className="border-b border-white/5 bg-white/5">
                        <th className="p-4 text-[10px] font-black uppercase tracking-widest text-marble/40">Date</th>
                        <th className="p-4 text-[10px] font-black uppercase tracking-widest text-marble/40">Category</th>
                        <th className="p-4 text-[10px] font-black uppercase tracking-widest text-marble/40">Description</th>
                        <th className="p-4 text-[10px] font-black uppercase tracking-widest text-marble/40 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      <AnimatePresence>
                        {filteredTransactions.map((tx) => (
                          <motion.tr 
                            key={tx.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="hover:bg-white/[0.02] transition-colors"
                          >
                            <td className="p-4 text-xs font-mono text-marble/60 whitespace-nowrap">{tx.date}</td>
                            <td className="p-4">
                              <span className="px-2 py-0.5 bg-white/5 border border-white/10 ares-cut-sm text-[9px] font-black uppercase tracking-widest text-marble">
                                {tx.category}
                              </span>
                            </td>
                            <td className="p-4 text-xs text-white max-w-[240px] truncate" title={tx.description || ""}>
                              {tx.description || "—"}
                            </td>
                            <td className={`p-4 text-xs font-black text-right whitespace-nowrap ${
                              tx.type === "income" ? "text-ares-green" : "text-ares-red"
                            }`}>
                              {tx.type === "income" ? "+" : "-"}${Number(tx.amount).toLocaleString()}
                            </td>
                          </motion.tr>
                        ))}
                      </AnimatePresence>

                      {filteredTransactions.length === 0 && (
                        <tr>
                          <td colSpan={4} className="p-12 text-center text-marble/40 text-xs font-bold uppercase tracking-widest">
                            <ArrowLeftRight className="mx-auto mb-3 opacity-30 text-ares-gold" size={32} />
                            No matching ledger transactions
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

              </div>

            </div>
          </>
        )}

        <footer className="mt-32 text-center border-t border-white/5 pt-8">
          <p className="text-[10px] font-mono uppercase tracking-widest text-marble/30">
            ARES 23247 <i>FIRST</i>® Tech Challenge Portal — Morgantown, WV
          </p>
        </footer>

      </div>
    </div>
  );
}
