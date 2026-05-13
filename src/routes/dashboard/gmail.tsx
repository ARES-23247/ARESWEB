import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { GmailInbox, EmailViewer } from "../../components/gmail";

export const Route = createFileRoute("/dashboard/gmail")({
  component: GmailPage,
});

function GmailPage() {
  const [selectedMessage, setSelectedMessage] = useState<{
    messageId: string;
    threadId: string;
  } | null>(null);

  const handleMessageSelect = (messageId: string, threadId: string) => {
    setSelectedMessage({ messageId, threadId });
  };

  const handleBack = () => {
    setSelectedMessage(null);
  };

  return (
    <div className="h-[calc(100vh-4rem)]">
      {selectedMessage ? (
        <EmailViewer
          threadId={selectedMessage.threadId}
          onBack={handleBack}
        />
      ) : (
        <GmailInbox onMessageSelect={handleMessageSelect} />
      )}
    </div>
  );
}
