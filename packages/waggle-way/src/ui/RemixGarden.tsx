import { useEffect, useRef, useState, type RefObject } from "react";
import { DialogShell } from "@ares/ui/dialog";
import { Button } from "@ares/ui/button";
import type { CommunityClient, CommunityGarden } from "../core/community";
import GardenScene from "./GardenScene";

export interface RemixSource {
  id: string;
  revision: string;
}

/** Fetch public content anew. A link carries identity, never ownership or level data. */
export default function RemixGarden({
  client,
  source,
  onLoad,
  onClose,
  onExport,
  returnFocusRef,
}: {
  client: CommunityClient;
  source: RemixSource;
  onLoad: (garden: CommunityGarden) => boolean;
  onClose: () => void;
  onExport: () => void;
  returnFocusRef: RefObject<HTMLButtonElement | null>;
}) {
  const [refresh, setRefresh] = useState(0);
  const [result, setResult] = useState<{
    garden: CommunityGarden | null;
    error: string;
  } | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    let current = true;
    const revision = Number(source.revision);
    if (
      !/^[a-zA-Z0-9_-]{1,64}$/.test(source.id) ||
      !/^[1-9]\d*$/.test(source.revision) ||
      !Number.isSafeInteger(revision)
    ) {
      setResult({
        garden: null,
        error:
          "This remix link is invalid. Open a garden from the community browser.",
      });
      return;
    }
    void client
      .get(source.id)
      .then((garden) => {
        if (!current) return;
        if (garden.id !== source.id)
          throw new Error(
            "This garden does not match the remix link. Open it again from the community browser.",
          );
        setResult({ garden, error: "" });
      })
      .catch((cause: unknown) => {
        if (current)
          setResult({
            garden: null,
            error:
              cause instanceof Error
                ? cause.message
                : "This garden could not be opened.",
          });
      });
    return () => {
      current = false;
    };
  }, [client, source.id, source.revision, refresh]);
  useEffect(() => {
    if (result?.garden) heading.current?.focus();
  }, [result]);
  const garden = result?.garden;
  return (
    <DialogShell
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="Make it your garden"
      size="xl"
      className="ww-page ww-map-dialog ww-community-dialog"
      returnFocusRef={returnFocusRef}
    >
      <div className="ww-community">
        {!result && <p role="status">Opening the community garden…</p>}
        {result?.error && (
          <p role="alert" className="ww-error">
            {result.error}
          </p>
        )}
        {garden && (
          <>
            <h3 ref={heading} tabIndex={-1}>
              {garden.title}
            </h3>
            <p>
              By {garden.nickname} · Revision {garden.revision}
            </p>
            {garden.revision !== Number(source.revision) && (
              <p role="status">
                This garden changed since you selected it. The preview shows its
                latest approved revision.
              </p>
            )}
            <div
              className="ww-community-preview"
              style={{
                maxWidth: `${(40 * garden.level.width) / garden.level.height}dvh`,
              }}
            >
              <GardenScene level={garden.level} overlays={false} />
            </div>
            <p>
              This starts a separate remix and replaces the current workshop
              draft. Export your draft first to keep a file. Undo can restore
              earlier content.
            </p>
            <p>
              Your remix needs its own successful test flight and approval
              before sharing.
            </p>
            <Button
              onClick={() => {
                if (onLoad(garden)) onClose();
                else
                  setResult({
                    garden,
                    error:
                      "This remix could not be loaded. Your current draft is kept.",
                  });
              }}
            >
              Remix this revision
            </Button>
          </>
        )}
        <div className="ww-toolbar">
          <Button variant="secondary" onClick={onExport}>
            Export current draft
          </Button>
          {result?.error && (
            <Button
              variant="secondary"
              onClick={() => {
                setResult(null);
                setRefresh((value) => value + 1);
              }}
            >
              Retry garden
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            Keep current draft
          </Button>
        </div>
      </div>
    </DialogShell>
  );
}
