import { useState } from "react";
import DashboardPageHeader from "./dashboard/DashboardPageHeader";
import DashboardMetricsGrid from "./dashboard/DashboardMetricsGrid";
import DashboardEmptyState from "./dashboard/DashboardEmptyState";
import { DashboardInput, DashboardSubmitButton } from "./dashboard/DashboardFormInputs";
import { useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Trash2 } from "lucide-react";
import { DollarSign } from "lucide-react";
import { PieChart } from "lucide-react";
import { TrendingUp } from "lucide-react";
import { TrendingDown } from "lucide-react";
import { ArrowRight } from "lucide-react";
import { RefreshCw } from "lucide-react";
import { Wallet } from "lucide-react";
import { Building } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "../api/client";
import SeasonPicker from "./SeasonPicker";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { financeTransactionSchema, sponsorshipPipelineSchema } from "@shared/schemas/financeSchema";

// ── Status config for Sponsorship ─────────────────────────────────────
const PIPELINE_COLUMNS = ["potential", "contacted", "pledged", "secured", "lost"] as const;

const pipelineConfig: Record<string, { bg: string; text: string; border: string; label: string }> = {
  potential: { bg: "bg-white/5", text: "text-marble/50", border: "border-white/10", label: "Potential" },
  contacted: { bg: "bg-ares-cyan/10", text: "text-ares-cyan", border: "border-ares-cyan/30", label: "Contacted" },
  pledged:   { bg: "bg-ares-gold/10", text: "text-ares-gold", border: "border-ares-gold/30", label: "Pledged" },
  secured:   { bg: "bg-ares-green/10", text: "text-ares-green", border: "border-ares-green/30", label: "Secured" },
  lost:      { bg: "bg-ares-red/10", text: "text-ares-red", border: "border-ares-red/30", label: "Lost" },
};

export default function FinanceManager() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"pipeline" | "ledger">("pipeline");
  const [isAdding, setIsAdding] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState<number | null>(null);

  // ── Queries ──
  const { data: summaryRes } = api.finance.getSummary.useQuery(["finance-summary", selectedSeason], { query: { season_id: selectedSeason || undefined } });
  const { data: pipelineRes } = api.finance.listPipeline.useQuery(["finance-pipeline", selectedSeason], { query: { season_id: selectedSeason || undefined } });
  const { data: transactionsRes } = api.finance.listTransactions.useQuery(["finance-transactions", selectedSeason], { query: { season_id: selectedSeason || undefined } });

  const summary = summaryRes?.status === 200 ? summaryRes.body : { total_income: 0, total_expenses: 0, balance: 0 };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pipeline: any[] = pipelineRes?.status === 200 ? pipelineRes.body.pipeline : [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const transactions: any[] = transactionsRes?.status === 200 ? transactionsRes.body.transactions : [];

  // ── Mutations ──
  const savePipeline = api.finance.savePipeline.useMutation({
    onSuccess: () => {
      toast.success("Sponsorship updated.");
      queryClient.invalidateQueries({ queryKey: ["finance-pipeline"] });
      setIsAdding(false);
    }
  });

  const saveTransaction = api.finance.saveTransaction.useMutation({
    onSuccess: () => {
      toast.success("Transaction recorded.");
      queryClient.invalidateQueries({ queryKey: ["finance-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["finance-summary"] });
      setIsAdding(false);
    }
  });

  const deleteTransaction = api.finance.deleteTransaction.useMutation({
    onSuccess: () => {
      toast.success("Transaction deleted.");
      queryClient.invalidateQueries({ queryKey: ["finance-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["finance-summary"] });
    }
  });

  const deletePipeline = api.finance.deletePipeline.useMutation({
    onSuccess: () => {
      toast.success("Pipeline item deleted.");
      queryClient.invalidateQueries({ queryKey: ["finance-pipeline"] });
    }
  });

  // ── Forms ──
  const pipelineForm = useForm({
    resolver: zodResolver(sponsorshipPipelineSchema),
    defaultValues: { company_name: "", status: "potential", estimated_value: 0, season_id: selectedSeason }
  });

  const transactionForm = useForm({
    resolver: zodResolver(financeTransactionSchema),
    defaultValues: { type: "expense", amount: 0, category: "parts", date: new Date().toISOString().split('T')[0], description: "", season_id: selectedSeason }
  });

  return (
    <div className="space-y-8">
      {/* Overview Metrics */}
      <DashboardMetricsGrid 
        metrics={[
          { label: "Total Income", value: `$${summary.total_income.toLocaleString()}`, icon: <TrendingUp className="text-ares-green" /> },
          { label: "Total Expenses", value: `$${summary.total_expenses.toLocaleString()}`, icon: <TrendingDown className="text-ares-red" /> },
          { label: "Cash Balance", value: `$${summary.balance.toLocaleString()}`, icon: <Wallet className="text-ares-gold" /> },
          { label: "Pipeline Value", value: `$${pipeline.reduce((acc, p) => acc + (p.status !== 'lost' ? (p.estimated_value || 0) : 0), 0).toLocaleString()}`, icon: <PieChart className="text-ares-cyan" /> },
        ]}
      />

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex bg-black/40 p-1 ares-cut-sm border border-white/5">
          <button 
            onClick={() => { setActiveTab("pipeline"); setIsAdding(false); }}
            className={`px-4 py-2 text-xs font-black uppercase tracking-widest transition-all ares-cut-sm ${activeTab === 'pipeline' ? 'bg-ares-red text-white' : 'text-marble/40 hover:text-white'}`}
          >
            Sponsorship Pipeline
          </button>
          <button 
            onClick={() => { setActiveTab("ledger"); setIsAdding(false); }}
            className={`px-4 py-2 text-xs font-black uppercase tracking-widest transition-all ares-cut-sm ${activeTab === 'ledger' ? 'bg-ares-red text-white' : 'text-marble/40 hover:text-white'}`}
          >
            Ledger & Expenses
          </button>
        </div>

        <SeasonPicker value={selectedSeason || ""} onChange={(v) => setSelectedSeason(v ? parseInt(v) : null)} />
      </div>

      <DashboardPageHeader
        title={activeTab === 'pipeline' ? "Sponsorship Pipeline" : "Financial Ledger"}
        subtitle={activeTab === 'pipeline' ? "Track potential funding sources and company outreach." : "Record every income and expense for the team's budget."}
        icon={activeTab === 'pipeline' ? <Building className="text-ares-cyan" /> : <DollarSign className="text-ares-gold" />}
        action={
          <button
            onClick={() => setIsAdding(!isAdding)}
            className="flex items-center gap-2 px-4 py-2 bg-ares-red text-white font-bold ares-cut-sm hover:bg-ares-danger transition-colors shadow-lg shadow-ares-red/20"
          >
            {isAdding ? <XCircle size={18} /> : <Plus size={18} />}
            {isAdding ? "Cancel" : activeTab === 'pipeline' ? "Add Lead" : "Add Transaction"}
          </button>
        }
      />

      {/* Add Form */}
      <AnimatePresence>
        {isAdding && (
          <motion.div
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="bg-obsidian border border-ares-red/30 ares-cut-lg p-8 shadow-2xl"
          >
            {activeTab === 'pipeline' ? (
              <form onSubmit={pipelineForm.handleSubmit(data => savePipeline.mutate({ body: { ...data, season_id: selectedSeason } }))} className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <DashboardInput id="pipeline-company" label="Company Name" {...pipelineForm.register("company_name")} error={pipelineForm.formState.errors.company_name?.message} fullWidth />
                <DashboardInput id="pipeline-value" label="Est. Value ($)" type="number" {...pipelineForm.register("estimated_value", { valueAsNumber: true })} />
                <div className="flex flex-col gap-1">
                  <label htmlFor="pipeline-status" className="text-[10px] font-black uppercase tracking-widest text-marble/40 px-1">Initial Status</label>
                  <select id="pipeline-status" {...pipelineForm.register("status")} className="bg-white/5 border border-white/10 ares-cut-sm p-3 text-sm text-white focus:border-ares-red outline-none">
                    {PIPELINE_COLUMNS.map(c => <option key={c} value={c} className="bg-obsidian text-white">{pipelineConfig[c].label}</option>)}
                  </select>
                </div>
                <div className="md:col-span-3">
                  <DashboardSubmitButton isPending={savePipeline.isPending} defaultText="Add Lead to Pipeline" theme="red" />
                </div>
              </form>
            ) : (
              <form onSubmit={transactionForm.handleSubmit(data => saveTransaction.mutate({ body: { ...data, season_id: selectedSeason } }))} className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="flex flex-col gap-1">
                  <label htmlFor="transaction-type" className="text-[10px] font-black uppercase tracking-widest text-marble/40 px-1">Type</label>
                  <select id="transaction-type" {...transactionForm.register("type")} className="bg-white/5 border border-white/10 ares-cut-sm p-3 text-sm text-white focus:border-ares-red outline-none">
                    <option value="expense" className="bg-obsidian text-white">Expense (-)</option>
                    <option value="income" className="bg-obsidian text-white">Income (+)</option>
                  </select>
                </div>
                <DashboardInput id="ledger-amount" label="Amount ($)" type="number" step="0.01" {...transactionForm.register("amount", { valueAsNumber: true })} error={transactionForm.formState.errors.amount?.message} />
                <DashboardInput id="ledger-date" label="Date" type="date" {...transactionForm.register("date")} />
                <DashboardInput id="ledger-category" label="Category" {...transactionForm.register("category")} placeholder="e.g. Parts, Travel, Reg" />
                <DashboardInput id="ledger-desc" label="Description" {...transactionForm.register("description")} placeholder="Details about the transaction..." fullWidth />
                <div className="md:col-span-3">
                  <DashboardSubmitButton isPending={saveTransaction.isPending} defaultText="Record Transaction" theme="red" />
                </div>
              </form>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main View */}
      {activeTab === 'pipeline' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {PIPELINE_COLUMNS.map(status => (
            <div key={status} className={`ares-cut-sm border ${pipelineConfig[status].border} ${pipelineConfig[status].bg} flex flex-col min-h-[300px]`}>
              <div className="p-3 border-b border-white/5 flex items-center justify-between">
                <span className={`text-[10px] font-black uppercase tracking-tighter ${pipelineConfig[status].text}`}>{pipelineConfig[status].label}</span>
                <span className="text-[10px] font-bold text-white/20">{pipeline.filter(p => p.status === status).length}</span>
              </div>
              <div className="p-2 space-y-2">
                {pipeline.filter(p => p.status === status).map(lead => (
                  <div key={lead.id} className="bg-black/60 p-3 ares-cut-sm border border-white/5 group hover:border-white/20 transition-all">
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-xs font-bold text-white leading-tight">{lead.company_name}</span>
                      <button 
                        onClick={() => confirm("Delete lead?") && deletePipeline.mutate({ params: { id: lead.id! } })} 
                        className="opacity-0 group-hover:opacity-100 text-marble/20 hover:text-ares-red transition-all"
                        title="Delete lead"
                        aria-label="Delete lead"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                    <div className="text-[10px] font-black text-ares-gold">${Number(lead.estimated_value || 0).toLocaleString()}</div>
                    <div className="mt-2 flex gap-1 overflow-x-auto">
                       {PIPELINE_COLUMNS.map(next => next !== status && (
                         <button 
                            key={next} 
                            onClick={() => savePipeline.mutate({ body: { ...lead, status: next } })}
                            className="w-4 h-4 rounded-full bg-white/5 hover:bg-white/20 flex items-center justify-center transition-colors"
                            title={`Move to ${next}`}
                          >
                           <ArrowRight size={8} />
                         </button>
                       ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-black/40 border border-white/5 ares-cut-lg overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/5 border-b border-white/5">
                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-marble/40">Date</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-marble/40">Category</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-marble/40">Description</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-marble/40 text-right">Amount</th>
                <th className="p-4 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {transactions.map(t => (
                <tr key={t.id} className="hover:bg-white/5 transition-colors group">
                  <td className="p-4 text-xs font-bold text-marble/60">{t.date}</td>
                  <td className="p-4">
                    <span className="px-2 py-0.5 bg-white/5 border border-white/10 ares-cut-sm text-[10px] font-black uppercase tracking-widest text-marble">
                      {t.category}
                    </span>
                  </td>
                  <td className="p-4 text-sm text-white font-medium">{t.description || "—"}</td>
                  <td className={`p-4 text-sm font-black text-right ${t.type === 'income' ? 'text-ares-green' : 'text-ares-red'}`}>
                    {t.type === 'income' ? '+' : '-'}${Number(t.amount).toLocaleString()}
                  </td>
                  <td className="p-4">
                    <button 
                      onClick={() => confirm("Delete transaction?") && deleteTransaction.mutate({ params: { id: t.id! } })} 
                      className="opacity-0 group-hover:opacity-100 text-marble/20 hover:text-ares-red transition-all"
                      title="Delete transaction"
                      aria-label="Delete transaction"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
              {transactions.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-12 text-center">
                    <DashboardEmptyState icon={<RefreshCw size={48} />} message="No transactions recorded for this season." />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const XCircle = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
);
