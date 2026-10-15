import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ChevronDown,
  ChevronUp,
  Code2,
  Compass,
  Cpu,
  Sparkles,
  Wrench,
} from "lucide-react";
import type { PublicDocument } from "@/lib/publicContentApi";
import type { LearningPathId } from "@/lib/learningContent";

export type RookieDocumentItem = Pick<
  PublicDocument,
  "slug" | "title" | "level" | "pathMemberships"
>;

interface AcademyRookieBannerProps {
  documents: RookieDocumentItem[];
}

interface RookieTrackOption {
  id: string;
  title: string;
  roleLabel: string;
  ctaLabel: string;
  description: string;
  preferredPaths: LearningPathId[];
  fallbackHref: string;
  icon: typeof Code2;
}

const ROOKIE_TRACK_OPTIONS: RookieTrackOption[] = [
  {
    id: "programming",
    title: "Software & Robot Control",
    roleLabel: "New Programmers",
    ctaLabel: "Start Software Track",
    description:
      "Start with how robot software turns driver and autonomous intent into safe, predictable motion.",
    preferredPaths: ["robotics-foundations", "programming-with-ares", "ftc-robot-with-ares"],
    fallbackHref: "/academy?subject=robotics-engineering&level=beginner",
    icon: Code2,
  },
  {
    id: "hardware",
    title: "Mechanical, CAD & Wiring",
    roleLabel: "New Builders",
    ctaLabel: "Start Hardware Track",
    description:
      "Learn measurement, safe tool use, drivetrains, mechanisms, and robot electrical power systems.",
    preferredPaths: ["mechanical-design-fabrication", "electrical-systems-diagnostics"],
    fallbackHref: "/academy?subject=robotics-engineering&level=beginner",
    icon: Wrench,
  },
  {
    id: "stem-operations",
    title: "Math, AI & Team Operations",
    roleLabel: "All New Members",
    ctaLabel: "Start STEM & Ops Track",
    description:
      "Explore beginner-friendly math for robotics, machine vision fundamentals, and competition pit/drive workflows.",
    preferredPaths: ["math-for-robotics", "ai-ml-foundations", "competition-operations"],
    fallbackHref: "/academy?level=beginner",
    icon: Cpu,
  },
];

function findFirstPathLesson(
  documents: RookieDocumentItem[],
  preferredPaths: LearningPathId[],
): { doc: RookieDocumentItem; pathId: LearningPathId } | null {
  for (const pathId of preferredPaths) {
    const matches = documents
      .map((doc) => {
        const membership = doc.pathMemberships.find((m) => m.pathId === pathId);
        return membership ? { doc, order: membership.order } : null;
      })
      .filter((entry): entry is { doc: RookieDocumentItem; order: number } => entry !== null)
      .sort((a, b) => a.order - b.order);
    if (matches.length > 0) {
      return { doc: matches[0].doc, pathId };
    }
  }
  return null;
}

export default function AcademyRookieBanner({
  documents,
}: AcademyRookieBannerProps) {
  const [expanded, setExpanded] = useState(true);

  const trackCards = useMemo(() => {
    return ROOKIE_TRACK_OPTIONS.map((option) => {
      const match = findFirstPathLesson(documents, option.preferredPaths);
      const href = match
        ? `/academy/${match.doc.slug}?path=${match.pathId}`
        : option.fallbackHref;
      return {
        ...option,
        href,
      };
    });
  }, [documents]);

  return (
    <section
      aria-labelledby="academy-rookie-banner-heading"
      className="mb-8 rounded-xl border border-ares-gold/30 bg-black/35 p-4 sm:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-ares-gold/40 bg-ares-gold/15 text-ares-gold">
            <Compass size={20} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-widest text-ares-gold">
              First-Time Visitor Guide
            </p>
            <h2
              id="academy-rookie-banner-heading"
              className="font-heading text-lg font-black uppercase tracking-tight text-white"
            >
              New to Robotics? Start Here
            </h2>
            <p className="mt-0.5 text-xs text-marble/75">
              Not sure which track to pick first? Choose the area that matches your interest to jump straight into a beginner-friendly lesson.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/academy?level=beginner"
            className="inline-flex items-center gap-1.5 rounded-lg border border-ares-cyan/40 bg-ares-cyan/10 px-3 py-2 text-xs font-bold uppercase tracking-wider text-ares-cyan transition-colors hover:bg-ares-cyan hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-gold"
          >
            <Sparkles size={13} aria-hidden="true" />
            Beginner Filter
          </Link>
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            aria-expanded={expanded}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-bold uppercase tracking-wider text-marble/80 transition-colors hover:border-white/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan cursor-pointer"
          >
            {expanded ? (
              <>
                Hide tracks <ChevronUp size={14} aria-hidden="true" />
              </>
            ) : (
              <>
                Show tracks <ChevronDown size={14} aria-hidden="true" />
              </>
            )}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-5 grid grid-cols-1 gap-4 border-t border-white/10 pt-5 md:grid-cols-3">
          {trackCards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.id}
                className="flex min-w-0 flex-col justify-between rounded-xl border border-white/10 bg-black/30 p-4 transition-colors hover:border-ares-gold/35"
              >
                <div>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="rounded border border-ares-gold/30 bg-ares-gold/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-ares-gold">
                      {card.roleLabel}
                    </span>
                    <Icon size={16} className="text-ares-cyan" aria-hidden="true" />
                  </div>
                  <h3 className="font-heading text-sm font-bold text-white">
                    {card.title}
                  </h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-marble/70">
                    {card.description}
                  </p>
                </div>
                <Link
                  to={card.href}
                  className="mt-4 inline-flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-white transition-colors hover:border-ares-gold hover:bg-ares-gold hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
                >
                  <span className="truncate">{card.ctaLabel}</span>
                  <span aria-hidden="true">&rarr;</span>
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
