import { useState } from "react";
import { Mail, Users, Send, AlertTriangle } from "lucide-react";
import { useGetMassEmailStats, useSendMassEmail } from "../api";
import { toast } from "sonner";
import { toastApiError } from "../api/honoClient";
import { useRichEditor } from "./editor/useRichEditor";
import RichEditorToolbar from "./editor/RichEditorToolbar";
import { CopilotMenu } from "./editor/CopilotMenu";

export default function MassEmailComposer() {
  const [subject, setSubject] = useState("");

  const editor = useRichEditor({
    placeholder: "<p>Start drafting your mass email here...</p>"
  });

  const { isLoading: isStatsLoading, data: statsRes } = useGetMassEmailStats();

  const sendMutation = useSendMassEmail({
    onSuccess: (data) => {
      if (data.success) {
        toast.success(`Mass email dispatched successfully to ${data.recipientCount} recipients.`);
        setSubject("");
        editor?.commands.setContent("");
      } else {
        const errorMsg = data.error || data.message || "Unknown error";
        toast.error(`Email send failed: ${errorMsg}`);
      }
    },
    onError: (err: unknown) => {
      toastApiError(err, "Email Blast Failed");
    }
  });

  const handleSend = () => {
    if (!subject.trim()) {
      toast.error("Please enter a subject.");
      return;
    }
    const htmlContent = editor?.getHTML() || "";
    if (!htmlContent || htmlContent === "<p></p>") {
      toast.error("Please enter email content.");
      return;
    }

    // Check if there are active users to send to
    if (!statsRes?.activeUsers || statsRes.activeUsers === 0) {
      toast.error("No active recipients found. There are no registered website users to send emails to.");
      return;
    }

    if (confirm("Are you sure you want to send this mass email to all registered website users?")) {
      sendMutation.mutate({ subject, htmlContent });
    }
  };




  return (
    <div className="flex flex-col h-full bg-obsidian text-white font-sans animate-in fade-in slide-in-from-bottom-4 duration-500 overflow-y-auto">
      <div className="p-4 sm:p-6 md:p-8 shrink-0 border-b border-white/5 bg-gradient-to-r from-obsidian to-black relative">
        <div className="absolute inset-0 bg-[url('/textures/cubes.png')] opacity-[0.02] mix-blend-overlay pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-ares-red/10 border border-ares-red/20 flex items-center justify-center ares-cut-sm shrink-0">
              <Mail className="text-ares-red" size={24} />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tighter flex items-center gap-2">
                Team <span className="text-marble/60">Broadcaster</span>
              </h1>
              <p className="text-xs sm:text-sm text-marble/60 font-bold uppercase tracking-widest mt-1">
                ARES Mass Email Composer
              </p>
            </div>
          </div>
          
          <button
            onClick={handleSend}
            disabled={sendMutation.isPending || !subject}
            className={`flex items-center gap-2 px-8 py-3 ares-cut-sm font-black tracking-widest transition-all ${
              sendMutation.isPending || !subject
                ? "bg-white/5 text-marble/60 cursor-not-allowed border border-white/5"
                : "bg-ares-red text-white hover:bg-red-700 hover:scale-[1.02] active:scale-95 shadow-[0_0_20px_rgba(192,0,0,0.4)]"
            }`}
          >
            {sendMutation.isPending ? (
              <>
                <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" aria-hidden="true"></div>
                <span>DISPATCHING...</span>
                <span className="sr-only">Sending mass email, please wait.</span>
              </>
            ) : (
              <>
                <Send size={18} />
                <span>DISPATCH BLAST</span>
              </>
            )}
          </button>
        </div>
      </div>

      <div className="flex-1 p-4 sm:p-6 md:p-8 max-w-5xl mx-auto w-full flex flex-col gap-6 relative">
        {/* Status Card */}
        <div className="bg-white/5 border border-white/10 ares-cut p-4 flex items-center gap-4">
          <div className="w-10 h-10 bg-ares-cyan/10 border border-ares-cyan/30 flex items-center justify-center shrink-0">
            <Users className="text-ares-cyan" size={20} />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-white uppercase tracking-widest">Audience Roster</h3>
            <p className="text-xs text-marble/60">Sourced directly from registered website users.</p>
          </div>
          <div className="text-right">
             {isStatsLoading ? (
               <div className="h-6 w-16 bg-white/10 animate-pulse rounded"></div>
             ) : (
               <div className="text-2xl font-black text-ares-cyan tracking-tighter">
                 {statsRes?.activeUsers || 0} <span className="text-sm font-bold text-marble/60 uppercase tracking-widest">Recipients</span>
               </div>
             )}
          </div>
        </div>

        {statsRes?.activeUsers === 0 && !isStatsLoading && (
          <div className="bg-ares-red/10 border border-ares-red/30 p-4 flex items-start gap-3 ares-cut-sm text-sm text-ares-red-soft">
            <AlertTriangle className="shrink-0 mt-0.5" size={18} />
            <div>
              <p className="font-bold">No active recipients found.</p>
              <p className="opacity-80">There are no registered website users in the database.</p>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <label htmlFor="subject-input" className="text-xs font-black text-marble/60 uppercase tracking-widest">Email Subject</label>
          <input
            id="subject-input"
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full bg-white/5 border border-white/10 px-4 py-3 text-white focus:outline-none focus:border-ares-red/50 ares-cut-sm transition-colors text-lg"
            placeholder="Important Update: State Championship Logistics"
          />
        </div>

        <div className="flex-1 flex flex-col gap-2 min-h-[500px]">
          <label htmlFor="body-input" className="text-xs font-black text-marble/60 uppercase tracking-widest">HTML Body</label>
          <div id="body-input" role="textbox" aria-label="HTML Body" className="flex-1 bg-white/5 border border-white/10 ares-cut relative flex flex-col group focus-within:border-ares-red/50 transition-colors min-h-[500px] overflow-visible">
             {editor && <RichEditorToolbar editor={editor} documentTitle={subject} />}
             {editor && <CopilotMenu editor={editor} />}
          </div>
        </div>
      </div>
    </div>
  );
}
