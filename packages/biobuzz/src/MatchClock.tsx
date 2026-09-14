import type { Phase } from "./core/types";
import { MATCH_TIME,nectarPlacementOpen } from "./core/timing";

function clock(seconds:number) {
  const whole=Math.max(0,Math.ceil(seconds));
  return `${Math.floor(whole/60)}:${String(whole%60).padStart(2,"0")}`;
}
export default function MatchClock({phase,tick=0,remaining=0,paused=false}:{phase:Phase|"waiting"|"loading";tick?:number;remaining?:number;paused?:boolean}) {
  const running=phase==="auto"||phase==="transition"||phase==="teleop";
  const open=phase==="practice"||(phase==="teleop"&&nectarPlacementOpen(true,tick));
  const title=phase==="practice"?"Practice · nectar flowers open":open?"Final minute · nectar flowers open":running?"Nectar flowers locked":phase==="settling"?"Time expired · scoring is settling":phase==="finished"?"Match complete · final score":phase==="interrupted"?"Match interrupted":phase==="waiting"?"Waiting for the host to start":"Loading the field";
  return <div className={`bio-match-clock${open?" bio-nectar-open":""}`}>
    <p className="bio-timer" role="timer" aria-label="Match timer" data-testid="match-clock"><span>{phase.toUpperCase()}{paused?" · PAUSED":""}</span><strong>{clock(phase==="practice"?tick/60:remaining)}</strong><span>{phase==="practice"?"elapsed · untimed":running?"remaining":""}</span></p>
    <p role="status" data-testid="nectar-window" className="bio-rule-title">{title}</p>
    {running&&!open&&<p data-testid="nectar-countdown">Nectar placement unlocks in <strong>{clock(MATCH_TIME.nectarStart-tick/60)}</strong>, at TELEOP 1:00. Early nectar still scores, with a 20-point penalty to the opponent.</p>}
    {open&&<p>{phase==="practice"?"Nectar placement is unrestricted in untimed practice.":"Nectar may now enter flowers without the early-placement penalty. Remaining reserve nectar releases as loading zones clear."}</p>}
    {(running||phase==="practice")&&<p className="bio-help">Pollen can score in flowers throughout play. Timed match: AUTO 0:30 → transition 0:08 → TELEOP 2:00.</p>}
  </div>;
}
