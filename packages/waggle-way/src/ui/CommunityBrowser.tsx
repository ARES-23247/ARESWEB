import { useEffect, useRef, useState } from "react";
import { Button } from "@ares/ui/button";
import { CommunityRequestError } from "../communityClient";
import type {
  CommunityClient,
  CommunityFilters,
  CommunityGarden,
  CommunityPage,
  CommunityParent,
  CommunityReviewReason,
} from "../core/community";
import type { ObjectKind } from "../core/level";
import GardenScene, { OBJECT_LABELS, PieceIcon } from "./GardenScene";

const reasonLabels: Record<CommunityReviewReason, string> = {
  text: "Inappropriate title or instructions",
  identity: "Personal information or impersonation",
  unsafe: "Unsafe content",
  misleading: "Misleading description or difficulty",
  other: "Another concern",
};

export default function CommunityBrowser({
  client,
  onPlay,
  onRemix,
}: {
  client: CommunityClient;
  onPlay: (garden: CommunityGarden) => void;
  onRemix?: (source: CommunityParent) => void;
}) {
  const [filters, setFilters] = useState<CommunityFilters>({});
  const [refresh, setRefresh] = useState(0);
  const [page, setPage] = useState<CommunityPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState("");
  const [garden, setGarden] = useState<CommunityGarden | null>(null);
  const requestId = useRef(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const lastCard = useRef("");
  const cardButton = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    let current = true;
    void client
      .browse(filters)
      .then((next) => {
        if (!current) return;
        setPage(next);
        setLoading(false);
      })
      .catch((cause: unknown) => {
        if (!current) return;
        setError(
          cause instanceof Error
            ? cause.message
            : "Community gardens could not be loaded.",
        );
        setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [client, filters, refresh]);

  useEffect(
    () => () => {
      requestId.current++;
    },
    [],
  );
  useEffect(() => {
    if (garden) heading.current?.focus();
    else cardButton.current?.focus();
  }, [garden]);

  function browse(next: CommunityFilters) {
    setLoading(true);
    setPage(null);
    setError("");
    setFilters(next);
    setRefresh((value) => value + 1);
  }

  async function open(id: string) {
    const token = ++requestId.current;
    setOpening(true);
    setError("");
    try {
      const next = await client.get(id);
      if (requestId.current === token) setGarden(next);
    } catch (cause) {
      if (requestId.current === token) {
        if (cause instanceof CommunityRequestError && cause.status === 404) {
          setGarden((current) => {
            if (current?.parent?.id !== id) return current;
            const next = { ...current };
            delete next.parent;
            return next;
          });
        }
        setError(
          cause instanceof Error
            ? cause.message
            : "This garden could not be opened.",
        );
      }
    } finally {
      if (requestId.current === token) setOpening(false);
    }
  }

  return (
    <div className="ww-community">
      {error && (
        <p role="alert" className="ww-notice ww-error">
          {error}
        </p>
      )}
      {garden ? (
        <>
          <div className="ww-toolbar">
            <Button
              variant="secondary"
              disabled={opening}
              onClick={() => {
                setGarden(null);
                setError("");
              }}
            >
              Back to gardens
            </Button>
            <Button disabled={opening} onClick={() => onPlay(garden)}>
              Play this garden
            </Button>
            {onRemix && (
              <Button
                variant="secondary"
                disabled={opening}
                onClick={() =>
                  onRemix({ id: garden.id, revision: garden.revision })
                }
              >
                Remix in workshop
              </Button>
            )}
          </div>
          <h3 ref={heading} tabIndex={-1}>
            {garden.title}
          </h3>
          <p>
            By {garden.nickname} · {garden.difficulty} ·{" "}
            {garden.estimatedLength} · Rescue {garden.rescueTarget} of{" "}
            {garden.population} bees
          </p>
          <div
            className="ww-community-preview"
            style={{
              maxWidth: `${(40 * garden.level.width) / garden.level.height}dvh`,
            }}
          >
            <GardenScene level={garden.level} overlays={false} />
          </div>
          <p className="ww-community-instructions">
            {garden.level.instructions}
          </p>
          {garden.parent && (
            <p>
              Remixed from{" "}
              <button
                type="button"
                className="ww-community-parent"
                disabled={opening}
                onClick={() => void open(garden.parent!.id)}
              >
                {garden.parent.title} by {garden.parent.nickname}
              </button>
            </p>
          )}
          {opening && <p role="status">Opening garden…</p>}
          <ReportGarden
            key={`${garden.id}:${garden.revision}`}
            client={client}
            id={garden.id}
          />
        </>
      ) : (
        <>
          <p>
            Gardens made by team members and approved by an admin or coach.
            Difficulty and length are creator estimates.
          </p>
          <fieldset
            className="ww-community-filters"
            disabled={loading || opening}
          >
            <legend className="sr-only">Find a garden</legend>
            <label>
              Difficulty
              <select
                value={filters.difficulty ?? ""}
                onChange={(event) =>
                  browse({
                    ...filters,
                    cursor: undefined,
                    difficulty:
                      (event.target.value as CommunityFilters["difficulty"]) ||
                      undefined,
                  })
                }
              >
                <option value="">Any difficulty</option>
                <option value="gentle">Gentle</option>
                <option value="moderate">Moderate</option>
                <option value="challenging">Challenging</option>
              </select>
            </label>
            <label>
              Length
              <select
                value={filters.estimatedLength ?? ""}
                onChange={(event) =>
                  browse({
                    ...filters,
                    cursor: undefined,
                    estimatedLength:
                      (event.target
                        .value as CommunityFilters["estimatedLength"]) ||
                      undefined,
                  })
                }
              >
                <option value="">Any length</option>
                <option value="short">Short</option>
                <option value="medium">Medium</option>
                <option value="long">Long</option>
              </select>
            </label>
            <label>
              Garden feature
              <select
                value={filters.mechanic ?? ""}
                onChange={(event) =>
                  browse({
                    ...filters,
                    cursor: undefined,
                    mechanic: (event.target.value as ObjectKind) || undefined,
                  })
                }
              >
                <option value="">Any feature</option>
                {Object.entries(OBJECT_LABELS)
                  .filter(([kind]) => !["hive", "flowers"].includes(kind))
                  .map(([kind, label]) => (
                    <option key={kind} value={kind}>
                      {label}
                    </option>
                  ))}
              </select>
            </label>
          </fieldset>
          {loading ? (
            <p role="status">Loading gardens…</p>
          ) : (
            <>
              {page && (
                <p role="status">
                  {page.gardens.length
                    ? `${page.gardens.length} gardens on this page.`
                    : "No approved gardens match yet. Try another filter or come back later."}
                </p>
              )}
              <ul className="ww-community-grid">
                {page?.gardens.map((entry) => (
                  <li key={entry.id}>
                    <button
                      ref={(node) => {
                        if (entry.id === lastCard.current)
                          cardButton.current = node;
                      }}
                      type="button"
                      className={`ww-community-card ww-community-${entry.theme}`}
                      disabled={opening}
                      onClick={() => {
                        lastCard.current = entry.id;
                        void open(entry.id);
                      }}
                    >
                      <span
                        className="ww-community-card-art"
                        aria-hidden="true"
                      >
                        <PieceIcon kind="flowers" />
                      </span>
                      <strong>{entry.title}</strong>
                      <span>By {entry.nickname}</span>
                      <small>
                        {entry.difficulty} · {entry.estimatedLength}
                      </small>
                      <small>
                        Rescue {entry.rescueTarget} of {entry.population} bees
                      </small>
                      <span className="ww-community-features">
                        {entry.mechanics
                          .filter((kind) => !["hive", "flowers"].includes(kind))
                          .map((kind) => OBJECT_LABELS[kind])
                          .join(" · ")}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
          {opening && <p role="status">Opening garden…</p>}
          <div className="ww-toolbar">
            <Button
              variant="secondary"
              disabled={loading || opening}
              onClick={() => browse({ ...filters, cursor: undefined })}
            >
              {filters.cursor ? "First page" : "Refresh gardens"}
            </Button>
            {page?.nextCursor && (
              <Button
                disabled={loading || opening}
                onClick={() => browse({ ...filters, cursor: page.nextCursor! })}
              >
                More gardens
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function ReportGarden({ client, id }: { client: CommunityClient; id: string }) {
  const [reason, setReason] = useState<CommunityReviewReason>("text");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  return (
    <details className="ww-community-report">
      <summary>Report a concern</summary>
      {sent ? (
        <p role="status">Report received for admin or coach review.</p>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (pending) return;
            setPending(true);
            setError("");
            void client
              .report(id, reason)
              .then(() => {
                if (alive.current) setSent(true);
              })
              .catch((cause: unknown) => {
                if (alive.current)
                  setError(
                    cause instanceof Error
                      ? cause.message
                      : "The report could not be confirmed. Please try again later.",
                  );
              })
              .finally(() => {
                if (alive.current) setPending(false);
              });
          }}
        >
          <p>
            Choose the concern that best fits. Do not include personal
            information.
          </p>
          <label>
            Concern
            <select
              value={reason}
              disabled={pending}
              onChange={(event) =>
                setReason(event.target.value as CommunityReviewReason)
              }
            >
              {Object.entries(reasonLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit" disabled={pending}>
            {pending ? "Sending report…" : "Send report"}
          </Button>
          {error && (
            <p role="alert" className="ww-error">
              {error}
            </p>
          )}
        </form>
      )}
    </details>
  );
}
