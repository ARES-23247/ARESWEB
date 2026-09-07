import { Link } from "react-router-dom";
import { GamePrintablesLink } from "@/components/games/GamePrintablesLink";
import SEO from "@/components/SEO";
import Game from "@ares/buzzhex/game";

export default function BuzzhexPage() {
  return <>
    <SEO title="BUZZHEX · Connect the hive" description="Play 11 × 11 Hex with yellow and black Buzzello tiles. Connect your edges with a friend or an Easy, Medium, or Hard computer opponent." />
    <Game printables={<GamePrintablesLink game="BUZZHEX" />} navigation={<><Link to="/arcade">ARES Arcade</Link><Link to="/buzzello">BUZZELLO</Link><Link to="/buzzle">BUZZLE</Link></>} />
  </>;
}
