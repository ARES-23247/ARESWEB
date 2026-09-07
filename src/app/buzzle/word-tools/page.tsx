import SEO from "@/components/SEO";
import WordTools from "@ares/buzzle/word-tools";
import { GamePrintablesLink } from "@/components/games/GamePrintablesLink";
export default function BuzzleWordToolsPage() { return <><SEO title="BUZZLE Word Tools" description="Check legal BUZZLE words, browse the two-letter list, and look up meanings while playing the physical game." url="/buzzle/word-tools" /><WordTools physicalGameLink={<GamePrintablesLink game="BUZZLE" />} /></>; }
