import SEO from "@/components/SEO";
import Game from "@ares/buzzle/game";
import * as online from "@/lib/buzzleOnline";
import { GamePrintablesLink } from "@/components/games/GamePrintablesLink";

export default function BuzzlePage() {
  return <><SEO
        title="BUZZLE™ Hexagonal Word Game"
        description="Play BUZZLE, a three-axis hexagonal word game from ARES 23247."
        url="/buzzle"
      /><Game online={online} physicalGameLink={<GamePrintablesLink game="BUZZLE" />} /></>;
}
