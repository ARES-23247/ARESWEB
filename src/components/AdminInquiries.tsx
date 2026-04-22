import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2, MessageSquare, Mail, Calendar, CheckSquare, Clock } from "lucide-react";
import { adminApi } from "../api/adminApi";

type Inquiry = {
  id: string;
  type: string;
  name: string;
  email: string;
  metadata: string;
  status: string;
  created_at: string;
};

import DashboardPageHeader from "./dashboard/DashboardPageHeader";
import DashboardEmptyState from "./dashboard/DashboardEmptyState";
import DashboardLoadingGrid from "./dashboard/DashboardLoadingGrid";

export default function AdminInquiries() {
  const queryClient = useQueryClient();

  const { data: inquiries = [], isLoading } = useQuery({
    queryKey: ["admin-inquiries"],
    queryFn: async () => {
      const d = await adminApi.get<{ inquiries?: Inquiry[] }>("/api/inquiries");
      return d.inquiries || [];
    }
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await adminApi.updateInquiryStatus(id, status);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-inquiries"] })
  });

  const deleteInquiry = useMutation({
    mutationFn: async (id: string) => {
      await adminApi.deleteInquiry(id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-inquiries"] })
  });

  return (
    <div className="space-y-6">
      <DashboardPageHeader 
        title="Team Inquiries" 
        subtitle="Review student, mentor, and sponsor applications."
        icon={<MessageSquare className="text-ares-gold" />}
      />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {isLoading ? (
           <DashboardLoadingGrid count={3} heightClass="h-40" />
        ) : inquiries.map((iq) => {
          let meta: Record<string, string | string[]> = {};
          try {
            if (iq.metadata) meta = JSON.parse(iq.metadata);
          } catch { /* ignore */ }
          
          return (
            <div key={iq.id} className="bg-black/40 border border-white/5 ares-cut-lg p-6 relative group transition-all hover:border-white/20 flex flex-col h-full">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                    iq.type === 'student' ? 'bg-ares-red/20 text-ares-red' : 
                    iq.type === 'mentor' ? 'bg-blue-500/20 text-blue-400' : 'bg-ares-cyan/20 text-ares-cyan'
                  }`}>
                    {iq.type} Form
                  </div>
                  <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                    iq.status === 'pending' ? 'bg-yellow-500/20 text-yellow-500' : 'bg-emerald-500/20 text-emerald-500'
                  }`}>
                    {iq.status}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {iq.status === 'pending' && (
                    <button onClick={() => updateStatus.mutate({ id: iq.id, status: 'resolved' })} className="text-zinc-500 hover:text-emerald-500 transition-colors" title="Mark Resolved">
                      <CheckSquare size={16} />
                    </button>
                  )}
                  {iq.status === 'resolved' && (
                    <button onClick={() => updateStatus.mutate({ id: iq.id, status: 'pending' })} className="text-zinc-500 hover:text-yellow-500 transition-colors" title="Mark Pending">
                      <Clock size={16} />
                    </button>
                  )}
                  <button onClick={() => { if(confirm("Delete inquiry?")) deleteInquiry.mutate(iq.id); }} className="text-zinc-500 hover:text-ares-red transition-colors" title="Delete">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <div className="mb-4 flex-shrink-0">
                <h4 className="text-xl font-bold text-white mb-1">{iq.name}</h4>
                <div className="flex items-center gap-2 text-sm text-zinc-400">
                  <Mail size={14} /> <a href={`mailto:${iq.email}`} className="hover:text-white transition-colors">{iq.email}</a>
                  <span className="mx-2 text-zinc-600">•</span>
                  <Calendar size={14} /> {new Date(iq.created_at).toLocaleDateString()}
                </div>
              </div>

              <div className="bg-white/5 ares-cut-sm p-4 text-sm text-zinc-300 flex-1">
                <div className="grid grid-cols-2 gap-y-3 mb-2">
                  {Object.entries(meta).map(([k, v]) => (
                    k !== 'additional' && v && (
                      <div key={k}>
                        <span className="block text-[10px] font-black uppercase text-zinc-500 tracking-widest">{k}</span>
                        <span className="font-medium text-white">{Array.isArray(v) ? v.join(', ') : String(v)}</span>
                      </div>
                    )
                  ))}
                </div>
                {meta.additional && (
                  <div className="mt-4 pt-4 border-t border-white/5">
                    <span className="block text-[10px] font-black uppercase text-zinc-500 tracking-widest">Additional Notes</span>
                    <p className="mt-1 italic text-zinc-400 whitespace-pre-wrap">{meta.additional}</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {inquiries.length === 0 && !isLoading && (
          <DashboardEmptyState
            className="col-span-1 lg:col-span-2 py-16 text-center border-2 border-dashed border-white/5 ares-cut-lg"
            icon={<MessageSquare size={32} />}
            message="No active inquiries or applications."
          />
        )}
      </div>
    </div>
  );
}
