import {
  ClipboardCheck,
  Image,
  Landmark,
  UsersRound,
  Wrench,
} from "lucide-react";
import sourceRequestRegister from "../../../content/learning/curriculum-source-requests.json";

const blockerLabels = {
  "approved-team-artifact": "Team media or artifact",
  "current-official-reference": "Current official source",
  "current-product-screenshot": "Current product screenshot",
  "current-season-release": "Current season release",
  "physical-student-evidence": "Physical student evidence",
  "team-process-review": "Team process review",
} as const;

type Blocker = keyof typeof blockerLabels;

interface EvidenceRequest {
  lessonId: string;
  need: string;
  acceptance: string;
  review: {
    evidenceState: "missing" | "partial";
    remainingBlockers: string[];
  };
}

const requests = sourceRequestRegister.requests as EvidenceRequest[];

function requestCount(blocker: Blocker) {
  return requests.filter((request) =>
    request.review.remainingBlockers.includes(blocker),
  ).length;
}

const summaryCards = [
  {
    label: "Team artifacts",
    count: requestCount("approved-team-artifact"),
    icon: Image,
  },
  {
    label: "Official sources",
    count: requests.filter((request) =>
      request.review.remainingBlockers.some(
        (blocker) =>
          blocker === "current-official-reference" ||
          blocker === "current-season-release",
      ),
    ).length,
    icon: Landmark,
  },
  {
    label: "Team reviews",
    count: requestCount("team-process-review"),
    icon: UsersRound,
  },
  {
    label: "Physical evidence",
    count: requestCount("physical-student-evidence"),
    icon: Wrench,
  },
];

function lessonLabel(lessonId: string) {
  return lessonId
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export default function CurriculumEvidenceRequestsPanel() {
  const partialCount = requests.filter(
    (request) => request.review.evidenceState === "partial",
  ).length;

  return (
    <section
      aria-labelledby="curriculum-evidence-heading"
      className="glass-card border border-ares-gold/30 bg-ares-gold/5 p-5 sm:p-6"
    >
      <div className="flex items-start gap-3">
        <ClipboardCheck
          aria-hidden="true"
          className="mt-0.5 shrink-0 text-ares-gold"
          size={22}
        />
        <div className="min-w-0">
          <h2
            id="curriculum-evidence-heading"
            className="font-heading text-lg font-black uppercase tracking-tight text-white"
          >
            Curriculum evidence needed
          </h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-marble/75">
            These lessons need real team artifacts, current official sources, or
            team review. Keep the gap visible until the listed acceptance check
            is met; do not replace it with sample data.
          </p>
        </div>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {summaryCards.map(({ label, count, icon: Icon }) => (
          <div
            key={label}
            className="rounded border border-white/10 bg-black/20 p-3"
          >
            <dt className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-marble/65">
              <Icon
                aria-hidden="true"
                size={15}
                className="shrink-0 text-ares-gold"
              />
              {label}
            </dt>
            <dd className="mt-2 font-mono text-xl font-bold text-white">
              {count}
            </dd>
          </div>
        ))}
      </dl>

      <details className="mt-5 rounded border border-white/10 bg-black/20">
        <summary className="min-h-11 cursor-pointer px-4 py-3 text-sm font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ares-cyan">
          Review all {requests.length} open requests ({partialCount} partially
          supported)
        </summary>
        <ul className="divide-y divide-white/10 border-t border-white/10">
          {requests.map((request) => (
            <li key={request.lessonId} className="p-4 sm:p-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <h3 className="font-bold text-white">
                    {lessonLabel(request.lessonId)}
                  </h3>
                  <p className="mt-1 text-sm text-marble/75">{request.need}</p>
                </div>
                <span className="w-fit shrink-0 rounded border border-ares-gold/30 bg-ares-gold/10 px-2 py-1 text-[11px] font-black uppercase tracking-wide text-ares-gold">
                  {request.review.evidenceState === "partial"
                    ? "Partial evidence"
                    : "Evidence missing"}
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-marble/65">
                <span className="font-bold text-marble/85">Ready when: </span>
                {request.acceptance}
              </p>
              <ul
                aria-label="Remaining blockers"
                className="mt-3 flex flex-wrap gap-2"
              >
                {request.review.remainingBlockers.map((blocker) => (
                  <li
                    key={blocker}
                    className="rounded border border-white/10 bg-white/5 px-2 py-1 text-xs text-marble/70"
                  >
                    {blockerLabels[blocker as Blocker] ?? blocker}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
