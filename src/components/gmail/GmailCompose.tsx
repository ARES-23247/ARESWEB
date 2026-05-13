import { useState, useEffect } from "react";
import { useSendGmailMessage, type GmailMessage } from "../../api/gmail";
import { X, Send, Loader2 } from "lucide-react";

interface GmailComposeProps {
  threadId?: string;
  replyToMessageId?: string | null;
  messages?: GmailMessage[];
  onClose: () => void;
}

export function GmailCompose({
  threadId,
  replyToMessageId,
  messages = [],
  onClose,
}: GmailComposeProps) {
  const { mutate: sendMessage, isPending } = useSendGmailMessage();
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  // Pre-fill for reply
  useEffect(() => {
    if (replyToMessageId && messages.length > 0) {
      const replyToMsg = messages.find((m) => m.id === replyToMessageId);
      if (replyToMsg) {
        const fromHeader = replyToMsg.payload?.headers?.find((h) => h.name === "From");
        const subjectHeader = replyToMsg.payload?.headers?.find((h) => h.name === "Subject");
        const from = fromHeader?.value || "";
        const subj = subjectHeader?.value || "";

        setTo(from);
        setSubject(subj.startsWith("Re:") ? subj : `Re: ${subj}`);

        // Quote original message
        const originalBody = replyToMsg.snippet || "";
        setBody(`\n\n--- Original Message ---\nFrom: ${from}\n${originalBody}`);
      }
    }
  }, [replyToMessageId, messages]);

  const handleSend = () => {
    if (!to.trim() || !subject.trim() || !body.trim()) {
      return;
    }

    sendMessage(
      {
        to: [to],
        subject,
        body,
        threadId,
      },
      {
        onSuccess: () => {
          onClose();
        },
      }
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-obsidian border border-ares-gray-dark shadow-xl w-full max-w-2xl ares-cut-sm flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-ares-gray-dark">
          <h3 className="text-lg font-bold text-white">
            {replyToMessageId ? "Reply to Email" : "New Message"}
          </h3>
          <button
            onClick={onClose}
            className="p-1 text-marble hover:text-white hover:bg-ares-gray-dark/50 rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* To */}
          <div>
            <label className="block text-xs font-bold text-marble/60 uppercase tracking-wider mb-1">
              To
            </label>
            <input
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="recipient@example.com"
              className="w-full bg-ares-black border border-ares-gray-dark px-3 py-2 text-white placeholder-marble/50 focus:outline-none focus:ring-2 focus:ring-ares-cyan ares-cut-sm"
            />
          </div>

          {/* Subject */}
          {!replyToMessageId && (
            <div>
              <label className="block text-xs font-bold text-marble/60 uppercase tracking-wider mb-1">
                Subject
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Email subject"
                className="w-full bg-ares-black border border-ares-gray-dark px-3 py-2 text-white placeholder-marble/50 focus:outline-none focus:ring-2 focus:ring-ares-cyan ares-cut-sm"
              />
            </div>
          )}

          {/* Body */}
          <div className="flex-1">
            <label className="block text-xs font-bold text-marble/60 uppercase tracking-wider mb-1">
              Message
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your message..."
              rows={12}
              className="w-full bg-ares-black border border-ares-gray-dark px-3 py-2 text-white placeholder-marble/50 focus:outline-none focus:ring-2 focus:ring-ares-cyan ares-cut-sm resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-ares-gray-dark">
          <p className="text-xs text-marble/60">
            Emails are sent via your connected Google Account
          </p>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={isPending}
              className="px-4 py-2 text-marble hover:text-white hover:bg-ares-gray-dark/30 rounded transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSend}
              disabled={isPending || !to.trim() || !subject.trim() || !body.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-ares-cyan text-black font-bold ares-cut-sm hover:scale-105 transition-transform disabled:opacity-50 disabled:scale-100"
            >
              {isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
