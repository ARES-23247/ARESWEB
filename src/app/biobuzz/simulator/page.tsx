import Game from "@ares/biobuzz/game";
import SEO from "@/components/SEO";
import { biobuzzOnline } from "@/lib/biobuzzOnline";
export default function BiobuzzSimulatorPage(){return <><SEO title="BIOBUZZ Simulator" description="Drive a BIOBUZZ robot, practice with bots, play 2v2 matches, and build autos for ARES Studio." url="/biobuzz/simulator"/><Game online={biobuzzOnline}/></>;}
