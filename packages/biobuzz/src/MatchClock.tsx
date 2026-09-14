import type { MatchMode, Phase } from "./core/types";
import { MATCH_TIME,nectarPlacementOpen } from "./core/timing";

function clock(seconds:number) {
  const whole=Math.max(0,Math.ceil(seconds));
  return `${Math.floor(whole/60)}:${String(whole%60).padStart(2,"0")}`;
}
export default function MatchClock({phase,tick=0,remaining=0,paused=false,compact=false,mode="combined"}:{phase:Phase|"waiting"|"loading";tick?:number;remaining?:number;paused?:boolean;compact?:boolean;mode?:MatchMode}) {
  const running=phase==="auto"||phase==="transition"||phase==="teleop";
  // A combined match has 150 seconds of play. The disabled transition has its
  // own period clock and does not consume the remaining TELEOP time.
  const teleopDuration=MATCH_TIME.end-MATCH_TIME.teleopStart;
  const countdown=mode==="combined"&&phase==="auto"?remaining+teleopDuration:mode==="combined"&&phase==="transition"?teleopDuration:remaining;
  const open=phase==="practice"||(phase==="teleop"&&nectarPlacementOpen(true,tick));
  const title=phase==="practice"?"Practice · nectar flowers open":open?"Final minute · nectar flowers open":running?"Nectar flowers locked":phase==="settling"?"Time expired · scoring is settling":phase==="finished"?"Match complete · final score":phase==="interrupted"?"Match interrupted":phase==="waiting"?"Waiting for the host to start":"Loading the field";
  const rules=<>{open&&<p>{phase==="practice"?"Nectar placement is unrestricted in untimed practice.":"Nectar may now enter flowers without the early-placement penalty. Remaining reserve nectar releases as loading zones clear."}</p>}
    {(running||phase==="practice")&&<p className="bio-help">Pollen can score in flowers throughout play. {mode==="auto"?"AUTO only: 0:30, then scoring settles.":mode==="teleop"?"TELEOP only: 2:00. Nectar flowers open for the final minute.":"Combined: 2:30 of play. AUTO 0:30 → transition 0:08 → TELEOP 2:00. The match countdown pauses during the transition."}</p>}</>;
  return <div className={`bio-match-clock${open?" bio-nectar-open":""}${compact?" bio-clock-compact":""}`}>
    <p className="bio-timer" role="timer" aria-label="Match timer" data-testid="match-clock"><span>{phase.toUpperCase()}{paused?" · PAUSED":""}</span><strong data-testid="match-time">{phase==="practice"?"UNTIMED":clock(running?countdown:0)}</strong><span>{phase==="practice"?"no time limit":running?mode==="combined"?"match remaining":"remaining":""}</span>{mode==="combined"&&(phase==="auto"||phase==="transition")&&<span data-testid="period-clock">{phase==="auto"?"AUTO":"Transition"} {clock(remaining)}{phase==="transition"?" · match countdown paused":""}</span>}</p>
    <p role="status" data-testid="nectar-window" className="bio-rule-title">{title}</p>
    {running&&!open&&<p data-testid="nectar-countdown">{mode==="auto"?"Nectar placement stays locked throughout AUTO.":<>Nectar placement unlocks in <strong>{clock(MATCH_TIME.nectarStart-tick/60)}</strong>, at TELEOP 1:00.</>} Early nectar still scores, with a 20-point penalty to the opponent.</p>}
    {compact?<details><summary>Timing and scoring rules</summary>{rules}</details>:rules}
  </div>;
}
