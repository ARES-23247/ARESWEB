import React, { useEffect, useState, createContext, useContext } from "react";
import { RoomProvider, useRoom } from "@liveblocks/react/suspense";
import { ClientSideSuspense } from "@liveblocks/react";
import { LiveblocksYjsProvider } from "@liveblocks/yjs";
import * as Y from "yjs";
import { RefreshCw } from "lucide-react";

interface CollaborativeEditorContextType {
  ydoc: Y.Doc | undefined;
  provider: any | undefined;
}

const CollaborativeEditorContext = createContext<CollaborativeEditorContextType>({
  ydoc: undefined,
  provider: undefined,
});

export function useCollaborativeEditor() {
  return useContext(CollaborativeEditorContext);
}

function CollaborativeEditorInner({
  children,
  initialContent,
  onDocLoaded,
}: {
  children: React.ReactNode;
  initialContent?: string;
  onDocLoaded?: (ydoc: Y.Doc) => void;
}) {
  const room = useRoom();
  const [ydoc, setYdoc] = useState<Y.Doc>();
  const [provider, setProvider] = useState<any>();

  useEffect(() => {
    const yDoc = new Y.Doc();
    const yProvider = new LiveblocksYjsProvider(room, yDoc);

    // If initialContent is provided, we can inject it here if the doc is empty.
    // However, Liveblocks/Yjs might already be syncing. We need to wait for sync
    // and then check if the doc is empty.
    yProvider.on("synced", (isSynced: boolean) => {
      if (isSynced) {
        const type = yDoc.getXmlFragment("default");
        // We defer injecting content to the Editor component using commands.setContent
        // since Tiptap handles HTML/JSON parsing. So we just pass the doc up.
        onDocLoaded?.(yDoc);
      }
    });

    setYdoc(yDoc);
    setProvider(yProvider);

    return () => {
      yDoc.destroy();
      yProvider.destroy();
    };
  }, [room, onDocLoaded]);

  return (
    <CollaborativeEditorContext.Provider value={{ ydoc, provider }}>
      {children}
    </CollaborativeEditorContext.Provider>
  );
}

export function CollaborativeEditorRoom({
  roomId,
  children,
  initialContent,
  onDocLoaded,
}: {
  roomId: string;
  children: React.ReactNode;
  initialContent?: string;
  onDocLoaded?: (ydoc: Y.Doc) => void;
}) {
  return (
    <RoomProvider id={roomId} initialPresence={{ cursor: null }}>
      <ClientSideSuspense
        fallback={
          <div className="flex items-center justify-center py-20 bg-ares-black border-x border-b border-white/10 rounded-b-xl min-h-[400px]">
            <RefreshCw className="animate-spin text-ares-red" size={32} />
          </div>
        }
      >
        <CollaborativeEditorInner initialContent={initialContent} onDocLoaded={onDocLoaded}>
          {children}
        </CollaborativeEditorInner>
      </ClientSideSuspense>
    </RoomProvider>
  );
}
