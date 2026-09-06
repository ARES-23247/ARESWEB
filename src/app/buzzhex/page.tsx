import { Link } from "react-router-dom";
import SEO from "@/components/SEO";
import Game from "@ares/buzzhex/game";

export default function BuzzhexPage() {
  return <>
    <SEO title="BUZZHEX · Connect the hive" description="Play 11 × 11 Hex with yellow and black Buzzello tiles. Connect your edges in a two-player game on one device." />
    <Game navigation={<><Link to="/arcade">ARES Arcade</Link><Link to="/buzzello">BUZZELLO</Link><Link to="/buzzle">BUZZLE</Link></>} />
  </>;
}
