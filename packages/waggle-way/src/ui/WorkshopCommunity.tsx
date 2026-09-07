import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { Button } from "@ares/ui/button";
import { DialogShell } from "@ares/ui/dialog";
import { CommunityRequestError } from "../communityClient";
import type {
  CommunityClient,
  CommunityMetadata,
  OwnedCommunityGarden,
  OwnedCommunityRevision,
} from "../core/community";
import type { LevelDefinition } from "../core/level";
import {
  submissionEvidence,
  type DraftOrigin,
  type PublicationBinding,
  type WinningFlight,
} from "../workshopState";
import GardenScene from "./GardenScene";
import CommunityModeration from "./CommunityModeration";

export interface WorkshopCommunityAccess {
  client: CommunityClient;
  /** Used only as an in-memory scope; never rendered or included in a level file. */
  accountKey: string;
  canSubmit: boolean;
  canReview?: boolean;
  identityControl?: ReactNode;
}

interface Props {
  access: WorkshopCommunityAccess;
  level: LevelDefinition;
  flights: WinningFlight[];
  origin: DraftOrigin | null;
  returnFocusRef: RefObject<HTMLButtonElement | null>;
  onBind: (level: LevelDefinition, binding: PublicationBinding) => void;
  onLoad: (revision: OwnedCommunityRevision) => void;
  onDeleted: (id: string) => void;
  onExport: () => void;
}

export default function WorkshopCommunity(props: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [restoreToEditor, setRestoreToEditor] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const reviewButton = useRef<HTMLButtonElement>(null);
  const [startReview, setStartReview] = useState(false);
  return (
    <>
      <Button
        ref={button}
        variant="secondary"
        onClick={() => {
          setRestoreToEditor(false);
          setStartReview(false);
          setOpen(true);
        }}
      >
        Share garden
      </Button>
      {props.access.canReview && (
        <Button
          ref={reviewButton}
          variant="secondary"
          onClick={() => {
            setRestoreToEditor(false);
            setStartReview(true);
            setOpen(true);
          }}
        >
          Review gardens
        </Button>
      )}
      <DialogShell
        open={open}
        onOpenChange={(next) => {
          if (!busy) setOpen(next);
        }}
        title="Community workshop"
        size="xl"
        className="ww-page ww-map-dialog ww-community-dialog"
        showClose={!busy}
        returnFocusRef={
          restoreToEditor
            ? props.returnFocusRef
            : startReview
              ? reviewButton
              : button
        }
      >
        {open &&
          (props.access.canSubmit ? (
            <PublishingPanel
              {...props}
              initialSection={startReview ? "review" : "share"}
              onBusy={setBusy}
              onClose={() => {
                setRestoreToEditor(true);
                setOpen(false);
              }}
            />
          ) : (
            <>
              <p>
                Current authorized team members can submit gardens for admin or
                coach review. You can build and test locally without signing in.
              </p>
              {props.access.identityControl}
            </>
          ))}
      </DialogShell>
    </>
  );
}

const DEFAULT_METADATA: CommunityMetadata = {
  nickname: "",
  difficulty: "gentle",
  estimatedLength: "short",
};
const REASONS = {
  text: "Title or instructions",
  identity: "Personal information or identity",
  unsafe: "Unsafe content",
  misleading: "Misleading description",
  other: "Another concern",
};
const message = (cause: unknown) =>
  cause instanceof Error
    ? cause.message
    : "This community request could not be completed.";

function PublishingPanel({
  access,
  level,
  flights,
  origin,
  onBind,
  onLoad,
  onDeleted,
  onExport,
  onBusy,
  onClose,
  initialSection,
}: Props & {
  onBusy: (busy: boolean) => void;
  onClose: () => void;
  initialSection: "share" | "review";
}) {
  const publication =
    origin?.publication?.accountKey === access.accountKey
      ? origin.publication
      : null;
  const [metadata, setMetadata] = useState(
    publication?.metadata ?? DEFAULT_METADATA,
  );
  const [tab, setTab] = useState<"share" | "mine" | "review">(initialSection);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [loadingRevision, setLoadingRevision] =
    useState<OwnedCommunityRevision | null>(null);
  const [deleting, setDeleting] = useState<OwnedCommunityGarden | null>(null);
  const alive = useRef(true);
  const locked = useRef(false);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const shareTab = useRef<HTMLButtonElement>(null);
  const mineTab = useRef<HTMLButtonElement>(null);
  const focusAfterRequest = useRef(false);
  useEffect(() => {
    if (!busy && focusAfterRequest.current) {
      focusAfterRequest.current = false;
      mineTab.current?.focus();
    }
  }, [busy]);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    if (loadingRevision || deleting) confirmationHeading.current?.focus();
  }, [loadingRevision, deleting]);
  const evidence = submissionEvidence(level, flights);

  async function perform<T>(
    action: () => Promise<T>,
    accept: (value: T) => void,
  ) {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    onBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await action();
      if (alive.current) accept(result);
    } catch (cause) {
      if (!alive.current) return;
      setError(message(cause));
      if (
        cause instanceof CommunityRequestError &&
        [401, 403, 409].includes(cause.status)
      ) {
        setLoadingRevision(null);
        setDeleting(null);
        setRefresh((value) => value + 1);
      }
    } finally {
      locked.current = false;
      if (alive.current) {
        setBusy(false);
        onBusy(false);
      }
    }
  }

  function openRevision(id: string, checkMissing = false) {
    void perform(
      async () => {
        try {
          return await access.client.getOwn(id);
        } catch (cause) {
          if (
            checkMissing &&
            publication?.version === 0 &&
            cause instanceof CommunityRequestError &&
            cause.status === 404
          )
            return null;
          throw cause;
        }
      },
      (revision) => {
        if (revision) setLoadingRevision(revision);
        else if (publication) {
          onBind(level, { ...publication, needsReload: false });
          setNotice(
            "No saved submission was found. You can retry this submission.",
          );
        }
      },
    );
  }

  function clearConfirmation() {
    setLoadingRevision(null);
    setDeleting(null);
  }
  function cancelConfirmation() {
    clearConfirmation();
    (tab === "mine" ? mineTab : shareTab).current?.focus();
  }

  return (
    <div className="ww-community">
      <div className="ww-toolbar" aria-label="Community workshop sections">
        <Button
          ref={shareTab}
          variant="secondary"
          disabled={busy}
          aria-pressed={tab === "share"}
          onClick={() => {
            clearConfirmation();
            setTab("share");
            setError("");
          }}
        >
          Share current garden
        </Button>
        <Button
          variant="secondary"
          disabled={busy}
          aria-pressed={tab === "mine"}
          ref={mineTab}
          onClick={() => {
            clearConfirmation();
            setTab("mine");
            setError("");
          }}
        >
          My submissions
        </Button>
        {access.canReview && (
          <Button
            variant="secondary"
            disabled={busy}
            aria-pressed={tab === "review"}
            onClick={() => {
              clearConfirmation();
              setTab("review");
              setError("");
              setNotice("");
            }}
          >
            Review gardens
          </Button>
        )}
      </div>
      {error && (
        <p className="ww-notice ww-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="ww-notice" role="status">
          {notice}
        </p>
      )}
      {busy && <p role="status">Working on your community request…</p>}
      {tab === "review" && access.canReview ? (
        <CommunityModeration
          client={access.client}
          onBusy={(value) => {
            setBusy(value);
            onBusy(value);
          }}
        />
      ) : loadingRevision ? (
        <>
          <h3 ref={confirmationHeading} tabIndex={-1}>
            Load {loadingRevision.level.title}?
          </h3>
          <p>
            This replaces the current draft with the saved community revision.
            Export your current draft first if you want a separate file. Undo
            can restore earlier content.
          </p>
          <div
            className="ww-community-preview"
            style={{
              maxWidth: `${(40 * loadingRevision.level.width) / loadingRevision.level.height}dvh`,
            }}
          >
            <GardenScene level={loadingRevision.level} overlays={false} />
          </div>
          <p>Saved status: {loadingRevision.garden.status}</p>
          <div className="ww-toolbar">
            <Button
              onClick={() => {
                onLoad(loadingRevision);
                onClose();
              }}
            >
              Load saved revision
            </Button>
            <Button variant="secondary" onClick={onExport}>
              Export current draft
            </Button>
            <Button variant="secondary" onClick={cancelConfirmation}>
              Keep current draft
            </Button>
          </div>
        </>
      ) : deleting ? (
        <>
          <h3 ref={confirmationHeading} tabIndex={-1}>
            Delete {deleting.title} from the community?
          </h3>
          <p>
            This removes your community copy. Approved remixes remain available.
            Your local draft is kept.
          </p>
          <div className="ww-toolbar">
            <Button
              variant="danger"
              disabled={busy}
              onClick={() =>
                void perform(
                  () => access.client.removeOwn(deleting.id, deleting.version),
                  (deleted) => {
                    onDeleted(deleted.id);
                    setDeleting(null);
                    setRefresh((value) => value + 1);
                    setNotice(
                      "Community garden deleted. Your local draft is kept.",
                    );
                    focusAfterRequest.current = true;
                  },
                )
              }
            >
              Delete community copy
            </Button>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={cancelConfirmation}
            >
              Keep garden
            </Button>
          </div>
        </>
      ) : tab === "mine" ? (
        <>
          <p>
            Up to twenty community gardens, with at most three awaiting review.
            Open a saved revision to edit it.
          </p>
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => setRefresh((value) => value + 1)}
          >
            Refresh submissions
          </Button>
          <OwnerLibrary
            client={access.client}
            refresh={refresh}
            busy={busy}
            onOpen={openRevision}
            onDelete={setDeleting}
          />
        </>
      ) : (
        <>
          <h3>{level.title}</h3>
          <p>
            Share your finished garden with the team. An admin or coach reviews
            it before it becomes public.
          </p>
          {evidence.ready ? (
            <p>
              Best flights: {evidence.bestRescued} rescued ·{" "}
              {evidence.bestPollen} pollen · {evidence.fewestTools} tools at
              best.
            </p>
          ) : (
            <ul>
              {evidence.missing.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
          <p>
            Changes need a new test flight. Recordings last until you leave the
            workshop.
          </p>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (level.rulesVersion >= 6) return;
              if (!evidence.ready || publication?.needsReload || busy) return;
              const clean = { ...metadata, nickname: metadata.nickname.trim() };
              if (!/^[^\p{Cc}\p{Cf}<>]{1,24}$/u.test(clean.nickname)) {
                setError(
                  "Choose a nickname of 1–24 characters without markup or control characters.",
                );
                return;
              }
              void perform(
                async () => {
                  const binding: PublicationBinding = {
                    id: publication?.id ?? crypto.randomUUID(),
                    version: publication?.version ?? 0,
                    accountKey: access.accountKey,
                    metadata: clean,
                    needsReload: true,
                  };
                  const body = {
                    expectedVersion: binding.version,
                    metadata: clean,
                    proof: { level, replays: evidence.replays },
                    ...(origin?.parent ? { parent: origin.parent } : {}),
                  };
                  if (
                    new TextEncoder().encode(JSON.stringify(body)).length >
                    768 * 1024
                  )
                    throw new Error(
                      "These recordings are too large to submit. Try a shorter successful test flight.",
                    );
                  onBind(level, binding);
                  try {
                    return {
                      binding,
                      saved: await access.client.submit(binding.id, body),
                    };
                  } catch (cause) {
                    if (
                      alive.current &&
                      cause instanceof CommunityRequestError &&
                      [400, 401, 403, 413, 415, 429].includes(cause.status)
                    )
                      onBind(level, { ...binding, needsReload: false });
                    throw cause;
                  }
                },
                ({ binding, saved }) => {
                  onBind(level, {
                    ...binding,
                    version: saved.version,
                    needsReload: false,
                  });
                  setNotice(
                    saved.publishedRevision === null
                      ? "Submitted for admin or coach review. It becomes public only after approval."
                      : "The new revision awaits review. Your previously approved revision stays available.",
                  );
                },
              );
            }}
          >
            <fieldset className="ww-community-filters" disabled={busy}>
              <legend className="sr-only">Public garden details</legend>
              <label>
                Public nickname
                <input
                  required
                  maxLength={24}
                  value={metadata.nickname}
                  autoComplete="off"
                  onChange={(event) =>
                    setMetadata({ ...metadata, nickname: event.target.value })
                  }
                />
              </label>
              <label>
                Estimated difficulty
                <select
                  value={metadata.difficulty}
                  onChange={(event) =>
                    setMetadata({
                      ...metadata,
                      difficulty: event.target
                        .value as CommunityMetadata["difficulty"],
                    })
                  }
                >
                  <option value="gentle">Gentle</option>
                  <option value="moderate">Moderate</option>
                  <option value="challenging">Challenging</option>
                </select>
              </label>
              <label>
                Estimated length
                <select
                  value={metadata.estimatedLength}
                  onChange={(event) =>
                    setMetadata({
                      ...metadata,
                      estimatedLength: event.target
                        .value as CommunityMetadata["estimatedLength"],
                    })
                  }
                >
                  <option value="short">Short</option>
                  <option value="medium">Medium</option>
                  <option value="long">Long</option>
                </select>
              </label>
            </fieldset>
            <p>Choose a nickname. Leave out names and contact details.</p>
            {publication?.needsReload && !busy && (
              <p role="alert">
                Check the saved revision before submitting again. The last
                change could not be confirmed.
              </p>
            )}
            <div className="ww-toolbar">
              <Button
                type="submit"
                disabled={
                  busy ||
                  level.rulesVersion >= 6 ||
                  !evidence.ready ||
                  publication?.needsReload
                }
              >
                Submit for review
              </Button>
              {level.rulesVersion >= 6 && (
                <p>
                  Dancer gardens support local play and file sharing. Community
                  publishing for these gardens is not ready yet.
                </p>
              )}
              {publication && (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => openRevision(publication.id, true)}
                >
                  Check saved revision
                </Button>
              )}
            </div>
          </form>
        </>
      )}
    </div>
  );
}

function OwnerLibrary({
  client,
  refresh,
  busy,
  onOpen,
  onDelete,
}: {
  client: CommunityClient;
  refresh: number;
  busy: boolean;
  onOpen: (id: string) => void;
  onDelete: (row: OwnedCommunityGarden) => void;
}) {
  const [result, setResult] = useState<{
    key: number;
    rows: OwnedCommunityGarden[] | null;
    error: string;
  }>({ key: -1, rows: null, error: "" });
  useEffect(() => {
    let current = true;
    void client
      .mine()
      .then((rows) => {
        if (current) setResult({ key: refresh, rows, error: "" });
      })
      .catch((cause: unknown) => {
        if (current)
          setResult({ key: refresh, rows: null, error: message(cause) });
      });
    return () => {
      current = false;
    };
  }, [client, refresh]);
  if (result.key !== refresh)
    return <p role="status">Loading your submissions…</p>;
  if (result.error)
    return (
      <p role="alert" className="ww-error">
        {result.error}
      </p>
    );
  if (!result.rows?.length)
    return <p role="status">You have no community submissions yet.</p>;
  return (
    <ul className="ww-community-grid">
      {result.rows.map((row) => (
        <li className="ww-panel" key={row.id}>
          <h3>{row.title}</h3>
          <p>
            Status: {row.status}
            {row.reviewReason ? ` · ${REASONS[row.reviewReason]}` : ""}
          </p>
          <div className="ww-toolbar">
            <Button
              variant="secondary"
              disabled={
                busy || row.status === "removed" || row.status === "deleted"
              }
              onClick={() => onOpen(row.id)}
            >
              Open {row.title}
            </Button>
            <Button
              variant="danger"
              disabled={busy}
              onClick={() => onDelete(row)}
            >
              Delete {row.title}
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
