import SEO from "@/components/SEO";
import Game from "@ares/buzzello/game";
import * as online from "@/lib/buzzelloOnline";

export default function BuzzelloPage() {
  return <><SEO
        title="BUZZELLO™"
        exactTitle
        url="/buzzello"
        description="Play BUZZELLO, a local, private online, or AI-powered six-axis hexagonal strategy game from ARES 23247."
      /><Game online={online} /></>;
}
