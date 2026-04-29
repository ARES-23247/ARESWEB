import React, { useEffect, useState, createContext, useContext } from "react";
import { RoomProvider, useRoom } from "@liveblocks/react/suspense";
import { ClientSideSuspense } from "@liveblocks/react";
import { LiveblocksYjsProvider } from "@liveblocks/yjs";
import * as Y from "yjs";
import { RefreshCw } from "lucide-react";

interface CollaborativeEditorContextType {
  ydoc: Y.Doc | undefined;
  provider: unknown | undefined;
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
  onDocLoaded,
}: {
  children: React.ReactNode;
  initialContent?: string;
  onDocLoaded?: (ydoc: Y.Doc) => void;
}) {
  const room = useRoom();
  const [ydoc] = useState<Y.Doc>(() => new Y.Doc());
  const [provider] = useState<LiveblocksYjsProvider>(() => new LiveblocksYjsProvider(room, ydoc));

  useEffect(() => {
    provider.on("synced", (isSynced: boolean) => {
      if (isSynced) {
        onDocLoaded?.(ydoc);
      }
    });

    return () => {
      ydoc.destroy();
      provider.destroy();
    };
  }, [provider, ydoc, onDocLoaded]);

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
