import { Link, useNavigate } from "react-router-dom";
import SEO from "@/components/SEO";
import Game from "@ares/waggle-way/game";
import { waggleCommunity } from "@/lib/waggleCommunity";
export default function WaggleWayPage() {
  const navigate = useNavigate();
  return (
    <>
      <SEO
        title="Waggle Way · Story gardens"
        description="Guide a hive through thirty puzzles with dances, fans and shelter leaves, or build your own local level."
        noindex
      />
      <Game
        community={waggleCommunity}
        onRemix={({ id, revision }) =>
          navigate(
            `/waggle-way/builder?${new URLSearchParams({ remix: id, revision: String(revision) })}`,
          )
        }
        workshopLink={
          <nav aria-label="Game navigation" className="ww-toolbar">
            <Link to="/arcade">← Arcade</Link>
            <Link to="/waggle-way/builder">Workshop</Link>
          </nav>
        }
      />
    </>
  );
}
