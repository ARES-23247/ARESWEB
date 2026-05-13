import { useState } from "react";
import { useGmailMessages, useGmailAuthStatus, type GmailMessage } from "../../api/gmail";
import { Loader2, Mail, RefreshCw, Search, Inbox, Send, Archive, Trash, Star } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface GmailInboxProps {
  onMessageSelect: (messageId: string, threadId: string) => void;
}

const labelMap: Record<string, { name: string; icon: React.ElementType; color: string }> = {
  INBOX: { name: "Inbox", icon: Inbox, color: "text-ares-cyan" },
  SENT: { name: "Sent", icon: Send, color: "text-ares-gold" },
  DRAFT: { name: "Drafts", icon: Mail, color: "text-marble" },
  SPAM: { name: "Spam", icon: Archive, color: "text-ares-red" },
  TRASH: { name: "Trash", icon: Trash, color: "text-ares-red" },
  STARRED: { name: "Starred", icon: Star, color: "text-ares-gold" },
  IMPORTANT: { name: "Important", icon: Star, color: "text-ares-gold" },
};

export function GmailInbox({ onMessageSelect }: GmailInboxProps) {
  const [selectedLabel, setSelectedLabel] = useState("INBOX");
  const [searchQuery, setSearchQuery] = useState("");
  const { data: authStatus, isLoading: authLoading } = useGmailAuthStatus();
  const {
    data: messagesData,
    refetch,
    isLoading: messagesLoading,
  } = useGmailMessages(
    {
      labelIds: selectedLabel,
      maxResults: 50,
      q: searchQuery || undefined,
    },
    !!authStatus?.isAuthenticated
  );

  const messages = messagesData?.messages || [];

  const handleRefresh = () => {
    refetch();
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-ares-gold animate-spin" />
      </div>
    );
  }

  if (!authStatus?.isAuthenticated) {
    return (
      <div className="bg-obsidian border border-ares-gray-dark p-8 text-center">
        <Mail className="w-16 h-16 text-marble/40 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-white mb-2">Gmail Not Connected</h3>
        <p className="text-marble/60 mb-6">
          Connect your Google Account to view and send team emails.
        </p>
        <a
          href="/admin/integrations"
          className="inline-block px-6 py-2 bg-ares-cyan text-black font-bold ares-cut-sm hover:scale-105 transition-transform"
        >
          Go to Integrations
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-obsidian">
      {/* Header */}
      <div className="border-b border-ares-gray-dark p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-white tracking-wide uppercase flex items-center gap-2">
            <Mail className="w-6 h-6 text-ares-gold" />
            Team Inbox
          </h2>
          <button
            onClick={handleRefresh}
            disabled={messagesLoading}
            className="p-2 text-marble hover:text-white hover:bg-ares-gray-dark/50 rounded transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`w-5 h-5 ${messagesLoading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-marble/60" />
          <input
            type="text"
            placeholder="Search emails..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && refetch()}
            className="w-full bg-ares-black border border-ares-gray-dark pl-10 pr-4 py-2 text-white placeholder-marble/50 focus:outline-none focus:ring-2 focus:ring-ares-cyan ares-cut-sm"
          />
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Labels Sidebar */}
        <div className="w-48 border-r border-ares-gray-dark p-2 overflow-y-auto">
          {(Object.keys(labelMap) as Array<keyof typeof labelMap>).map((label) => {
            const { name, icon: Icon, color } = labelMap[label];
            return (
              <button
                key={label}
                onClick={() => setSelectedLabel(label)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded text-left transition-colors ${
                  selectedLabel === label
                    ? "bg-ares-cyan/20 text-ares-cyan"
                    : "text-marble/70 hover:bg-ares-gray-dark/30 hover:text-white"
                }`}
              >
                <Icon className={`w-4 h-4 ${color}`} />
                <span className="text-sm font-medium">{name}</span>
              </button>
            );
          })}
        </div>

        {/* Messages List */}
        <div className="flex-1 overflow-y-auto">
          {messagesLoading && messages.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 text-ares-gold animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center p-8">
              <Mail className="w-12 h-12 text-marble/30 mb-3" />
              <p className="text-marble/60">
                {searchQuery ? "No emails match your search" : "No emails in this folder"}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-ares-gray-dark/30">
              {messages.map((message) => (
                <MessageItem
                  key={message.id}
                  message={message}
                  onClick={() => onMessageSelect(message.id, message.threadId)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface MessageItemProps {
  message: GmailMessage;
  onClick: () => void;
}

function MessageItem({ message, onClick }: MessageItemProps) {
  const from = getMessageHeader(message, "From");
  const subject = getMessageHeader(message, "Subject") || "(No subject)";
  const date = message.internalDate
    ? formatDistanceToNow(new Date(parseInt(message.internalDate)), { addSuffix: true })
    : "";
  const isUnread = !message.labelIds?.includes("READ");

  return (
    <button
      onClick={onClick}
      className="w-full text-left p-4 hover:bg-ares-gray-dark/30 transition-colors border-l-2 border-transparent hover:border-ares-cyan/50"
    >
      <div className="flex items-start gap-3">
        <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${isUnread ? "bg-ares-cyan" : "bg-transparent"}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className={`font-medium truncate ${isUnread ? "text-white" : "text-marble/70"}`}>
              {from}
            </span>
            <span className="text-xs text-marble/50 flex-shrink-0">{date}</span>
          </div>
          <p className={`text-sm truncate mb-1 ${isUnread ? "text-white" : "text-marble/60"}`}>
            {subject}
          </p>
          <p className="text-xs text-marble/50 truncate">{message.snippet}</p>
        </div>
      </div>
    </button>
  );
}

function getMessageHeader(message: GmailMessage, name: string): string {
  if (!message.payload?.headers) return "";
  const header = message.payload.headers.find((h) => h.name === name);
  return header?.value || "";
}
