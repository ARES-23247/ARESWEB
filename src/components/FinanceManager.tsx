
import { useState } from "react";
import { z } from "zod";
import DashboardPageHeader from "./dashboard/DashboardPageHeader";
import DashboardMetricsGrid from "./dashboard/DashboardMetricsGrid";
import DashboardEmptyState from "./dashboard/DashboardEmptyState";
import { DashboardInput, DashboardSubmitButton } from "./dashboard/DashboardFormInputs";
import { Plus, Trash2, DollarSign, PieChart, TrendingUp, TrendingDown, RefreshCw, Wallet, Building, Circle, UserPlus, Handshake, CheckCircle2, XCircle as XCircleIcon } from "lucide-react";
import { GenericKanbanBoard, KanbanColumnConfig } from "./kanban/GenericKanbanBoard";
import { SortablePipelineCard } from "./kanban/SortablePipelineCard";
import SponsorshipEditModal from "./kanban/SponsorshipEditModal";
import { motion, AnimatePresence } from "framer-motion";
import SeasonPicker from "./SeasonPicker";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { financeTransactionSchema, sponsorshipPipelineSchema, type SponsorshipPipelinePayload } from "@shared/schemas/financeSchema";
import type { PipelineItem, TransactionItem } from "../types/finance";
import { 
  useGetFinanceSummary, 
  useListSponsorshipPipeline, 
  useSaveSponsorshipPipeline, 
  useDeleteSponsorshipPipeline, 
  useListFinanceTransactions, 
  useSaveFinanceTransaction, 
  useDeleteFinanceTransaction 
} from "../api";

// ── Status config for Sponsorship ─────────────────────────────────────
const PIPELINE_COLUMNS = ["potential", "contacted", "pledged", "secured", "lost"] as const;

const pipelineConfig: Record<string, KanbanColumnConfig> = {
  potential: { bg: "bg-white/5", text: "text-marble/50", border: "border-white/10", label: "Potential", icon: Circle },
  contacted: { bg: "bg-ares-cyan/10", text: "text-ares-cyan", border: "border-ares-cyan/30", label: "Contacted", icon: UserPlus },
  pledged:   { bg: "bg-ares-gold/10", text: "text-ares-gold", border: "border-ares-gold/30", label: "Pledged", icon: Handshake },
  secured:   { bg: "bg-ares-green/10", text: "text-ares-green", border: "border-ares-green/30", label: "Secured", icon: CheckCircle2 },
  lost:      { bg: "bg-ares-red/10", text: "text-ares-red", border: "border-ares-red/30", label: "Lost", icon: XCircleIcon },
};

export type { PipelineItem, TransactionItem };

export default function FinanceManager() {
  const [activeTab, setActiveTab] = useState<"pipeline" | "ledger">("pipeline");
  const [isAdding, setIsAdding] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState<number | null>(null);
  const [editingLead, setEditingLead] = useState<PipelineItem | null>(null);
  const [activeKanbanFilter, setActiveKanbanFilter] = useState<string | null>(null);

  // ── Queries ──
  const { data: summaryRes, error: summaryError } = useGetFinanceSummary(selectedSeason);
  const { data: pipelineDataRes, error: pipelineError } = useListSponsorshipPipeline(selectedSeason);
  const { data: transactionsDataRes, error: transactionsError } = useListFinanceTransactions(selectedSeason);

  const summary = summaryRes;
  const pipeline = pipelineDataRes?.pipeline || [];
  const transactions = transactionsDataRes?.transactions || [];
  const isError = !!(summaryError || pipelineError || transactionsError);

  // ── Mutations ──
  const savePipeline = useSaveSponsorshipPipeline();
  const saveTransaction = useSaveFinanceTransaction();
  const deleteTransaction = useDeleteFinanceTransaction();
  const deletePipeline = useDeleteSponsorshipPipeline();

  const handleSavePipeline = (data: z.infer<typeof sponsorshipPipelineSchema>) => {
    savePipeline.mutate(data, {
      onSuccess: () => {
        toast.success("Sponsorship updated.");
        setIsAdding(false);
        pipelineForm.reset();
      },
      onError: (err: Error) => {
        toast.error(`Failed to save lead: ${err.message || "Unknown error"}`);
      }
    });
  };

  const handleSaveTransaction = (data: z.infer<typeof financeTransactionSchema>) => {
    saveTransaction.mutate(data, {
      onSuccess: () => {
        toast.success("Transaction recorded.");
        setIsAdding(false);
        transactionForm.reset();
      },
      onError: (err: Error) => {
        toast.error(`Failed to save transaction: ${err.message || "Unknown error"}`);
      }
    });
  };

  const handleDeleteTransaction = (id: string) => {
    deleteTransaction.mutate(id, {
      onSuccess: () => toast.success("Transaction deleted."),
      onError: (err: Error) => toast.error(`Failed to delete: ${err.message}`)
    });
  };

  const handleDeletePipeline = (id: string) => {
    deletePipeline.mutate(id, {
      onSuccess: () => toast.success("Pipeline item deleted."),
      onError: (err: Error) => toast.error(`Failed to delete: ${err.message}`)
    });
  };

  // ── Forms ──
  const pipelineForm = useForm({
    resolver: zodResolver(sponsorshipPipelineSchema),
    defaultValues: { company_name: "", status: "potential", estimated_value: 0, season_id: selectedSeason }
  });

  const transactionForm = useForm({
    resolver: zodResolver(financeTransactionSchema),
    defaultValues: { type: "expense", amount: 0, category: "parts", date: new Date().toISOString().split('T')[0], description: "", season_id: selectedSeason }
  });

  const isInitialLoading = !summaryRes && !isError;

  if (isError) {
    return (
      <div className="p-8 bg-ares-red/10 border border-ares-red/20 ares-cut-lg text-center">
        <RefreshCw className="mx-auto mb-4 text-ares-red animate-spin" size={32} />
        <h3 className="text-ares-red font-black uppercase tracking-widest text-lg mb-2">Financial Link Severed</h3>
        <p className="text-marble/60 text-sm mb-4">An error occurred while connecting to the team ledger.</p>
        <div className="font-mono text-[10px] py-1 px-2 bg-black/40 text-ares-red/80 inline-block ares-cut-sm">
          STATUS: ERROR
        </div>
      </div>
    );
  }

  if (isInitialLoading || !summary) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <RefreshCw className="text-ares-cyan animate-spin" size={48} />
        <p className="text-marble/60 font-black uppercase tracking-widest animate-pulse">Syncing Ledger...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Overview Metrics */}
      <DashboardMetricsGrid 
        metrics={[
          { label: "Total Income", value: `$${(summary?.total_income ?? 0).toLocaleString()}`, icon: <TrendingUp className="text-ares-green" /> },
          { label: "Total Expenses", value: `$${(summary?.total_expenses ?? 0).toLocaleString()}`, icon: <TrendingDown className="text-ares-red" /> },
          { label: "Cash Balance", value: `$${(summary?.balance ?? 0).toLocaleString()}`, icon: <Wallet className="text-ares-gold" /> },
          { label: "Pipeline Value", value: `$${pipeline.reduce((acc: number, p: PipelineItem) => acc + (p.status !== 'lost' ? (Number(p.estimated_value) || 0) : 0), 0).toLocaleString()}`, icon: <PieChart className="text-ares-cyan" /> },
        ]}
      />

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex bg-black/40 p-1 ares-cut-sm border border-white/5">
          <button 
            onClick={() => { setActiveTab("pipeline"); setIsAdding(false); }}
            className={`px-4 py-2 text-xs font-black uppercase tracking-widest transition-all ares-cut-sm ${activeTab === 'pipeline' ? 'bg-ares-red text-white' : 'text-marble/60 hover:text-white'}`}
          >
            Sponsorship Pipeline
          </button>
          <button 
            onClick={() => { setActiveTab("ledger"); setIsAdding(false); }}
            className={`px-4 py-2 text-xs font-black uppercase tracking-widest transition-all ares-cut-sm ${activeTab === 'ledger' ? 'bg-ares-red text-white' : 'text-marble/60 hover:text-white'}`}
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
              <form onSubmit={pipelineForm.handleSubmit(data => handleSavePipeline({ ...data, season_id: selectedSeason || undefined }))} className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <DashboardInput id="pipeline-company" label="Company Name" {...pipelineForm.register("company_name")} error={pipelineForm.formState.errors.company_name?.message} fullWidth />
                <DashboardInput id="pipeline-value" label="Est. Value ($)" type="number" {...pipelineForm.register("estimated_value")} error={pipelineForm.formState.errors.estimated_value?.message} />
                <div className="flex flex-col gap-1">
                  <label htmlFor="pipeline-status" className="text-[10px] font-black uppercase tracking-widest text-marble/60 px-1">Initial Status</label>
                  <select id="pipeline-status" {...pipelineForm.register("status")} className="bg-white/5 border border-white/10 ares-cut-sm p-3 text-sm text-white focus:border-ares-red outline-none">
                    {PIPELINE_COLUMNS.map(c => <option key={c} value={c} className="bg-obsidian text-white">{pipelineConfig[c].label}</option>)}
                  </select>
                </div>
                <div className="md:col-span-3">
                  <DashboardSubmitButton isPending={savePipeline.isPending} defaultText="Add Lead to Pipeline" theme="red" />
                </div>
              </form>
            ) : (
              <form onSubmit={transactionForm.handleSubmit(data => handleSaveTransaction({ ...data, season_id: selectedSeason || undefined }))} className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="flex flex-col gap-1">
                  <label htmlFor="transaction-type" className="text-[10px] font-black uppercase tracking-widest text-marble/60 px-1">Type</label>
                  <select id="transaction-type" {...transactionForm.register("type")} className="bg-white/5 border border-white/10 ares-cut-sm p-3 text-sm text-white focus:border-ares-red outline-none">
                    <option value="expense" className="bg-obsidian text-white">Expense (-)</option>
                    <option value="income" className="bg-obsidian text-white">Income (+)</option>
                  </select>
                </div>
                <DashboardInput id="ledger-amount" label="Amount ($)" type="number" step="0.01" {...transactionForm.register("amount")} error={transactionForm.formState.errors.amount?.message} />
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
        <>
          <GenericKanbanBoard<PipelineItem>
            items={pipeline}
            columns={PIPELINE_COLUMNS}
            columnConfig={pipelineConfig}
            getId={(item) => String(item.id)}
            getStatus={(item) => item.status}
            getSortOrder={(_item) => 0} // no sort order in DB currently
            onReorder={(updates) => {
              // we only care about status updates since sort_order is not saved
              // to optimize, just update the items that changed status
              updates.forEach(update => {
                const item = pipeline.find((p: PipelineItem) => String(p.id) === update.id);
                if (item && item.status !== update.status) {
                  const pipelineItem = item as PipelineItem & { id?: string; season_id?: number | null };
                  savePipeline.mutate({
                    id: pipelineItem.id,
                    company_name: pipelineItem.company_name,
                    status: update.status as "potential" | "contacted" | "pledged" | "secured" | "lost",
                    estimated_value: Number(pipelineItem.estimated_value),
                    contact_person: pipelineItem.contact_person ?? null,
                    notes: pipelineItem.notes ?? null,
                    season_id: pipelineItem.season_id ?? null,
                    assignees: pipelineItem.assignees ?? [],
                  });
                }
              });
            }}
            isLoading={isInitialLoading}
            activeFilter={activeKanbanFilter}
            onFilterChange={setActiveKanbanFilter}
            emptyStateText="No leads"
            renderItem={(item) => (
              <SortablePipelineCard
                key={item.id}
                item={item}
                onDelete={(id) => handleDeletePipeline(id)}
                onEdit={(item) => setEditingLead(item)}
              />
            )}
            renderDragOverlay={(item) => (
              <div className="p-3 bg-obsidian/90 ares-cut-sm border border-ares-cyan/40 shadow-lg shadow-ares-cyan/10 cursor-grabbing">
                <p className="text-sm font-bold text-white leading-tight">{item.company_name}</p>
              </div>
            )}
          />

          <AnimatePresence>
            {editingLead && (
              <SponsorshipEditModal
                item={editingLead}
                onClose={() => setEditingLead(null)}
                onSave={async (id, updates) => {
                  const lead = editingLead as PipelineItem & { id?: string };
                  const updatePayload: SponsorshipPipelinePayload = {
                    id: lead.id,
                    company_name: updates.company_name ?? lead.company_name,
                    status: updates.status ?? lead.status,
                    estimated_value: Number(updates.estimated_value ?? lead.estimated_value),
                    contact_person: updates.contact_person ?? lead.contact_person ?? null,
                    notes: updates.notes ?? lead.notes ?? null,
                    season_id: updates.season_id ?? lead.season_id ?? null,
                    assignees: updates.assignees ?? lead.assignees ?? [],
                  };
                  handleSavePipeline(updatePayload);
                  setEditingLead(null);
                }}
                onDelete={(id) => {
                  handleDeletePipeline(id);
                  setEditingLead(null);
                }}
              />
            )}
          </AnimatePresence>
        </>
      ) : (
        <div className="bg-black/40 border border-white/5 ares-cut-lg overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/5 border-b border-white/5">
                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-marble/60">Date</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-marble/60">Category</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-marble/60">Description</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-marble/60 text-right">Amount</th>
                <th className="p-4 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {transactions.map((t: TransactionItem) => (
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
                      onClick={() => confirm("Delete transaction?") && handleDeleteTransaction(t.id!)} 
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
