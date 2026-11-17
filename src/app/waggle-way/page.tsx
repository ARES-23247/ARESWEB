import { Link, useNavigate } from "react-router-dom";
import SEO from "@/components/SEO";
import Game from "@ares/waggle-way/game";
import { waggleCommunity } from "@/lib/waggleCommunity";
export default function WaggleWayPage({ openCommunity = false }: { openCommunity?: boolean }) {
  const navigate = useNavigate();
  return (
    <>
      <SEO
        title={openCommunity ? "Waggle Way · Community gardens" : "Waggle Way · Story gardens"}
        description={openCommunity
          ? "Browse and play verified puzzles shared by the Waggle Way community."
          : "Guide a hive through thirty puzzles with dances, fans and shelter leaves, or build your own local level."}
        noindex
      />
      <Game
        key={openCommunity ? "community" : "campaign"}
        community={waggleCommunity}
        openCommunity={openCommunity}
        onRemix={({ id, revision }) =>
          navigate(
            `/waggle-way/builder?${new URLSearchParams({ remix: id, revision: String(revision) })}`,
          )
        }
        workshopLink={
          <nav aria-label="Game navigation" className="ww-toolbar">
            <Link to="/arcade">← Arcade</Link>
            <Link to="/waggle-way/builder">Workshop</Link>
            <Link to={openCommunity ? "/waggle-way" : "/waggle-way/community"}>
              {openCommunity ? "Story gardens" : "Community"}
            </Link>
          </nav>
        }
      />
    </>
  );
}
