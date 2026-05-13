import { useState } from "react";
import { useGmailThread, type GmailMessage } from "../../api/gmail";
import { Loader2, ArrowLeft, Reply, User, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { GmailCompose } from "./GmailCompose";

interface EmailViewerProps {
  threadId: string;
  onBack: () => void;
}

export function EmailViewer({ threadId, onBack }: EmailViewerProps) {
  const { data: thread, isLoading } = useGmailThread(threadId);
  const [isReplying, setIsReplying] = useState(false);
  const [replyToMessageId, setReplyToMessageId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 text-ares-gold animate-spin" />
      </div>
    );
  }

  if (!thread?.messages?.length) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-marble/60">Email not found</p>
      </div>
    );
  }

  const messages = thread.messages.sort(
    (a, b) => parseInt(a.internalDate) - parseInt(b.internalDate)
  );

  const handleReply = (messageId: string) => {
    setReplyToMessageId(messageId);
    setIsReplying(true);
  };

  const lastMessage = messages[messages.length - 1];

  return (
    <div className="flex flex-col h-full bg-obsidian">
      {/* Toolbar */}
      <div className="border-b border-ares-gray-dark p-4 flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-2 text-marble hover:text-white hover:bg-ares-gray-dark/50 rounded transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1" />
        <button
          onClick={() => handleReply(lastMessage.id)}
          className="flex items-center gap-2 px-4 py-2 bg-ares-cyan text-black font-bold ares-cut-sm hover:scale-105 transition-transform"
        >
          <Reply className="w-4 h-4" />
          Reply
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.map((message, index) => (
          <MessageBubble
            key={message.id}
            message={message}
            isLast={index === messages.length - 1}
            onReply={() => handleReply(message.id)}
          />
        ))}
      </div>

      {/* Compose Reply Modal */}
      {isReplying && (
        <GmailCompose
          threadId={threadId}
          replyToMessageId={replyToMessageId}
          messages={messages}
          onClose={() => {
            setIsReplying(false);
            setReplyToMessageId(null);
          }}
        />
      )}
    </div>
  );
}

interface MessageBubbleProps {
  message: GmailMessage;
  isLast: boolean;
  onReply: () => void;
}

function MessageBubble({ message, isLast, onReply }: MessageBubbleProps) {
  const from = getMessageHeader(message, "From");
  const to = getMessageHeader(message, "To");
  const subject = getMessageHeader(message, "Subject");
  const date = message.internalDate
    ? formatDistanceToNow(new Date(parseInt(message.internalDate)), { addSuffix: true })
    : "";
  const body = getMessageBody(message);

  return (
    <div className={`bg-ares-gray-dark/30 border border-ares-gray-dark/50 p-6 ares-cut-sm ${isLast ? "ring-1 ring-ares-cyan/30" : ""}`}>
      {/* Headers */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-bold text-white mb-1">{subject}</h3>
          <div className="flex items-center gap-4 text-sm text-marble/60">
            <span className="flex items-center gap-1">
              <User className="w-3 h-3" />
              {from}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {date}
            </span>
          </div>
          {to && (
            <p className="text-xs text-marble/40 mt-1">
              To: {to}
            </p>
          )}
        </div>
        {isLast && (
          <button
            onClick={onReply}
            className="p-2 text-ares-cyan hover:bg-ares-cyan/10 rounded transition-colors"
            title="Reply"
          >
            <Reply className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Body */}
      <div className="prose prose-invert prose-sm max-w-none">
        <div
          className="text-marble/80 whitespace-pre-wrap break-words"
          dangerouslySetInnerHTML={{ __html: body }}
        />
      </div>

      {/* Attachments */}
      {(message.payload as unknown as { parts?: { filename?: string }[] })?.parts?.some((p) => p.filename && p.filename !== "") && (
        <div className="mt-4 pt-4 border-t border-ares-gray-dark/50">
          <p className="text-xs font-bold text-marble/60 uppercase mb-2">Attachments</p>
          <div className="flex flex-wrap gap-2">
            {(message.payload as unknown as { parts?: { filename?: string }[] }).parts
              ?.filter((p) => p.filename && p.filename !== "")
              .map((part, i: number) => (
                <div
                  key={i}
                  className="px-3 py-2 bg-ares-black border border-ares-gray-dark rounded text-sm text-marble/70 flex items-center gap-2"
                >
                  <span>📎</span>
                  <span>{part.filename}</span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

function getMessageHeader(message: GmailMessage, name: string): string {
  if (!message.payload?.headers) return "";
  const header = message.payload.headers.find((h) => h.name === name);
  return header?.value || "";
}

function getMessageBody(message: GmailMessage): string {
  if (!message.payload) return "";

  // Try to get body from payload.body
  if (message.payload.body?.data) {
    return decodeBase64(message.payload.body.data);
  }

  // Try to get body from parts
  const parts = (message.payload as unknown as { parts?: { mimeType?: string; body?: { data?: string } }[] }).parts;
  if (parts) {
    for (const part of parts) {
      if (part.mimeType === "text/html" && part.body?.data) {
        return decodeBase64(part.body.data);
      }
      if (part.mimeType === "text/plain" && part.body?.data) {
        return decodeBase64(part.body.data);
      }
    }
  }

  return message.snippet || "";
}

function decodeBase64(data: string): string {
  try {
    // Gmail uses URL-safe base64
    const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = atob(base64);
    // Try to decode as UTF-8
    const bytes = new Uint8Array(decoded.length);
    for (let i = 0; i < decoded.length; i++) {
      bytes[i] = decoded.charCodeAt(i);
    }
    return new TextDecoder("utf-8").decode(bytes);
  } catch {
    return data;
  }
}
