import { useEffect, useRef, useState } from "react";
import { Button } from "@ares/ui/button";
import { CommunityRequestError } from "../communityClient";
import type {
  CommunityClient,
  CommunityGarden,
  CommunityReport,
  CommunityReportPage,
  CommunityReview,
  CommunityReviewReason,
  OwnedCommunityGarden,
} from "../core/community";
import GardenScene from "./GardenScene";
import GameSession from "./GameSession";

const REASONS: Record<CommunityReviewReason, string> = {
  text: "Title or instructions",
  identity: "Personal information or identity",
  unsafe: "Unsafe content",
  misleading: "Misleading description",
  other: "Another concern",
};
type Queue =
  | {
      kind: "review";
      gardens: OwnedCommunityGarden[];
      nextCursor: string | null;
    }
  | ({ kind: "reports" } & CommunityReportPage);
type ReportDetail = { report: CommunityReport; garden: CommunityGarden | null };

/** The host scopes this panel to the current account/role. Every action is server-authorized. */
export default function CommunityModeration({
  client,
  onBusy,
}: {
  client: CommunityClient;
  onBusy: (busy: boolean) => void;
}) {
  const [tab, setTab] = useState<"review" | "reports">("review");
  const [cursor, setCursor] = useState<string>();
  const [refresh, setRefresh] = useState(0);
  const key = JSON.stringify([tab, cursor, refresh]);
  const [result, setResult] = useState<{
    key: string;
    page: Queue | null;
    error: string;
  } | null>(null);
  const [candidate, setCandidate] = useState<CommunityReview | null>(null);
  const [report, setReport] = useState<ReportDetail | null>(null);
  const [testing, setTesting] = useState(false);
  const [confirmRemoval, setConfirmRemoval] = useState(false);
  const [checked, setChecked] = useState(false);
  const [reason, setReason] = useState<CommunityReviewReason | "">("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const alive = useRef(true);
  const locked = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    let current = true;
    const request =
      tab === "review"
        ? client
            .pending(cursor)
            .then((page) => ({ ...page, kind: "review" as const }))
        : client
            .reports(cursor)
            .then((page) => ({ ...page, kind: "reports" as const }));
    void request
      .then((page) => {
        if (current) setResult({ key, page, error: "" });
      })
      .catch((cause: unknown) => {
        if (current)
          setResult({
            key,
            page: null,
            error:
              cause instanceof Error
                ? cause.message
                : "This queue could not be loaded.",
          });
      });
    return () => {
      current = false;
    };
  }, [client, cursor, tab, key]);
  useEffect(() => {
    heading.current?.focus();
  }, [candidate, report, testing, confirmRemoval, tab]);

  function clearDetail() {
    setCandidate(null);
    setReport(null);
    setTesting(false);
    setConfirmRemoval(false);
    setChecked(false);
    setReason("");
  }
  function reload(message = "") {
    clearDetail();
    setCursor(undefined);
    setRefresh((value) => value + 1);
    setNotice(message);
  }
  async function perform<T>(
    action: () => Promise<T>,
    accept: (value: T) => void,
    mutation = false,
  ) {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    onBusy(true);
    setError("");
    setNotice("");
    try {
      const value = await action();
      if (alive.current) accept(value);
    } catch (cause) {
      if (!alive.current) return;
      if (
        mutation ||
        (cause instanceof CommunityRequestError &&
          [401, 403, 404, 409].includes(cause.status))
      )
        reload();
      setError(
        cause instanceof Error
          ? cause.message
          : "This review action could not be completed.",
      );
    } finally {
      locked.current = false;
      if (alive.current) {
        setBusy(false);
        onBusy(false);
      }
    }
  }
  function openCandidate(id: string) {
    void perform(
      async () => {
        const review = await client.review(id);
        if (
          review.garden.id !== id ||
          review.candidate.id !== id ||
          review.garden.candidateRevision !== review.candidate.revision
        )
          throw new Error(
            "This review changed. Reload the queue before continuing.",
          );
        return review;
      },
      (value) => {
        clearDetail();
        setCandidate(value);
      },
    );
  }
  function openReport(item: CommunityReport) {
    void perform(
      async () => {
        if (!item.publication) return null;
        try {
          const garden = await client.get(item.levelId);
          return garden.id === item.levelId && garden.revision === item.revision
            ? garden
            : null;
        } catch (cause) {
          if (cause instanceof CommunityRequestError && cause.status === 404)
            return null;
          throw cause;
        }
      },
      (garden) => {
        clearDetail();
        setReason(item.reason);
        setReport({ report: item, garden });
      },
    );
  }
  const page = result?.key === key ? result.page : null;
  const queueError = result?.key === key ? result.error : "";
  const loading = result?.key !== key;
  const details = candidate || report;
  return (
    <div className="ww-community">
      <div className="ww-toolbar">
        <Button
          variant="secondary"
          disabled={busy}
          aria-pressed={tab === "review"}
          onClick={() => {
            clearDetail();
            setTab("review");
            setCursor(undefined);
            setError("");
            setNotice("");
          }}
        >
          Awaiting review
        </Button>
        <Button
          variant="secondary"
          disabled={busy}
          aria-pressed={tab === "reports"}
          onClick={() => {
            clearDetail();
            setTab("reports");
            setCursor(undefined);
            setError("");
            setNotice("");
          }}
        >
          Reported gardens
        </Button>
        {details && (
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => {
              clearDetail();
              setError("");
            }}
          >
            Back to queue
          </Button>
        )}
      </div>
      {error && (
        <p className="ww-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="ww-notice" role="status">
          {notice}
        </p>
      )}
      {busy && <p role="status">Working on the review…</p>}
      {candidate ? (
        testing ? (
          <GameSession
            embedded
            exitLabel="Return to review"
            level={candidate.candidate.level}
            titleRef={heading}
            onExit={() => setTesting(false)}
          />
        ) : (
          <>
            <h3 ref={heading} tabIndex={-1}>
              {candidate.candidate.title}
            </h3>
            <p>
              By {candidate.candidate.nickname} · Revision{" "}
              {candidate.candidate.revision}
            </p>
            <p>
              Creator estimates: {candidate.candidate.difficulty} ·{" "}
              {candidate.candidate.estimatedLength}
            </p>
            <div
              className="ww-community-preview"
              style={{
                maxWidth: `${(40 * candidate.candidate.level.width) / candidate.candidate.level.height}dvh`,
              }}
            >
              <GardenScene level={candidate.candidate.level} overlays={false} />
            </div>
            <p>{candidate.candidate.level.instructions}</p>
            <p>
              {candidate.allBeesProven
                ? "All bees rescued in verified flights."
                : "The rescue target was met in verified flights."}{" "}
              Best pollen: {candidate.bestPollen}. Fewest tools:{" "}
              {candidate.fewestTools}.
            </p>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => setTesting(true)}
            >
              Test candidate
            </Button>
            <label className="ww-review-check">
              <input
                type="checkbox"
                checked={checked}
                disabled={busy}
                onChange={(event) => setChecked(event.target.checked)}
              />{" "}
              I checked the title, instructions, nickname and gameplay.
            </label>
            <ReasonSelect
              value={reason}
              onChange={setReason}
              disabled={busy}
              label="Rejection reason"
            />
            <div className="ww-toolbar">
              <Button
                disabled={busy || !checked}
                onClick={() =>
                  void perform(
                    () =>
                      client.decide(
                        candidate.garden.id,
                        candidate.garden.version,
                        candidate.reviewDigest,
                        "approve",
                      ),
                    () => reload("Garden approved and published."),
                    true,
                  )
                }
              >
                Approve and publish
              </Button>
              <Button
                variant="danger"
                disabled={busy || !reason}
                onClick={() => {
                  if (reason)
                    void perform(
                      () =>
                        client.decide(
                          candidate.garden.id,
                          candidate.garden.version,
                          candidate.reviewDigest,
                          "reject",
                          reason,
                        ),
                      () =>
                        reload(
                          "Revision rejected. Any earlier approved revision remains available.",
                        ),
                      true,
                    );
                }}
              >
                Reject revision
              </Button>
            </div>
          </>
        )
      ) : report ? (
        <>
          <h3 ref={heading} tabIndex={-1}>
            {confirmRemoval
              ? "Remove this published garden?"
              : "Reported garden"}
          </h3>
          <p>Concern: {REASONS[report.report.reason]}</p>
          {report.garden ? (
            <>
              <h4>
                {report.garden.title} · By {report.garden.nickname}
              </h4>
              <div
                className="ww-community-preview"
                style={{
                  maxWidth: `${(40 * report.garden.level.width) / report.garden.level.height}dvh`,
                }}
              >
                <GardenScene level={report.garden.level} overlays={false} />
              </div>
              <p>{report.garden.level.instructions}</p>
            </>
          ) : (
            <p>
              The reported publication is no longer available. You can resolve
              the report without removing another revision.
            </p>
          )}
          {confirmRemoval && report.garden && report.report.publication ? (
            <>
              <p>
                This removes the published garden. Approved remixes remain
                available. The report stays open until you resolve it.
              </p>
              <ReasonSelect
                value={reason}
                onChange={setReason}
                disabled={busy}
                label="Removal reason"
              />
              <div className="ww-toolbar">
                <Button
                  variant="danger"
                  disabled={busy || !reason}
                  onClick={() => {
                    if (reason)
                      void perform(
                        () =>
                          client.removePublished(
                            report.report.levelId,
                            report.report.publication!.version,
                            reason,
                          ),
                        () =>
                          reload(
                            "Garden removed. Its report remains open for resolution.",
                          ),
                        true,
                      );
                  }}
                >
                  Confirm removal
                </Button>
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={() => setConfirmRemoval(false)}
                >
                  Keep published
                </Button>
              </div>
            </>
          ) : (
            <>
              <p>
                Resolving a report closes this concern. It does not remove the
                garden.
              </p>
              <div className="ww-toolbar">
                <Button
                  disabled={busy}
                  onClick={() =>
                    void perform(
                      () => client.resolveReport(report.report.id),
                      () =>
                        reload("Report resolved. Publication was not changed."),
                      true,
                    )
                  }
                >
                  Resolve report
                </Button>
                {report.garden && report.report.publication && (
                  <Button
                    variant="danger"
                    disabled={busy}
                    onClick={() => setConfirmRemoval(true)}
                  >
                    Remove garden
                  </Button>
                )}
              </div>
            </>
          )}
        </>
      ) : (
        <>
          <h3 ref={heading} tabIndex={-1}>
            {tab === "review"
              ? "Gardens awaiting review"
              : "Reports awaiting attention"}
          </h3>
          <Button
            variant="secondary"
            disabled={busy || loading}
            onClick={() => {
              setError("");
              reload();
            }}
          >
            Refresh queue
          </Button>
          {loading && <p role="status">Loading queue…</p>}
          {queueError && (
            <p className="ww-error" role="alert">
              {queueError}
            </p>
          )}
          {page?.kind === "review" &&
            (page.gardens.length ? (
              <ul className="ww-community-grid">
                {page.gardens.map((item) => (
                  <li className="ww-panel" key={item.id}>
                    <h4>{item.title}</h4>
                    <Button
                      variant="secondary"
                      disabled={busy}
                      onClick={() => openCandidate(item.id)}
                    >
                      Review {item.title}
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p role="status">No gardens are awaiting review.</p>
            ))}
          {page?.kind === "reports" &&
            (page.reports.length ? (
              <ul className="ww-community-grid">
                {page.reports.map((item) => (
                  <li className="ww-panel" key={item.id}>
                    <h4>
                      {item.publication?.card.title ??
                        "Unavailable publication"}
                    </h4>
                    <p>{REASONS[item.reason]}</p>
                    <Button
                      variant="secondary"
                      disabled={busy}
                      onClick={() => openReport(item)}
                    >
                      Inspect report for{" "}
                      {item.publication?.card.title ??
                        "unavailable publication"}
                      : {REASONS[item.reason]}
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p role="status">No reports are awaiting attention.</p>
            ))}
          <div className="ww-toolbar">
            {cursor && (
              <Button
                variant="secondary"
                disabled={busy || loading}
                onClick={() => setCursor(undefined)}
              >
                First page
              </Button>
            )}
            {page?.nextCursor && (
              <Button
                variant="secondary"
                disabled={busy || loading}
                onClick={() => setCursor(page.nextCursor!)}
              >
                More items
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function ReasonSelect({
  value,
  onChange,
  disabled,
  label,
}: {
  value: CommunityReviewReason | "";
  onChange: (reason: CommunityReviewReason | "") => void;
  disabled: boolean;
  label: string;
}) {
  return (
    <label className="ww-review-reason">
      {label}
      <select
        value={value}
        disabled={disabled}
        onChange={(event) =>
          onChange(event.target.value as CommunityReviewReason | "")
        }
      >
        <option value="">Choose a reason</option>
        {Object.entries(REASONS).map(([key, text]) => (
          <option value={key} key={key}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
}
